#!/usr/bin/env python3
"""
AgentLogger - 统一日志系统

所有 Agent 通过此工具记录日志，采用 JSON 行格式存储。
支持多个日志级别，自动附加上下文信息（Agent 名、时间等）。
"""

import json
import time
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional, Dict, Any


class AgentLogger:
    """AI Agent 统一日志记录器"""

    # 日志级别映射
    LEVELS = {
        "DEBUG": 0,
        "INFO": 1,
        "WARNING": 2,
        "ERROR": 3,
        "CRITICAL": 4
    }

    def __init__(self, agent_name: str, log_dir: str = ".claude/logs"):
        """
        初始化 AgentLogger

        Args:
            agent_name: Agent 名称（小秘书/设计师/知识管理/摄影师）
            log_dir: 日志目录
        """
        self.agent_name = agent_name
        self.log_dir = Path(log_dir)
        self.log_dir.mkdir(parents=True, exist_ok=True)

        # 日志文件路径（每个 Agent 一个文件）
        self.log_file = self.log_dir / f"{agent_name}.jsonl"

    def debug(self, message: str, **context):
        """记录 DEBUG 级别日志"""
        self._log("DEBUG", message, context)

    def info(self, message: str, **context):
        """记录 INFO 级别日志"""
        self._log("INFO", message, context)

    def warning(self, message: str, **context):
        """记录 WARNING 级别日志"""
        self._log("WARNING", message, context)

    def error(self, message: str, **context):
        """记录 ERROR 级别日志"""
        self._log("ERROR", message, context)

    def critical(self, message: str, **context):
        """记录 CRITICAL 级别日志"""
        self._log("CRITICAL", message, context)

    def _log(self, level: str, message: str, context: dict):
        """
        内部日志记录方法

        Args:
            level: 日志级别
            message: 日志消息
            context: 上下文信息
        """
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "level": level,
            "agent": self.agent_name,
            "message": message,
            **context
        }

        try:
            with open(self.log_file, "a", encoding="utf-8") as f:
                f.write(json.dumps(log_entry, ensure_ascii=False) + "\n")
        except (IOError, OSError) as e:
            # 如果写入失败，至少输出到 stderr（防止影响主流程）
            import sys
            print(f"❌ 日志写入失败: {e}", file=sys.stderr)

    @staticmethod
    def get_logs(
        agent_name: str,
        log_dir: str = ".claude/logs",
        limit: int = 100,
        level: Optional[str] = None,
        date: Optional[str] = None
    ) -> list:
        """
        查询日志

        Args:
            agent_name: Agent 名称
            log_dir: 日志目录
            limit: 返回日志数量（最新优先）
            level: 只返回特定级别的日志（可选）
            date: 只返回特定日期的日志（可选，格式 YYYY-MM-DD）

        Returns:
            日志列表

        Example:
            logs = AgentLogger.get_logs("摄影师", limit=10, level="ERROR")
        """
        log_file = Path(log_dir) / f"{agent_name}.jsonl"

        if not log_file.exists():
            return []

        logs = []
        try:
            with open(log_file, "r", encoding="utf-8") as f:
                for line in f:
                    try:
                        entry = json.loads(line.strip())

                        # 应用过滤条件
                        if level and entry.get("level") != level:
                            continue
                        if date and entry.get("date") != date:
                            continue

                        logs.append(entry)
                    except json.JSONDecodeError:
                        continue

            # 返回最新的日志（倒序）
            return sorted(logs, key=lambda x: x["timestamp"], reverse=True)[:limit]

        except (IOError, OSError):
            return []

    @staticmethod
    def get_summary(log_dir: str = ".claude/logs", date: Optional[str] = None) -> Dict[str, Any]:
        """
        获取日志汇总统计

        Args:
            log_dir: 日志目录
            date: 指定日期（可选，格式 YYYY-MM-DD）

        Returns:
            包含统计信息的字典

        Example:
            summary = AgentLogger.get_summary()
            print(f"今日 ERROR: {summary['errors']}")
        """
        if date is None:
            date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        log_dir_path = Path(log_dir)
        summary = {
            "date": date,
            "agents": {},
            "total_logs": 0,
            "level_counts": {
                "DEBUG": 0,
                "INFO": 0,
                "WARNING": 0,
                "ERROR": 0,
                "CRITICAL": 0
            }
        }

        if not log_dir_path.exists():
            return summary

        # 扫描所有 Agent 日志文件
        for log_file in log_dir_path.glob("*.jsonl"):
            agent_name = log_file.stem

            try:
                with open(log_file, "r", encoding="utf-8") as f:
                    agent_logs = []
                    for line in f:
                        try:
                            entry = json.loads(line.strip())
                            if entry.get("date") == date:
                                agent_logs.append(entry)
                                summary["level_counts"][entry.get("level")] += 1
                        except json.JSONDecodeError:
                            continue

                    if agent_logs:
                        summary["agents"][agent_name] = {
                            "logs": len(agent_logs),
                            "levels": {
                                level: sum(1 for log in agent_logs if log.get("level") == level)
                                for level in summary["level_counts"]
                            },
                            "last_log": max(agent_logs, key=lambda x: x["timestamp"])["timestamp"]
                        }
                        summary["total_logs"] += len(agent_logs)

            except (IOError, OSError):
                continue

        return summary


# 快捷使用示例
if __name__ == "__main__":
    # 创建日志记录器
    logger = AgentLogger("摄影师")

    # 记录不同级别的日志
    logger.info("开始采集 Unsplash 数据", source="unsplash")
    logger.warning("API 响应缓慢", latency_ms=2500)
    logger.info("采集完成", downloads=1234, views=5678)

    # 查询日志
    print("\n最近 5 条摄影师日志：")
    logs = AgentLogger.get_logs("摄影师", limit=5)
    for log in logs:
        print(f"  [{log['level']}] {log['message']}")

    # 获取统计
    print("\n今日日志统计：")
    summary = AgentLogger.get_summary()
    print(f"  总日志数: {summary['total_logs']}")
    print(f"  ERROR: {summary['level_counts']['ERROR']}")
    print(f"  WARNING: {summary['level_counts']['WARNING']}")
