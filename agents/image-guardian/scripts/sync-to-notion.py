#!/usr/bin/env python3
"""
影像守门员 - Notion 同步
将 Unsplash 数据同步到 Notion 数据库
"""

import json
import requests
import time
from datetime import datetime
from pathlib import Path
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# 路径配置
AGENT_DIR = Path.home() / ".claude" / "agents" / "image-guardian"
CONFIG_PATH = AGENT_DIR / "config" / "unsplash-config.json"
DATA_DIR = AGENT_DIR / "data" / "daily-stats"

NOTION_API = "https://api.notion.com/v1"
NOTION_VERSION = "2022-06-28"


def get_session_with_retry():
    """创建带重试机制的 session"""
    session = requests.Session()
    retry = Retry(
        total=3,
        backoff_factor=1,
        status_forcelist=[500, 502, 503, 504],
    )
    adapter = HTTPAdapter(max_retries=retry)
    session.mount("https://", adapter)
    return session


# 全局 session
SESSION = get_session_with_retry()


def load_config():
    """加载配置"""
    with open(CONFIG_PATH, 'r') as f:
        return json.load(f)


def get_notion_headers(token):
    """获取 Notion API 请求头"""
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Notion-Version": NOTION_VERSION
    }


def load_today_stats():
    """加载今日统计数据"""
    today = datetime.now().strftime("%Y-%m-%d")
    filepath = DATA_DIR / f"{today}.json"
    if filepath.exists():
        with open(filepath, 'r') as f:
            return json.load(f)
    return None


def fetch_all_photos(access_key, username):
    """获取用户所有照片"""
    url = f"https://api.unsplash.com/users/{username}/photos"
    headers = {"Authorization": f"Client-ID {access_key}"}
    params = {"stats": "true", "per_page": 30, "order_by": "latest"}

    response = requests.get(url, headers=headers, params=params)
    response.raise_for_status()
    return response.json()


def query_existing_photos(token, database_id):
    """查询数据库中已存在的照片"""
    url = f"{NOTION_API}/databases/{database_id}/query"
    headers = get_notion_headers(token)

    response = SESSION.post(url, headers=headers, json={})
    response.raise_for_status()

    existing = {}
    for page in response.json().get("results", []):
        props = page.get("properties", {})
        unsplash_id = props.get("Unsplash ID", {}).get("rich_text", [])
        if unsplash_id:
            existing[unsplash_id[0]["plain_text"]] = page["id"]

    return existing


def create_photo_page(token, database_id, photo):
    """创建图片记录"""
    url = f"{NOTION_API}/pages"
    headers = get_notion_headers(token)

    description = photo.get("description") or photo.get("alt_description") or "无描述"
    photo_url = photo.get("urls", {}).get("regular", "")
    page_url = photo.get("links", {}).get("html", "")
    tags = [tag["title"] for tag in photo.get("tags", [])][:5]

    data = {
        "parent": {"database_id": database_id},
        "cover": {
            "type": "external",
            "external": {"url": photo_url}
        } if photo_url else None,
        "properties": {
            "名称": {
                "title": [{"text": {"content": description[:100]}}]
            },
            "Unsplash ID": {
                "rich_text": [{"text": {"content": photo["id"]}}]
            },
            "链接": {
                "url": page_url
            },
            "标签": {
                "multi_select": [{"name": tag} for tag in tags]
            },
            "上传日期": {
                "date": {"start": photo.get("created_at", "")[:10]}
            },
            "总下载": {
                "number": photo.get("statistics", {}).get("downloads", {}).get("total", 0)
            },
            "总浏览": {
                "number": photo.get("statistics", {}).get("views", {}).get("total", 0)
            },
            "总点赞": {
                "number": photo.get("likes", 0)
            },
            "最后同步": {
                "date": {"start": datetime.now().strftime("%Y-%m-%d")}
            }
        }
    }

    # 移除 None 值
    if data["cover"] is None:
        del data["cover"]

    response = SESSION.post(url, headers=headers, json=data)
    response.raise_for_status()
    return response.json()


def update_photo_page(token, page_id, photo):
    """更新图片记录"""
    url = f"{NOTION_API}/pages/{page_id}"
    headers = get_notion_headers(token)

    data = {
        "properties": {
            "总下载": {
                "number": photo.get("statistics", {}).get("downloads", {}).get("total", 0)
            },
            "总浏览": {
                "number": photo.get("statistics", {}).get("views", {}).get("total", 0)
            },
            "总点赞": {
                "number": photo.get("likes", 0)
            },
            "最后同步": {
                "date": {"start": datetime.now().strftime("%Y-%m-%d")}
            }
        }
    }

    response = requests.patch(url, headers=headers, json=data)
    response.raise_for_status()
    return response.json()


def sync_photos_to_notion(config, photos):
    """同步图片到 Notion 图片档案"""
    token = config["notion"]["token"]
    database_id = config["notion"]["gallery_database_id"]

    if not database_id:
        print("未配置图片档案数据库 ID")
        return

    print(f"\n📸 同步图片到 Notion...")

    # 查询已存在的照片
    existing = query_existing_photos(token, database_id)
    print(f"   数据库中已有 {len(existing)} 张照片")

    created = 0
    updated = 0

    for photo in photos:
        photo_id = photo["id"]
        desc = (photo.get("description") or photo.get("alt_description") or "无描述")[:20]

        if photo_id in existing:
            # 更新已存在的记录
            update_photo_page(token, existing[photo_id], photo)
            updated += 1
            print(f"   ↻ 更新: {desc}...")
        else:
            # 创建新记录
            create_photo_page(token, database_id, photo)
            created += 1
            print(f"   + 新增: {desc}...")

    print(f"\n   ✅ 同步完成: 新增 {created}, 更新 {updated}")


def sync_daily_stats_to_notion(config, stats):
    """同步每日统计到 Notion"""
    token = config["notion"]["token"]
    database_id = config["notion"]["stats_database_id"]

    if not database_id:
        print("未配置每日统计数据库 ID")
        return

    print(f"\n📊 同步每日统计到 Notion...")

    url = f"{NOTION_API}/pages"
    headers = get_notion_headers(token)

    changes = stats.get("changes", {})

    data = {
        "parent": {"database_id": database_id},
        "properties": {
            "日期": {
                "title": [{"text": {"content": stats["date"]}}]
            },
            "总下载": {
                "number": stats["summary"]["downloads"]
            },
            "总浏览": {
                "number": stats["summary"]["views"]
            },
            "总点赞": {
                "number": stats["summary"]["likes"]
            },
            "新增下载": {
                "number": changes.get("downloads", 0)
            },
            "新增浏览": {
                "number": changes.get("views", 0)
            },
            "新增点赞": {
                "number": changes.get("likes", 0)
            }
        }
    }

    response = SESSION.post(url, headers=headers, json=data)
    response.raise_for_status()

    print(f"   ✅ 已记录 {stats['date']} 的统计数据")


def main():
    config = load_config()

    notion_config = config.get("notion", {})
    if not notion_config.get("token"):
        print("请先配置 Notion Token")
        return

    access_key = config["access_key"]
    username = config["username"]

    print(f"🛡️ 影像守门员 - Notion 同步")
    print(f"   账号: @{username}")

    # 获取所有照片
    photos = fetch_all_photos(access_key, username)
    print(f"   从 Unsplash 获取到 {len(photos)} 张照片")

    # 同步图片档案
    sync_photos_to_notion(config, photos)

    # 同步每日统计
    stats = load_today_stats()
    if stats:
        sync_daily_stats_to_notion(config, stats)
    else:
        print("\n⚠️ 今日统计数据不存在，请先运行 fetch-unsplash-stats.py")

    print("\n✅ Notion 同步完成!")


if __name__ == "__main__":
    main()
