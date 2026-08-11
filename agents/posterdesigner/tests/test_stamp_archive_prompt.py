#!/usr/bin/env python3
"""stamp_archive_prompt 的单元测试（零外部依赖，可离线跑）。"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from stamp_archive_prompt import (  # noqa: E402
    build_recipe, compile_prompt, PhotoRequiredError, PROMPT_FILE,
    SEAL_SHAPES, SEAL_CORNERS, SPLICE_MODES,
)


class TestStampRecipe(unittest.TestCase):
    def test_defaults_are_auto_and_landscape(self):
        r = build_recipe()
        self.assertEqual(r.seal_shape, "auto")
        self.assertEqual(r.seal_corner, "auto")
        self.assertEqual(r.splice, "lr")
        self.assertEqual(r.size, "1536x1024")   # 左右拼接 → 横版

    def test_top_bottom_splice_is_portrait(self):
        self.assertEqual(build_recipe(splice="tb").size, "1024x1536")

    def test_illegal_values_fall_back_to_default(self):
        r = build_recipe(seal_shape="triangle", seal_corner="middle", splice="diagonal")
        self.assertEqual(r.seal_shape, "auto")
        self.assertEqual(r.seal_corner, "auto")
        self.assertEqual(r.splice, "lr")

    def test_value_normalization_is_case_insensitive(self):
        self.assertEqual(build_recipe(seal_shape="SQUARE").seal_shape, "square")
        self.assertEqual(build_recipe(seal_corner="Lower-Right").seal_corner, "lower-right")

    def test_recipe_line_contains_all_axes(self):
        line = build_recipe(seal_shape="square", seal_corner="lower-right",
                            splice="tb", subject_hint="钟楼").as_line()
        self.assertIn("photo-stamp-archive", line)
        self.assertIn("方形边框", line)
        self.assertIn("右下", line)
        self.assertIn("上下拼接", line)
        self.assertIn("意象:钟楼", line)
        self.assertIn("文字:默认英文", line)

    def test_recipe_line_custom_text(self):
        self.assertIn("文字:HARBOUR", build_recipe(text_line="HARBOUR").as_line())


class TestStampCompile(unittest.TestCase):
    def test_photo_required(self):
        """无参考照片必须抛错（照片是唯一内容来源）。"""
        with self.assertRaises(PhotoRequiredError):
            compile_prompt(build_recipe(), has_reference_image=False)

    def test_local_prompt_file_exists(self):
        """本地中文正文副本必须存在，保证 agent 自包含。"""
        self.assertTrue(PROMPT_FILE.exists(), f"缺少本地 prompt 正文: {PROMPT_FILE}")

    def test_base_prompt_signature(self):
        """正文应含核心约束：图章、暖白纸、直缝、留白。"""
        p = compile_prompt(build_recipe(), has_reference_image=True)
        self.assertIn("图章", p)
        self.assertIn("暖白", p)
        self.assertIn("笔直", p)
        self.assertIn("留白", p)

    def test_splice_rule_always_explicit(self):
        """拼接方向必须始终写进 prompt（它同时决定画布横竖）。"""
        self.assertIn("竖直", compile_prompt(build_recipe(splice="lr"), True))
        self.assertIn("水平", compile_prompt(build_recipe(splice="tb"), True))

    def test_square_seal_demands_four_sided_border(self):
        p = compile_prompt(build_recipe(seal_shape="square"), True)
        self.assertIn("四条边", p)
        self.assertIn("方形墨框", p)

    def test_auto_shape_adds_no_shape_rule(self):
        """auto 时不应写死任何形状约束，交给模型按主体定形。"""
        p = compile_prompt(build_recipe(seal_shape="auto", seal_corner="auto"), True)
        self.assertNotIn("必须使用明显可辨的圆形", p)
        self.assertNotIn("整组必须落在", p)

    def test_corner_rule_written_when_chosen(self):
        self.assertIn("左上区域", compile_prompt(build_recipe(seal_corner="upper-left"), True))

    def test_default_text_is_english_only(self):
        p = compile_prompt(build_recipe(), has_reference_image=True)
        self.assertIn("仅英文", p)

    def test_custom_text_verbatim(self):
        p = compile_prompt(build_recipe(text_line="HARBOUR"), True)
        self.assertIn("HARBOUR", p)
        self.assertIn("不要翻译", p)

    def test_subject_hint_does_not_override_photo(self):
        p = compile_prompt(build_recipe(subject_hint="黄昏"), True)
        self.assertIn("黄昏", p)
        self.assertIn("不得凭此虚构", p)

    def test_every_table_entry_is_wellformed(self):
        """三张表的结构完整性：label 非空，形状/角落含约束文案（auto 除外）。"""
        for k, (label, rule) in SEAL_SHAPES.items():
            self.assertTrue(label, f"SEAL_SHAPES[{k}] 缺 label")
            if k != "auto":
                self.assertTrue(rule, f"SEAL_SHAPES[{k}] 缺约束文案")
        for k, (label, rule) in SEAL_CORNERS.items():
            self.assertTrue(label, f"SEAL_CORNERS[{k}] 缺 label")
            if k != "auto":
                self.assertTrue(rule, f"SEAL_CORNERS[{k}] 缺约束文案")
        for k, (label, rule, size) in SPLICE_MODES.items():
            self.assertTrue(label and rule, f"SPLICE_MODES[{k}] 字段不全")
            self.assertRegex(size, r"^\d+x\d+$", f"SPLICE_MODES[{k}] size 格式错误")


if __name__ == "__main__":
    unittest.main(verbosity=2)
