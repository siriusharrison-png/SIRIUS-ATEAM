# SIRIUS ATEAM

转转的 AI 团队 —— 独立职能协作系统。

## 访问地址

https://siriusharrison-png.github.io/SIRIUS-ATEAM/

---

## 部署架构

采用**前后端分离**架构：

| 部分 | 托管平台 | 地址 |
|------|---------|------|
| 页面（静态） | GitHub Pages | `siriusharrison-png.github.io/SIRIUS-ATEAM` |
| API（推送） | Vercel | `sirius-ateam.vercel.app/api/push-feishu` |

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
- **推送日报** - 小秘书推送工作日报到飞书（含代码变更详情）
- **推送数据** - 摄影师推送 Unsplash 数据到飞书（含统计数据）

---

## 飞书推送配置

### 环境变量（Vercel）

```
FEISHU_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/xxxxx
```

### 推送内容更新

编辑 `index.html` 顶部的 `agentData` 对象：

```javascript
// 小秘书日报 - 代码变更记录
agentData.secretary.recentChanges = [
  {
    date: '2026-03-09',
    author: 'Claude',
    project: 'SIRIUS-ATEAM',
    action: '修复推送功能',
    repo: 'https://github.com/siriusharrison-png/SIRIUS-ATEAM'
  }
];

// 摄影师 - Unsplash 统计数据
agentData.photographer.unsplashStats = {
  date: '2026-03-05',
  downloads: 20459,
  views: 2915382,
  likes: 254,
  weeklyChange: {
    downloads: '+287',
    views: '+35,000',
    likes: '+5'
  }
};
```

---

## 相关仓库

- [design-token](https://github.com/siriusharrison-png/design-token) - 设计系统
- [learn-to-notion](https://github.com/siriusharrison-png/learn-to-notion) - 知识管理
- [design-qa-cli](https://github.com/siriusharrison-png/design-qa-cli) - 设计还原度检查

---

## 本地路径映射

`~/.claude/agents` → `~/Desktop/SIRIUS-ATEAM/agents`（软链接）
