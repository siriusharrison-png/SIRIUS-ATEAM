#!/usr/bin/env python3
"""pick_latest_day 的行为测试。"""
import importlib.util
import sys
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "run_daily_cloud", Path(__file__).parent / "run-daily-cloud.py"
)
mod = importlib.util.module_from_spec(spec)
sys.modules["run_daily_cloud"] = mod
spec.loader.exec_module(mod)

pick_latest_day = mod.pick_latest_day


def test_returns_real_date_from_api():
    """当日数值必须连带它真实归属的日期一起返回。"""
    stats = {"history": {
        "downloads": [{"date": "2026-08-25", "value": 57},
                      {"date": "2026-08-26", "value": 37}],
        "views": [{"date": "2026-08-25", "value": 6199},
                  {"date": "2026-08-26", "value": 6087}],
    }}
    assert pick_latest_day(stats) == ("2026-08-26", 37, 6087)


def test_handles_empty_history():
    assert pick_latest_day({"history": {"downloads": [], "views": []}}) == (None, 0, 0)
    assert pick_latest_day({}) == (None, 0, 0)


def test_unsorted_history_picks_max_date():
    """API 若乱序返回，也要取日期最大的那天，而不是数组末尾。"""
    stats = {"history": {
        "downloads": [{"date": "2026-08-26", "value": 37},
                      {"date": "2026-08-25", "value": 57}],
        "views": [{"date": "2026-08-26", "value": 6087},
                  {"date": "2026-08-25", "value": 6199}],
    }}
    assert pick_latest_day(stats) == ("2026-08-26", 37, 6087)


if __name__ == "__main__":
    import traceback
    failed = 0
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn()
                print(f"PASS {name}")
            except Exception:
                failed += 1
                print(f"FAIL {name}")
                traceback.print_exc()
    sys.exit(1 if failed else 0)
