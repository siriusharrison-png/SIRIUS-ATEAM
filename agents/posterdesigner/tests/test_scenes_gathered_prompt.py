#!/usr/bin/env python3
"""scenes_gathered_prompt 的单元测试（零外部依赖，可离线跑）。"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from scenes_gathered_prompt import (  # noqa: E402
    build_recipe, compile_prompt, PhotoRequiredError, PROMPT_FILE,
)


class TestScenesRecipe(unittest.TestCase):
    def test_recipe_line_default_text(self):
        r = build_recipe(subject_hint="山间旧屋")
        line = r.as_line()
        self.assertIn("scenes-gathered-zine", line)
        self.assertIn("意象:山间旧屋", line)
        self.assertIn("微文字:默认英文", line)

    def test_recipe_line_custom_text(self):
        r = build_recipe(text_line="After the rain")
        self.assertIn("微文字:After the rain", r.as_line())


class TestScenesCompile(unittest.TestCase):
    def test_photo_required(self):
        """无参考照片必须抛错（照片是唯一内容来源）。"""
        r = build_recipe()
        with self.assertRaises(PhotoRequiredError):
            compile_prompt(r, has_reference_image=False)

    def test_local_prompt_file_exists(self):
        """本地中文正文副本必须存在，保证 agent 自包含。"""
        self.assertTrue(PROMPT_FILE.exists(), f"缺少本地 prompt 正文: {PROMPT_FILE}")

    def test_base_prompt_signature(self):
        """正文应含签名语义与撕边/高饱和色等核心约束。"""
        p = compile_prompt(build_recipe(), has_reference_image=True)
        self.assertIn("实景拼贴", p)
        self.assertIn("撕", p)          # 手撕纤维毛边
        self.assertIn("高饱和", p)

    def test_default_text_is_english_only(self):
        """未提供微文字时，补充约束应要求默认仅英文。"""
        p = compile_prompt(build_recipe(), has_reference_image=True)
        self.assertIn("仅英文", p)

    def test_custom_text_verbatim(self):
        """提供微文字时应原样嵌入且要求不翻译。"""
        p = compile_prompt(build_recipe(text_line="Almost home"),
                           has_reference_image=True)
        self.assertIn("Almost home", p)
        self.assertIn("不要翻译", p)

    def test_subject_hint_does_not_override_photo(self):
        """意象提示只作命名参考，不得覆盖照片事实。"""
        p = compile_prompt(build_recipe(subject_hint="黄昏"),
                           has_reference_image=True)
        self.assertIn("黄昏", p)
        self.assertIn("不得凭此虚构", p)


if __name__ == "__main__":
    unittest.main(verbosity=2)
