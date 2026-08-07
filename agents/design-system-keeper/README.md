# 设计系统管家

转转的 AI 团队成员，纯静态知识库型角色。负责设计系统 / 组件风格的**规范、延展与风格探索**的讨论与沉淀。

> **类型**：静态知识库，无脚本、不像 agent。触发词 `/designcomponent` 是「我想聊组件」的语义标签，不驱动程序。

---

## 定位

- 承载不同组件风格的信息，当前以**拉姆斯风格**作为演示 MVP。
- 组件代码只在独立仓库 [rams-system](https://github.com/siriusharrison-png/rams-system)，团队里只做统一入口 + 知识层。
- 未来扩展多风格：在 `knowledge/styles/` 下新增一个 `<name>.md` 即可。

## 组件库（拉姆斯风格 MVP）

- **仓库**：https://github.com/siriusharrison-png/rams-system
- **在线 Playground**：https://rams-system.vercel.app
- 内容：14 atoms + 3 modules + 4 devices + 材质体系 + 画廊 Playground（React + Vite）。

## 知识层

- `knowledge/styles/rams.md` — 拉姆斯风格档案（理念 / 材质契约 / 控件清单 / 地址）
- `knowledge/spec.md` — 跨风格通用组件规范（命名 / 变体 / token 契约 / 无障碍）
- `knowledge/extending.md` — 如何新增一个风格或组件

## 协作

- reportTo：小秘书
- 已登记于 `agents/hub.json` 成员表
