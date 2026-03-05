#!/usr/bin/env python3
"""
飞书机器人 - Figma 设计稿搜索助手
"""

import os
import json
import hashlib
import hmac
from pathlib import Path

from flask import Flask, request, jsonify
from dotenv import load_dotenv

from feishu_api import FeishuAPI, search_figma_designs

# 加载环境变量
load_dotenv(Path(__file__).parent.parent / ".env")

app = Flask(__name__)
feishu = FeishuAPI()

# 用户会话状态（简单用内存存储）
user_sessions = {}


def load_product_config():
    """加载产品配置"""
    config_path = Path(__file__).parent.parent / "config" / "products.json"
    with open(config_path, "r", encoding="utf-8") as f:
        return json.load(f)


def build_product_select_card():
    """构建产品选择卡片"""
    config = load_product_config()
    products = [p["name"] for p in config.get("products", [])]

    buttons = []
    for product in products:
        buttons.append({
            "tag": "button",
            "text": {"tag": "plain_text", "content": product},
            "type": "default",
            "value": {"action": "select_product", "product": product}
        })

    return json.dumps({
        "config": {"wide_screen_mode": True},
        "header": {
            "title": {"tag": "plain_text", "content": "Figma 设计稿搜索"},
            "template": "blue"
        },
        "elements": [
            {
                "tag": "div",
                "text": {"tag": "plain_text", "content": "请选择产品："}
            },
            {
                "tag": "action",
                "actions": buttons
            }
        ]
    })


def build_file_type_select_card(product):
    """构建文件类型选择卡片"""
    config = load_product_config()
    file_types = config.get("file_types", ["设计系统", "常规迭代"])

    buttons = []
    for ft in file_types:
        buttons.append({
            "tag": "button",
            "text": {"tag": "plain_text", "content": ft},
            "type": "default",
            "value": {"action": "select_file_type", "product": product, "file_type": ft}
        })

    return json.dumps({
        "config": {"wide_screen_mode": True},
        "header": {
            "title": {"tag": "plain_text", "content": f"搜索 {product} 设计稿"},
            "template": "blue"
        },
        "elements": [
            {
                "tag": "div",
                "text": {"tag": "plain_text", "content": "请选择文件类型："}
            },
            {
                "tag": "action",
                "actions": buttons
            }
        ]
    })


def build_search_prompt_card(product, file_type):
    """构建搜索提示卡片"""
    return json.dumps({
        "config": {"wide_screen_mode": True},
        "header": {
            "title": {"tag": "plain_text", "content": f"搜索 {product} - {file_type}"},
            "template": "blue"
        },
        "elements": [
            {
                "tag": "div",
                "text": {"tag": "plain_text", "content": "请输入要搜索的页面/板块关键词："}
            },
            {
                "tag": "note",
                "elements": [
                    {"tag": "plain_text", "content": "例如：登录、首页、商品详情"}
                ]
            }
        ]
    })


def build_results_card(results, keyword):
    """构建搜索结果卡片"""
    if not results:
        return json.dumps({
            "config": {"wide_screen_mode": True},
            "header": {
                "title": {"tag": "plain_text", "content": "搜索结果"},
                "template": "orange"
            },
            "elements": [
                {
                    "tag": "div",
                    "text": {"tag": "plain_text", "content": f"未找到包含「{keyword}」的设计稿"}
                }
            ]
        })

    # 构建结果列表
    elements = [
        {
            "tag": "div",
            "text": {"tag": "lark_md", "content": f"找到 **{len(results)}** 个相关设计稿："}
        },
        {"tag": "hr"}
    ]

    for i, result in enumerate(results[:10]):  # 最多显示 10 个
        link = result.get("Figma链接", {})
        link_url = link.get("link", "") if isinstance(link, dict) else link

        elements.append({
            "tag": "div",
            "text": {
                "tag": "lark_md",
                "content": f"**{i+1}. {result.get('板块名称', '')}**\n"
                          f"📁 {result.get('文件名', '')} / {result.get('页面名称', '')}\n"
                          f"🕐 {result.get('更新时间', '')}"
            },
            "extra": {
                "tag": "button",
                "text": {"tag": "plain_text", "content": "打开"},
                "type": "primary",
                "url": link_url
            }
        })

    if len(results) > 10:
        elements.append({
            "tag": "note",
            "elements": [{"tag": "plain_text", "content": f"还有 {len(results) - 10} 个结果未显示"}]
        })

    return json.dumps({
        "config": {"wide_screen_mode": True},
        "header": {
            "title": {"tag": "plain_text", "content": f"搜索「{keyword}」的结果"},
            "template": "green"
        },
        "elements": elements
    })


@app.route("/webhook", methods=["POST"])
def webhook():
    """
    飞书事件回调入口
    """
    data = request.json

    # URL 验证
    if data.get("type") == "url_verification":
        return jsonify({"challenge": data.get("challenge")})

    # 事件处理
    event = data.get("event", {})
    event_type = data.get("header", {}).get("event_type", "")

    # 消息事件
    if event_type == "im.message.receive_v1":
        message = event.get("message", {})
        chat_id = message.get("chat_id")
        message_type = message.get("message_type")
        sender_id = event.get("sender", {}).get("sender_id", {}).get("open_id")

        if message_type == "text":
            content = json.loads(message.get("content", "{}"))
            text = content.get("text", "").strip()

            # 检查用户会话状态
            session = user_sessions.get(sender_id, {})

            if session.get("waiting_for_keyword"):
                # 用户输入了搜索关键词
                product = session.get("product")
                file_type = session.get("file_type")

                results = search_figma_designs(product, file_type, text)
                card = build_results_card(results, text)

                # 清除会话状态
                user_sessions.pop(sender_id, None)

            else:
                # 开始新的搜索流程
                card = build_product_select_card()

            feishu.send_card_message(chat_id, "chat_id", card)

    return jsonify({"code": 0})


@app.route("/card_action", methods=["POST"])
def card_action():
    """
    卡片交互回调
    """
    data = request.json
    action = data.get("action", {})
    value = action.get("value", {})
    open_id = data.get("open_id")

    action_type = value.get("action")

    if action_type == "select_product":
        product = value.get("product")
        card = build_file_type_select_card(product)
        return jsonify({"card": json.loads(card)})

    elif action_type == "select_file_type":
        product = value.get("product")
        file_type = value.get("file_type")

        # 保存会话状态，等待用户输入关键词
        user_sessions[open_id] = {
            "product": product,
            "file_type": file_type,
            "waiting_for_keyword": True
        }

        card = build_search_prompt_card(product, file_type)
        return jsonify({"card": json.loads(card)})

    return jsonify({})


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8080))
    print(f"Figma 设计稿搜索机器人启动在 http://localhost:{port}")
    print("Webhook 地址: http://localhost:{port}/webhook")
    print("卡片回调地址: http://localhost:{port}/card_action")
    app.run(host="0.0.0.0", port=port, debug=True)
