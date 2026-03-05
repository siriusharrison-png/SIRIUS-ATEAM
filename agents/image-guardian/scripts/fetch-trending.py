#!/usr/bin/env python3
"""
影像守门员 - 热门关键词抓取
"""

import json
import requests
from datetime import datetime
from pathlib import Path

AGENT_DIR = Path.home() / ".claude" / "agents" / "image-guardian"
CONFIG_PATH = AGENT_DIR / "config" / "unsplash-config.json"
DATA_DIR = AGENT_DIR / "data"

def load_config():
    with open(CONFIG_PATH, 'r') as f:
        return json.load(f)

def fetch_explore_topics():
    """通过 Unsplash API 获取热门 Topics"""
    config = load_config()
    url = "https://api.unsplash.com/topics"
    headers = {"Authorization": f"Client-ID {config['access_key']}"}
    params = {"per_page": 20, "order_by": "featured"}

    try:
        response = requests.get(url, headers=headers, params=params)
        response.raise_for_status()
        topics_data = response.json()
        return [t["slug"] for t in topics_data]
    except Exception as e:
        print(f"获取 Topics 失败: {e}")
        # 返回预设的热门 Topics 作为后备
        return [
            "wallpapers", "nature", "3d-renders", "travel", "architecture-interior",
            "textures-patterns", "street-photography", "film", "animals", "fashion-beauty"
        ]

def fetch_search_suggestions(query=""):
    """获取搜索建议（模拟）"""
    # Unsplash 的搜索建议可能需要特定 API
    # 这里提供一些常见的热门类别
    common_trending = [
        "nature", "travel", "architecture", "minimal", "portrait",
        "street", "food", "animals", "technology", "abstract",
        "black-and-white", "landscape", "urban", "vintage", "night"
    ]
    return common_trending

def save_trending(data):
    """保存热门关键词"""
    filepath = DATA_DIR / "trending-keywords.json"

    result = {
        "updated_at": datetime.now().isoformat(),
        "topics": data.get("topics", []),
        "suggestions": data.get("suggestions", [])
    }

    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"热门关键词已保存: {filepath}")
    return result

def main():
    print("正在抓取 Unsplash 热门关键词...")

    topics = fetch_explore_topics()
    suggestions = fetch_search_suggestions()

    data = {
        "topics": topics,
        "suggestions": suggestions
    }

    save_trending(data)

    print(f"\n🔥 热门 Topics ({len(topics)} 个)")
    for i, topic in enumerate(topics[:10], 1):
        print(f"   {i}. {topic}")

    print(f"\n💡 推荐标签")
    print(f"   {', '.join(suggestions[:10])}")

    return data

if __name__ == "__main__":
    main()
