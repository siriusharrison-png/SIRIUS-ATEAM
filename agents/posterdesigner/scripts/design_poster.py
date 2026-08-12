#!/usr/bin/env python3
"""
design_poster.py — 海报设计师 Agent 主程序

把上传图片（input/）或纯主题，按 Minimal Zine Poster v0.1 风格
用 Gemini 图生图优化成一张纸感海报，输出到 output/。

用法：
    # 图生图：把一张照片优化成 zine 海报
    python scripts/design_poster.py --image input/photo.jpg --subject "海边的旧信箱"

    # 纯主题生成（无参考图）
    python scripts/design_poster.py --subject "雨后的旧车站" --text "still raining"

    # 只出 prompt 不出图（无 API Key 时可用，便于校对）
    python scripts/design_poster.py --subject "旧书" --dry-run

    # 批量：input/ 下所有图各出一张
    python scripts/design_poster.py --batch --subject "夏天的记忆"

环境变量（通过 OpenAI 兼容网关的 Images API 调用 gpt-image-2）：
    GATEWAY_API_KEY    网关 API Key（图生图必需，dry-run 除外）
    GATEWAY_BASE_URL   网关地址，如 https://apiproxy.paigod.work/v1
    POSTER_MODEL       可选，覆盖默认模型名（默认 gpt-image-2）
    POSTER_SIZE        可选，出图尺寸（默认 1024x1536 竖版，最接近 zine 3:5）

依赖：openai, pillow
"""

import argparse
import os
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

# 让脚本能 import 项目 lib（agents/lib）
AGENT_DIR = Path(__file__).resolve().parent.parent      # agents/posterdesigner
AGENTS_ROOT = AGENT_DIR.parent                           # agents/
REPO_ROOT = AGENTS_ROOT.parent                           # 仓库根
sys.path.insert(0, str(AGENTS_ROOT))

from prompt_compiler import choose_recipe, compile_prompt  # noqa: E402
import editorial_prompt as ep  # noqa: E402
import scenes_gathered_prompt as sg  # noqa: E402
import stamp_archive_prompt as st  # noqa: E402

# lib 为可选依赖：缺失时降级为本地打印，不阻断出图
try:
    from lib.hub_manager import HubManager
    from lib.agent_logger import AgentLogger
    _HAS_LIB = True
except Exception:  # pragma: no cover - 环境降级路径
    _HAS_LIB = False

AGENT_NAME = "海报设计师"
# 网关把 gpt-image-2 拆成两个独立模型名：文生图与图生图分别调用不同 endpoint。
# 各自可用环境变量覆盖；POSTER_MODEL 若设置则同时覆盖两者（整体兜底）。
DEFAULT_MODEL_EDIT = "gpt-image-2-edit"          # 有参考图 → images.edit
DEFAULT_MODEL_GENERATE = "gpt-image-2-text-to-image"  # 无参考图 → images.generate
INPUT_DIR = AGENT_DIR / "input"
OUTPUT_DIR = AGENT_DIR / "output"
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp"}
CST = timezone(timedelta(hours=8))  # 北京时间


def load_env():
    """把 agent 目录下的 .env 读进环境变量（已设置的不覆盖）。

    CLI、工作台、访达右键三条入口都要先调它，否则配在 .env 里的
    GATEWAY_API_KEY 读不到，出图会直接失败。
    """
    env_file = AGENT_DIR / ".env"
    if not env_file.exists():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())


def _log(logger, level, msg):
    """有 AgentLogger 用之，否则退化为 stderr 打印。

    注意：ERROR 级别同时打到 stderr，否则 AgentLogger 会把报错只写进
    .claude/logs/*.jsonl，命令行上静默失败、看不到原因。
    """
    if logger is not None:
        getattr(logger, level.lower(), logger.info)(msg)
        if level.upper() in ("ERROR", "CRITICAL"):
            print(f"[{level}] {msg}", file=sys.stderr)
    else:
        print(f"[{level}] {msg}", file=sys.stderr)


def _ts_slug() -> str:
    return datetime.now(CST).strftime("%Y%m%d-%H%M%S")


def _resolve_image_arg(raw: str) -> list[Path]:
    """把一个 --image 参数解析成实际图片路径列表。

    支持三种写法（拖拽进终端 / 访达右键都归到这里）：
      - 单个图片文件
      - 一个目录（展开目录下所有图片）
      - 带 ~ 或相对仓库根的路径
    """
    p = Path(raw).expanduser()
    if not p.is_absolute():
        # 优先按当前工作目录，退回仓库根
        cand = Path.cwd() / raw
        p = cand if cand.exists() else (REPO_ROOT / raw)
    if p.is_dir():
        return sorted(f for f in p.iterdir() if f.suffix.lower() in IMAGE_EXTS)
    return [p]


def _subject_from_path(img: Path | None) -> str:
    """未显式给主题时，从文件名兜底生成一个主题。"""
    if img is None:
        return "无题"
    stem = img.stem.replace("_", " ").replace("-", " ").strip()
    return stem or "无题"


def load_seed_history() -> str:
    """读上次用过的 layout，供 choose_recipe 避免重复。"""
    marker = OUTPUT_DIR / ".last_layout"
    if marker.exists():
        return marker.read_text(encoding="utf-8").strip()
    return ""


def save_seed_history(layout_key: str):
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUTPUT_DIR / ".last_layout").write_text(layout_key, encoding="utf-8")


def _save_image_response(resp, out_path: Path, logger) -> bool:
    """从 OpenAI Images API 响应里取出图像并写盘。兼容 b64_json 与 url 两种返回。"""
    import base64
    try:
        item = resp.data[0]
    except (AttributeError, IndexError, TypeError):
        _log(logger, "ERROR", "网关返回结构异常，无 data")
        return False

    out_path.parent.mkdir(parents=True, exist_ok=True)

    b64 = getattr(item, "b64_json", None)
    if b64:
        out_path.write_bytes(base64.b64decode(b64))
        _log(logger, "INFO", f"已出图: {out_path}")
        return True

    url = getattr(item, "url", None)
    if url:
        try:
            import urllib.request
            with urllib.request.urlopen(url) as r:
                out_path.write_bytes(r.read())
            _log(logger, "INFO", f"已出图(下载): {out_path}")
            return True
        except Exception as e:
            _log(logger, "ERROR", f"下载图像失败: {e}")
            return False

    _log(logger, "ERROR", "网关未返回图像数据（b64_json / url 皆空）")
    return False


def _ssl_context():
    """返回带 CA 证书的 SSL context。优先用 certifi（urllib 默认拿不到
    macOS 系统证书，会 CERTIFICATE_VERIFY_FAILED），降级系统默认。"""
    import ssl
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        return ssl.create_default_context()


def _save_v3_response(data: dict, out_path: Path, logger) -> bool:
    """解析 /v3 native 返回并写盘。返回结构为 {"images": [<url 或 base64>, ...]}。

    每个元素可能是：URL 字符串（下载）、纯 base64 字符串、或 {url|b64_json|image} 对象。
    """
    import base64
    if not isinstance(data, dict):
        _log(logger, "ERROR", f"网关返回非 JSON 对象：{type(data).__name__}")
        return False

    images = data.get("images")
    if not images:
        # 可能是错误体或结构变更，把 key 打出来便于定位
        _log(logger, "ERROR", f"网关返回无 images 字段，keys={list(data.keys())}")
        return False

    item = images[0]
    # 对象形态：取其中的 url / b64_json / image 字段
    if isinstance(item, dict):
        item = item.get("url") or item.get("b64_json") or item.get("image")
    if not isinstance(item, str) or not item:
        _log(logger, "ERROR", "网关 images[0] 无法解析为图像")
        return False

    out_path.parent.mkdir(parents=True, exist_ok=True)

    if item.startswith("http://") or item.startswith("https://"):
        try:
            import urllib.request
            with urllib.request.urlopen(item, timeout=120, context=_ssl_context()) as r:
                out_path.write_bytes(r.read())
            _log(logger, "INFO", f"已出图(下载): {out_path}")
            return True
        except Exception as e:
            _log(logger, "ERROR", f"下载图像失败: {e}")
            return False

    # 非 URL 则按 base64 处理（可能带 data: 前缀）
    try:
        b64 = item.split(",", 1)[1] if item.startswith("data:") else item
        out_path.write_bytes(base64.b64decode(b64))
        _log(logger, "INFO", f"已出图: {out_path}")
        return True
    except Exception as e:
        _log(logger, "ERROR", f"图像 base64 解码失败: {e}")
        return False


def generate_image(prompt: str, image_path: Path | None,
                   out_path: Path, logger, size: str | None = None) -> bool:
    """
    通过网关的 provider-native 图像接口出图，写出 PNG。返回是否成功。

    网关已把图像能力迁移到 /v3/{model} native 协议（不再是 OpenAI 兼容的
    /v1/images/*）：
    - 有参考图 → POST /v3/gpt-image-2-edit         （图生图，body 带 image）
    - 无参考图 → POST /v3/gpt-image-2-text-to-image （文生图）
    返回结构为 {"images": [<url 或 base64>, ...]}。

    Args:
        size: 画布尺寸，必须落在网关枚举内（竖版如 1024x1536 / 1152x2048，
              横版如 1536x1024）。传 None 时按竖版默认。
              POSTER_SIZE 环境变量优先级最高，便于整体覆盖。
    """
    api_key = os.environ.get("GATEWAY_API_KEY")
    base_url = os.environ.get("GATEWAY_BASE_URL")
    # POSTER_MODEL 若设置则整体覆盖两条路径；否则按有无参考图各走各的默认名。
    _override = os.environ.get("POSTER_MODEL")
    model = _override or (
        os.environ.get("POSTER_MODEL_EDIT", DEFAULT_MODEL_EDIT) if image_path is not None
        else os.environ.get("POSTER_MODEL_GENERATE", DEFAULT_MODEL_GENERATE)
    )
    size = os.environ.get("POSTER_SIZE") or size or "1024x1536"
    quality = os.environ.get("POSTER_QUALITY", "medium")

    if not api_key:
        _log(logger, "ERROR", "缺少 GATEWAY_API_KEY，无法出图（可用 --dry-run 只出 prompt）")
        return False
    if not base_url:
        _log(logger, "ERROR", "缺少 GATEWAY_BASE_URL（网关地址），无法出图")
        return False

    # 图像走 /v3/{model}，与 chat 的 /v1 不同根：从 base_url 剥掉尾部 /v1。
    root = base_url.rstrip("/")
    if root.endswith("/v1"):
        root = root[:-3].rstrip("/")
    api_url = f"{root}/v3/{model}"

    body = {"prompt": prompt, "size": size, "quality": quality}
    if image_path is not None:
        import base64
        raw = Path(image_path).read_bytes()
        ext = Path(image_path).suffix.lower()
        mime = "image/jpeg" if ext in (".jpg", ".jpeg") else \
               "image/webp" if ext == ".webp" else \
               "image/gif" if ext == ".gif" else "image/png"
        body["image"] = f"data:{mime};base64,{base64.b64encode(raw).decode()}"

    import json as _json
    import urllib.request
    import urllib.error
    req = urllib.request.Request(
        api_url,
        data=_json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=300, context=_ssl_context()) as r:
            data = _json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = ""
        try:
            detail = e.read().decode("utf-8")[:300]
        except Exception:
            pass
        _log(logger, "ERROR", f"网关出图失败 HTTP {e.code}: {detail}")
        return False
    except Exception as e:
        _log(logger, "ERROR", f"网关出图请求异常: {e}")
        return False

    return _save_v3_response(data, out_path, logger)


def report_to_hub(subject, recipe, out_files, dry_run):
    """把这次出图写进协作中枢 hub.json。"""
    if not _HAS_LIB:
        return
    try:
        hub = HubManager(str(AGENTS_ROOT / "hub.json"))
        hub.update_agent_status(AGENT_NAME, "active")
        content = (f"海报出图：主题「{subject}」，配方 {recipe.as_line()}"
                   + ("（dry-run 仅 prompt）" if dry_run else f"，产出 {len(out_files)} 张"))
        hub.add_message(
            AGENT_NAME, "update", content,
            data={
                "subject": subject,
                "recipe": recipe.as_line(),
                "outputs": [str(p) for p in out_files],
                "dryRun": dry_run,
            },
        )
    except Exception as e:  # 不因中枢写入失败而中断主流程
        print(f"[WARNING] 写入 hub.json 失败: {e}", file=sys.stderr)


def run(args) -> int:
    load_env()   # 先读 .env，否则 GATEWAY_API_KEY 拿不到
    logger = AgentLogger(AGENT_NAME) if _HAS_LIB else None
    _log(logger, "INFO", f"开始：主题「{args.subject or '（按文件名）'}」 dry_run={args.dry_run} batch={args.batch}")

    # 决定参考图集合
    images: list[Path | None]
    if args.batch:
        if not INPUT_DIR.exists():
            _log(logger, "ERROR", f"input 目录不存在: {INPUT_DIR}")
            return 1
        images = sorted(p for p in INPUT_DIR.iterdir() if p.suffix.lower() in IMAGE_EXTS)
        if not images:
            _log(logger, "ERROR", "batch 模式下 input/ 无图片")
            return 1
    elif args.image:
        collected: list[Path] = []
        seen: set[str] = set()
        for raw in args.image:
            for p in _resolve_image_arg(raw):
                key = str(p.resolve()) if p.exists() else str(p)
                if key in seen:
                    continue
                seen.add(key)
                if not p.exists():
                    _log(logger, "WARNING", f"跳过不存在的参考图: {p}")
                    continue
                collected.append(p)
        if not collected:
            _log(logger, "ERROR", "没有可用的参考图")
            return 1
        images = list(collected)
    else:
        images = [None]  # 纯文生图

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    last_layout = load_seed_history()
    out_files: list[Path] = []
    recipe = None

    for idx, img in enumerate(images):
        subject = args.subject or _subject_from_path(img)

        if args.skill == "editorial":
            # editorial：照片必需，无变体配方
            if img is None:
                _log(logger, "ERROR", "editorial 需要参考照片，跳过纯文生图")
                continue
            recipe = ep.build_recipe(subject_hint=args.subject or "",
                                     subtitle_hint=args.subtitle)
            try:
                prompt = ep.compile_prompt(recipe, has_reference_image=True)
            except ep.PhotoRequiredError as e:
                _log(logger, "ERROR", str(e))
                continue
            suffix = "editorial"
        elif args.skill == "scenes":
            # scenes：照片必需，无变体配方；--text 作为可选微文字
            if img is None:
                _log(logger, "ERROR", "scenes 需要参考照片，跳过纯文生图")
                continue
            recipe = sg.build_recipe(subject_hint=args.subject or "",
                                     text_line=args.text or "")
            try:
                prompt = sg.compile_prompt(recipe, has_reference_image=True)
            except sg.PhotoRequiredError as e:
                _log(logger, "ERROR", str(e))
                continue
            suffix = "scenes"
        elif args.skill == "stamp":
            # stamp：照片必需，无种子配方；但有图章形状/位置/拼接三条显式轴
            if img is None:
                _log(logger, "ERROR", "stamp 需要参考照片，跳过纯文生图")
                continue
            recipe = st.build_recipe(
                seal_shape=args.seal_shape,
                seal_corner=args.seal_corner,
                splice=args.splice,
                subject_hint=args.subject or "",
                text_line=args.text or "",
            )
            try:
                prompt = st.compile_prompt(recipe, has_reference_image=True)
            except st.PhotoRequiredError as e:
                _log(logger, "ERROR", str(e))
                continue
            suffix = "stamp"
        else:
            # zine：种子配方引擎 + 四段式
            seed = f"{subject}|{img}|{_ts_slug()}|{idx}"
            recipe = choose_recipe(seed, mono=args.mono, avoid_layout=last_layout)
            prompt = compile_prompt(
                subject, recipe,
                text_line=args.text,
                has_reference_image=img is not None,
            )
            suffix = "zine"

        stem = img.stem if img is not None else "poster"
        out_path = OUTPUT_DIR / f"{stem}-{suffix}-{_ts_slug()}-{idx}.png"

        print(f"\n=== [{idx+1}/{len(images)}] {stem} ({args.skill}) ===")
        print(f"Recipe: {recipe.as_line()}")
        print(f"参考图: {img if img else '（无，纯文生图）'}")
        print("-" * 60)
        print(prompt)
        print("-" * 60)

        if args.dry_run:
            _log(logger, "INFO", "dry-run：跳过实际出图")
        else:
            # 只有 stamp 的 recipe 带 size（左右拼接走横版）；其余为 None → 竖版默认
            ok = generate_image(prompt, img, out_path, logger,
                                size=getattr(recipe, "size", None))
            if ok:
                out_files.append(out_path)

        # 只有 zine 有 layout 轴需要记忆（editorial / scenes 无变体配方）
        if args.skill == "zine":
            last_layout = recipe.layout_key

    save_seed_history(last_layout)
    if recipe is not None:   # 全部跳过（如 editorial 无照片）时 recipe 为 None
        report_to_hub(args.subject or "（按文件名）", recipe, out_files, args.dry_run)

    if not args.dry_run and not out_files:
        _log(logger, "ERROR", "没有成功产出任何图片")
        return 1

    print(f"\n完成。产出 {len(out_files)} 张 → {OUTPUT_DIR}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="海报设计师：把图片/主题优化成 zine 海报或照片抽象编辑作品")
    p.add_argument("--skill", choices=["zine", "editorial", "scenes", "stamp"], default="zine",
                   help="出图风格：zine（纸感海报，默认）/ editorial（原照片+抽象记忆面板，照片必需）"
                        "/ scenes（实景拼贴：真景为锚+插画成场+撕纸成界，照片必需）"
                        "/ stamp（档案图章：原片+暖白纸+定制手工图章，照片必需）")
    p.add_argument("--subtitle", action="store_true",
                   help="editorial 专用：允许生成副标题（默认只出主标题）")
    p.add_argument("--seal-shape", choices=list(st.SEAL_SHAPES), default=st.DEFAULT_SEAL_SHAPE,
                   help="stamp 专用：图章形状（默认 auto，按主体轮廓自动定形）")
    p.add_argument("--seal-corner", choices=list(st.SEAL_CORNERS), default=st.DEFAULT_SEAL_CORNER,
                   help="stamp 专用：图章所在角落（默认 auto，按视觉重量平衡）")
    p.add_argument("--splice", choices=list(st.SPLICE_MODES), default=st.DEFAULT_SPLICE,
                   help="stamp 专用：拼接方向 lr=左右(横版，默认) / tb=上下(竖版)")
    p.add_argument("--subject", help="主题 / 核心意象（一句话）；省略时按每张图文件名生成")
    p.add_argument("--image", nargs="+", metavar="PATH",
                   help="参考图路径，可多张，也可传目录（拖拽进终端/访达右键都走这里）")
    p.add_argument("--batch", action="store_true", help="对 input/ 下所有图片批量出图")
    p.add_argument("--text", help="海报内出现的短句（可选）")
    p.add_argument("--mono", action="store_true", help="单色模式，弱化高饱和色锚点")
    p.add_argument("--dry-run", action="store_true", help="只编译并打印 prompt，不出图")
    return p


if __name__ == "__main__":
    sys.exit(run(build_parser().parse_args()))
