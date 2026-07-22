"""
agents.lib - AI 团队协作库

包含 Agent 协作所需的核心工具：
- HubManager: hub.json 协作中枢管理
- AgentLogger: 统一日志系统
- ConfigValidator: 配置验证器
"""

from .hub_manager import HubManager

__all__ = ["HubManager"]
__version__ = "0.1.0"
