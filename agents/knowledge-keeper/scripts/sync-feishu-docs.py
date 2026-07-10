#!/usr/bin/env python3
"""
知识管理 Agent - 飞书文档同步
每天读取飞书文档，提取 URL，补充到 Notion
"""

import os
import sys
import json
import requests
from datetime import datetime
from pathlib import Path
import re

# 配置
FEISHU_APP_ID = os.environ.get("FEISHU_APP_ID", "")
FEISHU_APP_SECRET = os.environ.get("FEISHU_APP_SECRET", "")
FEISHU_WIKI_ID = "BW3ZwOSQZiHWGuk96wVcPRhynJb"  # 飞书文档 ID
NOTION_API_KEY = os.environ.get("NOTION_API_KEY", "")
NOTION_DATABASE_ID = os.environ.get("NOTION_DATABASE_ID", "")

NOTION_API = "https://api.notion.com/v1"
FEISHU_API = "https://open.feishu.cn/open-apis"


def get_feishu_tenant_token():
    """获取飞书 tenant_access_token"""
    url = f"{FEISHU_API}/auth/v3/tenant_access_token/internal"
    payload = {
        "app_id": FEISHU_APP_ID,
        "app_secret": FEISHU_APP_SECRET
    }

    resp = requests.post(url, json=payload)
    resp.raise_for_status()
    data = resp.json()

    if data.get("code") != 0:
        raise Exception(f"飞书认证失败: {data.get('msg')}")

    return data["tenant_access_token"]


def fetch_feishu_wiki_content(token):
    """获取飞书 Wiki 文档内容"""
    url = f"{FEISHU_API}/wiki/v2/spaces/{FEISHU_WIKI_ID}"
    headers = {"Authorization": f"Bearer {token}"}

    resp = requests.get(url, headers=headers)
    resp.raise_for_status()
    data = resp.json()

    if data.get("code") != 0:
        raise Exception(f"获取飞书文档失败: {data.get('msg')}")

    return data.get("data", {})


def extract_urls_from_text(text):
    """从文本中提取 URL"""
    if not text:
        return []

    # URL 正则表达式
    url_pattern = r'https?://[^\s\)"\']+'
    urls = re.findall(url_pattern, text)
    return list(set(urls))  # 去重


def get_notion_existing_urls():
    """获取 Notion 中已有的 URL，避免重复"""
    url = f"{NOTION_API}/databases/{NOTION_DATABASE_ID}/query"
    headers = {
        "Authorization": f"Bearer {NOTION_API_KEY}",
        "Notion-Version": "2022-06-28"
    }

    try:
        resp = requests.post(url, headers=headers, json={})
        resp.raise_for_status()
        data = resp.json()

        existing_urls = set()
        for result in data.get("results", []):
            props = result.get("properties", {})
            if "URL" in props and props["URL"].get("url"):
                existing_urls.add(props["URL"]["url"])

        return existing_urls
    except:
        return set()


def add_to_notion(title, url, category="飞书文档"):
    """添加知识条目到 Notion"""
    url_endpoint = f"{NOTION_API}/pages"
    headers = {
        "Authorization": f"Bearer {NOTION_API_KEY}",
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json"
    }

    payload = {
        "parent": {
            "database_id": NOTION_DATABASE_ID
        },
        "properties": {
            "Title": {
                "title": [
                    {
                        "text": {
                            "content": title
                        }
                    }
                ]
            },
            "URL": {
                "url": url
            },
            "Category": {
                "select": {
                    "name": category
                }
            },
            "Date Added": {
                "date": {
                    "start": datetime.now().strftime("%Y-%m-%d")
                }
            }
        }
    }

    try:
        resp = requests.post(url_endpoint, headers=headers, json=payload)
        resp.raise_for_status()
        return True, resp.json().get("id")
    except Exception as e:
        print(f"添加到 Notion 失败: {e}")
        return False, None


def main():
    print(f"知识管理 - 飞书文档同步 ({datetime.now().strftime('%Y-%m-%d %H:%M')})")

    # 检查必需的环境变量
    if not FEISHU_APP_ID or not FEISHU_APP_SECRET:
        print("错误: 缺少飞书认证信息 (FEISHU_APP_ID, FEISHU_APP_SECRET)")
        sys.exit(1)

    if not NOTION_API_KEY or not NOTION_DATABASE_ID:
        print("错误: 缺少 Notion 配置 (NOTION_API_KEY, NOTION_DATABASE_ID)")
        sys.exit(1)

    try:
        # 1. 获取飞书 token
        print("获取飞书 token...")
        token = get_feishu_tenant_token()

        # 2. 获取飞书文档内容
        print("获取飞书文档内容...")
        wiki_data = fetch_feishu_wiki_content(token)

        # 3. 提取 URL
        print("提取 URL...")
        content = wiki_data.get("description", "")
        urls = extract_urls_from_text(content)
        print(f"  发现 {len(urls)} 个 URL")

        # 4. 获取 Notion 中已有的 URL
        existing_urls = get_notion_existing_urls()
        print(f"  Notion 中已有 {len(existing_urls)} 个 URL")

        # 5. 添加新 URL 到 Notion
        new_count = 0
        for url in urls:
            if url not in existing_urls:
                title = url.split("/")[-1][:50]  # 简单的标题提取
                success, page_id = add_to_notion(title, url, category="飞书文档")
                if success:
                    new_count += 1
                    print(f"  ✅ 添加: {title}")

        print(f"\n✅ 同步完成: 新增 {new_count} 个知识条目")

    except Exception as e:
        print(f"❌ 同步失败: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
