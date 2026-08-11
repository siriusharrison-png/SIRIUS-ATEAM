#!/usr/bin/env python3
"""
stamp_archive_prompt.py — Make Photo Stamp Archive Prompt 编译器

第四个出图 skill：把上传照片编译成「原片忠实＋暖白纸面＋定制手工图章」的
档案拼接作品。与 zine（prompt_compiler.py）、editorial（editorial_prompt.py）、
scenes（scenes_gathered_prompt.py）并列，由工作台 tab / --skill 分流。

规则来源：Dlcccc71913/skill-make-photo-stamp-archive（MIT）
prompt 正文：本地副本 skills/photo-stamp-archive.zh-CN.md（保证 agent 自包含、可复现）

与 editorial / scenes 的相同点（同属「固定长 prompt」一路）：
- 无种子变体配方引擎：核心是一整段调好的长 prompt。
- 照片必需：照片是唯一内容来源，无照片则不成立（compile 会抛错，前端也禁用按钮）。

与 editorial / scenes 的差异：
- 本 skill 有三条**用户可显式选择**的轴：图章形状 / 图章角落 / 拼接方向。
  三者默认 auto，交给模型按主体轮廓与视觉重量自行决定；用户选定后写成硬约束。
- 拼接方向决定画布长宽：左右拼接走横版，上下拼接走竖版（见 SIZE_BY_SPLICE）。
"""

from dataclasses import dataclass
from pathlib import Path

SKILL_ID = "make-photo-stamp-archive"

# 本地 prompt 正文副本：agents/posterdesigner/skills/photo-stamp-archive.zh-CN.md
AGENT_DIR = Path(__file__).resolve().parent.parent
PROMPT_FILE = AGENT_DIR / "skills" / "photo-stamp-archive.zh-CN.md"

# 图章形状：key -> (中文label, 写进 prompt 的硬约束)
SEAL_SHAPES = {
    "auto": ("自动（按主体轮廓定形）", ""),
    "circle": ("圆形 / 椭圆", "图章必须使用明显可辨的圆形或椭圆边界，允许克制的干墨断口，但轮廓要读得出是圆的。"),
    "square": (
        "方形边框",
        "图章必须带一圈完整、明确无误的方形墨框，四条边都要出现；"
        "允许磨损的角、轻微断墨与压力不均，但方形边界必须可读。"
        "不要干净的数字边框、照片卡纸、贴纸卡片或泛用矩形。",
    ),
    "arch": ("拱形", "图章必须使用拱形边界（上圆下方），呼应窗、门、门洞或拱顶类主体。"),
    "panoramic": ("全景横条", "图章必须使用横向全景条状边界，呼应成排、队列、海岸线或开阔风景。"),
    "silhouette": (
        "异形轮廓",
        "图章必须沿主体自身的定义性外轮廓剪影成形（建筑、车辆、树、雕像或器物），"
        "不要再套一个泛用矩形或圆形外框。",
    ),
}

# 图章所在角落
SEAL_CORNERS = {
    "auto": ("自动（按视觉重量平衡）", ""),
    "upper-left": ("左上", "图章与说明文字整组必须落在纸面板的左上区域。"),
    "upper-right": ("右上", "图章与说明文字整组必须落在纸面板的右上区域。"),
    "lower-left": ("左下", "图章与说明文字整组必须落在纸面板的左下区域。"),
    "lower-right": ("右下", "图章与说明文字整组必须落在纸面板的右下区域。"),
}

# 拼接方向：key -> (中文label, 硬约束, 出图尺寸)
SPLICE_MODES = {
    "lr": (
        "左右拼接（横版，默认）",
        "采用左右直拼：照片面板与纸面板左右并置，中间是一条完全笔直的**竖直**接缝。",
        "1536x1024",
    ),
    "tb": (
        "上下拼接（竖版）",
        "采用上下直拼：照片面板与纸面板上下并置，中间是一条完全笔直的**水平**接缝。",
        "1024x1536",
    ),
}

DEFAULT_SEAL_SHAPE = "auto"
DEFAULT_SEAL_CORNER = "auto"
DEFAULT_SPLICE = "lr"


class PhotoRequiredError(ValueError):
    """stamp skill 缺少参考照片时抛出。"""


@dataclass
class StampRecipe:
    """承载用户显式选择的三条轴 + 轻量文本补充，供日志/hub 记录与 prompt 编译。"""
    seal_shape: str
    seal_corner: str
    splice: str
    subject_hint: str
    text_line: str

    @property
    def size(self) -> str:
        """本次出图应使用的画布尺寸（由拼接方向决定横竖）。"""
        return SPLICE_MODES[self.splice][2]

    def as_line(self) -> str:
        bits = [
            "photo-stamp-archive",
            f"图章:{SEAL_SHAPES[self.seal_shape][0]}",
            f"位置:{SEAL_CORNERS[self.seal_corner][0]}",
            f"拼接:{SPLICE_MODES[self.splice][0]}",
        ]
        if self.subject_hint:
            bits.append(f"意象:{self.subject_hint}")
        bits.append(f"文字:{self.text_line}" if self.text_line else "文字:默认英文")
        return " / ".join(bits)


def _load_base_prompt() -> str:
    """读本地中文 prompt 正文；缺失时给一句兜底，避免整链崩掉。"""
    if PROMPT_FILE.exists():
        return PROMPT_FILE.read_text(encoding="utf-8").strip()
    # 兜底：文件缺失时的最小可用 prompt（正常不会走到）
    return (
        "将上传的图片严格作为唯一内容来源，生成一张档案图章拼接作品："
        "一侧忠实保留原照片，另一侧是暖白档案纸，纸上盖一枚为该主体定制的手工图章；"
        "两块面板沿一条笔直的缝直接相接，无任何过渡效果；"
        "纸面保留约 70% 安静空白，图章与小字只占一角。"
    )


def _norm(value: str, table: dict, default: str) -> str:
    """把用户传入值归一到 table 的合法 key，非法值退回默认。"""
    v = (value or "").strip().lower()
    return v if v in table else default


def build_recipe(seal_shape: str = DEFAULT_SEAL_SHAPE,
                 seal_corner: str = DEFAULT_SEAL_CORNER,
                 splice: str = DEFAULT_SPLICE,
                 subject_hint: str = "",
                 text_line: str = "") -> StampRecipe:
    return StampRecipe(
        seal_shape=_norm(seal_shape, SEAL_SHAPES, DEFAULT_SEAL_SHAPE),
        seal_corner=_norm(seal_corner, SEAL_CORNERS, DEFAULT_SEAL_CORNER),
        splice=_norm(splice, SPLICE_MODES, DEFAULT_SPLICE),
        subject_hint=(subject_hint or "").strip(),
        text_line=(text_line or "").strip(),
    )


def compile_prompt(recipe: StampRecipe, has_reference_image: bool) -> str:
    """
    组合最终 prompt。

    Args:
        recipe: build_recipe 的结果。
        has_reference_image: 必须为 True，否则抛 PhotoRequiredError。

    Returns:
        喂给 gpt-image-2 images.edit 的完整中文 prompt。
    """
    if not has_reference_image:
        raise PhotoRequiredError(
            "make-photo-stamp-archive 需要一张参考照片作为唯一内容来源，请先上传图片。"
        )

    base = _load_base_prompt()
    extras = []

    # 拼接方向始终显式写出（它同时决定了画布横竖，必须和 size 一致）
    extras.append(SPLICE_MODES[recipe.splice][1])

    shape_rule = SEAL_SHAPES[recipe.seal_shape][1]
    if shape_rule:
        extras.append(shape_rule)

    corner_rule = SEAL_CORNERS[recipe.seal_corner][1]
    if corner_rule:
        extras.append(corner_rule)

    if recipe.subject_hint:
        # 主题提示只作为「命名与情绪的参考」，不得覆盖照片事实
        extras.append(
            f"标题与情绪可参考用户给出的意象「{recipe.subject_hint}」，"
            f"但必须服从照片中真实存在的主体关系与视觉事实，不得凭此虚构内容。"
        )

    if recipe.text_line:
        # 用户给了确切措辞：原样复现，不翻译不扩写
        extras.append(
            f"说明文字请原样使用用户提供的措辞「{recipe.text_line}」，"
            f"不要翻译、扩写、改写或追加副标题；"
            f"仍按打字机小字的字号、墨值与位置规则融入纸面，且不得压在图章上。"
        )
    else:
        # 未提供：走 SKILL 默认——主标题 1–3 个大写英文词 + 小写副标题
        extras.append(
            "未提供说明文字：按默认方向自创一处「仅英文」打字机小字——"
            "主标题 1–3 个大写单词，副标题 2–4 个小写单词用 ` / ` 分隔；"
            "保持小、淡、拼写准确，放在图章附近而不压在图章上。"
        )

    return base + "\n\n## 补充约束\n\n" + "\n\n".join(extras)


if __name__ == "__main__":
    import sys
    hint = sys.argv[1] if len(sys.argv) > 1 else "老城的钟楼"
    r = build_recipe(seal_shape="square", seal_corner="lower-right", subject_hint=hint)
    print("Recipe:", r.as_line())
    print("Size:", r.size)
    print("-" * 60)
    print(compile_prompt(r, has_reference_image=True))
