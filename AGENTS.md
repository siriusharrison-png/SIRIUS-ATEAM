# Agent 架构与协作规范

本文档定义系统中所有 Agent 的角色、职责、通信协议和协作规则。

## Agent 概览

| Agent | 名称 | 职责 | 触发 | 优先级 |
|-------|------|------|------|--------|
| 摄影师 | image-guardian | 每日采集 Unsplash 数据，推送到飞书 | 每日 09:00 (UTC 01:00) | P0 |
| 知识管理 | knowledge-keeper | 同步飞书文档和 GitLab 工作空间到 Notion | 08:00 / 12:00 (UTC 00:00 / 04:00) | P1 |
| 秘书 | secretary | 生成日报，汇总所有设备的使用情况 | 每日 18:00 (UTC 10:00) | P1 |
| 设计基础设施 | design-infra | 设计系统维护（预留） | 按需 | P2 |
| 海报设计师 | posterdesigner | 把上传图片/主题优化成 zine 纸感海报（Gemini 图生图） | 手动 `/poster` | P2 |

## 1. Agent 详细定义

### 1.1 摄影师 (image-guardian)

**职责**：
- 每日从 Unsplash 获取用户统计数据
- 分析热门主题和趋势
- 推送日报卡片到飞书
- 记录所有操作和统计数据

**关键数据**：
- 累计下载数、浏览数、点赞数
- 当日增长数据
- 热门关键词

**依赖**：
- Unsplash API
- 飞书 Webhook

**失败处理**：
- 自动重试（在 GitHub Actions 中配置）
- 失败告警到飞书（秘书频道）
- 错误记录到日志系统

**输出**：
- 飞书卡片消息
- 日志条目（INFO/ERROR）
- hub.json status update

---

### 1.2 知识管理 (knowledge-keeper)

**职责**：
- **飞书同步** (08:00 UTC)：定期检查飞书文档，提取 URL 并补充到 Notion
- **GitLab 同步** (12:00 UTC)：定期检查 GitLab Workspace 文件，同步更新到 Notion

**关键数据**：
- 飞书：文档 URL、最后修改时间
- GitLab：文件路径、最后提交信息
- Notion：已有的 URL（避免重复）

**依赖**：
- 飞书 API
- GitLab API
- Notion API

**失败处理**：
- 各自独立失败告警（飞书失败、GitLab 失败分开通知）
- 缓存机制（本地记录已同步的 URL，避免重复）
- 错误不会中断整个工作流

**输出**：
- Notion 数据库更新
- 日志条目（INFO/ERROR，含统计数据）
- hub.json status update

**协作关系**：
- 两个同步脚本完全独立，互不影响
- 都只读飞书/GitLab，只写 Notion，无竞争

---

### 1.3 秘书 (secretary)

**职责**：
- 每日 18:00 生成工作日报
- 收集所有设备的日报数据（本地 + 云同步）
- 推送到飞书

**关键数据**：
- 多设备的 Claude 使用情况
- 工作总结
- 统计指标

**依赖**：
- claude-config 私有仓库（device insights 数据）
- 飞书 Webhook

**失败处理**：
- 失败告警到飞书
- 可手动触发重新生成指定日期的报告

**输出**：
- 飞书日报卡片
- 日志条目
- hub.json status update

---

### 1.4 设计基础设施 (design-infra)

**职责**：预留，待定义

### 1.5 海报设计师 (posterdesigner)

**职责**：把转转上传的图片或主题，按 `gc-minimal-zine-poster-v0-1` skill 风格优化成极简 zine 纸感海报。

- **引擎**：Google Gemini `gemini-2.5-flash-image`（图生图）
- **触发**：手动 `/poster`、"做海报"、"优化成海报"
- **输入**：`agents/posterdesigner/input/` 图片 + 主题文字
- **输出**：`agents/posterdesigner/output/` + 上报 `hub.json`
- **详见**：[agents/posterdesigner/README.md](agents/posterdesigner/README.md)

---

## 2. 工作流调度

### 北京时间日程表

```
00:00 ─ 知识管理：飞书文档同步 (sync-feishu-docs.py)
├─ 从飞书获取文档
├─ 提取 URL
└─ 同步到 Notion

04:00 ─ 知识管理：GitLab 工作空间同步 (sync-gitlab-workspace.py)
├─ 从 GitLab 获取文件
├─ 检查更新
└─ 同步到 Notion

09:00 ─ 摄影师：每日数据采集与推送 (run-daily-cloud.py)
├─ 获取 Unsplash 统计
├─ 获取热门关键词
└─ 推送飞书日报

18:00 ─ 秘书：生成工作日报 (merge-daily-insights.py)
├─ 收集设备日报
├─ 合并数据
└─ 推送飞书
```

### 时间间隔分析

- **00:00 → 04:00**: 4 小时（知识管理内部间隔）
- **04:00 → 09:00**: 5 小时（缓冲）
- **09:00 → 18:00**: 9 小时（缓冲，无重叠）
- **18:00 → 24:00**: 6 小时（缓冲）

**评估**：间距充足，无重叠风险。

---

## 3. 消息协议

所有 Agent 通过 `hub.json` 中的 message 队列通信。

### 消息格式

```json
{
  "id": "msg-uuid",
  "from": "摄影师",
  "to": "系统",
  "type": "update|alert|task|status",
  "priority": "normal|high|critical",
  "timestamp": "2026-07-22T10:00:00+08:00",
  "content": {
    "action": "...",
    "data": {...}
  },
  "status": "pending|processing|done|failed"
}
```

### 消息类型

| 类型 | 用途 | 优先级 | 示例 |
|------|------|--------|------|
| **update** | 完成某项工作 | normal | "飞书同步完成：新增 5 个 URL" |
| **alert** | 告警或错误 | high/critical | "GitLab 同步失败：401 Unauthorized" |
| **task** | 分派新任务给其他 Agent | high | "秘书，请生成 2026-07-22 日报" |
| **status** | 状态查询回复 | normal | "当前在线，最后运行于 10:00" |

### 消息优先级

- **critical**: 系统级错误，需要立即处理
- **high**: 工作流失败，需要告警
- **normal**: 日常操作完成

---

## 4. 状态管理协议

### Agent 状态生命周期

```
┌─────────┐
│ offline │  (初始状态或很久没运行)
└────┬────┘
     │ 工作流触发
     ▼
┌─────────┐
│  busy   │  (正在运行)
└────┬────┘
     │ 完成或失败
     ▼
┌─────────┐
│ active  │  (最后一次运行成功)
└────┬────┘
     │ 2 小时无更新
     ▼
┌─────────┐
│  idle   │  (等待下次运行)
└────┬────┘
     │ 检测到错误
     ▼
┌─────────┐
│ error   │  (最后一次运行失败)
└─────────┘
```

### 更新规则

**hub.json 中的 Agent 条目**：

```json
{
  "name": "摄影师",
  "status": "active",
  "lastSeen": "2026-07-22T10:00:00+08:00",
  "lastError": null,
  "runCount": 42,
  "successCount": 40,
  "failureCount": 2
}
```

**更新时机**：
- 工作流开始：status = "busy"，更新 `startTime`
- 工作流成功：status = "active"，更新 `lastSeen`、`successCount`
- 工作流失败：status = "error"，更新 `lastError`、`failureCount`
- 定期更新：每次 API 调用时更新 `lastSeen`

---

## 5. 协作规则

### 5.1 独立性原则

**原则**：每个 Agent 的失败不应影响其他 Agent。

- ✅ 摄影师失败 → 知识管理和秘书继续运行
- ✅ 知识管理（飞书）失败 → GitLab 同步继续运行
- ✅ 秘书失败 → 不影响其他工作流

**实现**：
- 每个工作流独立的失败告警
- 错误记录到日志，不中断执行
- hub.json 支持并发写入（使用 fcntl 锁）

### 5.2 冲突解决

**可能的冲突**：
1. **Notion 重复写入**：知识管理的两个脚本同时更新同一条记录
   - **解决**：Notion API 的去重机制（URL 字段唯一）
   
2. **hub.json 并发写入**：两个脚本同时更新
   - **解决**：HubManager 的文件锁 + 重试机制

3. **日志同时写入**：多个 Agent 同时记录日志
   - **解决**：JSON Lines 格式支持并发追加写入

### 5.3 通知机制

**消息如何触发通知**：
- **type = "alert"** 且 **priority = "critical"** → 立即发送飞书告警
- **type = "update"** → 记录到日志，仪表板可见
- **type = "task"** → 暂不支持（预留），未来实现 Agent 间协调

---

## 6. 数据流

```
┌──────────────┐
│   Unsplash   │
└──────┬───────┘
       │ 摄影师采集
       ▼
    ┌─────────────────┐
    │  飞书日报卡片   │
    └─────────────────┘

┌──────────────┐         ┌──────────────┐
│   飞书文档   │         │  GitLab WS   │
└──────┬───────┘         └──────┬───────┘
       │ 知识管理                │ 知识管理
       └──────────┬──────────────┘
                  │ 提取 URL
                  ▼
            ┌───────────┐
            │  Notion   │
            └───────────┘

┌──────────────┐
│ claude-config│ (device insights)
└──────┬───────┘
       │ 秘书收集
       ▼
    ┌─────────────────┐
    │  飞书日报卡片   │
    └─────────────────┘
```

---

## 7. 故障恢复策略

### 场景 1：某个 Agent 工作流失败

**流程**：
1. GitHub Actions 工作流失败
2. 失败告警发送到飞书（秘书频道）
3. 错误记录到日志系统
4. hub.json 状态更新为 `error`
5. 下一个调度周期自动重试

**手动恢复**：
```bash
# 手动触发工作流
gh workflow run daily.yml  # 摄影师
gh workflow run knowledge-sync.yml  # 知识管理
gh workflow run secretary-daily.yml  # 秘书
```

### 场景 2：某个外部 API 暂时不可用

**处理**：
- 各脚本有自己的错误处理和重试逻辑
- 不会因为 API 暂时不可用而导致状态污染
- 日志记录错误详情，用于后续排查

### 场景 3：hub.json 或日志系统故障

**影响**：
- hub.json 故障：Agent 状态更新失败，但不影响主工作流
- 日志系统故障：日志丢失，但不影响业务逻辑

**恢复**：
```bash
# 重新初始化 hub.json
python agents/lib/hub_manager.py --init

# 检查日志完整性
ls -la ~/.claude/logs/
```

---

## 8. 监控与告警

### 8.1 关键指标

| 指标 | 监控点 | 阈值 | 告警 |
|------|--------|------|------|
| Agent 运行失败率 | hub.json | > 20% | 高 |
| 最后运行时间 | lastSeen | 超过预期 1 小时 | 中 |
| 错误数增长 | failureCount | 增长 > 5 次/天 | 中 |
| 日志大小 | .jsonl 文件 | > 100MB | 低 |

### 8.2 仪表板监控

访问 `.claude/logs/dashboard.html`：
- 实时显示所有 Agent 状态
- 显示最近错误和告警
- 统计运行成功率

### 8.3 自动化告警

在 GitHub Actions 中配置：
```yaml
- name: Check Agent Health
  if: always()
  run: |
    python scripts/check-agent-health.py
    # 检查失败率，如果过高则告警
```

---

## 9. 扩展指南

### 添加新 Agent 的步骤

1. **在 agents/ 下创建目录**：`agents/my-agent/`
2. **创建脚本**：`agents/my-agent/scripts/main.py`
3. **集成 HubManager** 和 **AgentLogger**
4. **创建工作流**：`.github/workflows/my-agent.yml`
5. **添加到此文档**：更新本文的 Agent 表格和详细定义
6. **测试**：本地运行测试，GitHub Actions 验证

### 集成模板

```python
#!/usr/bin/env python3
from pathlib import Path
import sys

try:
    sys.path.insert(0, str(Path(__file__).parent.parent.parent))
    from lib.hub_manager import HubManager
    from lib.agent_logger import AgentLogger
    HAS_HUB_MANAGER = True
    HAS_LOGGER = True
    logger = AgentLogger("我的Agent")
except ImportError:
    HAS_HUB_MANAGER = False
    HAS_LOGGER = False

def main():
    if HAS_LOGGER:
        logger.info("开始工作")
    
    try:
        # 业务逻辑
        pass
    
    except Exception as e:
        if HAS_LOGGER:
            logger.error(f"失败: {str(e)}")
        sys.exit(1)
    
    finally:
        if HAS_HUB_MANAGER:
            hub = HubManager(Path(__file__).parent.parent.parent / "hub.json")
            hub.update_agent_status("我的Agent", "active")

if __name__ == "__main__":
    main()
```

---

## 10. 变更日志

### v1.0.0 (2026-07-22)

- 初版 Agent 架构文档
- 定义 3 个核心 Agent（摄影师、知识管理、秘书）
- 确立消息协议和状态管理规范
- 调度时间表优化（无重叠）
- 故障恢复策略
