# Hub.json 数据格式说明

> 协作中枢的数据结构定义，供各 Agent 参考。

---

## 整体结构

```json
{
  "meta": { ... },        // 元信息
  "agents": { ... },      // Agent 状态
  "messages": [ ... ],    // 消息列表
  "tasks": [ ... ],       // 任务列表
  "dailySummary": { ... } // 当日汇总
}
```

---

## meta（元信息）

```json
{
  "version": "1.0.0",           // hub.json 格式版本
  "rulesVersion": "1.0.0",      // 对应的 RULES.md 版本
  "lastUpdate": "ISO时间戳",     // 最后更新时间
  "description": "描述"
}
```

---

## agents（Agent 状态）

```json
{
  "Agent名称": {
    "status": "active|inactive|busy",  // 状态
    "lastSeen": "ISO时间戳",            // 最后活跃时间
    "currentTask": "task-id"           // 当前正在执行的任务（可选）
  }
}
```

### 状态说明

| 状态 | 说明 |
|------|------|
| `active` | 空闲可用 |
| `busy` | 正在执行任务 |
| `inactive` | 离线/不可用 |

---

## messages（消息列表）

### 结构

```json
{
  "id": "msg-唯一ID",
  "from": "发送者Agent名称",
  "to": "接收者Agent名称（可选，不填则广播）",
  "time": "ISO时间戳",
  "type": "消息类型",
  "content": "消息内容（简短描述）",
  "data": { ... },           // 附加数据（可选）
  "read": false,             // 是否已读（可选）
  "relatedTask": "task-id"   // 关联任务（可选）
}
```

### type（消息类型）

| 类型 | 说明 | 使用场景 |
|------|------|----------|
| `info` | 普通信息 | 完成通知、状态更新 |
| `update` | 更新通知 | 设计系统更新、知识库更新 |
| `alert` | 警告/问题 | 检测到问题、错误发生 |
| `request` | 请求协助 | 需要其他 Agent 帮助 |
| `response` | 响应请求 | 对 request 的回复 |

### 写入消息示例

```javascript
// 读取现有 hub.json
const hub = JSON.parse(fs.readFileSync('hub.json'));

// 添加新消息
hub.messages.push({
  id: `msg-${Date.now()}`,
  from: "测试QA",
  time: new Date().toISOString(),
  type: "alert",
  content: "发现 3 处硬编码颜色",
  data: {
    issues: [...]
  }
});

// 更新 lastUpdate
hub.meta.lastUpdate = new Date().toISOString();

// 写回文件
fs.writeFileSync('hub.json', JSON.stringify(hub, null, 2));
```

---

## tasks（任务列表）

### 结构

```json
{
  "id": "task-唯一ID",
  "title": "任务标题",
  "description": "详细描述",
  "from": "创建者（用户或Agent）",
  "assignee": "执行者Agent名称",
  "status": "任务状态",
  "priority": "优先级",
  "createdAt": "创建时间",
  "updatedAt": "更新时间",
  "completedAt": "完成时间（可选）",
  "result": { ... }  // 执行结果（可选）
}
```

### status（任务状态）

| 状态 | 说明 |
|------|------|
| `pending` | 待处理（未分配或待开始） |
| `in_progress` | 进行中 |
| `completed` | 已完成 |
| `blocked` | 被阻塞 |
| `cancelled` | 已取消 |

### priority（优先级）

| 优先级 | 说明 |
|--------|------|
| `high` | 高优先，优先处理 |
| `normal` | 普通 |
| `low` | 低优先，空闲时处理 |

---

## dailySummary（当日汇总）

```json
{
  "date": "YYYY-MM-DD",
  "stats": {
    "messagesCount": 10,     // 今日消息数
    "tasksCompleted": 5,     // 今日完成任务数
    "alertsCount": 2         // 今日警告数
  },
  "highlights": [            // 重点事项（可选）
    "设计系统更新到 v1.0.4",
    "新增 3 个知识条目"
  ]
}
```

---

## 操作规范

### 读取

1. 直接读取 `~/.claude/agents/hub.json`
2. 解析 JSON
3. 获取所需数据

### 写入

1. 读取现有文件
2. 修改需要的字段
3. 更新 `meta.lastUpdate`
4. 写回文件

### 注意事项

- **不要删除其他 Agent 的消息**
- **保持 JSON 格式正确**（使用 2 空格缩进）
- **时间戳使用 ISO 8601 格式**（带时区）
- **消息 ID 确保唯一**（推荐 `msg-{timestamp}`）

---

## 示例：完整的消息流

```
1. 用户要求检查代码
   ↓
2. 小秘书创建任务，分配给测试QA
   ↓
3. 测试QA 更新状态为 busy，开始执行
   ↓
4. 测试QA 发现问题，写入 alert 消息
   ↓
5. 测试QA 完成任务，更新任务状态
   ↓
6. 小秘书 读取消息，汇总到日报
```
