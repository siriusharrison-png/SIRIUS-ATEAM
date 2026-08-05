#!/usr/bin/env python3
"""prompt_compiler 的单元测试（零外部依赖，可离线跑）。"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from prompt_compiler import (  # noqa: E402
    choose_recipe, compile_prompt, LAYOUT_FAMILY,
)


class TestRecipe(unittest.TestCase):
    def test_deterministic(self):
        """同一种子必得同一配方（可复现）。"""
        a = choose_recipe("seed-x")
        b = choose_recipe("seed-x")
        self.assertEqual(a.as_line(), b.as_line())

    def test_seed_changes_recipe(self):
        """不同种子应大概率给出不同视觉语法。"""
        lines = {choose_recipe(f"s{i}").as_line() for i in range(20)}
        self.assertGreater(len(lines), 5)

    def test_avoid_layout(self):
        """指定要避开的 layout 时不应再选它。"""
        first = choose_recipe("fixed").layout_key
        second = choose_recipe("fixed", avoid_layout=first).layout_key
        self.assertNotEqual(first, second)

    def test_mono_mode(self):
        r = choose_recipe("seed", mono=True)
        self.assertEqual(r.color_name, "monochrome")


class TestCompile(unittest.TestCase):
    def setUp(self):
        self.recipe = choose_recipe("compile-seed")

    def test_four_paragraphs(self):
        p = compile_prompt("旧车站", self.recipe)
        self.assertEqual(len(p.split("\n\n")), 4)

    def test_reference_image_wording(self):
        """图生图应提到保留参考图主体。"""
        p = compile_prompt("旧车站", self.recipe, has_reference_image=True)
        self.assertIn("reference image", p)

    def test_text_line_embedded(self):
        p = compile_prompt("海", self.recipe, text_line="still here")
        self.assertIn("still here", p)

    def test_avoid_list_present(self):
        p = compile_prompt("海", self.recipe)
        self.assertIn("AVOID:", p)
        self.assertIn("no 3D", p)

    def test_color_anchor_not_weakened(self):
        """非单色时必须点明高饱和色且不弱化。"""
        p = compile_prompt("海", self.recipe)
        self.assertIn("high-chroma anchor", p)
        self.assertIn("do NOT make it pale", p)

    def test_empty_subject_fallback(self):
        p = compile_prompt("   ", self.recipe)
        self.assertIn("quiet fragment of memory", p)


if __name__ == "__main__":
    unittest.main(verbosity=2)
