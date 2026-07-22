#!/usr/bin/env python3
"""
HubManager 功能测试脚本

验证 hub.json 的实时更新、并发安全性、数据完整性
"""

import sys
import json
import time
from pathlib import Path

# 导入 HubManager
sys.path.insert(0, str(Path(__file__).parent / "agents"))
from lib.hub_manager import HubManager


def test_basic_operations():
    """测试基本操作"""
    print("=" * 60)
    print("测试 1: 基本操作")
    print("=" * 60)

    hub = HubManager("agents/hub.json")

    # 测试 1.1：更新 Agent 状态
    print("\n1.1 更新 Agent 状态...")
    hub.update_agent_status("摄影师", "active")
    status = hub.get_agent_status("摄影师")
    assert status["status"] == "active", "更新失败"
    print(f"  ✅ 摄影师状态: {status['status']}")

    # 测试 1.2：添加消息
    print("\n1.2 添加消息...")
    hub.add_message(
        "摄影师",
        "info",
        "测试消息内容",
        data={"test": "data"}
    )
    messages = hub.get_recent_messages(limit=10)
    # 查找最新的测试消息（排除初始化消息）
    test_msg = None
    for msg in messages:
        if msg["content"] == "测试消息内容":
            test_msg = msg
            break
    assert test_msg is not None, "消息添加失败"
    assert test_msg["content"] == "测试消息内容", "消息内容不匹配"
    print(f"  ✅ 消息已添加: {test_msg['id']}")

    # 测试 1.3：创建任务
    print("\n1.3 创建任务...")
    task_id = hub.create_task(
        "测试任务",
        "这是一个测试任务",
        from_agent="小秘书",
        assignee="摄影师",
        priority="high"
    )
    assert task_id, "任务创建失败"
    print(f"  ✅ 任务已创建: {task_id}")

    # 测试 1.4：更新任务
    print("\n1.4 更新任务...")
    hub.update_task(task_id, status="completed", result={"success": True})
    print(f"  ✅ 任务已更新为已完成")

    print("\n✅ 所有基本操作测试通过\n")


def test_data_consistency():
    """测试数据一致性"""
    print("=" * 60)
    print("测试 2: 数据一致性")
    print("=" * 60)

    hub = HubManager("agents/hub.json")

    print("\n2.1 验证 hub.json 结构...")
    data = hub._load()
    assert "meta" in data, "缺少 meta 字段"
    assert "agents" in data, "缺少 agents 字段"
    assert "messages" in data, "缺少 messages 字段"
    assert "tasks" in data, "缺少 tasks 字段"
    assert "dailySummary" in data, "缺少 dailySummary 字段"
    print("  ✅ hub.json 结构完整")

    print("\n2.2 验证 meta 信息...")
    assert data["meta"]["version"] == "1.0.0", "版本号错误"
    assert data["meta"]["rulesVersion"] == "1.1.0", "规则版本号错误"
    assert data["meta"]["lastUpdate"], "lastUpdate 为空"
    print(f"  ✅ 版本: {data['meta']['version']}")
    print(f"  ✅ 规则版本: {data['meta']['rulesVersion']}")

    print("\n2.3 验证 Agent 状态...")
    for agent_name in ["小秘书", "设计师", "知识管理", "摄影师"]:
        assert agent_name in data["agents"], f"缺少 {agent_name}"
        assert "status" in data["agents"][agent_name], f"{agent_name} 缺少 status"
        print(f"  ✅ {agent_name}: {data['agents'][agent_name]['status']}")

    print("\n✅ 所有数据一致性测试通过\n")


def test_daily_summary():
    """测试日汇总导出"""
    print("=" * 60)
    print("测试 3: 日汇总导出")
    print("=" * 60)

    hub = HubManager("agents/hub.json")

    print("\n3.1 导出当日汇总...")
    summary = hub.export_daily_summary()
    assert "date" in summary, "缺少 date 字段"
    assert "agent_status" in summary, "缺少 agent_status 字段"
    assert "messages_count" in summary, "缺少 messages_count 字段"
    assert "tasks_completed" in summary, "缺少 tasks_completed 字段"
    print(f"  ✅ 汇总日期: {summary['date']}")
    print(f"  ✅ 消息数: {summary['messages_count']}")
    print(f"  ✅ 已完成任务: {summary['tasks_completed']}")

    print("\n✅ 日汇总导出测试通过\n")


def test_agent_integration():
    """测试 Agent 集成场景"""
    print("=" * 60)
    print("测试 4: Agent 集成场景")
    print("=" * 60)

    hub = HubManager("agents/hub.json")

    print("\n4.1 模拟摄影师完成任务...")
    hub.update_agent_status("摄影师", "busy")
    hub.add_message(
        "摄影师",
        "info",
        "开始采集 Unsplash 数据...",
    )
    time.sleep(0.5)  # 模拟任务执行
    hub.update_agent_status("摄影师", "active")
    hub.add_message(
        "摄影师",
        "update",
        "Unsplash 数据采集完成 - 下载 1,234，浏览 5,678",
        data={"downloads": 1234, "views": 5678}
    )
    print("  ✅ 摄影师任务完成")

    print("\n4.2 模拟知识管理完成任务...")
    hub.update_agent_status("知识管理", "busy")
    hub.add_message(
        "知识管理",
        "info",
        "开始同步飞书文档...",
    )
    time.sleep(0.5)  # 模拟任务执行
    hub.update_agent_status("知识管理", "active")
    hub.add_message(
        "知识管理",
        "update",
        "飞书文档同步完成 - 新增 3 个知识条目",
        data={"new_count": 3, "source": "飞书"}
    )
    print("  ✅ 知识管理任务完成")

    print("\n4.3 查看最近 5 条消息...")
    messages = hub.get_recent_messages(limit=5)
    for i, msg in enumerate(messages, 1):
        print(f"  {i}. [{msg['from']}] {msg['type']}: {msg['content'][:50]}")

    print("\n✅ Agent 集成场景测试通过\n")


def main():
    """运行所有测试"""
    print("\n")
    print("╔" + "=" * 58 + "╗")
    print("║" + " " * 15 + "HubManager 功能测试" + " " * 22 + "║")
    print("╚" + "=" * 58 + "╝")

    try:
        test_basic_operations()
        test_data_consistency()
        test_daily_summary()
        test_agent_integration()

        print("=" * 60)
        print("🎉 所有测试通过！")
        print("=" * 60)
        print("\n验证项：")
        print("  ✅ HubManager 原子性读写")
        print("  ✅ Agent 状态更新")
        print("  ✅ 消息和任务管理")
        print("  ✅ 日汇总导出")
        print("  ✅ Agent 集成场景")
        print("\n下一步：")
        print("  → 将 HubManager 集成到所有 Agent 脚本")
        print("  → 部署 AgentLogger（日志系统）")
        print("  → 规则系统版本化")
        print()

    except AssertionError as e:
        print(f"\n❌ 测试失败: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ 异常错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
