# 设计系统管家 — 团队新增知识库型角色 设计

日期：2026-08-07
状态：已获批，进入实现计划

## 背景

桌面 `~/Desktop/rams-system` 是一套独立的拉姆斯风格拟物组件库（React + Vite，14 atoms + 3 modules + 4 devices + 材质体系 + 画廊 Playground），已有自己的 git 仓库与 Vercel 部署。

转转希望把「设计系统 / 组件风格」这件事纳入团队统一管理，但**不动 rams-system 的代码**，只在团队里增加一个统一入口 + 一个负责讨论组件规范/延展/风格探索的角色。

## 已锁定的决策

- **角色类型 = 纯静态知识库**。不跑脚本、不像 agent，本质是「承载不同组件风格信息 + 团队统一入口」。触发词是语义标签，不驱动程序。
- **组件代码只在 rams-system 仓库**，团队里只做「指针 + 知识层（markdown）」。
- **当前拉姆斯风格作为演示 MVP**，未来扩展多风格时，只在 `knowledge/styles/` 加新文件。
- **知识层范围 = A 风格档案 + B 通用规范 + D 延展指南**。C（探索记录）暂不建，有内容再补。

## 角色标识

- 中文名：**设计系统管家**
- 文件夹：`agents/design-system-keeper/`（与 `knowledge-keeper` 呼应，keeper = 知识库型）
- 触发词：`/designcomponent`
- reportTo：小秘书

## 目录结构

```
agents/design-system-keeper/
├── config.json              # 角色注册（role=specialist, type=knowledge-base, 无 engine/无 scripts）
├── README.md                # 角色说明 + rams-system 仓库/线上地址
└── knowledge/
    ├── styles/
    │   └── rams.md          # [A] 风格档案：拉姆斯风格（MVP 演示）
    ├── spec.md              # [B] 通用组件规范：命名/变体/token 契约/无障碍
    └── extending.md         # [D] 延展指南：如何加一个新风格/新组件
```

未来加风格 → `knowledge/styles/<name>.md` 加一个文件即可。

## config.json 契约

对齐现有角色 schema，去掉 agent 专属属性（无 `engine`、无 scripts）：

```json
{
  "name": "设计系统管家",
  "role": "specialist",
  "type": "knowledge-base",
  "description": "承载设计系统组件风格的规范、延展与探索；当前以拉姆斯风格为演示 MVP，未来扩展多风格统一管理。",
  "capabilities": ["style_catalog", "component_spec", "extending_guide"],
  "triggers": ["/designcomponent"],
  "styles": [
    {
      "id": "rams",
      "name": "拉姆斯风格",
      "status": "mvp",
      "repo": "https://github.com/siriusharrison-png/rams-system",
      "playground": "https://rams-system.vercel.app"
    }
  ],
  "inputFrom": ["hub.json", "user_input"],
  "outputTo": ["hub.json", "knowledge/"],
  "reportTo": "小秘书",
  "deployment": "静态知识库 / 无脚本"
}
```

> **待确认**：`playground` 域名默认取 Vercel 项目名推导的 `https://rams-system.vercel.app`，落地前向转转确认真实线上地址。

## 知识层文档内容

三份文档均为 markdown，MVP 阶段写「骨架 + 拉姆斯风格已有内容」，不堆空占位：

- **styles/rams.md（风格档案）**：拉姆斯风格设计理念、材质契约（9 个 `--surface-*` 变量，源自 rams-system 已有 spec）、控件品类清单（atoms/modules/devices）、仓库与线上地址。
- **spec.md（通用规范）**：跨风格通用约定——命名规范、变体规则、token/材质契约怎么定、无障碍要求。
- **extending.md（延展指南）**：想加一个新风格或新组件时「该怎么做」的操作手册，思路参照 rams-system 已有的 EXTENDING。

## 团队页入口（index.html）

在现有角色卡片区新增一张「设计系统管家」卡片，视觉/结构对齐现有卡片（如知识管理、海报设计师）：

- 描述：一句话点明「设计系统 / 组件风格的规范与探索，当前拉姆斯风格 MVP」。
- 按钮 1 `查看` → `openGitHub('agents/design-system-keeper')`，看团队知识库文档。
- 按钮 2 `组件库` → 新开 rams-system 线上 Playground，看真实组件。

不加「打开工作台」类按钮——该角色无本地脚本服务。

## 协作中枢（hub.json）

按现有惯例把新角色登记进 `hub.json` 成员表（参照 knowledge-keeper 的登记结构），`reportTo` 小秘书。具体字段落地时对齐现有结构。

## 取舍说明

1. **不动 rams-system 一行代码** —— 团队只做「指针 + 知识层」，符合「已有仓库、只加入口」。
2. **知识层用 markdown** —— 纯文本，好讨论、好版本管理，不引入任何构建。
3. **MVP 克制** —— 只建 A/B/D 三份文档 + 一张卡片，不预建空目录（C 暂缓）。

## 验收标准

- `agents/design-system-keeper/` 目录、`config.json`、`README.md`、三份知识文档齐全且内容非空。
- `config.json` 结构与现有角色可对齐，无 engine/无 scripts，`type=knowledge-base`。
- 团队页新增卡片可见，两个按钮分别正确跳转团队目录与 rams-system 线上。
- `hub.json` 登记新成员，reportTo 小秘书。
- rams-system 仓库无任何改动。
