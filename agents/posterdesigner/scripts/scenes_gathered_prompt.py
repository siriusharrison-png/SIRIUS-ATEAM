#!/usr/bin/env python3
"""
scenes_gathered_prompt.py — Gathered Scenes Zine v1.3 Prompt 编译器

第三个出图 skill：把上传照片编译成「真景为锚＋插画成场＋撕纸成界」的
竖向实景拼贴海报。与 zine（prompt_compiler.py）、editorial（editorial_prompt.py）
并列，由工作台 tab / --skill 分流。

规则来源：作者 Zeejay0 的 scenes-gathered-zine-v1-3 SKILL
prompt 正文：本地副本 skills/scenes-gathered-zine.zh-CN.md（保证 agent 自包含、可复现）

与 editorial 的相同点（同属「固定长 prompt」一路）：
- 无变体配方引擎：核心是一整段作者调好的长 prompt，不做种子采样。
- 照片必需：照片是唯一内容来源，无照片则不成立（compile 会抛错，前端也禁用按钮）。
- 表单极简：只接受可选的主题提示 / 微文字，作为对固定 prompt 的轻量补充。

与 editorial 的差异：
- 本 skill 默认允许一处「微文字」，且默认仅英文；用户可用 --text 指定确切措辞。
"""

from dataclasses import dataclass
from pathlib import Path
from typing import Optional

SKILL_ID = "scenes-gathered-zine-v1-3"

# 本地 prompt 副本：agents/posterdesigner/skills/scenes-gathered-zine.zh-CN.md
AGENT_DIR = Path(__file__).resolve().parent.parent
PROMPT_FILE = AGENT_DIR / "skills" / "scenes-gathered-zine.zh-CN.md"


class PhotoRequiredError(ValueError):
    """scenes skill 缺少参考照片时抛出。"""


@dataclass
class ScenesRecipe:
    """scenes 没有变体轴，这里仅承载用户的轻量补充，供日志/hub 记录用。"""
    subject_hint: str
    text_line: str

    def as_line(self) -> str:
        bits = ["scenes-gathered-zine"]
        if self.subject_hint:
            bits.append(f"意象:{self.subject_hint}")
        if self.text_line:
            bits.append(f"微文字:{self.text_line}")
        else:
            bits.append("微文字:默认英文")
        return " / ".join(bits)


def _load_base_prompt() -> str:
    """读本地中文 prompt 正文；缺失时给一句兜底，避免整链崩掉。"""
    if PROMPT_FILE.exists():
        return PROMPT_FILE.read_text(encoding="utf-8").strip()
    # 兜底：文件缺失时的最小可用 prompt（正常不会走到）
    return (
        "将上传的图片严格作为唯一内容来源，生成一张竖向 3:5 的实景拼贴纸感海报："
        "真实照片作为锚点，被放进一片由照片衍生、留白充裕的抽象插画场；"
        "把繁复细节压缩成少数安静图形；用一种高饱和色作为构图结构；"
        "在照片与米色纸面交界处保留一道可见的手撕纤维毛边。"
    )


def build_recipe(subject_hint: str = "", text_line: str = "") -> ScenesRecipe:
    return ScenesRecipe(subject_hint=(subject_hint or "").strip(),
                        text_line=(text_line or "").strip())


def compile_prompt(recipe: ScenesRecipe, has_reference_image: bool) -> str:
    """
    组合最终 prompt。

    Args:
        recipe: build_recipe 的结果（用户轻量补充）。
        has_reference_image: 必须为 True，否则抛 PhotoRequiredError。

    Returns:
        喂给 gpt-image-2 images.edit 的完整中文 prompt。
    """
    if not has_reference_image:
        raise PhotoRequiredError(
            "scenes-gathered-zine 需要一张参考照片作为唯一内容来源，请先上传图片。"
        )

    base = _load_base_prompt()
    extras = []

    if recipe.subject_hint:
        # 主题提示只作为「命名与情绪的参考」，不得覆盖照片事实
        extras.append(
            f"标题与情绪可参考用户给出的意象「{recipe.subject_hint}」，"
            f"但必须服从照片中真实存在的主体关系与视觉事实，不得凭此虚构内容。"
        )

    if recipe.text_line:
        # 用户给了确切措辞：原样复现，不翻译不扩写（对齐 SKILL「措辞选择」首条）
        extras.append(
            f"微文字请原样使用用户提供的措辞「{recipe.text_line}」，"
            f"不要翻译、扩写、改写或追加副标题；"
            f"仍按微文字系统的字形、墨值、尺度与位置规则融入纸面。"
        )
    else:
        # 未提供：走 SKILL 默认——仅英文、一处、命名情绪余韵
        extras.append(
            "未提供微文字：按默认方向自创一处「仅英文」微文字（≤5 个单词），"
            "命名场景安静的情绪余韵而非记录时间地点，保持克制、从属、融入纸面。"
        )

    if not extras:
        return base
    return base + "\n\n## 补充约束\n\n" + "\n\n".join(extras)


if __name__ == "__main__":
    import sys
    hint = sys.argv[1] if len(sys.argv) > 1 else "雨后山间的旧屋"
    r = build_recipe(subject_hint=hint, text_line="")
    print("Recipe:", r.as_line())
    print("-" * 60)
    print(compile_prompt(r, has_reference_image=True))
