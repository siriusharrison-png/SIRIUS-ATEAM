#!/usr/bin/env python3
"""
同步 Figma 文件结构到飞书多维表格
"""

import os
import sys
import json
from pathlib import Path

# 添加 src 到路径
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from dotenv import load_dotenv
from figma_api import get_all_nodes_from_file
from feishu_api import FeishuAPI

# 加载环境变量
load_dotenv(Path(__file__).parent.parent / ".env")


def load_product_config():
    """加载产品配置"""
    config_path = Path(__file__).parent.parent / "config" / "products.json"
    with open(config_path, "r", encoding="utf-8") as f:
        return json.load(f)


def sync_all():
    """
    同步所有配置的 Figma 文件到多维表格
    """
    config = load_product_config()
    app_token = os.getenv("FEISHU_BITABLE_APP_TOKEN")
    table_id = os.getenv("FEISHU_BITABLE_TABLE_ID")

    if not app_token or not table_id:
        print("错误: 请先配置 FEISHU_BITABLE_APP_TOKEN 和 FEISHU_BITABLE_TABLE_ID")
        return

    feishu = FeishuAPI()

    # 清空现有数据
    print("正在清空现有数据...")
    feishu.bitable_clear_table(app_token, table_id)

    # 收集所有节点
    all_nodes = []

    for product in config.get("products", []):
        product_name = product.get("name")
        print(f"\n正在处理产品: {product_name}")

        for file_config in product.get("figma_files", []):
            file_key = file_config.get("file_key")
            file_type = file_config.get("file_type", "常规迭代")

            if not file_key:
                continue

            print(f"  - 获取文件: {file_key}")

            try:
                nodes = get_all_nodes_from_file(
                    file_key,
                    product_name=product_name,
                    file_type=file_type
                )
                all_nodes.extend(nodes)
                print(f"    找到 {len(nodes)} 个节点")
            except Exception as e:
                print(f"    错误: {e}")

    # 转换为多维表格记录格式
    records = []
    for node in all_nodes:
        records.append({
            "fields": {
                "产品名称": node.get("product"),
                "文件类型": node.get("file_type"),
                "文件名": node.get("file_name"),
                "页面名称": node.get("page_name"),
                "板块名称": node.get("node_name"),
                "节点类型": node.get("node_type"),
                "Figma链接": {"link": node.get("figma_link"), "text": "打开"},
                "更新时间": node.get("last_modified")
            }
        })

    # 写入多维表格
    if records:
        print(f"\n正在写入 {len(records)} 条记录到多维表格...")
        feishu.bitable_create_records(app_token, table_id, records)
        print("同步完成!")
    else:
        print("\n没有找到任何节点，请检查 config/products.json 配置")


def sync_single_file(file_key, product_name="", file_type="常规迭代"):
    """
    同步单个 Figma 文件（用于测试）
    """
    print(f"正在获取文件 {file_key}...")

    nodes = get_all_nodes_from_file(file_key, product_name, file_type)

    print(f"\n找到 {len(nodes)} 个节点:\n")

    for node in nodes[:10]:  # 只显示前 10 个
        print(f"  [{node['node_type']}] {node['page_name']} / {node['node_name']}")
        print(f"    链接: {node['figma_link']}")
        print()

    if len(nodes) > 10:
        print(f"  ... 还有 {len(nodes) - 10} 个节点")

    return nodes


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="同步 Figma 到飞书多维表格")
    parser.add_argument("--file", "-f", help="单独同步一个 Figma 文件（用于测试）")
    parser.add_argument("--product", "-p", default="", help="产品名称（配合 --file 使用）")
    parser.add_argument("--type", "-t", default="常规迭代", help="文件类型（配合 --file 使用）")

    args = parser.parse_args()

    if args.file:
        sync_single_file(args.file, args.product, args.type)
    else:
        sync_all()
