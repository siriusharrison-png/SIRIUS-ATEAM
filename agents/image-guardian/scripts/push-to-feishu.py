#!/usr/bin/env python3
"""
影像守门员 - 飞书推送
"""

import json
import requests
from datetime import datetime
from pathlib import Path

AGENT_DIR = Path.home() / ".claude" / "agents" / "image-guardian"
CONFIG_PATH = AGENT_DIR / "config" / "unsplash-config.json"
DATA_DIR = AGENT_DIR / "data" / "daily-stats"
TRENDING_PATH = AGENT_DIR / "data" / "trending-keywords.json"

def load_config():
    with open(CONFIG_PATH, 'r') as f:
        return json.load(f)

def load_today_stats():
    today = datetime.now().strftime("%Y-%m-%d")
    filepath = DATA_DIR / f"{today}.json"
    if filepath.exists():
        with open(filepath, 'r') as f:
            return json.load(f)
    return None

def load_trending():
    """加载热门关键词"""
    if TRENDING_PATH.exists():
        with open(TRENDING_PATH, 'r') as f:
            return json.load(f)
    return None

def format_change(value):
    """格式化变化值"""
    if value > 0:
        return f"↑{value:,}"
    elif value < 0:
        return f"↓{abs(value):,}"
    return "→0"

def pick_latest_day(stats):
    """取 history 中日期最大的一天，返回 (日期, 下载, 浏览)。

    Unsplash 的 historical.values 末尾是上一个自然日，不是当天。
    必须把数据归属的真实日期一起带出来做表头，否则卡片标题写今天、
    数字却是别的一天，看起来就是"两天数据一样"。
    """
    history = (stats or {}).get("history") or {}

    def latest(key):
        items = [v for v in (history.get(key) or []) if v.get("date")]
        if not items:
            return None, 0
        top = max(items, key=lambda v: v["date"])
        return top["date"], top.get("value", 0)

    d_date, downloads = latest("downloads")
    v_date, views = latest("views")
    return (d_date or v_date), downloads, views

def build_feishu_card(stats, trending):
    """构建飞书卡片消息"""

    # 最近一个完整自然日的数据（Unsplash 不提供当天实时值）
    day_date, day_downloads, day_views = pick_latest_day(stats)
    day_label = day_date or "最近一日"

    # 获取热门关键词（取前 8 个）
    trending_keywords = []
    if trending:
        trending_keywords = trending.get("topics", [])[:8]
    trending_text = ", ".join(trending_keywords) if trending_keywords else "暂无数据"

    card = {
        "msg_type": "interactive",
        "card": {
            "header": {
                "title": {
                    "tag": "plain_text",
                    "content": f"Unsplash 日报 | {stats['date']}"
                },
                "template": "blue"
            },
            "elements": [
                {
                    "tag": "div",
                    "text": {
                        "tag": "lark_md",
                        "content": f"""**@{stats['username']}**

| 指标 | {day_label} | 累计 |
|------|------|------|
| 下载 | +{day_downloads:,} | {stats['summary']['downloads']:,} |
| 浏览 | +{day_views:,} | {stats['summary']['views']:,} |
| 点赞 | - | {stats['summary']['likes']:,} |

**热门关键词**
{trending_text}
"""
                    }
                }
            ]
        }
    }

    return card

def send_to_feishu(webhook_url, card):
    """发送到飞书"""
    response = requests.post(webhook_url, json=card)
    response.raise_for_status()
    return response.json()

def main():
    config = load_config()
    webhook = config.get("feishu_webhook")

    if not webhook:
        print("请先配置飞书 Webhook")
        return

    stats = load_today_stats()
    if not stats:
        print("今日统计数据不存在，请先运行 fetch-unsplash-stats.py")
        return

    trending = load_trending()
    card = build_feishu_card(stats, trending)
    result = send_to_feishu(webhook, card)

    if result.get("StatusCode") == 0:
        print("✅ 飞书推送成功")
    else:
        print(f"❌ 推送失败: {result}")

if __name__ == "__main__":
    main()
