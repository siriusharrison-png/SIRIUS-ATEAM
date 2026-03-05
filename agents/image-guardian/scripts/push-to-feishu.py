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

def get_today_data(stats):
    """从 history 中获取当日数据"""
    today_downloads = 0
    today_views = 0

    if "history" in stats:
        downloads_history = stats["history"].get("downloads", [])
        views_history = stats["history"].get("views", [])

        if downloads_history:
            today_downloads = downloads_history[-1].get("value", 0)
        if views_history:
            today_views = views_history[-1].get("value", 0)

    return today_downloads, today_views

def build_feishu_card(stats, trending):
    """构建飞书卡片消息"""

    # 获取当日数据
    today_downloads, today_views = get_today_data(stats)

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

| 指标 | 当日 | 累计 |
|------|------|------|
| 下载 | +{today_downloads:,} | {stats['summary']['downloads']:,} |
| 浏览 | +{today_views:,} | {stats['summary']['views']:,} |
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
