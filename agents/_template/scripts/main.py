#!/usr/bin/env python3
"""
模板 Agent: [AGENT_NAME]
说明: [简要描述功能]

核心职责:
  - [职责 1]
  - [职责 2]
  - [职责 3]

依赖:
  - [依赖服务 1]
  - [依赖环境变量]

输出:
  - [输出数据类型 1]
  - [输出目标 1]

工作流:
  - GitHub Actions 定时触发 (cron: 'X X * * *')
  - 本地手动触发: python scripts/main.py

"""

import os
import sys
import json
from datetime import datetime
from pathlib import Path

# ============================================================
# 导入库（可选，如果系统不可用则降级）
# ============================================================

try:
    sys.path.insert(0, str(Path(__file__).parent.parent.parent))
    from lib.hub_manager import HubManager
    from lib.agent_logger import AgentLogger
    HAS_HUB_MANAGER = True
    HAS_LOGGER = True
    logger = AgentLogger("[AGENT_NAME]")
except ImportError:
    HAS_HUB_MANAGER = False
    HAS_LOGGER = False
    logger = None


# ============================================================
# 环境变量与配置
# ============================================================

# 示例：添加你的配置
# API_KEY = os.environ.get("YOUR_API_KEY", "")
# WEBHOOK_URL = os.environ.get("YOUR_WEBHOOK_URL", "")


# ============================================================
# 业务逻辑函数
# ============================================================

def validate_environment():
    """
    验证必需的环境变量和依赖
    失败时抛出异常
    """
    # 示例：
    # if not API_KEY:
    #     raise ValueError("缺少必需的环境变量: YOUR_API_KEY")
    pass


def fetch_data():
    """
    获取数据（核心业务逻辑）
    返回: dict 包含处理后的数据
    """
    # 示例：
    # response = requests.get("https://api.example.com/data")
    # return response.json()
    return {
        "timestamp": datetime.now().isoformat(),
        "status": "success",
        "data": []
    }


def process_data(raw_data):
    """
    处理和转换数据
    输入: fetch_data() 的返回值
    输出: 处理后的结果
    """
    # 在这里添加数据处理逻辑
    return raw_data


def export_results(processed_data):
    """
    导出结果到目标位置
    可能是：飞书、Notion、本地文件、数据库等
    """
    # 示例：
    # push_to_feishu(processed_data)
    # save_to_file(processed_data)
    return True


# ============================================================
# 主程序
# ============================================================

def main():
    """主程序入口"""
    print(f"[AGENT_NAME] 工作流启动 ({datetime.now().strftime('%Y-%m-%d %H:%M')})")

    if HAS_LOGGER:
        logger.info("开始工作流")

    try:
        # 步骤 1：环境验证
        print("验证环境...")
        if HAS_LOGGER:
            logger.info("验证环境变量和依赖")
        validate_environment()

        # 步骤 2：获取数据
        print("获取数据...")
        if HAS_LOGGER:
            logger.info("开始获取数据")
        raw_data = fetch_data()
        print(f"  ✅ 获取成功")

        # 步骤 3：处理数据
        print("处理数据...")
        if HAS_LOGGER:
            logger.info("开始处理数据")
        processed_data = process_data(raw_data)
        print(f"  ✅ 处理成功")

        # 步骤 4：导出结果
        print("导出结果...")
        if HAS_LOGGER:
            logger.info("导出结果")
        success = export_results(processed_data)

        if success:
            print(f"✅ 工作流完成")

            if HAS_LOGGER:
                logger.info(
                    "工作流完成",
                    status="success",
                    items_processed=len(processed_data.get("data", []))
                )

            # 更新协作中枢（hub.json）
            if HAS_HUB_MANAGER:
                try:
                    hub = HubManager(Path(__file__).parent.parent.parent / "hub.json")
                    hub.update_agent_status("[AGENT_NAME]", "active")
                    hub.add_message(
                        "[AGENT_NAME]",
                        "update",
                        "工作流完成",
                        data={
                            "status": "success",
                            "timestamp": datetime.now().isoformat(),
                            "items_processed": len(processed_data.get("data", []))
                        }
                    )
                    print("✅ 已更新协作中枢")
                except Exception as e:
                    print(f"⚠️  更新协作中枢失败: {e}")
                    if HAS_LOGGER:
                        logger.warning(f"更新协作中枢失败: {str(e)}")
            else:
                print("⚠️  HubManager 不可用，跳过协作中枢更新")

            return 0
        else:
            raise Exception("导出结果失败")

    except Exception as e:
        error_msg = f"工作流失败: {str(e)}"
        print(f"❌ {error_msg}")

        if HAS_LOGGER:
            logger.error(error_msg)

        # 失败时也要更新协作中枢
        if HAS_HUB_MANAGER:
            try:
                hub = HubManager(Path(__file__).parent.parent.parent / "hub.json")
                hub.add_message(
                    "[AGENT_NAME]",
                    "alert",
                    f"工作流失败: {str(e)[:100]}",
                    data={"error": str(e)}
                )
            except:
                pass

        return 1


if __name__ == "__main__":
    sys.exit(main())
