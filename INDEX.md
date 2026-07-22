# SIRIUS Agent 系统文档总览

这是 SIRIUS-ATEAM Agent 协作系统的完整文档指南。系统分为四个阶段演进：P0（基础设施）、P1（可观测性）、P2（协作规范）、P3（系统扩展）。

## 📚 快速导航

### 对于新用户

1. **了解系统架构**：[AGENTS.md](AGENTS.md)
   - 系统中有哪些 Agent
   - 它们的职责是什么
   - 如何协作

2. **学习部署新 Agent**：[EXTENDING.md](EXTENDING.md)
   - 5 分钟快速开始
   - 完整的 9 步部署指南
   - 实际案例（天气 Agent）

3. **监控运行状态**：[.claude/logs/README.md](.claude/logs/README.md)
   - 启动日志仪表板
   - 查询和分析日志
   - 健康检查

### 对于开发者

1. **实现新 Agent**：[agents/_template/README.md](agents/_template/README.md)
   - 使用 `new-agent.sh` 创建项目
   - 编辑 4 个核心函数
   - 本地测试和部署

2. **理解 hub.json 协议**：[HUB_SCHEMA.md](HUB_SCHEMA.md)
   - 数据结构规范
   - 消息格式定义
   - 状态管理生命周期

3. **工作流调度**：[WORKFLOW_SCHEDULE.md](WORKFLOW_SCHEDULE.md)
   - 当前调度时间表
   - 冲突检测工具
   - 容量规划

### 对于运维

1. **系统健康监控**：[scripts/agent-health-check.py](scripts/agent-health-check.py)
   - 检查 Agent 新鲜度
   - 监控成功率
   - 生成健康分数

2. **协调规则引擎**：[scripts/agent-coordination.py](scripts/agent-coordination.py)
   - 依赖关系管理
   - 冲突检测
   - 故障恢复

3. **工作流验证**：[scripts/check-workflow-schedule.py](scripts/check-workflow-schedule.py)
   - 检查调度冲突
   - 分析缓冲时间
   - 验证容量

---

## 🏗️ 系统架构

```
┌─────────────────────────────────────────────────────────┐
│           SIRIUS Agent 协作系统                         │
└─────────────────────────────────────────────────────────┘

┌─────────┐      ┌──────────────┐      ┌──────────┐
│  摄影师  │      │  知识管理    │      │  秘书    │
│ (09:00) │      │ (08:00/12:00)│     │(18:00)  │
└────┬────┘      └──────┬───────┘      └────┬─────┘
     │                  │                   │
     └──────────────────┼───────────────────┘
                        │
                   ┌────▼─────┐
                   │ hub.json  │ (协作中枢)
                   │(HubManager)
                   └────┬──────┘
                        │
          ┌─────────────┼─────────────┐
          │             │             │
    ┌────▼────┐   ┌───▼────┐   ┌──▼──────┐
    │  日志   │   │ 消息队列│  │ 状态   │
    │系统     │   │        │   │管理    │
    │(Logger) │   │(Messages)  │       │
    └─────────┘   └────────┘   └────────┘

         ┌──────────────────────────────────┐
         │   仪表板 & 监控工具               │
         │  - dashboard.html (实时监控)    │
         │  - health-check.py (健康检查)   │
         │  - coordination.py (规则引擎)   │
         └──────────────────────────────────┘
```

---

## 📋 核心文档列表

### 架构与规范

| 文档 | 用途 | 受众 |
|------|------|------|
| [AGENTS.md](AGENTS.md) | Agent 定义、职责、协作规则 | 所有人 |
| [HUB_SCHEMA.md](HUB_SCHEMA.md) | hub.json 数据结构规范 | 开发者 |
| [WORKFLOW_SCHEDULE.md](WORKFLOW_SCHEDULE.md) | 工作流时间表与调度优化 | 运维 |
| [EXTENDING.md](EXTENDING.md) | 如何添加新 Agent 的完整指南 | 开发者 |

### 工具与脚本

| 脚本 | 功能 | 运行 |
|------|------|------|
| [scripts/new-agent.sh](scripts/new-agent.sh) | 快速创建新 Agent 项目 | `bash scripts/new-agent.sh <name> "<desc>"` |
| [scripts/check-workflow-schedule.py](scripts/check-workflow-schedule.py) | 验证工作流调度无冲突 | `python scripts/check-workflow-schedule.py` |
| [scripts/agent-health-check.py](scripts/agent-health-check.py) | 监控 Agent 运行状态 | `python scripts/agent-health-check.py --verbose` |
| [scripts/agent-coordination.py](scripts/agent-coordination.py) | 查看协调规则 | `python scripts/agent-coordination.py` |

### 库与核心模块

| 模块 | 作用 | 位置 |
|------|------|------|
| HubManager | 原子化读写 hub.json | [agents/lib/hub_manager.py](agents/lib/hub_manager.py) |
| AgentLogger | JSON 行格式日志 | [agents/lib/agent_logger.py](agents/lib/agent_logger.py) |
| Agent 模板 | 快速创建新 Agent 项目 | [agents/_template/](agents/_template/) |

### 监控工具

| 工具 | 用途 | 访问 |
|------|------|------|
| 日志仪表板 | 实时查看所有 Agent 日志 | `bash .claude/logs/start-dashboard.sh` 然后打开 http://localhost:8000/dashboard.html |
| hub.json | 系统中枢状态 | `agents/hub.json` |
| 日志文件 | 详细操作日志 | `~/.claude/logs/*.jsonl` |

---

## 🚀 常见任务

### 任务 1：添加新 Agent

```bash
# 1. 使用模板创建项目
bash scripts/new-agent.sh weather-report "天气播报"

# 2. 编辑 agents/weather-report/scripts/main.py
# 修改 4 个函数:
#   - validate_environment()
#   - fetch_data()
#   - process_data()
#   - export_results()

# 3. 本地测试
python agents/weather-report/scripts/main.py

# 4. 配置工作流 (.github/workflows/weather-report.yml)
#   - 设置 cron 时间
#   - 添加 Secret

# 5. 验证调度
python scripts/check-workflow-schedule.py

# 6. 提交
git add .
git commit -m "feat: 添加天气播报 Agent"
git push
```

### 任务 2：监控 Agent 状态

```bash
# 启动实时仪表板
cd .claude/logs
bash start-dashboard.sh

# 在浏览器中打开 http://localhost:8000/dashboard.html
# 查看所有 Agent 的实时状态和日志
```

### 任务 3：检查工作流调度

```bash
# 验证没有时间冲突
python scripts/check-workflow-schedule.py

# 输出：
# 📊 工作流调度表
# 时间     Agent          ...
# 08:00    知识管理-飞书  ...
# 09:00    摄影师        ...
# 12:00    知识管理-GitLab ...
# 18:00    秘书          ...
# ✅ 所有工作流无冲突
```

### 任务 4：排查 Agent 故障

```bash
# 1. 检查健康状态
python scripts/agent-health-check.py --verbose

# 2. 查看最近日志
tail -20 ~/.claude/logs/[agent-name].jsonl | jq .

# 3. 查看 hub.json 中的状态
grep -A 10 "\"[agent-name]\"" agents/hub.json

# 4. 手动运行 Agent 测试
export $(cat agents/[agent-name]/.env | xargs)
python agents/[agent-name]/scripts/main.py
```

---

## 📊 系统进度

### P0 阶段：基础设施（已完成）
- ✅ HubManager 实现
- ✅ 3 个 Agent 脚本集成
- ✅ hub.json 初始化
- ✅ 工作流失败告警
- **成果**: Agent 协作中枢激活

### P1 阶段：可观测性（已完成）
- ✅ AgentLogger JSON 行格式日志
- ✅ 工作流失败告警完善
- ✅ 3 个 Agent 脚本日志集成
- ✅ 日志聚合仪表板
- **成果**: 系统运行完全可见

### P2 阶段：协作规范（已完成）
- ✅ Agent 架构文档（AGENTS.md）
- ✅ hub.json 数据结构规范（HUB_SCHEMA.md）
- ✅ 工作流调度验证（check-workflow-schedule.py）
- ✅ Agent 健康检查系统
- ✅ 协调规则引擎框架
- **成果**: Agent 协作从隐式变为显式规范

### P3 阶段：系统扩展（已完成）
- ✅ Agent 项目模板
- ✅ 快速部署脚本（new-agent.sh）
- ✅ 完整扩展指南（EXTENDING.md）
- ✅ 工作流模板
- ✅ 测试框架
- **成果**: 低门槛、标准化的 Agent 创建流程

---

## 🔍 快速参考

### 北京时间工作流调度

```
00:00 (UTC) = 08:00 (北京) → 知识管理：飞书同步
04:00 (UTC) = 12:00 (北京) → 知识管理：GitLab 同步
01:00 (UTC) = 09:00 (北京) → 摄影师：每日数据采集
10:00 (UTC) = 18:00 (北京) → 秘书：每日日报
```

### Cron 与北京时间转换

```
北京时间 = UTC 时间 + 8 小时
Cron UTC 时间 = (北京时间 - 8) % 24

示例：
北京 09:00 → UTC 01:00 → cron: '0 1 * * *'
北京 18:00 → UTC 10:00 → cron: '0 10 * * *'
北京 23:00 → UTC 15:00 → cron: '0 15 * * *'
```

### Agent 状态流

```
离线 → 忙碌 → 活跃 → 空闲 → 错误
      (运行)  (成功)  (等待) (失败)
```

---

## 📞 获取帮助

### 问题排查

1. **Agent 不运行** → 查看 [WORKFLOW_SCHEDULE.md](WORKFLOW_SCHEDULE.md) 的故障排查部分
2. **工作流时间冲突** → 运行 `check-workflow-schedule.py`
3. **日志查看** → 启动仪表板或查看 `~/.claude/logs/`
4. **添加新 Agent** → 跟随 [EXTENDING.md](EXTENDING.md) 的 9 步指南

### 相关资源

- GitHub Actions 文档：https://docs.github.com/en/actions
- Cron 在线工具：https://crontab.guru/
- Feishu API 文档：https://open.feishu.cn/document/home

---

## 📝 版本历史

| 版本 | 日期 | 主要变更 |
|------|------|---------|
| v1.0.0 | 2026-07-22 | P3 完成：系统扩展规范 + 部署自动化 |
| v0.9.0 | 2026-07-22 | P2 完成：协作规范 + 健康检查 + 规则引擎 |
| v0.8.0 | 2026-07-22 | P1 完成：可观测性 + 日志系统 + 仪表板 |
| v0.7.0 | 2026-07-21 | P0 完成：基础设施激活 |

---

## 🎯 下一步

系统已经成熟，建议的后续方向：

1. **实战验证**：部署一个新 Agent 使用 new-agent.sh，验证完整流程
2. **文档维护**：根据实际使用情况更新 AGENTS.md 和 EXTENDING.md
3. **工具优化**：根据反馈改进健康检查和协调规则
4. **容量监控**：定期运行 health-check 监控系统状态
5. **知识积累**：记录 Agent 开发的最佳实践和常见问题

---

**最后更新**: 2026-07-22
**维护者**: SIRIUS Agent 系统开发团队
