#!/usr/bin/env python3
"""
工作流协调检查工具
验证所有工作流的调度是否合理、无冲突

用法:
  python scripts/check-workflow-schedule.py
"""

import re
import os
from pathlib import Path
from datetime import datetime, timedelta
from typing import List, Tuple

# 北京时间 = UTC + 8
BEIJING_TZ_OFFSET = 8


def parse_cron(cron_str: str) -> Tuple[int, int]:
    """
    解析 cron 表达式，返回 (minute, hour)
    简化版，只处理 "M H * * *" 格式
    """
    parts = cron_str.strip().split()
    if len(parts) < 2:
        raise ValueError(f"Invalid cron: {cron_str}")

    minute = int(parts[0])
    hour = int(parts[1])

    # 转换为北京时间
    beijing_hour = (hour + BEIJING_TZ_OFFSET) % 24
    beijing_minute = minute

    return beijing_minute, beijing_hour


def load_workflows() -> List[dict]:
    """加载所有工作流（使用正则表达式解析）"""
    workflows_dir = Path(".github/workflows")
    workflows = []

    if not workflows_dir.exists():
        print("❌ 错误：.github/workflows 目录不存在")
        return []

    for yml_file in workflows_dir.glob("*.yml"):
        try:
            with open(yml_file, 'r', encoding='utf-8') as f:
                content = f.read()

            # 使用正则表达式提取 cron 表达式
            # 匹配 "- cron: '0 0 * * *'" 这样的格式
            cron_pattern = r"cron:\s*['\"](\d+\s+\d+\s+\*\s+\*\s+\*)['\"]"
            matches = re.findall(cron_pattern, content)

            for cron_str in matches:
                try:
                    minute, hour = parse_cron(cron_str)
                    utc_hour = int(cron_str.split()[1])
                    utc_minute = int(cron_str.split()[0])

                    workflows.append({
                        'name': yml_file.stem,
                        'file': str(yml_file),
                        'cron': cron_str,
                        'utc_hour': utc_hour,
                        'utc_minute': utc_minute,
                        'beijing_hour': hour,
                        'beijing_minute': minute
                    })
                except Exception as e:
                    print(f"⚠️  警告：{yml_file.stem} 中的 cron 解析失败: {e}")

        except Exception as e:
            print(f"⚠️  警告：加载 {yml_file} 失败: {e}")

    return workflows


def check_conflicts(workflows: List[dict]) -> Tuple[bool, List[str]]:
    """检查工作流是否冲突"""
    conflicts = []

    # 按北京时间排序
    sorted_workflows = sorted(workflows, key=lambda w: (w['beijing_hour'], w['beijing_minute']))

    for i in range(len(sorted_workflows) - 1):
        current = sorted_workflows[i]
        next_wf = sorted_workflows[i + 1]

        # 假设每个工作流耗时 30 分钟
        current_end_hour = current['beijing_hour']
        current_end_minute = current['beijing_minute'] + 30
        if current_end_minute >= 60:
            current_end_hour = (current_end_hour + 1) % 24
            current_end_minute -= 60

        # 检查是否与下一个工作流重叠
        next_start_hour = next_wf['beijing_hour']
        next_start_minute = next_wf['beijing_minute']

        if current_end_hour == next_start_hour and current_end_minute > next_start_minute:
            conflicts.append(
                f"❌ {current['name']} (预计 {current_end_hour:02d}:{current_end_minute:02d} 结束) "
                f"与 {next_wf['name']} (开始于 {next_start_hour:02d}:{next_start_minute:02d}) 冲突"
            )

    return len(conflicts) == 0, conflicts


def print_schedule_table(workflows: List[dict]):
    """打印调度表"""
    print("\n📊 工作流调度表（北京时间）\n")
    print(f"{'时间':<10} {'Agent':<20} {'UTC Cron':<20} {'文件':<30}")
    print("─" * 80)

    # 按时间排序
    sorted_workflows = sorted(workflows, key=lambda w: (w['beijing_hour'], w['beijing_minute']))

    for wf in sorted_workflows:
        time_str = f"{wf['beijing_hour']:02d}:{wf['beijing_minute']:02d}"
        print(f"{time_str:<10} {wf['name']:<20} {wf['cron']:<20} {wf['file']:<30}")

    print()


def print_timeline(workflows: List[dict]):
    """打印时间线"""
    print("📈 24 小时时间线\n")

    # 创建 24 小时的时间线
    timeline = {}
    for wf in workflows:
        hour = wf['beijing_hour']
        if hour not in timeline:
            timeline[hour] = []
        timeline[hour].append(wf)

    for hour in range(24):
        hour_str = f"{hour:02d}:00"
        if hour in timeline:
            agents = ", ".join([wf['name'] for wf in timeline[hour]])
            print(f"{hour_str} ┌─ {agents}")
        else:
            print(f"{hour_str} │")

    print()


def main():
    print("🔍 工作流协调检查\n")

    workflows = load_workflows()

    if not workflows:
        print("❌ 没有找到任何定时工作流")
        return 1

    print(f"✅ 找到 {len(workflows)} 个工作流\n")

    # 打印调度表
    print_schedule_table(workflows)

    # 打印时间线
    print_timeline(workflows)

    # 检查冲突
    ok, conflicts = check_conflicts(workflows)

    if ok:
        print("✅ 所有工作流无冲突，调度合理\n")

        # 打印缓冲时间分析
        print("⏱️  缓冲时间分析（假设每个工作流耗时 30 分钟）\n")
        sorted_workflows = sorted(workflows, key=lambda w: (w['beijing_hour'], w['beijing_minute']))

        for i in range(len(sorted_workflows) - 1):
            current = sorted_workflows[i]
            next_wf = sorted_workflows[i + 1]

            current_end = current['beijing_hour'] * 60 + current['beijing_minute'] + 30
            next_start = next_wf['beijing_hour'] * 60 + next_wf['beijing_minute']

            if next_start < current_end:
                next_start += 24 * 60  # 跨天处理

            gap = next_start - current_end
            print(f"  {current['name']} → {next_wf['name']}: {gap} 分钟")

        print()
        return 0
    else:
        print("❌ 发现以下冲突：\n")
        for conflict in conflicts:
            print(conflict)
        print()
        return 1


if __name__ == "__main__":
    import sys
    sys.exit(main())
