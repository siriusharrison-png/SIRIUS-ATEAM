# MotionLab · Motion 工作台

个人探索型 motion 工作台：用大白话描述想要的动画，LLM（Opus 5.5 / GPT-6 astra 可切换）生成 Remotion 动画代码，本地校验 + 自愈后渲染成几十秒的 mp4，支持实时参数微调与 token 成本估算。

> 方向：LLM 写动画代码 → Remotion 本地渲染。**不是** AI 出实拍画面（网关目前只有语言模型）。

## 快速开始

```bash
cd agents/motionlab
npm install                       # 首次：装依赖（含 Remotion、会下载 headless Chrome）
cp .env.example .env              # 填入网关 key（复用 posterdesigner 那个）
npm run server                    # 起工作台，浏览器打开提示的地址
```

双击 `motionlab.command` 也可一键启动。

## 配置

- **API key / base url**：走环境变量 `GATEWAY_API_KEY` / `GATEWAY_BASE_URL`，从本目录 `.env` 读取（与 posterdesigner 复用同一个网关 key）。
- **模型与价格**：`config.json` 的 `models` 段。折扣系数已填（gpt-6-astra 0.68 / opus-5-5 0.46），**官方原价 `priceInPerM` / `priceOutPerM` 待填**，否则成本估算恒为 0。
- **渲染默认**：`config.json` 的 `render`（fps / 尺寸 / 默认时长）。

## 目录

```
web/        单页工作台（对话 + 模型切换 + 预览 + 参数面板 + 成本条）
server/     编排层（调 LLM → 契约校验+自愈 → 渲染 → 算成本）
remotion/   渲染引擎（Root + 生成的组件）
output/     渲染出的 mp4
```

## 成本

只花 LLM 的 token 钱（本地渲染免费）。公式：`官方原价/token × 折扣系数 × token数`。累计存 `.cost.json`。
