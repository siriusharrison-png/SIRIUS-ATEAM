# SIRIUS-ATEAM Agent 架构优化建议 (2026-07-22)

> 基于 Astra 分析，针对当前 4-Agent 系统的全面优化方案

---

## 📋 概览

**当前系统状态**：
- ✅ 架构完整（4 个 Agent 清晰定位）
- ✅ 规则文档齐全（RULES.md + hub-schema.md）
- ✅ 自动化工作流已实现（4 个 GitHub Actions）
- ❌ **数据同步过期**（hub.json 滞后 4 个月）
- ❌ **可观测性缺陷**（无日志系统）
- ❌ **规则与代码脱节**（文档停留在 3 月）

**优化目标**：从"完整但不活跃"升级为"活跃且可扩展"

---

## 🎯 7 个关键问题（按优先级排序）

### P0（必做）：hub.json 过期 - 影响全系统

**现状**：
- `lastSeen: 2026-03-05`（4 个月前）
- `messages: [1条初始消息]`（无协作记录）
- `tasks: []`（无任务分配）
- 协作中枢形同虚设

**根因**：hub.json 被当作静态模板，各 Agent 完成任务后不更新

**影响**：
- 无法判断 Agent 是否正常运行
- 任务分配流程形同虚设
- 小秘书无法准确汇总

**解决方案**（3-4 天）：
1. 创建 `agents/lib/hub_manager.py` - HubManager 工具类
   - 负责读写 hub.json（防并发冲突）
   - 提供原子性操作和重试机制
2. 修改各 Agent 脚本（image-guardian, knowledge-keeper, secretary）
   - 任务完成后调用 HubManager 更新 hub.json
3. 重新初始化 hub.json
   - 重置 `lastSeen` 为当前时间
   - 清空过期的 messages/tasks
   - 同步当前各 Agent 状态

**代码示例**：
```python
# agents/lib/hub_manager.py
class HubManager:
    def __init__(self, hub_path="agents/hub.json"):
        self.hub_path = Path(hub_path)
    
    def update_agent_status(self, agent_name: str, status: str, last_seen: str = None):
        """原子性更新 Agent 状态"""
        hub = self._load()
        hub["agents"][agent_name]["status"] = status
        hub["agents"][agent_name]["lastSeen"] = last_seen or datetime.now(timezone.utc).isoformat()
        hub["meta"]["lastUpdate"] = datetime.now(timezone.utc).isoformat()
        self._save(hub)
    
    def add_message(self, from_agent: str, msg_type: str, content: str, data: dict = None):
        """添加消息到 hub.json"""
        hub = self._load()
        msg = {
            "id": f"msg-{int(time.time()*1000)}",
            "from": from_agent,
            "time": datetime.now(timezone.utc).isoformat(),
            "type": msg_type,
            "content": content,
            "data": data or {}
        }
        hub["messages"].append(msg)
        self._save(hub)
```

---

### P1（重点）：规则系统老化 - 影响全系统

**现状**：
- RULES.md 最后更新：2026-03-05
- 无版本控制和变更日志
- 新功能上线后无人更新规则

**根因**：没有规则版本管理流程

**影响**：
- 新功能无规则覆盖
- 规则演进无记录
- 无清晰的规则更新流程

**解决方案**（2-3 天）：
1. 创建 `agents/RULES-HISTORY.md` - 版本清单和变更记录
2. 创建 `agents/RULES-PROPOSAL-TEMPLATE.md` - 规则建议模板
3. 修改 `agents/RULES.md`
   - 添加版本声明（当前 v1.0.0 升级到 v1.1.0）
   - 添加"规则更新流程"章节
4. 定义规则生命周期
   - 提案阶段（draft）
   - 讨论阶段（under-review）
   - 审核阶段（approved）
   - 实施阶段（active）
   - 验证阶段（verified）

**RULES-HISTORY.md 示例**：
```markdown
# 规则版本历史

## v1.1.0 (2026-07-22) - 激活协作中枢版本
- 添加 hub.json 实时更新规则
- 新增日志系统规范
- 明确 Agent 完成任务后的 hub.json 更新职责

## v1.0.0 (2026-03-05) - 初始版本
- 定义 4 个 Agent 的权限边界
- 建立任务流转规范
- 规范设计系统三层映射
```

---

### P1（重点）：可观测性缺陷 - 影响运维管理

**现状**：
- 无集中日志系统
- 工作流失败用 `continue-on-error` 掩盖
- 无健康检查机制

**根因**：各 Agent 脚本各自处理日志，无统一标准

**影响**：
- 工作流失败无人知晓
- 问题发现延迟数小时甚至数天
- 难以调试和优化

**解决方案**（3-4 天）：
1. 创建 `agents/lib/agent_logger.py` - 统一日志系统
   - JSON 行日志格式（支持解析）
   - 日志级别：INFO, WARNING, ERROR, CRITICAL
   - 包含上下文（Agent 名、任务 ID、时间）
2. 修改工作流文件（.github/workflows/）
   - 移除 `continue-on-error`，改为显式错误处理
   - 添加失败告警（飞书通知）
   - 添加工作流日志聚合步骤
3. 创建日志聚合页面（.claude/logs/dashboard.html）
   - 展示最近 7 天的工作流执行情况
   - 高亮失败和警告
   - 支持按 Agent 过滤

**代码示例**：
```python
# agents/lib/agent_logger.py
import json
from pathlib import Path
from datetime import datetime, timezone

class AgentLogger:
    def __init__(self, agent_name: str, log_dir=".claude/logs"):
        self.agent_name = agent_name
        self.log_dir = Path(log_dir)
        self.log_dir.mkdir(exist_ok=True)
    
    def info(self, message: str, **context):
        self._log("INFO", message, context)
    
    def error(self, message: str, **context):
        self._log("ERROR", message, context)
    
    def _log(self, level: str, message: str, context: dict):
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": level,
            "agent": self.agent_name,
            "message": message,
            **context
        }
        
        # 写入 JSON 行日志
        log_file = self.log_dir / f"{self.agent_name}.jsonl"
        with open(log_file, "a") as f:
            f.write(json.dumps(log_entry, ensure_ascii=False) + "\n")
```

---

### P2（强烈推荐）：其他问题

**P2-1 协作流程模糊**（2-3 天）
- 现状：无端到端的工作流示例
- 解决：创建 4 个完整场景示例（任务分配、问题报告、设计咨询、知识添加）
- 文件：`agents/WORKFLOW-EXAMPLES.md`

**P2-2 文档维护不一致**（1-2 天）
- 现状：代码在演进，文档停留在 3 月
- 解决：添加 CI 工作流自动检查文档与代码的一致性
- 文件：`.github/workflows/doc-sync-check.yml`

**P2-3 工作流时间安排模糊**（1 天）
- 现状：工作流时间无显式依赖关系
- 解决：创建工作流依赖关系图
- 文件：`.github/WORKFLOW-SCHEDULE.md`

**P2-4 系统可扩展性**（2-3 天）
- 现状：无新 Agent 接入规范
- 解决：创建新 Agent 接入指南（9 步流程）
- 文件：`agents/NEW-AGENT-SETUP-GUIDE.md`

---

## 📁 文件变更清单

### 新建文件（11 个）

| 文件 | 说明 | 优先级 |
|------|------|--------|
| `agents/lib/hub_manager.py` | HubManager 工具类 | P0 |
| `agents/lib/agent_logger.py` | 统一日志系统 | P1 |
| `agents/RULES-HISTORY.md` | 规则版本历史 | P1 |
| `agents/RULES-PROPOSAL-TEMPLATE.md` | 规则建议模板 | P1 |
| `agents/WORKFLOW-EXAMPLES.md` | 协作流程示例 | P2 |
| `agents/NEW-AGENT-SETUP-GUIDE.md` | 新 Agent 接入指南 | P2 |
| `.github/WORKFLOW-SCHEDULE.md` | 工作流时间表 | P2 |
| `.github/workflows/doc-sync-check.yml` | 文档同步检查 | P2 |
| `.claude/logs/dashboard.html` | 日志聚合页面 | P1 |
| `.claude/logs/.gitkeep` | 日志目录占位符 | P1 |
| `studio/notes/AGENT-OPTIMIZATION-2026-07-22.md` | 本优化报告 | 文档 |

### 修改文件（9 个）

| 文件 | 改动 | 优先级 |
|------|------|--------|
| `agents/RULES.md` | 添加版本声明、规则更新流程 | P1 |
| `agents/hub-schema.md` | 添加版本说明、实时更新规范 | P1 |
| `agents/hub.json` | 重新初始化当前状态 | P0 |
| `agents/secretary/README.md` | 添加 hub.json 更新职责 | P1 |
| `agents/image-guardian/scripts/run-daily-cloud.py` | 集成 HubManager | P0 |
| `agents/knowledge-keeper/scripts/sync-*.py` | 集成 HubManager、AgentLogger | P0 |
| `.github/workflows/daily.yml` | 移除 continue-on-error、添加日志 | P1 |
| `.github/workflows/knowledge-sync.yml` | 移除 continue-on-error、添加日志 | P1 |
| `.github/workflows/secretary-daily.yml` | 添加日志聚合步骤 | P1 |

---

## 🚀 实施路线图

### 第 1 周（P0 - 激活协作中枢）

| 日期 | 任务 | 预期产出 |
|------|------|----------|
| Day 1-2 | 创建 HubManager 工具类 | agents/lib/hub_manager.py |
| Day 2-3 | 修改各 Agent 脚本集成 HubManager | 3 个脚本更新 |
| Day 3-4 | 重新初始化 hub.json | 最新的 hub 状态 |
| Day 4-5 | 测试和文档 | README 更新 |

**验收标准**：
- ✅ hub.json lastSeen 为当前时间
- ✅ 任何 Agent 完成任务后能自动更新 hub.json
- ✅ 无数据丢失或冲突

### 第 2 周（P1 - 可观测性 + 规则清晰化）

| 日期 | 任务 | 预期产出 |
|------|------|----------|
| Day 1-2 | 创建 AgentLogger 系统 | agents/lib/agent_logger.py |
| Day 2 | 修改工作流文件 | 3 个工作流更新 |
| Day 3 | 创建日志聚合页面 | .claude/logs/dashboard.html |
| Day 3-4 | 规则版本化 | RULES-HISTORY.md, RULES-PROPOSAL-TEMPLATE.md |
| Day 5 | 修改 RULES.md | 添加版本和更新流程 |

**验收标准**：
- ✅ 工作流失败时 24 小时内有飞书通知
- ✅ 所有日志都存储为 JSON 行格式
- ✅ RULES.md 版本清晰，有更新流程

### 第 3 周（P2 - 协作流程清晰化）

| 日期 | 任务 | 预期产出 |
|------|------|----------|
| Day 1-2 | 编写协作流程示例 | agents/WORKFLOW-EXAMPLES.md |
| Day 2 | 创建工作流时间表 | .github/WORKFLOW-SCHEDULE.md |
| Day 3 | 创建 CI 文档同步检查 | .github/workflows/doc-sync-check.yml |
| Day 4-5 | 更新各 Agent README | 文档同步 |

**验收标准**：
- ✅ 有 4 个完整的、可复现的协作流程示例
- ✅ 工作流时间依赖关系清晰
- ✅ CI 能检查文档与代码一致性

### 第 4 周（P3 - 系统扩展规范）

| 日期 | 任务 | 预期产出 |
|------|------|----------|
| Day 1-3 | 编写新 Agent 接入指南 | agents/NEW-AGENT-SETUP-GUIDE.md |
| Day 4 | 创建配置验证脚本 | agents/lib/config_validator.py |
| Day 5 | 文档和示例 | 完整指南 |

**验收标准**：
- ✅ 有 9 步的新 Agent 接入流程
- ✅ 可自动验证新 Agent 的配置
- ✅ 有完整的示例代码

---

## 📊 预期效果

### 短期（实施后 1-2 月）
- ✅ hub.json 实时更新，Agent 状态透明
- ✅ 工作流失败可追踪，问题无法隐藏
- ✅ 小秘书能准确汇总进度
- ✅ 规则版本清晰，更新流程规范

### 中期（实施后 2-3 月）
- ✅ 协作流程标准化，新人快速上手
- ✅ 文档和代码自动同步，知识转移顺畅
- ✅ 系统日志完整，调试效率提升
- ✅ 规则演进有记录，决策可追溯

### 长期（实施后 3-6 月）
- ✅ 支持新 Agent 接入，系统可扩展
- ✅ 适配多团队场景，可复用能力
- ✅ 成为 Multi-Agent 协作的成熟范例

---

## 🎯 关键指标

| 指标 | 现状 | 目标 | 度量 |
|------|------|------|------|
| hub.json 更新频率 | 4 个月 | 每天 | Agent 完成任务后自动更新 |
| 工作流失败告警 | 无 | 24 小时内 | 飞书通知记录 |
| 规则版本清晰度 | 无版本 | v1.2.0+ | RULES-HISTORY.md 记录 |
| 日志可追踪性 | 无 | 100% | JSON 日志覆盖所有 Agent |
| 新 Agent 接入时间 | 不确定 | < 2 天 | 接入指南检查清单 |
| 文档与代码一致性 | 50% | 100% | CI 自动检查 |

---

## 💡 执行建议

1. **小团队优先**（1-2 人）
   - 先完成 P0 + P1（激活系统）
   - 测试验证（1-2 周）
   - 再推进 P2 + P3

2. **大团队并行**（4 人）
   - 2 人做 P0 (hub.json + HubManager)
   - 2 人做 P1 (日志系统 + 规则版本化)
   - 1 周内完成，接下来平行处理 P2 + P3

3. **验收标准明确**
   - 每项完成后，在 hub.json 更新任务状态
   - 每个 PR 需要验收确认
   - 重要变更需要在 RULES-HISTORY.md 记录

4. **文档同步机制**
   - 修改代码时同时更新文档
   - CI 检查文档与代码一致性
   - 月末归档一次，更新 CHANGELOG.md

---

## 📝 下一步

1. **立即** - 和用户确认优化方向和优先级
2. **本周** - 创建具体的实施任务清单
3. **下周** - 启动第 1 周的 P0 工作
4. **月末** - 完成第 1-2 周，评估效果

**预计总时间**：14-20 个工作日（4 人一周，或 2 人两周）

---

*报告生成时间：2026-07-22*  
*分析工具：Astra Foundation*  
*下一步反馈：[待用户确认]*
