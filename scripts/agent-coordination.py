#!/usr/bin/env python3
"""
Agent 协调规则引擎
基于 hub.json 的实时状态，自动执行协作规则

规则类型：
1. 依赖规则: 某个 Agent 的输入依赖另一个 Agent 的输出
2. 冲突规则: 防止多个 Agent 同时修改相同数据
3. 通知规则: Agent 完成任务时自动通知相关方
4. 恢复规则: 检测到故障时自动触发恢复流程
"""

import sys
import json
from pathlib import Path
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Callable
from enum import Enum

sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    from agents.lib.hub_manager import HubManager
    HAS_LIBS = True
except ImportError:
    HAS_LIBS = False


class RuleType(Enum):
    """规则类型"""
    DEPENDENCY = "dependency"      # 依赖规则
    CONFLICT = "conflict"          # 冲突规则
    NOTIFICATION = "notification"  # 通知规则
    RECOVERY = "recovery"          # 恢复规则
    COORDINATION = "coordination"  # 协调规则


class Rule:
    """协作规则基类"""

    def __init__(self, rule_id: str, rule_type: RuleType, description: str):
        self.rule_id = rule_id
        self.rule_type = rule_type
        self.description = description
        self.conditions = []
        self.actions = []

    def evaluate(self, hub_state: dict) -> bool:
        """评估规则是否触发"""
        raise NotImplementedError

    def execute(self, hub_state: dict) -> dict:
        """执行规则的动作"""
        raise NotImplementedError


class DependencyRule(Rule):
    """
    依赖规则：确保依赖的 Agent 成功运行后，依赖方才运行

    示例：秘书需要摄影师和知识管理的数据
    """

    def __init__(self, rule_id: str, dependent_agent: str, required_agents: List[str], max_age_hours: int = 2):
        super().__init__(rule_id, RuleType.DEPENDENCY, f"{dependent_agent} 依赖于 {', '.join(required_agents)}")
        self.dependent_agent = dependent_agent
        self.required_agents = required_agents
        self.max_age_hours = max_age_hours

    def evaluate(self, hub_state: dict) -> bool:
        """检查所有依赖的 Agent 是否都已成功运行"""
        agents = hub_state.get("agents", {})

        # 检查所有必需的 Agent 是否都健康且最近运行过
        now = datetime.now(timezone.utc).astimezone(timezone(timedelta(hours=8)))

        for req_agent in self.required_agents:
            if req_agent not in agents:
                return False

            agent_info = agents[req_agent]

            # 检查状态
            if agent_info.get("status") == "error":
                return False

            # 检查新鲜度
            try:
                last_seen = datetime.fromisoformat(agent_info.get("lastSeen", ""))
                if last_seen.tzinfo is None:
                    last_seen = last_seen.replace(tzinfo=timezone.utc)
                last_seen = last_seen.astimezone(timezone(timedelta(hours=8)))

                age_hours = (now - last_seen).total_seconds() / 3600
                if age_hours > self.max_age_hours:
                    return False
            except:
                return False

        return True

    def execute(self, hub_state: dict) -> dict:
        """依赖检查通过，返回可以进行的操作"""
        return {
            "can_proceed": True,
            "reason": f"所有依赖条件满足，{self.dependent_agent} 可以安全执行",
            "dependencies": {
                "satisfied": self.required_agents,
                "max_age_hours": self.max_age_hours
            }
        }


class ConflictRule(Rule):
    """
    冲突规则：防止多个 Agent 同时写入相同数据

    示例：知识管理的两个同步脚本不能同时运行
    """

    def __init__(self, rule_id: str, agents: List[str], resource: str):
        super().__init__(rule_id, RuleType.CONFLICT, f"保护资源 {resource} 的写入冲突")
        self.agents = agents
        self.resource = resource
        self.write_lock_timeout = 3600  # 1 小时

    def evaluate(self, hub_state: dict) -> bool:
        """检查是否存在写入冲突"""
        agents = hub_state.get("agents", {})
        busy_agents = [a for a in self.agents if agents.get(a, {}).get("status") == "busy"]

        # 如果有多个 Agent 在忙碌状态，可能存在冲突
        return len(busy_agents) > 1

    def execute(self, hub_state: dict) -> dict:
        """返回冲突信息和建议的解决方案"""
        agents = hub_state.get("agents", {})
        busy_agents = [a for a in self.agents if agents.get(a, {}).get("status") == "busy"]

        return {
            "conflict_detected": len(busy_agents) > 1,
            "busy_agents": busy_agents,
            "resource": self.resource,
            "recommendation": f"等待 {', '.join(busy_agents)} 完成后再运行"
        }


class NotificationRule(Rule):
    """
    通知规则：Agent 完成任务时通知相关方

    示例：摄影师完成后通知秘书可以开始
    """

    def __init__(self, rule_id: str, trigger_agent: str, trigger_event: str, notify_agent: str):
        super().__init__(rule_id, RuleType.NOTIFICATION, f"当 {trigger_agent} {trigger_event} 时通知 {notify_agent}")
        self.trigger_agent = trigger_agent
        self.trigger_event = trigger_event
        self.notify_agent = notify_agent

    def evaluate(self, hub_state: dict) -> bool:
        """检查触发条件是否满足"""
        messages = hub_state.get("messages", [])

        # 查找最近的事件消息
        for msg in reversed(messages):
            if (msg.get("from") == self.trigger_agent and
                self.trigger_event in msg.get("content", {}).get("action", "") and
                msg.get("status") == "done"):
                return True

        return False

    def execute(self, hub_state: dict) -> dict:
        """生成通知消息"""
        return {
            "notification": {
                "from": self.trigger_agent,
                "to": self.notify_agent,
                "type": "notification",
                "message": f"{self.trigger_agent} 已完成 {self.trigger_event}，请准备后续工作"
            }
        }


class RecoveryRule(Rule):
    """
    恢复规则：检测到故障时自动触发恢复

    示例：某 Agent 失败次数过多时，自动降级处理或告警
    """

    def __init__(self, rule_id: str, agent: str, failure_threshold: int = 3, window_hours: int = 24):
        super().__init__(rule_id, RuleType.RECOVERY, f"监控 {agent} 的故障率")
        self.agent = agent
        self.failure_threshold = failure_threshold
        self.window_hours = window_hours

    def evaluate(self, hub_state: dict) -> bool:
        """检查故障率是否超过阈值"""
        agents = hub_state.get("agents", {})
        agent_info = agents.get(self.agent, {})

        stats = agent_info.get("stats", {})
        run_count = stats.get("runCount", 0)
        failure_count = stats.get("failureCount", 0)

        # 简化检查：连续失败是否超过阈值
        if failure_count >= self.failure_threshold and run_count > 0:
            recent_failures = failure_count % max(run_count - 10, 1)  # 最近 10 次中的失败数
            return recent_failures >= 2

        return False

    def execute(self, hub_state: dict) -> dict:
        """返回恢复建议"""
        agents = hub_state.get("agents", {})
        agent_info = agents.get(self.agent, {})
        last_error = agent_info.get("lastError")

        return {
            "recovery_needed": True,
            "agent": self.agent,
            "last_error": last_error,
            "recommendations": [
                f"检查 {self.agent} 的错误日志",
                "验证依赖服务是否可用",
                f"考虑手动触发 {self.agent} 的工作流",
                "通知运维人员进行排查"
            ]
        }


class CoordinationEngine:
    """Agent 协调引擎"""

    def __init__(self, hub_path: Path = None):
        self.hub_path = hub_path or Path.home() / ".claude/projects/-Users-ppio-dn-275-Desktop-SIRIUS-ATEAM/agents/hub.json"
        self.rules: Dict[str, Rule] = {}
        self._init_default_rules()

    def _init_default_rules(self):
        """初始化默认规则"""
        # 依赖规则：秘书依赖摄影师和知识管理
        self.add_rule(DependencyRule(
            "dep-secretary-on-others",
            dependent_agent="秘书",
            required_agents=["摄影师", "知识管理"],
            max_age_hours=2
        ))

        # 冲突规则：知识管理的两个同步不能同时运行
        self.add_rule(ConflictRule(
            "conflict-knowledge-keeper",
            agents=["知识管理"],  # 简化版，实际应检查子任务
            resource="Notion database"
        ))

        # 通知规则：摄影师完成后通知系统
        self.add_rule(NotificationRule(
            "notify-photographer-done",
            trigger_agent="摄影师",
            trigger_event="daily_report",
            notify_agent="系统"
        ))

        # 恢复规则：监控每个 Agent 的故障率
        for agent in ["摄影师", "知识管理", "秘书"]:
            self.add_rule(RecoveryRule(
                f"recovery-{agent}",
                agent=agent,
                failure_threshold=3,
                window_hours=24
            ))

    def add_rule(self, rule: Rule):
        """添加规则"""
        self.rules[rule.rule_id] = rule

    def evaluate_all_rules(self, hub_state: dict) -> Dict:
        """评估所有规则"""
        results = {
            "timestamp": datetime.now(timezone(timedelta(hours=8))).isoformat(),
            "total_rules": len(self.rules),
            "triggered_rules": [],
            "rule_results": {}
        }

        for rule_id, rule in self.rules.items():
            try:
                if rule.evaluate(hub_state):
                    action_result = rule.execute(hub_state)
                    results["triggered_rules"].append(rule_id)
                    results["rule_results"][rule_id] = {
                        "type": rule.rule_type.value,
                        "description": rule.description,
                        "result": action_result
                    }
            except Exception as e:
                results["rule_results"][rule_id] = {
                    "error": str(e)
                }

        return results

    def run(self) -> Dict:
        """运行协调引擎"""
        if not HAS_LIBS:
            return {"error": "HubManager not available"}

        try:
            hub = HubManager(self.hub_path)
            # 这里应该有获取完整状态的方法
            hub_state = {}  # 简化版
            return self.evaluate_all_rules(hub_state)
        except Exception as e:
            return {"error": str(e)}


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Agent 协调规则引擎")
    parser.add_argument("--hub-path", help="hub.json 路径")
    parser.add_argument("--json", action="store_true", help="输出 JSON 格式")

    args = parser.parse_args()

    engine = CoordinationEngine(Path(args.hub_path) if args.hub_path else None)

    print("🔄 Agent 协调规则引擎\n")
    print(f"已加载 {len(engine.rules)} 条规则\n")

    for rule_id, rule in engine.rules.items():
        print(f"  - [{rule.rule_type.value}] {rule_id}: {rule.description}")

    print("\n（当前为演示版本，完整版本需要与 hub.json 集成）")

    return 0


if __name__ == "__main__":
    sys.exit(main())
