"""
飞书 API 封装
多维表格读写、消息发送
"""

import os
import requests
from datetime import datetime

class FeishuAPI:
    BASE_URL = "https://open.feishu.cn/open-apis"

    def __init__(self, app_id=None, app_secret=None):
        self.app_id = app_id or os.getenv("FEISHU_APP_ID")
        self.app_secret = app_secret or os.getenv("FEISHU_APP_SECRET")
        self._access_token = None
        self._token_expires = None

    @property
    def access_token(self):
        """获取 tenant_access_token（自动刷新）"""
        if self._access_token and self._token_expires:
            if datetime.now().timestamp() < self._token_expires:
                return self._access_token

        url = f"{self.BASE_URL}/auth/v3/tenant_access_token/internal"
        response = requests.post(url, json={
            "app_id": self.app_id,
            "app_secret": self.app_secret
        })
        data = response.json()
        self._access_token = data.get("tenant_access_token")
        self._token_expires = datetime.now().timestamp() + data.get("expire", 7200) - 300
        return self._access_token

    @property
    def headers(self):
        return {"Authorization": f"Bearer {self.access_token}"}

    # ============ 多维表格操作 ============

    def bitable_list_records(self, app_token, table_id, filter_params=None, page_size=100):
        """
        查询多维表格记录
        filter_params: {"field_name": "value"} 用于过滤
        """
        url = f"{self.BASE_URL}/bitable/v1/apps/{app_token}/tables/{table_id}/records"

        params = {"page_size": page_size}
        if filter_params:
            # 构建 filter 表达式
            conditions = []
            for field, value in filter_params.items():
                conditions.append(f'CurrentValue.[{field}] = "{value}"')
            if conditions:
                params["filter"] = " AND ".join(conditions)

        response = requests.get(url, headers=self.headers, params=params)
        data = response.json()

        if data.get("code") != 0:
            print(f"查询失败: {data.get('msg')}")
            return []

        return data.get("data", {}).get("items", [])

    def bitable_search_records(self, app_token, table_id, product=None, file_type=None, keyword=None):
        """
        搜索多维表格记录（支持关键词模糊搜索）
        """
        # 先获取所有记录（简化版，实际可能需要分页）
        records = self.bitable_list_records(app_token, table_id, page_size=500)

        results = []
        for record in records:
            fields = record.get("fields", {})

            # 产品过滤
            if product and fields.get("产品名称") != product:
                continue

            # 文件类型过滤
            if file_type and fields.get("文件类型") != file_type:
                continue

            # 关键词搜索（搜索页面名称和板块名称）
            if keyword:
                page_name = fields.get("页面名称", "")
                node_name = fields.get("板块名称", "")
                if keyword.lower() not in page_name.lower() and keyword.lower() not in node_name.lower():
                    continue

            results.append(fields)

        # 按更新时间排序（最新在前）
        results.sort(key=lambda x: x.get("更新时间", ""), reverse=True)

        return results

    def bitable_create_records(self, app_token, table_id, records):
        """
        批量创建多维表格记录
        records: [{"fields": {...}}, ...]
        """
        url = f"{self.BASE_URL}/bitable/v1/apps/{app_token}/tables/{table_id}/records/batch_create"

        # 飞书限制每次最多 500 条
        batch_size = 500
        created = 0

        for i in range(0, len(records), batch_size):
            batch = records[i:i + batch_size]
            response = requests.post(url, headers=self.headers, json={"records": batch})
            data = response.json()

            if data.get("code") != 0:
                print(f"创建失败: {data.get('msg')}")
            else:
                created += len(batch)
                print(f"已创建 {created}/{len(records)} 条记录")

        return created

    def bitable_clear_table(self, app_token, table_id):
        """
        清空多维表格（删除所有记录）
        """
        records = self.bitable_list_records(app_token, table_id, page_size=500)

        if not records:
            print("表格已为空")
            return 0

        record_ids = [r.get("record_id") for r in records]

        url = f"{self.BASE_URL}/bitable/v1/apps/{app_token}/tables/{table_id}/records/batch_delete"
        response = requests.post(url, headers=self.headers, json={"records": record_ids})
        data = response.json()

        if data.get("code") != 0:
            print(f"删除失败: {data.get('msg')}")
            return 0

        print(f"已删除 {len(record_ids)} 条记录")
        return len(record_ids)

    # ============ 消息发送 ============

    def send_card_message(self, receive_id, receive_type, card_content):
        """
        发送卡片消息
        receive_type: "open_id" | "user_id" | "chat_id"
        """
        url = f"{self.BASE_URL}/im/v1/messages"
        params = {"receive_id_type": receive_type}

        response = requests.post(url, headers=self.headers, params=params, json={
            "receive_id": receive_id,
            "msg_type": "interactive",
            "content": card_content
        })

        return response.json()


# ============ 便捷函数 ============

def search_figma_designs(product=None, file_type=None, keyword=None):
    """
    搜索 Figma 设计稿
    """
    app_token = os.getenv("FEISHU_BITABLE_APP_TOKEN")
    table_id = os.getenv("FEISHU_BITABLE_TABLE_ID")

    api = FeishuAPI()
    return api.bitable_search_records(app_token, table_id, product, file_type, keyword)
