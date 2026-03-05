#!/usr/bin/env python3
"""
影像守门员 - 每日任务（供定时任务调用）
"""

import subprocess
import sys
from pathlib import Path

SCRIPTS_DIR = Path.home() / ".claude" / "agents" / "image-guardian" / "scripts"

def run_script(name):
    """运行指定脚本"""
    script_path = SCRIPTS_DIR / name
    print(f"\n{'='*50}")
    print(f"执行: {name}")
    print('='*50)

    result = subprocess.run(
        [sys.executable, str(script_path)],
        capture_output=False
    )
    return result.returncode == 0

def main():
    print("🛡️ 影像守门员 - 每日任务开始")

    # 1. 获取统计数据
    if not run_script("fetch-unsplash-stats.py"):
        print("❌ 获取统计数据失败")
        return

    # 2. 抓取热门关键词
    run_script("fetch-trending.py")

    # 3. 同步到 Notion
    run_script("sync-to-notion.py")

    # 4. 推送到飞书
    run_script("push-to-feishu.py")

    print("\n✅ 影像守门员 - 每日任务完成")

if __name__ == "__main__":
    main()
