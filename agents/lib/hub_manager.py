#!/usr/bin/env python3
"""
HubManager - hub.json 协作中枢管理工具

负责 hub.json 的原子性读写，防并发冲突，确保数据一致性。
所有 Agent 通过此工具更新协作中枢的状态。
"""

import json
import time
import fcntl
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional, Dict, Any


class HubManager:
    """hub.json 协作中枢管理器"""

    def __init__(self, hub_path: str = "agents/hub.json"):
        """
        初始化 HubManager

        Args:
            hub_path: hub.json 文件路径
        """
        self.hub_path = Path(hub_path)
        self.lock_path = self.hub_path.parent / f"{self.hub_path.name}.lock"
        self.max_retries = 3
        self.retry_delay = 0.5  # 秒

    def _ensure_hub_exists(self):
        """确保 hub.json 存在，不存在则创建默认模板"""
        if not self.hub_path.exists():
            default_hub = {
                "meta": {
                    "version": "1.0.0",
                    "rulesVersion": "1.1.0",
                    "lastUpdate": datetime.now(timezone.utc).isoformat(),
                    "description": "AI 团队协作中枢"
                },
                "agents": {
                    "小秘书": {"status": "active", "lastSeen": None},
                    "设计师": {"status": "active", "lastSeen": None},
                    "知识管理": {"status": "active", "lastSeen": None},
                    "摄影师": {"status": "active", "lastSeen": None}
                },
                "messages": [],
                "tasks": [],
                "dailySummary": {
                    "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                    "stats": {
                        "messagesCount": 0,
                        "tasksCompleted": 0,
                        "alertsCount": 0
                    }
                }
            }
            self.hub_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.hub_path, "w", encoding="utf-8") as f:
                json.dump(default_hub, f, indent=2, ensure_ascii=False)

    def _acquire_lock(self, file_handle):
        """获取文件锁"""
        try:
            fcntl.flock(file_handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            return True
        except (IOError, OSError):
            return False

    def _load(self) -> Dict[str, Any]:
        """
        原子性加载 hub.json（带重试）

        Returns:
            解析后的 hub.json 内容

        Raises:
            RuntimeError: 多次重试后仍无法加载
        """
        self._ensure_hub_exists()

        for attempt in range(self.max_retries):
            try:
                with open(self.hub_path, "r", encoding="utf-8") as f:
                    fcntl.flock(f.fileno(), fcntl.LOCK_SH)
                    data = json.load(f)
                    fcntl.flock(f.fileno(), fcntl.LOCK_UN)
                    return data
            except (IOError, OSError, json.JSONDecodeError) as e:
                if attempt < self.max_retries - 1:
                    time.sleep(self.retry_delay * (attempt + 1))
                else:
                    raise RuntimeError(f"无法加载 hub.json（尝试 {self.max_retries} 次）: {e}")

    def _save(self, data: Dict[str, Any]):
        """
        原子性保存 hub.json（带重试）

        Args:
            data: 要保存的数据

        Raises:
            RuntimeError: 多次重试后仍无法保存
        """
        for attempt in range(self.max_retries):
            try:
                # 写入临时文件再移动（确保原子性）
                temp_path = self.hub_path.with_suffix(".tmp")
                with open(temp_path, "w", encoding="utf-8") as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)

                # 原子性移动
                temp_path.replace(self.hub_path)
                return
            except (IOError, OSError) as e:
                if attempt < self.max_retries - 1:
                    time.sleep(self.retry_delay * (attempt + 1))
                else:
                    raise RuntimeError(f"无法保存 hub.json（尝试 {self.max_retries} 次）: {e}")

    def update_agent_status(self, agent_name: str, status: str, last_seen: Optional[str] = None):
        """
        更新 Agent 状态

        Args:
            agent_name: Agent 名称（小秘书/设计师/知识管理/摄影师）
            status: 状态（active/busy/inactive）
            last_seen: 最后活跃时间（ISO 格式，默认为当前时间）

        Example:
            hub.update_agent_status("摄影师", "active")
            hub.update_agent_status("知识管理", "busy", "2026-07-22T10:30:00+08:00")
        """
        hub = self._load()

        if agent_name not in hub["agents"]:
            hub["agents"][agent_name] = {}

        hub["agents"][agent_name]["status"] = status
        hub["agents"][agent_name]["lastSeen"] = last_seen or datetime.now(timezone.utc).isoformat()
        hub["meta"]["lastUpdate"] = datetime.now(timezone.utc).isoformat()

        self._save(hub)

    def add_message(
        self,
        from_agent: str,
        msg_type: str,
        content: str,
        to_agent: Optional[str] = None,
        data: Optional[Dict] = None,
        related_task: Optional[str] = None
    ):
        """
        添加消息到 hub.json

        Args:
            from_agent: 发送者 Agent 名称
            msg_type: 消息类型（info/update/alert/request/response）
            content: 消息内容
            to_agent: 接收者（可选，不填则广播）
            data: 附加数据（可选）
            related_task: 关联任务 ID（可选）

        Example:
            hub.add_message(
                "摄影师",
                "alert",
                "检测到 3 个硬编码颜色",
                data={"issues": [...]}
            )
        """
        hub = self._load()

        msg = {
            "id": f"msg-{int(time.time() * 1000)}",
            "from": from_agent,
            "time": datetime.now(timezone.utc).isoformat(),
            "type": msg_type,
            "content": content,
            "read": False
        }

        if to_agent:
            msg["to"] = to_agent
        if data:
            msg["data"] = data
        if related_task:
            msg["relatedTask"] = related_task

        hub["messages"].append(msg)
        hub["meta"]["lastUpdate"] = datetime.now(timezone.utc).isoformat()

        self._save(hub)

    def create_task(
        self,
        title: str,
        description: str,
        from_agent: str,
        assignee: Optional[str] = None,
        priority: str = "normal"
    ) -> str:
        """
        创建任务

        Args:
            title: 任务标题
            description: 任务描述
            from_agent: 创建者
            assignee: 分配给（可选）
            priority: 优先级（high/normal/low）

        Returns:
            创建的任务 ID

        Example:
            task_id = hub.create_task(
                "检查设计 Token 一致性",
                "验证所有颜色是否使用 Token",
                from_agent="小秘书",
                assignee="设计师",
                priority="high"
            )
        """
        hub = self._load()

        task_id = f"task-{int(time.time() * 1000)}"
        now = datetime.now(timezone.utc).isoformat()

        task = {
            "id": task_id,
            "title": title,
            "description": description,
            "from": from_agent,
            "assignee": assignee or from_agent,
            "status": "pending",
            "priority": priority,
            "createdAt": now,
            "updatedAt": now
        }

        hub["tasks"].append(task)
        hub["meta"]["lastUpdate"] = now

        self._save(hub)
        return task_id

    def update_task(self, task_id: str, **kwargs):
        """
        更新任务

        Args:
            task_id: 任务 ID
            **kwargs: 要更新的字段（status, priority, result 等）

        Example:
            hub.update_task(
                "task-123",
                status="completed",
                result={"found_issues": 3}
            )
        """
        hub = self._load()

        for task in hub["tasks"]:
            if task["id"] == task_id:
                task.update(kwargs)
                task["updatedAt"] = datetime.now(timezone.utc).isoformat()

                if kwargs.get("status") == "completed":
                    task["completedAt"] = task["updatedAt"]

                hub["meta"]["lastUpdate"] = datetime.now(timezone.utc).isoformat()
                self._save(hub)
                return

        raise ValueError(f"任务不存在: {task_id}")

    def get_agent_status(self, agent_name: str) -> Dict[str, Any]:
        """
        获取 Agent 状态

        Args:
            agent_name: Agent 名称

        Returns:
            Agent 的状态字典

        Example:
            status = hub.get_agent_status("摄影师")
            print(status["lastSeen"])
        """
        hub = self._load()
        return hub["agents"].get(agent_name, {})

    def get_recent_messages(self, limit: int = 10, agent_name: Optional[str] = None) -> list:
        """
        获取最近的消息

        Args:
            limit: 返回消息数量
            agent_name: 可选，只获取特定 Agent 的消息

        Returns:
            消息列表（最新优先）

        Example:
            messages = hub.get_recent_messages(limit=5, agent_name="摄影师")
        """
        hub = self._load()

        messages = hub["messages"]
        if agent_name:
            messages = [m for m in messages if m["from"] == agent_name]

        return sorted(messages, key=lambda m: m["time"], reverse=True)[:limit]

    def export_daily_summary(self) -> Dict[str, Any]:
        """
        导出当日汇总（供小秘书日报使用）

        Returns:
            包含当日统计的字典

        Example:
            summary = hub.export_daily_summary()
        """
        hub = self._load()

        messages_today = [
            m for m in hub["messages"]
            if m["time"].startswith(datetime.now(timezone.utc).strftime("%Y-%m-%d"))
        ]

        tasks_today = [
            t for t in hub["tasks"]
            if t.get("completedAt", "").startswith(datetime.now(timezone.utc).strftime("%Y-%m-%d"))
        ]

        alerts_today = [m for m in messages_today if m["type"] == "alert"]

        return {
            "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "agent_status": hub["agents"],
            "messages_count": len(messages_today),
            "tasks_completed": len(tasks_today),
            "alerts_count": len(alerts_today),
            "recent_messages": self.get_recent_messages(limit=5),
            "recent_tasks": [t for t in hub["tasks"] if t["status"] != "pending"][:5]
        }


# 快捷使用示例
if __name__ == "__main__":
    hub = HubManager()

    # 更新 Agent 状态
    hub.update_agent_status("摄影师", "active")

    # 添加消息
    hub.add_message(
        "摄影师",
        "info",
        "今日 Unsplash 数据更新完毕"
    )

    # 创建任务
    task_id = hub.create_task(
        "验证设计 Token 一致性",
        "检查 3 处硬编码颜色",
        from_agent="小秘书",
        assignee="设计师",
        priority="high"
    )

    # 完成任务
    hub.update_task(task_id, status="completed", result={"fixed": 3})

    # 导出汇总
    summary = hub.export_daily_summary()
    print(f"今日消息数: {summary['messages_count']}")
    print(f"今日完成任务: {summary['tasks_completed']}")
