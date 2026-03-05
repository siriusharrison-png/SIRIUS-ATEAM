"""
Figma API 封装
获取文件结构（页面、Frame、Section）
"""

import os
import requests
from datetime import datetime

class FigmaAPI:
    BASE_URL = "https://api.figma.com/v1"

    def __init__(self, token=None):
        self.token = token or os.getenv("FIGMA_TOKEN")
        self.headers = {"X-Figma-Token": self.token}

    def get_file(self, file_key):
        """获取文件基本信息和结构"""
        url = f"{self.BASE_URL}/files/{file_key}"
        response = requests.get(url, headers=self.headers)
        response.raise_for_status()
        return response.json()

    def get_file_meta(self, file_key):
        """获取文件元信息（名称、更新时间等）"""
        url = f"{self.BASE_URL}/files/{file_key}?depth=1"
        response = requests.get(url, headers=self.headers)
        response.raise_for_status()
        data = response.json()
        return {
            "name": data.get("name"),
            "last_modified": data.get("lastModified"),
            "version": data.get("version")
        }

    def extract_nodes(self, file_key, file_data, product_name="", file_type=""):
        """
        从文件数据中提取所有节点（页面、Frame、Section）
        返回扁平化的列表，每项包含完整路径和链接
        """
        nodes = []
        file_name = file_data.get("name", "")
        last_modified = file_data.get("lastModified", "")

        # 解析更新时间
        if last_modified:
            try:
                dt = datetime.fromisoformat(last_modified.replace("Z", "+00:00"))
                last_modified = dt.strftime("%Y-%m-%d")
            except:
                pass

        document = file_data.get("document", {})

        def process_node(node, page_name="", parent_path=""):
            node_type = node.get("type", "")
            node_name = node.get("name", "")
            node_id = node.get("id", "")

            # 生成 Figma 链接
            figma_link = f"https://www.figma.com/design/{file_key}?node-id={node_id.replace(':', '-')}"

            # 只记录 PAGE、FRAME、SECTION 类型
            if node_type in ["CANVAS"]:  # CANVAS = Page
                page_name = node_name
                nodes.append({
                    "product": product_name,
                    "file_type": file_type,
                    "file_name": file_name,
                    "page_name": node_name,
                    "node_name": node_name,
                    "node_type": "页面",
                    "figma_link": figma_link,
                    "last_modified": last_modified
                })
            elif node_type in ["FRAME", "SECTION"]:
                type_label = "板块" if node_type == "FRAME" else "分区"
                nodes.append({
                    "product": product_name,
                    "file_type": file_type,
                    "file_name": file_name,
                    "page_name": page_name,
                    "node_name": node_name,
                    "node_type": type_label,
                    "figma_link": figma_link,
                    "last_modified": last_modified
                })

            # 递归处理子节点（限制深度，只到第一层 Frame）
            children = node.get("children", [])
            for child in children:
                if node_type == "CANVAS":  # 只处理页面的直接子节点
                    process_node(child, page_name)

        # 从文档根节点开始处理
        for page in document.get("children", []):
            process_node(page)

        return nodes


def get_all_nodes_from_file(file_key, product_name="", file_type="", token=None):
    """
    便捷函数：获取一个 Figma 文件的所有节点
    """
    api = FigmaAPI(token)
    file_data = api.get_file(file_key)
    return api.extract_nodes(file_key, file_data, product_name, file_type)
