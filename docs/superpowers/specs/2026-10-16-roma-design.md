# roma · 香气卡片生成器设计

- 日期：2026-10-16
- 作者：小的（与转转共创）
- 状态：待转转评审

## 1. 背景与目的

输入一段香味描述（或具体香水信息），生成一张**以视觉为主的香气卡片**。卡片有正反两面，分别用 ASCII 与 Riso 两种风格表达同一香气，点击翻面切换。个人探索型创作工具，追求"把香味当灵感、用轻知识骨架托底的艺术表达"。

### 非目标（YAGNI）

- 不做严谨香水数据库 / 不联网搜图抓参考图（参考图只是风格目标，不进管线）。
- 不展示调用花费 / token 估算。
- 不做批量生成、不做账号、不做云端部署（本地工具）。
- 不引前端框架；渲染器不额外依赖后端图像库（PNG 走浏览器端）。

### 成功标准

1. 输入描述或香水信息 → 得到一张卡片，正反两面分别是 ASCII 与 Riso 风格。
2. 点击卡片翻面，在两种风格间切换。
3. 导出：一键存 PNG，存当前朝向那一面。
4. 作为 server 型能力被 Playground Hub 自动发现、一键启动。

## 2. 形态与技术栈

- 放 `agents/roma/`，补 `launch`（server 型，端口 4322，避开 motionlab 的 4321），自动进 Hub。
- 技术栈对齐 motionlab：原生 Node http 服务 + 原生前端（无框架）+ 网关 LLM 客户端。
- server 拆小模块，各带 vitest 测试。
- 复用网关：`GATEWAY_API_KEY` / `GATEWAY_BASE_URL`，`.env` 与 motionlab/poster 同机制（启动时读入、不覆盖已设）。

## 3. 管线（描述 → 卡片）

```
输入文本（自由描述 或 香水名+香调数据）
  └─> LLM 一次调用，产出结构化 JSON：
        {
          perfumeName,          // 香水名或 LLM 命名的意象名
          family,               // 香调分类（如 花香醛调）
          notes: { top[], mid[], base[] },  // 前/中/后调原料
          keyMaterials[],       // 关键原料
          visual: {             // 抽象视觉指令
            palette[],          // 配色（供 Riso 套色；hex）
            motif,              // 母题形状/意象
            texture,            // 质感
            mood                // 氛围
          },
          caption,              // 一句氛围文案
          ascii                 // LLM 直出的 ASCII 构图（等宽字符块）
        }
  └─> 两个本地渲染器（不再调 LLM）：
        ├─ ASCII 面：由 ascii 字段 + 极简标题排成等宽卡
        └─ Riso 面：由 visual.palette/motif/texture 生成 SVG
  └─> 卡片组装：正面 Riso、反面 ASCII，极简标题；知识骨架弱化角落（可开关）
```

一次 LLM 调用拿全信息，省 token、省往返。

## 4. 架构

### 4.1 目录

```
agents/roma/
├── roma.command            ← 双击起服务 + 开浏览器（备用；主入口走 Hub）
├── config.json             ← 含 launch 段（server :4322）、gateway、models
├── .env.example
├── .gitignore
├── README.md
├── package.json
├── server/
│   ├── index.js            ← http 服务：/config、/generate，静态托管 web/
│   ├── llm.js              ← 网关调用（对齐 motionlab llm.js）
│   ├── prompt.js           ← 把输入拼成提示词，约束输出 JSON schema
│   ├── parse.js            ← 解析/校验 LLM 返回的 JSON，缺字段兜底
│   └── *.test.js
└── web/
    ├── index.html
    ├── app.js              ← 调 /generate、渲染两面、翻面交互、导出 PNG
    ├── riso.js             ← Riso SVG 渲染器（套色/半调/偏移）
    ├── ascii.js            ← ASCII 面渲染（排版等宽块 + 标题）
    └── style.css           ← 卡片翻面 3D 动画、极简版式
```

### 4.2 后端 API（最小集）

| 方法 | 路径 | 职责 |
|---|---|---|
| GET | `/config` | 返回可用模型列表（供前端选模型，对齐 motionlab） |
| POST | `/generate` | body: `{ input, model }` → LLM 一次调用 → 返回 §3 的结构化 JSON |
| GET | `/`、静态 | 托管 web/ |

- 服务只监听 `127.0.0.1`。
- `parse.js` 对 LLM 返回做结构校验，缺字段给安全兜底（如 ascii 缺失时用占位、palette 缺失时给中性色板），不让前端崩。

### 4.3 前端

- **卡片**：一个有正反面的容器，CSS 3D `transform: rotateY(180deg)` 翻面。正面 Riso（SVG），反面 ASCII（`<pre>` 等宽）。
- **翻面**：点击卡片（或翻面按钮）切换朝向。
- **标题**：极简——香水名 + 一词香调；金字塔/原料默认弱化角落，开关可收起。
- **导出**：一键存 PNG，存**当前朝向那一面**。
  - Riso 面：SVG → canvas → `toBlob` 下载。
  - ASCII 面：把 `<pre>` 画到 canvas（或用 SVG `<foreignObject>`/离屏绘制）→ PNG 下载。
  - 纯浏览器端，无后端图像依赖。

### 4.4 Riso 渲染器要点（riso.js）

- 限定套色：取真实 Risograph 油墨色板（如荧光粉 #FF48B0、蓝 #0078BF、黄 #FFE800 等）的子集，由 LLM 的 `palette` 映射到最接近的油墨色。
- 半调网点：用 SVG `<pattern>` 做圆点网屏表现套色区域。
- 套色偏移：各色层做轻微位移（registration offset），模拟丝网错位。
- 母题：由 `visual.motif` 决定基础图形构成（抽象形状组合，非具象）。

## 5. 错误处理

- LLM 返回非法 JSON：`parse.js` 捕获，返回明确错误给前端提示"再试一次/换个描述"，不抛未捕获异常。
- 网关 key 缺失/401：`/generate` 返回可读错误，前端提示去填 `.env`。
- `palette`/`ascii` 等字段缺失：按 §4.2 兜底，仍能出卡（降级但不崩）。
- 空输入：前端拦截，提示先写点什么。

## 6. 安全边界

- 只监听 `127.0.0.1`。
- 不读取/不回显 `.env` 内容；仅 source 后使用。
- 用户输入只作为 LLM 提示词内容，不进入任何 shell/文件路径拼接。

## 7. 测试

- `prompt.js`：给定输入，断言提示词含关键约束（输出 JSON、字段齐全要求）。
- `parse.js`：合法 JSON 正常解析；非法 JSON 抛可读错误；缺字段走兜底（ascii/palette 缺失）。
- `llm.js`：对齐 motionlab，注入假 fetch 断言请求结构与返回解析。
- 前端 riso.js/ascii.js：渲染器为纯函数部分（输入 spec → 输出 SVG 字符串 / 排版结构）可单测；DOM/canvas 导出走手动验收。
- 测试框架：vitest。

## 8. 实施顺序（概览，详见后续 plan）

1. `agents/roma/` 骨架 + package.json + config.json（含 launch）+ .env.example
2. prompt.js + parse.js（纯逻辑，先测）
3. llm.js + server/index.js（/config、/generate 跑通）
4. web 前端：ascii.js + riso.js 渲染器
5. 卡片翻面交互 + 导出 PNG
6. roma.command + README + 端到端验证（经 Hub 启动）
