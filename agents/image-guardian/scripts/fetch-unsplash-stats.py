#!/usr/bin/env python3
"""
影像守门员 - Unsplash 统计数据获取
"""

import json
import os
import requests
from datetime import datetime
from pathlib import Path

# 路径配置
AGENT_DIR = Path.home() / ".claude" / "agents" / "image-guardian"
CONFIG_PATH = AGENT_DIR / "config" / "unsplash-config.json"
DATA_DIR = AGENT_DIR / "data" / "daily-stats"

def load_config():
    """加载配置"""
    with open(CONFIG_PATH, 'r') as f:
        return json.load(f)

def fetch_user_stats(access_key, username):
    """获取用户总体统计"""
    url = f"https://api.unsplash.com/users/{username}/statistics"
    headers = {"Authorization": f"Client-ID {access_key}"}
    params = {"resolution": "days", "quantity": 30}

    response = requests.get(url, headers=headers, params=params)
    response.raise_for_status()
    return response.json()

def fetch_photos_stats(access_key, username):
    """获取所有照片的统计"""
    url = f"https://api.unsplash.com/users/{username}/photos"
    headers = {"Authorization": f"Client-ID {access_key}"}
    params = {"stats": "true", "per_page": 30, "order_by": "popular"}

    response = requests.get(url, headers=headers, params=params)
    response.raise_for_status()
    return response.json()

def fetch_user_info(access_key, username):
    """获取用户基本信息"""
    url = f"https://api.unsplash.com/users/{username}"
    headers = {"Authorization": f"Client-ID {access_key}"}

    response = requests.get(url, headers=headers)
    response.raise_for_status()
    return response.json()

def save_daily_stats(stats):
    """保存每日统计"""
    today = datetime.now().strftime("%Y-%m-%d")
    filepath = DATA_DIR / f"{today}.json"

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)

    print(f"统计数据已保存: {filepath}")
    return filepath

def get_yesterday_stats():
    """获取昨日统计用于对比"""
    from datetime import timedelta
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    filepath = DATA_DIR / f"{yesterday}.json"

    if filepath.exists():
        with open(filepath, 'r') as f:
            return json.load(f)
    return None

def main():
    config = load_config()
    access_key = config["access_key"]
    username = config["username"]

    if access_key == "YOUR_ACCESS_KEY_HERE":
        print("请先在 config/unsplash-config.json 中配置 API Key")
        return

    print(f"正在获取 @{username} 的 Unsplash 统计数据...")

    # 获取数据
    user_stats = fetch_user_stats(access_key, username)
    photos_stats = fetch_photos_stats(access_key, username)

    # 计算照片总点赞数（从照片列表累加）
    total_likes = sum(p.get("likes", 0) for p in photos_stats)

    # 整理统计
    stats = {
        "date": datetime.now().strftime("%Y-%m-%d"),
        "username": username,
        "summary": {
            "downloads": user_stats["downloads"]["total"],
            "views": user_stats["views"]["total"],
            "likes": total_likes
        },
        "history": {
            "downloads": user_stats["downloads"]["historical"]["values"],
            "views": user_stats["views"]["historical"]["values"]
        },
        "top_photos": [
            {
                "id": p["id"],
                "description": p.get("description") or p.get("alt_description") or "无描述",
                "downloads": p["statistics"]["downloads"]["total"],
                "views": p["statistics"]["views"]["total"],
                "likes": p["likes"]
            }
            for p in photos_stats[:5]
        ]
    }

    # 对比昨日
    yesterday = get_yesterday_stats()
    if yesterday:
        stats["changes"] = {
            "downloads": stats["summary"]["downloads"] - yesterday["summary"]["downloads"],
            "views": stats["summary"]["views"] - yesterday["summary"]["views"],
            "likes": stats["summary"]["likes"] - yesterday["summary"].get("likes", 0)
        }

    # 保存
    save_daily_stats(stats)

    # 打印摘要
    print(f"\n📊 {username} 的 Unsplash 数据")
    print(f"   下载: {stats['summary']['downloads']:,}")
    print(f"   浏览: {stats['summary']['views']:,}")
    print(f"   点赞: {stats['summary']['likes']:,}")

    if "changes" in stats:
        print(f"\n📈 较昨日变化")
        print(f"   下载: {stats['changes']['downloads']:+d}")
        print(f"   浏览: {stats['changes']['views']:+d}")
        print(f"   点赞: {stats['changes']['likes']:+d}")

    return stats

if __name__ == "__main__":
    main()
