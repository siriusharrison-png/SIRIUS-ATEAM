#!/usr/bin/env python3
"""
影像守门员 - 云端每日任务（GitHub Actions 专用）
从环境变量读取配置
"""

import os
import json
import requests
import time
from datetime import datetime, timezone, timedelta

# 从环境变量读取配置
ACCESS_KEY = os.environ.get("UNSPLASH_ACCESS_KEY", "")
USERNAME = os.environ.get("UNSPLASH_USERNAME", "siriusharrison")
FEISHU_WEBHOOK = os.environ.get("FEISHU_WEBHOOK", "")
NOTION_TOKEN = os.environ.get("NOTION_TOKEN", "")
NOTION_GALLERY_DB = os.environ.get("NOTION_GALLERY_DB", "")


def fetch_user_stats():
    """获取用户统计"""
    url = f"https://api.unsplash.com/users/{USERNAME}/statistics"
    headers = {"Authorization": f"Client-ID {ACCESS_KEY}"}
    params = {"resolution": "days", "quantity": 30}

    resp = requests.get(url, headers=headers, params=params)
    resp.raise_for_status()
    return resp.json()


def fetch_photos_stats():
    """获取照片统计"""
    url = f"https://api.unsplash.com/users/{USERNAME}/photos"
    headers = {"Authorization": f"Client-ID {ACCESS_KEY}"}
    params = {"stats": "true", "per_page": 30, "order_by": "popular"}

    resp = requests.get(url, headers=headers, params=params)
    resp.raise_for_status()
    return resp.json()


def fetch_trending():
    """获取热门关键词"""
    url = "https://api.unsplash.com/topics"
    headers = {"Authorization": f"Client-ID {ACCESS_KEY}"}
    params = {"per_page": 20, "order_by": "featured"}

    try:
        resp = requests.get(url, headers=headers, params=params)
        resp.raise_for_status()
        return [t["slug"] for t in resp.json()]
    except:
        return ["wallpapers", "nature", "travel", "architecture", "film"]


def wait_until_send_time():
    """等待到北京时间 9:00 再发送"""
    beijing_tz = timezone(timedelta(hours=8))
    now = datetime.now(beijing_tz)
    target_hour = 9

    # 如果当前时间已经过了 9:00，直接发送
    if now.hour >= target_hour:
        print(f"当前北京时间 {now.strftime('%H:%M')}，直接发送")
        return

    # 计算需要等待的秒数
    target = now.replace(hour=target_hour, minute=0, second=0, microsecond=0)
    wait_seconds = (target - now).total_seconds()

    print(f"当前北京时间 {now.strftime('%H:%M')}，等待到 09:00 发送...")
    print(f"需等待 {int(wait_seconds // 60)} 分钟")

    # 等待（每 10 分钟打印一次状态，避免超时）
    while wait_seconds > 0:
        sleep_time = min(600, wait_seconds)  # 最多 sleep 10 分钟
        time.sleep(sleep_time)
        wait_seconds -= sleep_time
        if wait_seconds > 0:
            remaining = int(wait_seconds // 60)
            print(f"继续等待，还剩 {remaining} 分钟...")

    print("到达发送时间 09:00")


def push_to_feishu(stats, trending):
    """推送到飞书"""
    if not FEISHU_WEBHOOK:
        print("未配置飞书 Webhook，跳过推送")
        return

    # 等待到 9:00
    wait_until_send_time()

    # 当日数据
    today_downloads = 0
    today_views = 0
    if "history" in stats:
        downloads_history = stats["history"].get("downloads", [])
        views_history = stats["history"].get("views", [])
        if downloads_history:
            today_downloads = downloads_history[-1].get("value", 0)
        if views_history:
            today_views = views_history[-1].get("value", 0)

    trending_text = ", ".join(trending[:8])

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
                        "content": f"""**@{USERNAME}**

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

    resp = requests.post(FEISHU_WEBHOOK, json=card)
    if resp.json().get("StatusCode") == 0:
        print("飞书推送成功")
    else:
        print(f"飞书推送失败: {resp.text}")


def main():
    print(f"影像守门员 - 云端任务开始 ({datetime.now().strftime('%Y-%m-%d %H:%M')})")

    if not ACCESS_KEY:
        print("错误: 未配置 UNSPLASH_ACCESS_KEY")
        return

    # 1. 获取统计
    print("获取 Unsplash 统计...")
    user_stats = fetch_user_stats()
    photos_stats = fetch_photos_stats()

    total_likes = sum(p.get("likes", 0) for p in photos_stats)

    stats = {
        "date": datetime.now().strftime("%Y-%m-%d"),
        "summary": {
            "downloads": user_stats["downloads"]["total"],
            "views": user_stats["views"]["total"],
            "likes": total_likes
        },
        "history": {
            "downloads": user_stats["downloads"]["historical"]["values"],
            "views": user_stats["views"]["historical"]["values"]
        }
    }

    print(f"  下载: {stats['summary']['downloads']:,}")
    print(f"  浏览: {stats['summary']['views']:,}")
    print(f"  点赞: {stats['summary']['likes']:,}")

    # 2. 获取热门关键词
    print("获取热门关键词...")
    trending = fetch_trending()
    print(f"  {', '.join(trending[:5])}...")

    # 3. 推送飞书
    print("推送飞书...")
    push_to_feishu(stats, trending)

    print("云端任务完成")


if __name__ == "__main__":
    main()
