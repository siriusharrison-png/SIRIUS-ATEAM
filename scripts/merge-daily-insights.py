#!/usr/bin/env python3
"""
多设备日报汇总脚本
- 汇总所有设备的 daily-insights
- 生成统一的日报（分设备展示 + 汇总统计）
- 推送到飞书
"""

import json
import os
import sys
import requests
from pathlib import Path
from datetime import datetime, timezone, timedelta
from collections import defaultdict

# 配置
USAGE_DATA_DIR = Path(os.environ.get("USAGE_DATA_DIR", "./usage-data"))
FEISHU_WEBHOOK = os.environ.get("FEISHU_WEBHOOK", "")

# 成本估算已移除（2026-08-15）。原实现按「全量输入 × Opus 单价」计算，
# 未扣除缓存命中，数字虚高数倍（实测一个会话 2160 万缓存读取被当作新增输入计价），
# 且卡片脚注写「按 Sonnet 估算」而代码用 Opus 单价，标签与实现不一致。
# 改为展示输入/输出比与当天实际使用的模型。


def format_tokens(tokens):
    """格式化 token 数量"""
    if tokens >= 1_000_000:
        return f"{tokens/1_000_000:.2f}M"
    elif tokens >= 1_000:
        return f"{tokens/1_000:.1f}K"
    return str(tokens)


def format_ratio(input_tokens, output_tokens):
    """输入/输出比，写成 N:1 的形式。输出为 0 时返回占位符。"""
    if not output_tokens:
        return "-"
    return f"{input_tokens / output_tokens:.0f}:1"


def short_model(name):
    """把 claude-opus-5 这类模型 ID 缩短成便于阅读的名字。"""
    n = name.replace("claude-", "")
    for suffix in ("-20250929", "-20251001"):
        n = n.replace(suffix, "")
    return n


def load_all_device_insights(target_date):
    """加载所有设备的 insights"""
    devices_dir = USAGE_DATA_DIR / "devices"
    all_insights = []

    if not devices_dir.exists():
        print(f"设备目录不存在: {devices_dir}")
        return all_insights

    for device_dir in devices_dir.iterdir():
        if device_dir.is_dir():
            device_id = device_dir.name
            insights_file = device_dir / "daily-insights" / f"{target_date}.json"

            if insights_file.exists():
                try:
                    with open(insights_file, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        data["device_id"] = device_id
                        all_insights.append(data)
                        print(f"  加载 [{device_id}] {target_date}")
                except Exception as e:
                    print(f"  加载 [{device_id}] 失败: {e}")

    return all_insights


def merge_insights(all_insights, target_date):
    """合并所有设备的 insights"""
    if not all_insights:
        return None

    merged = {
        "date": target_date,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "devices": [],
        "totals": {
            "total_sessions": 0,
            "total_input_tokens": 0,
            "total_output_tokens": 0,
            "total_cache_read_tokens": 0,
            "total_cache_write_tokens": 0
        },
        "all_tools": defaultdict(int),
        "all_models": defaultdict(int),
        "all_sessions": []
    }

    for insight in all_insights:
        device_id = insight.get("device_id", "unknown")
        stats = insight.get("stats", {})

        # 记录设备详情
        merged["devices"].append({
            "device_id": device_id,
            "sessions": stats.get("total_sessions", 0),
            "input_tokens": stats.get("total_input_tokens", 0),
            "output_tokens": stats.get("total_output_tokens", 0),
            "cache_read_tokens": stats.get("total_cache_read_tokens", 0),
            "cache_write_tokens": stats.get("total_cache_write_tokens", 0),
            "models": stats.get("models", {}),
            "top_tools": stats.get("top_tools", {})
        })

        # 累加统计
        merged["totals"]["total_sessions"] += stats.get("total_sessions", 0)
        merged["totals"]["total_input_tokens"] += stats.get("total_input_tokens", 0)
        merged["totals"]["total_output_tokens"] += stats.get("total_output_tokens", 0)
        merged["totals"]["total_cache_read_tokens"] += stats.get("total_cache_read_tokens", 0)
        merged["totals"]["total_cache_write_tokens"] += stats.get("total_cache_write_tokens", 0)

        # 汇总模型使用次数（跨设备）
        for mdl, cnt in (stats.get("models") or {}).items():
            merged["all_models"][mdl] += cnt

        # 合并工具使用
        for tool, count in stats.get("top_tools", {}).items():
            merged["all_tools"][tool] += count

        # 合并会话列表
        for session in insight.get("sessions", []):
            session["device_id"] = device_id
            merged["all_sessions"].append(session)

    # 转换 defaultdict 为 dict
    merged["all_tools"] = dict(merged["all_tools"])
    merged["all_models"] = dict(
        sorted(merged["all_models"].items(), key=lambda x: x[1], reverse=True)
    )

    # 排序工具使用
    merged["top_tools"] = dict(
        sorted(merged["all_tools"].items(), key=lambda x: x[1], reverse=True)[:10]
    )

    # 输入/输出比
    merged["totals"]["io_ratio"] = format_ratio(
        merged["totals"]["total_input_tokens"],
        merged["totals"]["total_output_tokens"]
    )

    return merged


def push_to_feishu(all_insights, merged, target_date):
    """推送日报到飞书"""
    if not FEISHU_WEBHOOK:
        print("未配置 FEISHU_WEBHOOK，跳过推送")
        return

    if not all_insights or not merged:
        print("没有数据，跳过推送")
        return

    totals = merged["totals"]
    in_t = totals["total_input_tokens"]
    out_t = totals["total_output_tokens"]

    # ========== 汇总统计（一行） ==========
    summary_line = (
        f"**📊 今日汇总** ｜ {totals['total_sessions']} 会话 ｜ "
        f"输入 {format_tokens(in_t)} ／ 输出 {format_tokens(out_t)} ｜ "
        f"**比例 {totals.get('io_ratio', '-')}**"
    )

    # ========== 当天使用的模型 ==========
    models = merged.get("all_models") or {}
    if models:
        model_text = "　".join(f"`{short_model(m)}` × {c}" for m, c in models.items())
    else:
        model_text = "未记录"
    models_line = f"**🤖 今日模型** ｜ {model_text}"

    # ========== 分设备统计表格 ==========
    device_rows = []
    for device in merged["devices"]:
        device_id = device["device_id"]
        sessions = device["sessions"]
        input_t = device["input_tokens"]
        output_t = device["output_tokens"]
        ratio = format_ratio(input_t, output_t)

        # 工具统计（取前2个）
        tools = device.get("top_tools", {})
        tools_text = ", ".join([f"{t}({c})" for t, c in list(tools.items())[:2]]) or "-"

        # 该设备用的模型
        dev_models = device.get("models") or {}
        dev_model_text = ", ".join(short_model(m) for m in dev_models) or "-"

        device_rows.append(
            f"| 🖥️ {device_id} | {sessions} | {format_tokens(input_t)} "
            f"| {format_tokens(output_t)} | {ratio} | {dev_model_text} | {tools_text} |"
        )

    devices_table = f"""**📱 设备明细**

| 设备 | 会话 | 输入 | 输出 | 比例 | 模型 | 工具 |
|:-----|:----:|:----:|:----:|:----:|:-----|:-----|
{chr(10).join(device_rows)}"""

    # ========== 构建卡片 ==========
    card = {
        "msg_type": "interactive",
        "card": {
            "header": {
                "title": {
                    "tag": "plain_text",
                    "content": f"🤖 Claude 小秘书日报 | {target_date}"
                },
                "template": "blue"
            },
            "elements": [
                {
                    "tag": "div",
                    "text": {
                        "tag": "lark_md",
                        "content": summary_line
                    }
                },
                {
                    "tag": "div",
                    "text": {
                        "tag": "lark_md",
                        "content": models_line
                    }
                },
                {
                    "tag": "div",
                    "text": {
                        "tag": "lark_md",
                        "content": devices_table
                    }
                },
                {
                    "tag": "note",
                    "elements": [
                        {
                            "tag": "plain_text",
                            "content": f"共 {len(all_insights)} 台设备"
                        }
                    ]
                }
            ]
        }
    }

    try:
        resp = requests.post(FEISHU_WEBHOOK, json=card, timeout=10)
        result = resp.json()
        if result.get("StatusCode") == 0 or result.get("code") == 0:
            print("飞书推送成功")
        else:
            print(f"飞书推送失败: {result}")
    except Exception as e:
        print(f"飞书推送异常: {e}")


def main():
    beijing_tz = timezone(timedelta(hours=8))
    today = datetime.now(beijing_tz).strftime("%Y-%m-%d")

    # 支持命令行参数指定日期
    target_date = sys.argv[1] if len(sys.argv) > 1 else today

    print(f"汇总 {target_date} 的日报")

    # 加载所有设备数据
    all_insights = load_all_device_insights(target_date)

    if not all_insights:
        print(f"没有找到 {target_date} 的数据")
        return

    # 合并数据
    merged = merge_insights(all_insights, target_date)

    # 保存合并后的数据
    merged_dir = USAGE_DATA_DIR / "merged"
    merged_dir.mkdir(parents=True, exist_ok=True)
    merged_file = merged_dir / f"{target_date}.json"

    with open(merged_file, 'w', encoding='utf-8') as f:
        json.dump(merged, f, indent=2, ensure_ascii=False)
    print(f"已保存汇总数据: {merged_file}")

    # 推送飞书
    push_to_feishu(all_insights, merged, target_date)


if __name__ == "__main__":
    main()
