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

# 导入 HubManager 和 AgentLogger（如果可用）
try:
    sys.path.insert(0, str(Path(__file__).parent.parent.parent))
    from lib.hub_manager import HubManager
    from lib.agent_logger import AgentLogger
    HAS_HUB_MANAGER = True
    HAS_LOGGER = True
    logger = AgentLogger("知识管理")
except ImportError:
    HAS_HUB_MANAGER = False
    HAS_LOGGER = False
    logger = None

# 配置
FEISHU_APP_ID = os.environ.get("FEISHU_APP_ID", "")
FEISHU_APP_SECRET = os.environ.get("FEISHU_APP_SECRET", "")
FEISHU_NODE_TOKEN = os.environ.get("FEISHU_NODE_TOKEN", "")
NOTION_API_KEY = os.environ.get("NOTION_API_KEY", "")
NOTION_DATABASE_ID = os.environ.get("NOTION_DATABASE_ID", "")

NOTION_API = "https://api.notion.com/v1"
FEISHU_API = "https://open.feishu.cn/open-apis"


def raise_for_status_with_body(resp, label):
    """在 HTTP 失败时保留响应体，方便排查 CI 日志。"""
    if resp.ok:
        return

    body = resp.text.strip()
    if len(body) > 1000:
        body = body[:1000] + "...[truncated]"
    raise Exception(f"{label} failed: HTTP {resp.status_code} {resp.reason}; body={body}")


def get_feishu_tenant_token():
    """获取飞书 tenant_access_token"""
    url = f"{FEISHU_API}/auth/v3/tenant_access_token/internal"
    payload = {
        "app_id": FEISHU_APP_ID,
        "app_secret": FEISHU_APP_SECRET
    }

    resp = requests.post(url, json=payload)
    raise_for_status_with_body(resp, "获取飞书 tenant token")
    data = resp.json()

    if data.get("code") != 0:
        raise Exception(f"飞书认证失败: code={data.get('code')} msg={data.get('msg')} raw={data}")

    return data["tenant_access_token"]


def fetch_feishu_node_info(token):
    """通过 node_token 获取知识库节点信息"""
    url = f"{FEISHU_API}/wiki/v2/spaces/get_node"
    params = {"token": FEISHU_NODE_TOKEN}
    headers = {"Authorization": f"Bearer {token}"}

    resp = requests.get(url, headers=headers, params=params)
    raise_for_status_with_body(resp, "获取飞书节点信息")
    data = resp.json()

    if data.get("code") != 0:
        raise Exception(f"获取飞书节点失败: code={data.get('code')} msg={data.get('msg')} raw={data}")

    return data.get("data", {})


def fetch_docx_blocks(token, document_id):
    """分页获取 docx 文档块内容。"""
    url = f"{FEISHU_API}/docx/v1/documents/{document_id}/blocks"
    headers = {"Authorization": f"Bearer {token}"}
    blocks = []
    page_token = None

    while True:
        params = {}
        if page_token:
            params["page_token"] = page_token

        resp = requests.get(url, headers=headers, params=params)
        raise_for_status_with_body(resp, "获取飞书文档块")
        data = resp.json()

        if data.get("code") != 0:
            raise Exception(f"获取飞书文档块失败: code={data.get('code')} msg={data.get('msg')} raw={data}")

        page_data = data.get("data", {})
        blocks.extend(page_data.get("items", []))

        if not page_data.get("has_more"):
            break
        page_token = page_data.get("page_token")
        if not page_token:
            break

    return blocks


def collect_strings(value):
    """递归收集 JSON 中所有字符串值。"""
    if isinstance(value, str):
        return [value]
    if isinstance(value, dict):
        result = []
        for item in value.values():
            result.extend(collect_strings(item))
        return result
    if isinstance(value, list):
        result = []
        for item in value:
            result.extend(collect_strings(item))
        return result
    return []


def extract_urls_from_blocks(blocks):
    """从 docx blocks 里提取所有 URL。"""
    texts = collect_strings(blocks)
    urls = []
    for text in texts:
        urls.extend(extract_urls_from_text(text))

    # 去重且保持顺序
    return list(dict.fromkeys(urls))


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
        raise_for_status_with_body(resp, "查询 Notion 已有 URL")
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
        raise_for_status_with_body(resp, f"添加 Notion 页面 {title}")
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

    if not FEISHU_NODE_TOKEN:
        print("错误: 缺少飞书节点令牌 (FEISHU_NODE_TOKEN)")
        sys.exit(1)

    if not NOTION_API_KEY or not NOTION_DATABASE_ID:
        print("错误: 缺少 Notion 配置 (NOTION_API_KEY, NOTION_DATABASE_ID)")
        sys.exit(1)

    try:
        # 1. 获取飞书 token
        print("获取飞书 token...")
        token = get_feishu_tenant_token()

        # 2. 获取飞书节点信息
        print("获取飞书节点信息...")
        node_data = fetch_feishu_node_info(token)

        node = node_data.get("node", {})
        obj_type = node.get("obj_type")
        obj_token = node.get("obj_token")
        title = node.get("title") or node.get("name") or "飞书文档"

        if not obj_token:
            raise Exception(f"节点没有返回 obj_token: raw={node_data}")

        if obj_type and obj_type != "docx":
            raise Exception(f"当前节点类型不是 docx，无法提取正文: obj_type={obj_type} raw={node_data}")

        # 3. 获取文档块并提取 URL
        print("获取文档块并提取 URL...")
        blocks = fetch_docx_blocks(token, obj_token)
        urls = extract_urls_from_blocks(blocks)
        print(f"  发现 {len(urls)} 个 URL")

        # 4. 获取 Notion 中已有的 URL
        existing_urls = get_notion_existing_urls()
        print(f"  Notion 中已有 {len(existing_urls)} 个 URL")

        # 5. 添加新 URL 到 Notion
        new_count = 0
        for url in urls:
            if url not in existing_urls:
                item_title = url.split("/")[-1][:50]  # 简单的标题提取
                success, page_id = add_to_notion(item_title, url, category="飞书文档")
                if success:
                    new_count += 1
                    print(f"  ✅ 添加: {item_title}")

        print(f"\n✅ 同步完成: 新增 {new_count} 个知识条目")

        if HAS_LOGGER:
            logger.info(
                f"飞书文档同步完成",
                new_count=new_count,
                existing_count=len(existing_urls)
            )

        # 6. 更新协作中枢（hub.json）
        if HAS_HUB_MANAGER:
            try:
                hub = HubManager(Path(__file__).parent.parent.parent / "hub.json")
                hub.update_agent_status("知识管理", "active")
                hub.add_message(
                    "知识管理",
                    "update",
                    f"飞书文档同步完成 - 新增 {new_count} 个知识条目",
                    data={
                        "source": "飞书",
                        "new_count": new_count,
                        "existing_count": len(existing_urls),
                        "date": datetime.now().strftime("%Y-%m-%d")
                    }
                )
                print("✅ 已更新协作中枢")
            except Exception as e:
                print(f"⚠️ 更新协作中枢失败: {e}")
        else:
            print("⚠️ HubManager 不可用，跳过协作中枢更新")

    except Exception as e:
        print(f"❌ 同步失败: {e}")

        if HAS_LOGGER:
            logger.error(f"飞书文档同步失败: {str(e)}")

        # 失败时也要更新协作中枢（记录错误）
        if HAS_HUB_MANAGER:
            try:
                hub = HubManager(Path(__file__).parent.parent.parent / "hub.json")
                hub.add_message(
                    "知识管理",
                    "alert",
                    f"飞书文档同步失败: {str(e)[:100]}",
                    data={"error": str(e)}
                )
            except:
                pass

        sys.exit(1)


if __name__ == "__main__":
    main()
