#!/usr/bin/env python3
"""
editorial_prompt.py — Photo Abstract Editorial Prompt 编译器

第二个出图 skill：把上传照片编译成「原照片区域＋抽象记忆面板＋诗意标题」的
竖向编辑作品。与 zine（prompt_compiler.py）并列，由工作台 tab / --skill 分流。

规则来源：~/.claude/skills/photo-abstract-editorial/SKILL.md
prompt 正文：本地副本 skills/photo-abstract-editorial.zh-CN.md（保证 agent 自包含、可复现）

与 zine 的关键差异：
- 无变体配方引擎：核心是一整段固定长 prompt（skill 作者已调好），不做种子采样。
- 照片必需：照片是唯一内容来源，无照片则不成立（compile 会抛错，前端也禁用按钮）。
- 表单极简：只接受可选的主题提示 / 副标题倾向，作为对固定 prompt 的轻量补充。
"""

from dataclasses import dataclass
from pathlib import Path
from typing import Optional

SKILL_ID = "photo-abstract-editorial"

# 本地 prompt 副本：agents/posterdesigner/skills/photo-abstract-editorial.zh-CN.md
AGENT_DIR = Path(__file__).resolve().parent.parent
PROMPT_FILE = AGENT_DIR / "skills" / "photo-abstract-editorial.zh-CN.md"


class PhotoRequiredError(ValueError):
    """editorial skill 缺少参考照片时抛出。"""


@dataclass
class EditorialRecipe:
    """editorial 没有变体轴，这里仅承载用户的轻量补充，供日志/hub 记录用。"""
    subject_hint: str
    subtitle_hint: bool

    def as_line(self) -> str:
        bits = ["photo-abstract-editorial"]
        if self.subject_hint:
            bits.append(f"意象:{self.subject_hint}")
        bits.append("含副标题" if self.subtitle_hint else "仅主标题")
        return " / ".join(bits)


def _load_base_prompt() -> str:
    """读本地中文 prompt 正文；缺失时给一句兜底，避免整链崩掉。"""
    if PROMPT_FILE.exists():
        return PROMPT_FILE.read_text(encoding="utf-8").strip()
    # 兜底：文件缺失时的最小可用 prompt（正常不会走到）
    return (
        "将上传的图片严格作为唯一内容来源和摄影原片，生成一张由"
        "「原照片区域＋抽象记忆面板＋诗意英文标题」组成的竖向编辑作品。"
        "保留原照片不改动，下方为均匀象牙色抽象面板，标题为克制的编辑感衬线体。"
    )


def build_recipe(subject_hint: str = "", subtitle_hint: bool = False) -> EditorialRecipe:
    return EditorialRecipe(subject_hint=(subject_hint or "").strip(),
                           subtitle_hint=bool(subtitle_hint))


def compile_prompt(recipe: EditorialRecipe, has_reference_image: bool) -> str:
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
            "photo-abstract-editorial 需要一张参考照片作为唯一内容来源，请先上传图片。"
        )

    base = _load_base_prompt()
    extras = []

    if recipe.subject_hint:
        # 主题提示只作为「命名与情绪的参考」，不得覆盖照片事实
        extras.append(
            f"标题与情绪可参考用户给出的意象「{recipe.subject_hint}」，"
            f"但必须服从照片中真实存在的主体关系与视觉事实，不得凭此虚构内容。"
        )

    if not recipe.subtitle_hint:
        # 默认只出主标题，明确压制副标题
        extras.append("本次只输出一个英文主标题，不要副标题。")
    else:
        extras.append(
            "若副标题能增加新的语义层（而非重复主标题），可加入一个 3–7 个英文单词的短副标题。"
        )

    if not extras:
        return base
    return base + "\n\n## 补充约束\n\n" + "\n\n".join(extras)


if __name__ == "__main__":
    import sys
    hint = sys.argv[1] if len(sys.argv) > 1 else "海边黄昏的长椅"
    r = build_recipe(subject_hint=hint, subtitle_hint=False)
    print("Recipe:", r.as_line())
    print("-" * 60)
    print(compile_prompt(r, has_reference_image=True))
