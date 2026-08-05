#!/usr/bin/env python3
"""
prompt_compiler.py — Minimal Zine Poster v0.1 Prompt 编译器

把用户内容（主题 / 句子 / 图片角色）编译成一段 zine 风格的
四段式图像 prompt，供 Gemini 图生图使用。

规则来源：~/.claude/skills/gc-minimal-zine-poster/SKILL.md
- Variation Engine（layout / anchor / typography / texture / mood）
- Standard Color Engine（单一高饱和色锚点）
- Standard Prompt Shape（四段：canvas / anchor / type+accent+print / flat-scan mood+avoid）

设计要点：
- 变体选择用「种子」驱动，可复现；同一主题换种子即得不同视觉语法。
- 提供 avoid-list 作为负向约束，防止商业海报 / 3D / 霓虹等跑偏。
"""

import hashlib
from dataclasses import dataclass, field
from typing import Optional, List


# ---- Variation Engine 轴（对齐 SKILL.md） -------------------------------

LAYOUT_FAMILY = [
    ("center-fragment", "a tiny central image or object surrounded by air, placed in the middle"),
    ("lower-left-float", "a small anchor floating in the lower-left quadrant with a large empty top"),
    ("upper-right-block", "a small color/photo block in the upper-right with loose text drifting nearby"),
    ("dual-panel", "two small adjacent panels separated by a narrow gap"),
    ("irregular-cutout", "a torn organic paper shape carrying the image or type"),
    ("type-led", "typography as the main visual anchor, the image secondary or nearly absent"),
    ("dot-orbit", "dots, letters or hairlines orbiting a small subject"),
    ("single-specimen", "one isolated object or mark with almost no supporting graphics"),
]

IMAGE_ANCHOR = [
    "tiny faded photo",
    "torn-paper clipping",
    "flat silhouette",
    "solid color block",
    "old printed illustration",
    "object specimen",
    "translucent geometric overlay",
    "abstract texture window",
]

TYPOGRAPHY_MODE = [
    "fragmented floating letters",
    "one short phrase pressed against the image edge",
    "archive microtext with a tiny date and weather",
    "diagonally scattered words",
    "low-contrast gray ghost text",
    "a headline-as-object with rough letterpress",
    "text set inside a color block or cutout",
    "almost textless, only a tiny caption",
]

TEXTURE_MODE = [
    "xerox softness",
    "risograph grain",
    "letterpress ink bleed",
    "halftone degradation",
    "film-grain photo",
    "scan noise and paper fibers",
    "aged paper mottling",
    "soft motion blur on selected text",
]

MOOD_MODE = [
    "quiet", "summer", "solitude", "childhood", "seaside",
    "afternoon", "night", "memory", "slight surrealism",
]

# Standard Color Engine —— 单一高饱和色锚点，钴蓝优先
COLOR_ANCHORS = [
    ("fully saturated cobalt-blue risograph ink", "cobalt blue"),
    ("opaque ultramarine cutout", "ultramarine"),
    ("clean cyan printed block", "cyan"),
    ("vivid violet flat silhouette", "violet"),
    ("bold magenta-pink fragmented type", "magenta pink"),
    ("clean lemon-yellow printed block", "lemon yellow"),
    ("vivid pear-green flat silhouette", "pear green"),
    ("saturated orange irregular cutout", "orange"),
    ("clean tomato-red printed block", "tomato red"),
]

PAPER_TONES = [
    "warm ivory aged paper",
    "cool gray recycled paper",
    "pale sand kraft paper",
    "faint cream archival paper",
]

# 负向约束（SKILL.md Hard Avoids + Negative Constraints）
AVOID_LIST = (
    "no full-bleed scene, no commercial headline hierarchy, no product ad layout, "
    "no logo / CTA / brand campaign, no clean digital UI white, no glossy mockup or "
    "heavy paper shadow, no 3D rendering, no cinematic lighting, no hard shadows, "
    "no depth of field, no neon, no cyberpunk, no cute cartoon or anime, no fashion "
    "editorial drama, no dense scrapbook, not too many colors, no long clean readable "
    "text blocks, no stock-photo realism"
)


@dataclass
class Recipe:
    layout_key: str
    layout_desc: str
    anchor: str
    typography: str
    texture: str
    mood: str
    color_phrase: str
    color_name: str
    paper: str

    def as_line(self) -> str:
        return (f"{self.layout_key} / {self.anchor} / {self.typography} / "
                f"{self.color_name} accent / {self.texture} / {self.mood}")


def _pick(seq, seed_int, salt):
    """用种子确定性地从序列取一项。"""
    idx = (seed_int + salt) % len(seq)
    return seq[idx]


def choose_recipe(seed: str, mono: bool = False,
                  avoid_layout: Optional[str] = None) -> Recipe:
    """
    根据种子选一套变体配方。

    Args:
        seed: 任意字符串（主题+时间戳等），决定变体组合，可复现。
        mono: True 时用户明确要 monochrome，弱化彩色锚点。
        avoid_layout: 若与上次布局相同则顺延一位，满足「不重复」。
    """
    h = int(hashlib.sha256(seed.encode("utf-8")).hexdigest(), 16)

    layout = _pick(LAYOUT_FAMILY, h, 0)
    if avoid_layout and layout[0] == avoid_layout:
        layout = _pick(LAYOUT_FAMILY, h, 1)

    anchor = _pick(IMAGE_ANCHOR, h, 3)
    typography = _pick(TYPOGRAPHY_MODE, h, 5)
    texture = _pick(TEXTURE_MODE, h, 7)
    mood = _pick(MOOD_MODE, h, 11)
    paper = _pick(PAPER_TONES, h, 13)

    if mono:
        color_phrase, color_name = ("muted grayscale ink only", "monochrome")
    else:
        color_phrase, color_name = _pick(COLOR_ANCHORS, h, 17)

    return Recipe(
        layout_key=layout[0], layout_desc=layout[1], anchor=anchor,
        typography=typography, texture=texture, mood=mood,
        color_phrase=color_phrase, color_name=color_name, paper=paper,
    )


def compile_prompt(subject: str, recipe: Recipe,
                   text_line: Optional[str] = None,
                   has_reference_image: bool = False) -> str:
    """
    把主题 + 配方编译成四段式 zine prompt。

    Args:
        subject: 用户主题 / 核心意象（一句话）。
        recipe: choose_recipe 的结果。
        text_line: 图内出现的短句；None 时不强制放文字。
        has_reference_image: True 表示图生图，会保留参考图主体并做纸感改造。
    """
    subject = subject.strip() or "a quiet fragment of memory"

    # 参考图改造 vs 纯主题生成，措辞不同
    if has_reference_image:
        anchor_para = (
            f"Take the subject from the reference image and reinterpret it as a "
            f"{recipe.anchor} — one imageable metaphor for \"{subject}\". Make it "
            f"belong to paper through {recipe.texture}: low contrast, photocopy "
            f"softness, softened or torn edge, slight misregistration. Keep the "
            f"reference subject recognizable but flattened into a scanned-paper "
            f"element; do not reproduce its original background."
        )
    else:
        anchor_para = (
            f"One imageable subject: reinterpret \"{subject}\" as a {recipe.anchor}, "
            f"a single quiet metaphor. Give it {recipe.texture} so it belongs to "
            f"paper: low contrast, softened or torn edge, slight misregistration. "
            f"No illustrated scene, just one fragment."
        )

    # 段1：画布 + 纸 + 留白 + 视觉簇
    p1 = (
        f"A tall vertical 3:5 phone-poster on full-frame {recipe.paper}; no border, "
        f"no mockup, no frame. 70%-90% of the canvas reads as plain empty paper. "
        f"One small visual cluster occupies roughly 8%-25% of the canvas, arranged as "
        f"{recipe.layout_desc}; never edge-hugging."
    )

    # 段2：主体 + 锚点处理
    p2 = anchor_para

    # 段3：排版 + 高饱和色策略 + 印刷缺陷（skill 要求点明确切色相+形态+占比）
    text_clause = (
        f"Include one short readable phrase \"{text_line}\" in small serif or "
        f"typewriter type"
        if text_line else
        "Include small serif or typewriter microtext, semi-legible"
    )
    if recipe.color_name == "monochrome":
        color_clause = (
            "Keep the whole poster muted grayscale with paper tones and gray/black ink "
            "only, no strong chromatic accent (user requested monochrome)."
        )
    else:
        color_clause = (
            f"Paper tones plus gray/black support ONE unmistakably high-chroma anchor: "
            f"{recipe.color_phrase} ({recipe.color_name}), rendered as the subject, a "
            f"flat silhouette, an irregular cutout or a substantial block. This "
            f"saturated color occupies about 0.8%-2.5% of the canvas (15%-35% of the "
            f"cluster) and stays clearly visible at thumbnail size. Preserve its "
            f"saturation even under grain or ink bleed; do NOT make it pale, muted, "
            f"faded or pastel."
        )
    p3 = (
        f"Typography: {recipe.typography}. {text_clause}; text may drift, press against "
        f"the image edge, blur or misregister. {color_clause} Add print defects: "
        f"halftone, scanline, ink bleed, xerox wear, paper fibers."
    )

    # 段4：平扫氛围 + 负向约束
    p4 = (
        f"Overall: a flat orthographic scanned-paper appearance, matte absorbent paper, "
        f"diffuse light, low-to-medium contrast, no hard shadow, no 3D depth. Emotional "
        f"temperature: {recipe.mood}, poetic, nostalgic, diary-like, archival, like a "
        f"Japanese/Korean indie zine or minimal editorial. AVOID: {AVOID_LIST}."
    )

    return "\n\n".join([p1, p2, p3, p4])


if __name__ == "__main__":
    import sys
    subj = sys.argv[1] if len(sys.argv) > 1 else "雨后的旧车站"
    seed = subj + "|demo-seed"
    r = choose_recipe(seed)
    print("Recipe:", r.as_line())
    print("-" * 60)
    print(compile_prompt(subj, r, text_line=None, has_reference_image=True))
