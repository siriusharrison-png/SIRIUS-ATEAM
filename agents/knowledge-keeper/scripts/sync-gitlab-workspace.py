#!/usr/bin/env python3
"""
知识管理 Agent - GitLab Workspace 同步
定期检查 GitLab 上的文件，有更新就同步到 Notion
"""

import os
import sys
import json
import requests
from datetime import datetime
from pathlib import Path

# 配置
GITLAB_TOKEN = os.environ.get("GITLAB_TOKEN", "")
GITLAB_PROJECT_ID = "45898"  # product-agent/product_workspace
GITLAB_PATH = "knowledge/ux-dx-ax"  # 文件夹路径
NOTION_API_KEY = os.environ.get("NOTION_API_KEY", "")
NOTION_DATABASE_ID = os.environ.get("NOTION_DATABASE_ID", "")

GITLAB_API = "https://gitlab.paigod.work/api/v4"
NOTION_API = "https://api.notion.com/v1"

# 本地缓存文件，记录已同步的文件
CACHE_FILE = Path.home() / ".claude/agents/knowledge-keeper/gitlab-cache.json"


def raise_for_status_with_body(resp, label):
    """在 HTTP 失败时保留响应体，方便排查 CI 日志。"""
    if resp.ok:
        return

    body = resp.text.strip()
    if len(body) > 1000:
        body = body[:1000] + "...[truncated]"
    raise Exception(f"{label} failed: HTTP {resp.status_code} {resp.reason}; body={body}")


def get_gitlab_files(path, token):
    """获取 GitLab 仓库中指定路径的文件"""
    url = f"{GITLAB_API}/projects/{GITLAB_PROJECT_ID}/repository/tree"
    headers = {"PRIVATE-TOKEN": token}
    params = {"path": path, "recursive": True, "per_page": 100}

    try:
        resp = requests.get(url, headers=headers, params=params)
        raise_for_status_with_body(resp, "获取 GitLab 文件列表")
        return resp.json()
    except Exception as e:
        print(f"获取 GitLab 文件失败: {e}")
        return []


def get_file_content(file_path, token):
    """获取 GitLab 文件内容"""
    url = f"{GITLAB_API}/projects/{GITLAB_PROJECT_ID}/repository/files/{file_path.replace('/', '%2F')}/raw"
    headers = {"PRIVATE-TOKEN": token}
    params = {"ref": "main"}

    try:
        resp = requests.get(url, headers=headers, params=params)
        raise_for_status_with_body(resp, f"获取 GitLab 文件内容 {file_path}")
        return resp.text
    except:
        return None


def get_file_last_commit(file_path, token):
    """获取文件的最后修改时间"""
    url = f"{GITLAB_API}/projects/{GITLAB_PROJECT_ID}/repository/commits"
    headers = {"PRIVATE-TOKEN": token}
    params = {"path": file_path, "per_page": 1}

    try:
        resp = requests.get(url, headers=headers, params=params)
        raise_for_status_with_body(resp, f"获取 GitLab 最后提交 {file_path}")
        commits = resp.json()
        if commits:
            return commits[0]["created_at"]
    except:
        pass
    return None


def load_cache():
    """加载已同步文件的缓存"""
    if CACHE_FILE.exists():
        with open(CACHE_FILE, 'r') as f:
            return json.load(f)
    return {}


def save_cache(cache):
    """保存缓存"""
    CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(CACHE_FILE, 'w') as f:
        json.dump(cache, f, indent=2)


def extract_title_from_file(file_path, content):
    """从文件路径或内容中提取标题"""
    # 优先从文件名提取
    title = file_path.split("/")[-1].replace(".md", "").replace("-", " ").title()

    # 如果是 Markdown，尝试从第一行标题提取
    if content and content.startswith("#"):
        lines = content.split("\n")
        for line in lines:
            if line.startswith("#"):
                title = line.lstrip("#").strip()
                break

    return title[:100]  # 限制长度


def add_to_notion(title, url, category="WorkSpace"):
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
        raise_for_status_with_body(resp, f"添加 Notion 页面 {title}")
        return True, resp.json().get("id")
    except Exception as e:
        print(f"添加到 Notion 失败: {e}")
        return False, None


def main():
    print(f"知识管理 - GitLab Workspace 同步 ({datetime.now().strftime('%Y-%m-%d %H:%M')})")

    # 检查必需的环境变量
    if not GITLAB_TOKEN:
        print("错误: 缺少 GitLab Token (GITLAB_TOKEN)")
        sys.exit(1)

    if not NOTION_API_KEY or not NOTION_DATABASE_ID:
        print("错误: 缺少 Notion 配置 (NOTION_API_KEY, NOTION_DATABASE_ID)")
        sys.exit(1)

    try:
        # 1. 加载缓存
        cache = load_cache()
        print(f"已缓存 {len(cache)} 个文件")

        # 2. 获取 GitLab 文件列表
        print(f"获取 {GITLAB_PATH} 下的文件...")
        files = get_gitlab_files(GITLAB_PATH, GITLAB_TOKEN)
        print(f"  发现 {len(files)} 个文件")

        # 3. 检查更新
        new_count = 0
        updated_count = 0

        for file_obj in files:
            if file_obj["type"] != "blob":  # 跳过文件夹
                continue

            file_path = file_obj["path"]
            file_id = file_obj["id"]

            # 获取文件的最后修改时间
            last_commit = get_file_last_commit(file_path, GITLAB_TOKEN)

            if file_path not in cache:
                # 新文件
                print(f"  📄 新文件: {file_path}")
                content = get_file_content(file_path, GITLAB_TOKEN)
                title = extract_title_from_file(file_path, content)

                # 生成 GitLab 文件原始链接
                file_url = f"https://gitlab.paigod.work/product-agent/product_workspace/-/raw/main/{file_path}"

                success, page_id = add_to_notion(title, file_url, category="WorkSpace")
                if success:
                    cache[file_path] = {
                        "last_commit": last_commit,
                        "notion_page_id": page_id
                    }
                    new_count += 1
                    print(f"    ✅ 已添加: {title}")

            elif cache[file_path].get("last_commit") != last_commit:
                # 文件已更新
                print(f"  🔄 更新: {file_path}")
                updated_count += 1
                cache[file_path]["last_commit"] = last_commit
                # 这里可以选择更新 Notion 中的文件，或者只是标记为已更新

        # 4. 保存缓存
        save_cache(cache)

        print(f"\n✅ 同步完成: 新增 {new_count} 个，更新 {updated_count} 个")

    except Exception as e:
        print(f"❌ 同步失败: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
