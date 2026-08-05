#!/usr/bin/env python3
"""
serve.py — 海报设计师本地工作台

起一个本地 Web 服务，浏览器里拖图→出图→看大图/下载/重出。
复用 design_poster 的核心逻辑（prompt 编译 + 网关出图），只加一层 HTTP。
零额外依赖：仅用标准库 http.server（出图仍需 openai + 网关 Key）。

用法：
    python3 scripts/serve.py                # 默认 http://127.0.0.1:8765
    python3 scripts/serve.py --port 9000
    PORT=9000 python3 scripts/serve.py

网关 Key 从与脚本同级的 .env 读取（不入库），与命令行入口一致。
"""

import argparse
import json
import os
import sys
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

AGENT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(AGENT_DIR / "scripts"))

from prompt_compiler import choose_recipe, compile_prompt  # noqa: E402
import design_poster as dp  # noqa: E402

OUTPUT_DIR = AGENT_DIR / "output"
UPLOAD_DIR = AGENT_DIR / "output" / ".uploads"  # 临时上传图，随 output 一并被 gitignore
STATIC_HTML = AGENT_DIR / "web" / "index.html"


def _load_env():
    """把同级 .env 读进环境变量（若尚未设置）。"""
    env_file = AGENT_DIR / ".env"
    if not env_file.exists():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())


def _parse_multipart(body: bytes, boundary: bytes) -> dict:
    """极简 multipart/form-data 解析：返回 {字段名: 值/(文件名,字节)}。"""
    result = {}
    sep = b"--" + boundary
    for part in body.split(sep):
        part = part.strip(b"\r\n")
        if not part or part == b"--":
            continue
        if b"\r\n\r\n" not in part:
            continue
        head, data = part.split(b"\r\n\r\n", 1)
        head_text = head.decode("utf-8", "ignore")
        # 只在 Content-Disposition 那一行找 name/filename（head 可能多行）
        disp_line = ""
        for hl in head_text.split("\r\n"):
            if hl.lower().startswith("content-disposition:"):
                disp_line = hl
                break
        name = None
        filename = None
        for token in disp_line.split(";"):
            token = token.strip()
            if token.startswith('name="') and token.endswith('"'):
                name = token[len('name="'):-1]
            elif token.startswith('filename="') and token.endswith('"'):
                filename = token[len('filename="'):-1]
        if name is None:
            continue
        if filename is not None:
            result[name] = (filename, data)
        else:
            result[name] = data.decode("utf-8", "ignore").strip()
    return result


def _do_generate(fields: dict) -> dict:
    """执行一次出图，返回给前端的 JSON 结果。"""
    subject = (fields.get("subject") or "").strip()
    mono = fields.get("mono") in ("1", "true", "on")
    text_line = (fields.get("text") or "").strip() or None
    lock_layout = (fields.get("lock_layout") or "").strip() or None

    # 处理上传图（可选）
    img_path = None
    up = fields.get("image")
    if isinstance(up, tuple):
        filename, data = up
        if data:
            UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
            safe = dp._ts_slug() + "-" + Path(filename).name
            img_path = UPLOAD_DIR / safe
            img_path.write_bytes(data)

    if not subject:
        subject = dp._subject_from_path(img_path)

    # 配方：锁定则复用指定 layout，否则避开上次
    avoid = None if lock_layout else dp.load_seed_history()
    seed = f"{subject}|{img_path}|{dp._ts_slug()}"
    recipe = choose_recipe(seed, mono=mono, avoid_layout=avoid)
    if lock_layout:
        # 用户想锁定某布局：直接覆盖 layout 字段
        for fam in __import__("prompt_compiler").LAYOUT_FAMILY:
            if fam[0] == lock_layout:
                recipe.layout_key, recipe.layout_desc = fam[0], fam[1]
                break

    prompt = compile_prompt(subject, recipe, text_line=text_line,
                            has_reference_image=img_path is not None)

    stem = img_path.stem if img_path else "poster"
    out_path = OUTPUT_DIR / f"{stem}-zine-{dp._ts_slug()}.png"

    ok = dp.generate_image(prompt, img_path, out_path, None)
    if ok:
        dp.save_seed_history(recipe.layout_key)
        dp.report_to_hub(subject, recipe, [out_path], dry_run=False)
        return {
            "ok": True,
            "subject": subject,
            "recipe": recipe.as_line(),
            "layout": recipe.layout_key,
            "color": recipe.color_name,
            "file": out_path.name,
            "url": f"/output/{out_path.name}",
        }
    return {"ok": False, "error": "出图失败，检查 .env 里的网关 Key 与额度。"}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass  # 静默，避免刷屏

    def _send(self, code, body: bytes, ctype="application/json; charset=utf-8"):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path in ("/", "/index.html"):
            if STATIC_HTML.exists():
                self._send(200, STATIC_HTML.read_bytes(), "text/html; charset=utf-8")
            else:
                self._send(500, b"web/index.html missing")
            return
        if path.startswith("/output/"):
            name = Path(path[len("/output/"):]).name
            f = OUTPUT_DIR / name
            if f.exists() and f.suffix.lower() == ".png":
                self._send(200, f.read_bytes(), "image/png")
            else:
                self._send(404, b"not found")
            return
        if path == "/api/layouts":
            import prompt_compiler as pc
            data = [{"key": fam[0], "desc": fam[1]} for fam in pc.LAYOUT_FAMILY]
            self._send(200, json.dumps(data, ensure_ascii=False).encode("utf-8"))
            return
        self._send(404, b"not found")

    def do_POST(self):
        if self.path != "/api/generate":
            self._send(404, b"not found")
            return
        ctype = self.headers.get("Content-Type", "")
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        if "multipart/form-data" not in ctype or "boundary=" not in ctype:
            self._send(400, json.dumps({"ok": False, "error": "需要 multipart 表单"}).encode())
            return
        boundary = ctype.split("boundary=", 1)[1].strip().encode("utf-8")
        try:
            fields = _parse_multipart(body, boundary)
            result = _do_generate(fields)
        except Exception as e:
            result = {"ok": False, "error": f"服务器错误: {e}"}
        code = 200 if result.get("ok") else 500
        self._send(code, json.dumps(result, ensure_ascii=False).encode("utf-8"))


def main():
    parser = argparse.ArgumentParser(description="海报设计师本地工作台")
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", 8765)))
    parser.add_argument("--no-open", action="store_true", help="不自动打开浏览器")
    args = parser.parse_args()

    _load_env()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    url = f"http://127.0.0.1:{args.port}"
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    key_ok = "✓ 已就位" if os.environ.get("GATEWAY_API_KEY") else "✗ 缺失（出图会失败）"
    print(f"海报设计师工作台 → {url}")
    print(f"网关 Key: {key_ok}")
    print("按 Ctrl+C 停止。")
    if not args.no_open:
        try:
            webbrowser.open(url)
        except Exception:
            pass
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止。")


if __name__ == "__main__":
    main()
