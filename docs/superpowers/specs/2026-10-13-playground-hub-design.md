# Playground Hub · 本地启动中枢设计

- 日期：2026-10-13
- 作者：小的（与转转共创）
- 状态：待转转评审

## 1. 背景与目的

转转手头有多个本地能力（agent / playground / 工具），形态各异、分散各处，每次使用都要单独找、单独起，不方便。

本项目做一个**本地优先的启动中枢**：统一入口，发现并管理这些能力，能真正起进程、看运行状态、一键停止、看日志。

### 非目标（YAGNI）

- 不做对外作品集 / 公开展示（那是现有 `index.html` + GitHub Pages 的职责，保留不动）。
- 不做云端部署（Vercel 碰不到本地进程；中枢主力在本地）。
- 不做全量进程编排器（PM2 式健康检查、开机自启、依赖编排）——当前 5-6 个能力用不上。
- 不引入前端框架 / 数据库。

### 成功标准

1. 双击一个文件即可拉起中枢，浏览器自动打开中枢页。
2. 中枢页列出所有能力，自动发现、无需手改中枢代码即可新增能力。
3. 服务型能力可一键启动/停止，卡片实时显示运行状态、端口、日志。
4. 交互型能力可一键在新终端窗口中运行（供转转交互）。
5. 配置型能力可一键打开目录 / 查看文档。

## 2. 能力的三种形态

| 形态 | 示例 | 启动特征 | 中枢如何处理 |
|---|---|---|---|
| `server` | motionlab (`npm run server`, :4321) | 常驻端口进程 | spawn 常驻进程、记 PID、探活、停止、看日志、开浏览器 |
| `interactive` | posterdesigner (`poster.command`) | 交互式脚本，需终端输入（拖图/回车） | AppleScript 开新终端窗口运行，交互交给终端 |
| `doc` | 小秘书、知识管理、event-bubble-guard | 无进程，纯配置/文档 | 打开目录、查看 README |

没有 `launch` 段的能力自动归为 `doc` 型。

## 3. 清单驱动的能力发现

中枢启动时扫描 `agents/*/config.json`，读取其中新增的可选 `launch` 段：

```jsonc
"launch": {
  "type": "server",                     // server | interactive | doc；缺省为 doc
  "cmd": "npm run server",              // server / interactive 型使用
  "cwd": "agents/motionlab",            // 相对仓库根；缺省为 config.json 所在目录
  "port": 4321,                         // server 型：健康探测 + 打开浏览器
  "openUrl": "http://localhost:4321",   // server 型可选，缺省由 port 推导
  "command": "motionlab.command",       // interactive 型：相对 cwd 的脚本
  "docs": ["README.md"]                 // doc 型展示入口；缺省自动找 README.md
}
```

- 补 `launch` 段是一次性工作，之后新增能力零改中枢代码。
- `cmd` / `command` 只来自仓库内 config，**不接受页面传入任意命令**（见 §6 安全）。
- 能力的展示信息（名称、描述、角色）复用 config 已有的 `name` / `description` / `role` 字段。

### 需要补 launch 段的能力（实施期落地）

| 能力 | type | 关键字段 |
|---|---|---|
| motionlab | server | cmd=`npm run server`, port=4321 |
| posterdesigner | interactive | command=`poster.command` |
| 其余（小秘书/知识管理/设计师/设计系统管家/摄影师） | doc | 缺省即可，无需显式补 |

## 4. 架构

### 4.1 目录

新建 `hub/`（与 `agents/` `tools/` 平级）：

```
hub/
├── server/
│   ├── index.js          ← Express 入口，监听 127.0.0.1:7777
│   ├── discover.js       ← 扫描 config.json，归一化为能力列表
│   ├── process-manager.js← server 型进程的 spawn/stop/状态/日志
│   └── launcher.js       ← interactive 型（AppleScript 开终端）、doc 型（open 目录）
├── web/
│   ├── index.html        ← 中枢页（像素风，延续现有风格）
│   ├── app.js            ← 拉 /api 渲染卡片、轮询状态、交互
│   └── style.css
├── package.json          ← express 依赖；scripts: start
└── README.md
hub.command               ← 仓库根，双击起中枢 + 开浏览器
```

### 4.2 后端 API（最小集）

| 方法 | 路径 | 职责 |
|---|---|---|
| GET | `/api/capabilities` | 返回所有能力 + 实时状态（server 型含 running/port/pid） |
| POST | `/api/launch/:id` | 按 type 启动：server→spawn 常驻；interactive→AppleScript 开终端；doc→open 目录 |
| POST | `/api/stop/:id` | 停止 server 型进程（kill PID） |
| GET | `/api/logs/:id` | 返回 server 型进程近期 stdout/stderr（内存环形缓冲，末 N 行） |

- 进程状态存内存。中枢重启后：server 型通过探测 `port` 是否在监听来恢复"运行中"判断，不记持久化 PID。
- `id` 为能力目录名（如 `motionlab`），由发现阶段生成，稳定可寻址。

### 4.3 数据流

```
hub.command
  └─> node hub/server/index.js  (127.0.0.1:7777)
        ├─ discover.js 扫描 agents/*/config.json → 能力列表
        └─ 打开浏览器 → web/index.html
              └─ app.js GET /api/capabilities → 渲染卡片
                    ├─ 点"启动"(server) → POST /api/launch/:id → process-manager spawn
                    │     └─ 轮询 GET /api/capabilities 刷新状态灯 + GET /api/logs/:id
                    ├─ 点"运行"(interactive) → POST /api/launch/:id → osascript 开终端
                    └─ 点"打开"(doc) → POST /api/launch/:id → open 目录
```

### 4.4 前端

- 卡片网格，按形态分区/分色；延续现有像素风（参考根 `index.html` 的配色与字体）。
- `server` 卡：状态灯（跑中/停止）、端口、启动/停止、看日志、打开浏览器。
- `interactive` 卡："在终端运行"按钮。
- `doc` 卡："打开目录" + "查看 README"。
- 状态刷新：前端定时轮询 `/api/capabilities`（2-3s），实现足够简单，不引 WebSocket。

## 5. 错误处理

- 启动失败（cmd 退出非 0 / 端口被占）：进程管理器捕获，API 返回错误原因，卡片显示红色状态 + 原因。
- 依赖未装（如 motionlab 首次缺 node_modules）：这是能力自身 `.command` 的职责，中枢不替它装；server 型若 spawn 后立即退出，日志里会体现，前端提示"查看日志"。
- AppleScript 不可用 / 非 macOS：`launcher` 探测平台，非 macOS 时 interactive 型降级为"复制命令"提示（本项目主用 macOS，此为兜底）。
- 停止不存在的进程：幂等返回成功（已停止即视为达成）。

## 6. 安全边界

- 中枢只监听 `127.0.0.1`，不对外暴露。
- `cmd` / `command` **只来自仓库内 config.json**，API 不接受页面传入任意命令字符串——避免中枢沦为任意命令执行后门。`:id` 做白名单校验（必须是发现阶段已登记的能力）。
- `cwd` 解析后校验必须落在仓库根目录内，拒绝越界路径。
- 不读取 / 不回显 `.env` 内容；能力自己 source 自己的 `.env`。

## 7. 测试

- `discover.js`：给定若干 config.json 夹具，断言归一化输出（含缺省推导、doc 兜底）。
- `process-manager.js`：spawn 一个短命测试脚本，断言状态流转（启动→运行→停止）、日志捕获、重复停止幂等。
- `launcher.js`：非 macOS 降级分支、路径越界拒绝。
- API 层：`/api/capabilities` 返回结构、`:id` 白名单校验拒绝未知 id。
- 测试框架：vitest（与 motionlab 一致）。

## 8. 实施顺序（概览，详见后续 plan）

1. `hub/` 骨架 + package.json + discover.js（纯发现，先能列出能力）
2. 前端渲染（先只读，看得到卡片）
3. process-manager + launch/stop/logs（server 型跑通，以 motionlab 为验证对象）
4. launcher（interactive + doc 型）
5. 给 motionlab / posterdesigner 补 launch 段
6. hub.command + 端到端验证
