# SIRIUS ATEAM

转转的 AI 团队 —— 独立职能协作系统。

## 访问地址

https://siriusharrison-png.github.io/SIRIUS-ATEAM/

---

## 项目结构

```
SIRIUS-ATEAM/
├── index.html          ← 团队展示页面（像素风）
├── README.md           ← 本文件
└── agents/             ← Agent 配置与协作中枢
    ├── RULES.md        ← 统一规则（所有 Agent 必须遵守）
    ├── hub.json        ← 协作状态（消息/任务/状态）
    ├── hub-schema.md   ← 数据格式说明
    ├── secretary/      ← 小秘书（中枢协调）
    ├── design-infra/   ← 设计师
    ├── figma-designer/ ← Figma 设计员工
    ├── knowledge-keeper/ ← 知识管理
    ├── design-qa/      ← 测试QA
    └── image-guardian/ ← 摄影师
```

---

## 团队成员

| Agent | 角色 | 状态 | 配置 |
|-------|------|------|------|
| 小秘书 | 中枢协调 | 仅本地 | `agents/secretary/config.json` |
| 设计师 | 设计系统维护 | 开源 | `agents/design-infra/config.json` |
| Figma 设计员工 | Figma 设计操作 | 仅本地 | `agents/figma-designer/config.json` |
| 知识管理 | 学习知识管理 | 开源 | `agents/knowledge-keeper/config.json` |
| 测试QA | 设计还原度检查 | 开源 | `agents/design-qa/config.json` |
| 摄影师 | Unsplash 数据追踪 | 仅本地 | `agents/image-guardian/config.json` |

---

## 协作架构

```
┌─────────────────────────────────────────────────────┐
│                   统一规则层                         │
│              RULES.md（所有 Agent 遵守）             │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│                 小秘书（中枢）                        │
│         接收任务 → 分配 → 监控 → 汇总 → 汇报          │
└─────────────────────────────────────────────────────┘
           ↙      ↓       ↓       ↓      ↘
      设计师   Figma    知识    测试    摄影师
              设计员   管理     QA
           ↘      ↓       ↓       ↓      ↙
              hub.json（协作状态文件）
```

---

## 页面功能

- 像素风格的 Agent 形象展示
- Tag 切换查看各成员详情
- WORKFLOW 按钮查看协作流程图
- LOG 按钮查看各 Agent 更新日志

---

## 相关仓库

- [design-token](https://github.com/siriusharrison-png/design-token) - 设计系统
- [learn-to-notion](https://github.com/siriusharrison-png/learn-to-notion) - 知识管理
- [design-qa-cli](https://github.com/siriusharrison-png/design-qa-cli) - 设计还原度检查

---

## 本地路径映射

`~/.claude/agents` → `~/Desktop/SIRIUS-ATEAM/agents`（软链接）
