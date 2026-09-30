# MotionLab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭一个个人探索型 motion 工作台：用大白话描述，LLM 写 Remotion 动画代码，本地校验+自愈后渲染成几十秒的 mp4，支持实时参数微调与 token 成本估算。

**Architecture:** 三层——① 单页 web 工作台（对话 + 模型切换 + Remotion Player 实时预览 + 自动参数面板 + 成本条）；② 本地 Node http 服务（拼 prompt 调 LLM → 契约校验三道闸 + 自愈重试 → 落盘 → 触发渲染 → 算成本）；③ Remotion 本地渲染引擎（组件 + props → mp4）。

**Tech Stack:** Node (http 服务), Remotion + @remotion/player + @remotion/renderer, React, zod (propsSchema), 两个 LLM 端点（`gpt-6-astra` 走 `/v1/chat/completions` 或 `/v1/responses`，`claude-opus-5-5` 走 `/v1/chat/completions` 或 `/v1/messages`），vitest (测试)。

**Spec:** `docs/superpowers/specs/2026-09-30-motionlab-design.md`

## Global Constraints

- 所有可调项（颜色/时长/文案/速度…）必须走 props，LLM 生成的组件**不许写死**这些值。
- LLM 生成的组件必须 `export default` 一个 React 组件，并 `export const propsSchema`（zod 对象）。
- 动画必须用 Remotion 帧驱动范式：`useCurrentFrame()` / `interpolate()`；时长/fps/尺寸由外部 props 传入。
- 自愈重试上限 **2 次**（共调 LLM 最多 3 次），超限则返回明确错误给前端，不静默吞。
- 成本公式：`实际花费 = 官方原价/token × 折扣系数 × token数`，折扣系数 `gpt-6-astra=0.68`、`claude-opus-5-5=0.46`；**官方原价待转转提供，先在 config.json 用占位值并标注 TODO**。累计存 `.cost.json` 跨会话保留。
- 目录根：`agents/motionlab/`。渲染产物文件名带时间戳（如 `20260930-153000-motion.mp4`），与 posterdesigner 一致。
- 网关 base URL 与 API key 放 `config.json` / 环境变量，**不硬编码进源码，不提交 key**。

## Review Focus

- **LLM 返回代码里夹杂 markdown 围栏或解释文字**（最常见）：contract 解析前必须剥掉 ```` ```tsx ```` 围栏与非代码文本，否则静态检查必挂 → 覆盖在 Task 3。
- **propsSchema 声明了字段但组件没给默认值**：参数面板拿不到初值会崩 → 校验闸②必须强制每个字段有默认值，覆盖在 Task 3。
- **LLM 端点差异**：两个模型的 usage 字段位置/命名可能不同（chat vs responses/messages），取 token 数时取错会让成本恒为 0 或报错 → 覆盖在 Task 2、Task 5。
- **渲染超时/卡死**：headless Chromium 起不来或组件死循环会让请求永久 hang → render 必须有超时，覆盖在 Task 4。
- **参数面板数值越界**：滑块/输入超出 propsSchema 的 min/max 时预览崩溃 → 前端按 schema 约束拦截，覆盖在 Task 6。

---

### Task 1: 项目骨架 + config + Remotion 底座

**Files:**
- Create: `agents/motionlab/package.json`
- Create: `agents/motionlab/config.json`
- Create: `agents/motionlab/.gitignore`
- Create: `agents/motionlab/remotion/Root.tsx`
- Create: `agents/motionlab/remotion/index.ts`
- Create: `agents/motionlab/remotion/generated/.gitkeep`
- Create: `agents/motionlab/README.md`

**Interfaces:**
- Produces: `config.json` 结构 `{ gateway: {baseUrl, apiKeyEnv}, models: [{id, endpoint, discount, priceIn, priceOut}], render: {fps, width, height, defaultDurationSec} }`；Remotion 注册入口 `remotion/index.ts` → `registerRoot(Root)`。

- [ ] **Step 1: 初始化 package.json**

```json
{
  "name": "motionlab",
  "private": true,
  "type": "module",
  "scripts": {
    "server": "node server/index.js",
    "test": "vitest run"
  },
  "dependencies": {
    "remotion": "^4.0.0",
    "@remotion/cli": "^4.0.0",
    "@remotion/renderer": "^4.0.0",
    "@remotion/player": "^4.0.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: 写 config.json（官方原价用占位值 + TODO 标注）**

```json
{
  "gateway": {
    "baseUrl": "https://apiproxy.paigod.work",
    "apiKeyEnv": "MOTIONLAB_API_KEY"
  },
  "models": [
    { "id": "claude-opus-5-5", "label": "Opus 5.5", "endpoint": "/v1/chat/completions", "discount": 0.46, "priceInPerM": 0, "priceOutPerM": 0, "_TODO": "填官方原价 每百万token 输入/输出" },
    { "id": "gpt-6-astra", "label": "GPT-6 astra", "endpoint": "/v1/chat/completions", "discount": 0.68, "priceInPerM": 0, "priceOutPerM": 0, "_TODO": "填官方原价" }
  ],
  "render": { "fps": 30, "width": 1920, "height": 1080, "defaultDurationSec": 15 }
}
```

- [ ] **Step 3: 写 .gitignore**

```
node_modules/
output/
.cost.json
remotion/generated/*.tsx
!remotion/generated/.gitkeep
.env
```

- [ ] **Step 4: 写 Remotion Root.tsx（动态注册 generated 组件的空壳）**

```tsx
import { Composition } from "remotion";
import { PlaceholderComp, placeholderSchema } from "./placeholder";

// generated 组件在渲染时由 server 动态拼入；此处注册一个占位 Composition 保证 Remotion 可启动
export const Root: React.FC = () => (
  <Composition
    id="Motion"
    component={PlaceholderComp}
    durationInFrames={450}
    fps={30}
    width={1920}
    height={1080}
    defaultProps={placeholderSchema.parse({})}
  />
);
```

- [ ] **Step 5: 写 placeholder 组件（占位，后续被 generated 替换）**

Create `agents/motionlab/remotion/placeholder.tsx`：

```tsx
import { z } from "zod";
import { useCurrentFrame, interpolate } from "remotion";

export const placeholderSchema = z.object({
  title: z.string().default("MotionLab"),
});

export const PlaceholderComp: React.FC<z.infer<typeof placeholderSchema>> = ({ title }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" });
  return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", opacity, fontSize: 80 }}>{title}</div>;
};
```

- [ ] **Step 6: 写 remotion/index.ts**

```ts
import { registerRoot } from "remotion";
import { Root } from "./Root";
registerRoot(Root);
```

- [ ] **Step 7: 装依赖并验证 Remotion 能起**

Run: `cd agents/motionlab && npm install && npx remotion compositions remotion/index.ts`
Expected: 列出 `Motion` composition，无报错。

- [ ] **Step 8: 写 README（用途 + 启动方式 + 配置说明）**，然后提交

```bash
git add agents/motionlab/package.json agents/motionlab/config.json agents/motionlab/.gitignore agents/motionlab/remotion agents/motionlab/README.md
git commit -m "feat(motionlab): 项目骨架 + config + Remotion 底座"
```

---

### Task 2: LLM 客户端（两模型统一封装 + usage 提取）

**Files:**
- Create: `agents/motionlab/server/llm.js`
- Test: `agents/motionlab/server/llm.test.js`

**Interfaces:**
- Consumes: `config.json` 的 `models` 与 `gateway`。
- Produces: `async function callLLM({ modelId, messages, config }) → { text, usage: { inputTokens, outputTokens } }`；`function extractUsage(modelId, rawResponse) → { inputTokens, outputTokens }`（导出供测试）。

- [ ] **Step 1: 写失败测试（usage 提取，覆盖两种字段命名）**

```js
import { describe, it, expect } from "vitest";
import { extractUsage } from "./llm.js";

describe("extractUsage", () => {
  it("chat/completions 格式取 prompt_tokens/completion_tokens", () => {
    const raw = { usage: { prompt_tokens: 100, completion_tokens: 250 } };
    expect(extractUsage("gpt-6-astra", raw)).toEqual({ inputTokens: 100, outputTokens: 250 });
  });
  it("anthropic messages 格式取 input_tokens/output_tokens", () => {
    const raw = { usage: { input_tokens: 80, output_tokens: 300 } };
    expect(extractUsage("claude-opus-5-5", raw)).toEqual({ inputTokens: 80, outputTokens: 300 });
  });
  it("缺 usage 时返回 0 而非抛错", () => {
    expect(extractUsage("gpt-6-astra", {})).toEqual({ inputTokens: 0, outputTokens: 0 });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd agents/motionlab && npx vitest run server/llm.test.js`
Expected: FAIL（extractUsage 未定义）

- [ ] **Step 3: 实现 llm.js**

```js
import fs from "node:fs";

export function extractUsage(modelId, raw) {
  const u = raw?.usage ?? {};
  const inputTokens = u.prompt_tokens ?? u.input_tokens ?? 0;
  const outputTokens = u.completion_tokens ?? u.output_tokens ?? 0;
  return { inputTokens, outputTokens };
}

function extractText(raw) {
  // chat/completions: choices[0].message.content ; anthropic: content[0].text
  return raw?.choices?.[0]?.message?.content
    ?? raw?.content?.[0]?.text
    ?? "";
}

export async function callLLM({ modelId, messages, config }) {
  const model = config.models.find((m) => m.id === modelId);
  if (!model) throw new Error(`未知模型: ${modelId}`);
  const apiKey = process.env[config.gateway.apiKeyEnv];
  if (!apiKey) throw new Error(`缺少环境变量 ${config.gateway.apiKeyEnv}`);
  const res = await fetch(config.gateway.baseUrl + model.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: modelId, messages, max_tokens: 8000 }),
  });
  if (!res.ok) throw new Error(`LLM 调用失败 ${res.status}: ${await res.text()}`);
  const raw = await res.json();
  return { text: extractText(raw), usage: extractUsage(modelId, raw) };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd agents/motionlab && npx vitest run server/llm.test.js`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add agents/motionlab/server/llm.js agents/motionlab/server/llm.test.js
git commit -m "feat(motionlab): LLM 客户端封装 + usage 提取"
```

---

### Task 3: 契约校验三道闸

**Files:**
- Create: `agents/motionlab/server/contract.js`
- Test: `agents/motionlab/server/contract.test.js`

**Interfaces:**
- Produces:
  - `function stripFences(text) → string`（剥 markdown 围栏与前后解释文字，只留代码）
  - `async function validateComponent(code, config) → { ok: true, defaults } | { ok: false, gate, error }`（gate ∈ `"parse"|"schema"|"render"`）

- [ ] **Step 1: 写失败测试（覆盖围栏剥离 + 缺 export + 缺默认值）**

```js
import { describe, it, expect } from "vitest";
import { stripFences } from "./contract.js";

describe("stripFences", () => {
  it("剥掉 ```tsx 围栏", () => {
    const input = "解释一下：\n```tsx\nexport default X;\n```\n完成";
    expect(stripFences(input).trim()).toBe("export default X;");
  });
  it("无围栏时原样返回", () => {
    expect(stripFences("export default X;").trim()).toBe("export default X;");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd agents/motionlab && npx vitest run server/contract.test.js`
Expected: FAIL（stripFences 未定义）

- [ ] **Step 3: 实现 stripFences + 闸①静态检查**

```js
export function stripFences(text) {
  const fenceMatch = text.match(/```(?:tsx|jsx|ts|js)?\s*([\s\S]*?)```/);
  return fenceMatch ? fenceMatch[1] : text;
}

// 闸①：能否 parse + 有无 export default 组件与 propsSchema
export function gateStatic(code) {
  if (!/export\s+default/.test(code)) return { ok: false, gate: "parse", error: "缺少 export default 组件" };
  if (!/export\s+const\s+propsSchema/.test(code)) return { ok: false, gate: "parse", error: "缺少 export const propsSchema" };
  return { ok: true };
}
```

- [ ] **Step 4: 加闸②测试（schema 每字段必须有默认值）**

追加到 `contract.test.js`：

```js
import { gateSchema } from "./contract.js";
import { z } from "zod";

describe("gateSchema", () => {
  it("所有字段有默认值时通过并返回 defaults", () => {
    const schema = z.object({ title: z.string().default("hi"), speed: z.number().default(1) });
    const r = gateSchema(schema);
    expect(r.ok).toBe(true);
    expect(r.defaults).toEqual({ title: "hi", speed: 1 });
  });
  it("有字段缺默认值时报 schema 闸失败", () => {
    const schema = z.object({ title: z.string() });
    expect(gateSchema(schema).ok).toBe(false);
  });
});
```

- [ ] **Step 5: 实现闸②**

```js
export function gateSchema(schema) {
  try {
    const defaults = schema.parse({}); // 全部字段都有默认值才能 parse 空对象
    return { ok: true, defaults };
  } catch (e) {
    return { ok: false, gate: "schema", error: "propsSchema 存在无默认值字段: " + e.message };
  }
}
```

- [ ] **Step 6: 实现闸③（试渲染 1 帧）+ 组装 validateComponent**

闸③把 code 写入临时文件，调 `@remotion/renderer` 的 `renderStill` 渲染第 0 帧；成功即通过，失败抓 error。组装：

```js
import { renderStillFrame } from "./render.js"; // Task 4 提供

export async function validateComponent(code, config) {
  const clean = stripFences(code);
  const s = gateStatic(clean);
  if (!s.ok) return s;
  // 动态 import 出 propsSchema 做闸②（写临时文件再 import）
  const { schema, error } = await loadSchema(clean);
  if (error) return { ok: false, gate: "parse", error };
  const sc = gateSchema(schema);
  if (!sc.ok) return sc;
  try {
    await renderStillFrame(clean, sc.defaults, config);
  } catch (e) {
    return { ok: false, gate: "render", error: String(e).slice(0, 500) };
  }
  return { ok: true, defaults: sc.defaults, code: clean };
}
```

（`loadSchema` 写临时 .tsx → 动态 import 取 `propsSchema`；实现时用 node 的临时目录 + esbuild/tsx 转译，或直接依赖 Remotion 的 bundler。）

- [ ] **Step 7: 运行全部 contract 测试确认通过**

Run: `cd agents/motionlab && npx vitest run server/contract.test.js`
Expected: PASS

- [ ] **Step 8: 提交**

```bash
git add agents/motionlab/server/contract.js agents/motionlab/server/contract.test.js
git commit -m "feat(motionlab): 契约校验三道闸（静态/schema/试渲染）"
```

---

### Task 4: Remotion 渲染封装（带超时）

**Files:**
- Create: `agents/motionlab/server/render.js`
- Test: `agents/motionlab/server/render.test.js`

**Interfaces:**
- Consumes: `config.json` 的 `render`。
- Produces:
  - `async function renderStillFrame(code, props, config) → void`（试渲染第 0 帧，供 Task 3 闸③；失败抛错）
  - `async function renderVideo(code, props, config, { durationSec }) → { outputPath }`（渲成 mp4 存 `output/`，文件名带时间戳）
  - 两者都受 `RENDER_TIMEOUT_MS`（默认 120000）保护，超时抛 `Error("渲染超时")`。

- [ ] **Step 1: 写失败测试（超时包装器）**

```js
import { describe, it, expect } from "vitest";
import { withTimeout } from "./render.js";

describe("withTimeout", () => {
  it("超时抛错", async () => {
    const slow = new Promise((r) => setTimeout(r, 100));
    await expect(withTimeout(slow, 10, "渲染超时")).rejects.toThrow("渲染超时");
  });
  it("按时完成则返回结果", async () => {
    const fast = Promise.resolve("done");
    await expect(withTimeout(fast, 100, "渲染超时")).resolves.toBe("done");
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `cd agents/motionlab && npx vitest run server/render.test.js`
Expected: FAIL

- [ ] **Step 3: 实现 withTimeout + 渲染函数**

```js
import path from "node:path";
import fs from "node:fs";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";

export function withTimeout(promise, ms, msg) {
  let t;
  const timeout = new Promise((_, rej) => (t = setTimeout(() => rej(new Error(msg)), ms)));
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}

function tsNow() {
  return new Date().toISOString().replace(/[-:T]/g, "").slice(0, 15).replace(/(\d{8})(\d{6})/, "$1-$2");
}

async function writeGenerated(code) {
  const p = path.join(process.cwd(), "remotion", "generated", "current.tsx");
  fs.writeFileSync(p, code);
  return p;
}

export async function renderStillFrame(code, props, config) {
  await writeGenerated(code);
  const serveUrl = await bundle({ entryPoint: path.join(process.cwd(), "remotion", "index.ts") });
  const comp = await selectComposition({ serveUrl, id: "Motion", inputProps: props });
  const out = path.join(process.cwd(), "output", ".probe.png");
  await withTimeout(renderStill({ composition: comp, serveUrl, output: out, inputProps: props, frame: 0 }), Number(process.env.RENDER_TIMEOUT_MS ?? 120000), "渲染超时");
}

export async function renderVideo(code, props, config, { durationSec }) {
  await writeGenerated(code);
  const serveUrl = await bundle({ entryPoint: path.join(process.cwd(), "remotion", "index.ts") });
  const fps = config.render.fps;
  const comp = await selectComposition({ serveUrl, id: "Motion", inputProps: props });
  comp.durationInFrames = Math.round(durationSec * fps);
  const outputPath = path.join(process.cwd(), "output", `${tsNow()}-motion.mp4`);
  await withTimeout(renderMedia({ composition: comp, serveUrl, codec: "h264", output: outputPath, inputProps: props }), Number(process.env.RENDER_TIMEOUT_MS ?? 120000), "渲染超时");
  return { outputPath };
}
```

- [ ] **Step 4: 运行确认通过**

Run: `cd agents/motionlab && npx vitest run server/render.test.js`
Expected: PASS（withTimeout 单测通过；渲染函数走 Task 8 端到端验证）

- [ ] **Step 5: 提交**

```bash
git add agents/motionlab/server/render.js agents/motionlab/server/render.test.js
git commit -m "feat(motionlab): Remotion 渲染封装 + 超时保护"
```

---

### Task 5: 成本估算 + 累计持久化

**Files:**
- Create: `agents/motionlab/server/cost.js`
- Test: `agents/motionlab/server/cost.test.js`

**Interfaces:**
- Consumes: `extractUsage` 的输出结构、`config.models`。
- Produces:
  - `function estimateCost(modelId, usage, config) → { cost }`（`cost = (inputTokens/1e6*priceInPerM + outputTokens/1e6*priceOutPerM) * discount`）
  - `function addToTotal(cost, costFilePath) → { total }`（读 `.cost.json`，累加，写回）

- [ ] **Step 1: 写失败测试**

```js
import { describe, it, expect } from "vitest";
import { estimateCost } from "./cost.js";

const config = { models: [{ id: "claude-opus-5-5", discount: 0.46, priceInPerM: 10, priceOutPerM: 40 }] };

describe("estimateCost", () => {
  it("按 输入/输出单价 × 折扣 计算", () => {
    // 输入 1e6 token → 10 ; 输出 1e6 → 40 ; 合 50 × 0.46 = 23
    const { cost } = estimateCost("claude-opus-5-5", { inputTokens: 1e6, outputTokens: 1e6 }, config);
    expect(cost).toBeCloseTo(23, 5);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `cd agents/motionlab && npx vitest run server/cost.test.js`
Expected: FAIL

- [ ] **Step 3: 实现 cost.js**

```js
import fs from "node:fs";

export function estimateCost(modelId, usage, config) {
  const m = config.models.find((x) => x.id === modelId);
  if (!m) throw new Error(`未知模型: ${modelId}`);
  const raw = (usage.inputTokens / 1e6) * m.priceInPerM + (usage.outputTokens / 1e6) * m.priceOutPerM;
  return { cost: raw * m.discount };
}

export function addToTotal(cost, costFilePath) {
  let total = 0;
  try { total = JSON.parse(fs.readFileSync(costFilePath, "utf8")).total ?? 0; } catch {}
  total += cost;
  fs.writeFileSync(costFilePath, JSON.stringify({ total }, null, 2));
  return { total };
}
```

- [ ] **Step 4: 运行确认通过**

Run: `cd agents/motionlab && npx vitest run server/cost.test.js`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add agents/motionlab/server/cost.js agents/motionlab/server/cost.test.js
git commit -m "feat(motionlab): 成本估算 + 累计持久化"
```

---

### Task 6: 编排主流程（含自愈循环）+ http 服务

**Files:**
- Create: `agents/motionlab/server/orchestrate.js`
- Create: `agents/motionlab/server/index.js`
- Create: `agents/motionlab/server/prompt.js`
- Test: `agents/motionlab/server/orchestrate.test.js`

**Interfaces:**
- Consumes: `callLLM`(Task2), `validateComponent`(Task3), `renderVideo`(Task4), `estimateCost`/`addToTotal`(Task5)。
- Produces:
  - `function buildMessages(userDesc) → messages`（系统 prompt 写死契约要求）
  - `async function generate({ modelId, userDesc, config, deps }) → { code, defaults, usage, cost, attempts } | { error }`（含 ≤2 次自愈重试；`deps` 注入 callLLM/validateComponent 便于测试 mock）
  - http 服务：`POST /generate {modelId,desc}` → 生成结果；`POST /render {code,props,durationSec}` → mp4 路径；`GET /config` → 前端读模型列表与默认参数；静态托管 `web/`。

- [ ] **Step 1: 写失败测试（自愈：首次坏代码 → 回喂 → 第二次好代码）**

```js
import { describe, it, expect, vi } from "vitest";
import { generate } from "./orchestrate.js";

const config = { models: [{ id: "m", discount: 1, priceInPerM: 0, priceOutPerM: 0 }] };

it("首次校验失败则回喂重试，第二次成功", async () => {
  const callLLM = vi.fn()
    .mockResolvedValueOnce({ text: "坏代码", usage: { inputTokens: 1, outputTokens: 1 } })
    .mockResolvedValueOnce({ text: "好代码", usage: { inputTokens: 1, outputTokens: 1 } });
  const validateComponent = vi.fn()
    .mockResolvedValueOnce({ ok: false, gate: "parse", error: "缺 export" })
    .mockResolvedValueOnce({ ok: true, defaults: { title: "x" }, code: "好代码" });
  const r = await generate({ modelId: "m", userDesc: "一个标题淡入", config, deps: { callLLM, validateComponent } });
  expect(r.attempts).toBe(2);
  expect(r.code).toBe("好代码");
  expect(callLLM).toHaveBeenCalledTimes(2);
});

it("连续 3 次失败则返回 error 不抛出", async () => {
  const callLLM = vi.fn().mockResolvedValue({ text: "坏", usage: { inputTokens: 1, outputTokens: 1 } });
  const validateComponent = vi.fn().mockResolvedValue({ ok: false, gate: "render", error: "渲染挂了" });
  const r = await generate({ modelId: "m", userDesc: "x", config, deps: { callLLM, validateComponent } });
  expect(r.error).toBeTruthy();
  expect(callLLM).toHaveBeenCalledTimes(3);
});
```

- [ ] **Step 2: 运行确认失败**

Run: `cd agents/motionlab && npx vitest run server/orchestrate.test.js`
Expected: FAIL

- [ ] **Step 3: 实现 prompt.js（系统 prompt 写死契约）**

```js
export function buildMessages(userDesc, priorError) {
  const system = `你为 Remotion 生成一个动画组件。硬性要求：
1) export default 一个 React 组件；export const propsSchema = z.object({...})（每个字段必须 .default(...)）。
2) 所有可变内容（文案/颜色/时长/速度等）走 props，不许写死。
3) 用 useCurrentFrame()/interpolate() 做帧驱动动画；从 props 读取可调参数。
4) 只输出代码，不要解释。`;
  const messages = [{ role: "system", content: system }, { role: "user", content: userDesc }];
  if (priorError) messages.push({ role: "user", content: `上次生成的代码校验失败（${priorError}），请修正后重新输出完整代码。` });
  return messages;
}
```

- [ ] **Step 4: 实现 orchestrate.js（自愈循环）**

```js
import { buildMessages } from "./prompt.js";

export async function generate({ modelId, userDesc, config, deps }) {
  const { callLLM, validateComponent } = deps;
  const MAX = 2; // 额外重试次数
  let priorError = null;
  let totalUsage = { inputTokens: 0, outputTokens: 0 };
  for (let attempt = 1; attempt <= MAX + 1; attempt++) {
    const { text, usage } = await callLLM({ modelId, messages: buildMessages(userDesc, priorError), config });
    totalUsage.inputTokens += usage.inputTokens;
    totalUsage.outputTokens += usage.outputTokens;
    const v = await validateComponent(text, config);
    if (v.ok) return { code: v.code, defaults: v.defaults, usage: totalUsage, attempts: attempt };
    priorError = `${v.gate}: ${v.error}`;
  }
  return { error: `生成失败（已重试 ${MAX} 次）：${priorError}`, usage: totalUsage };
}
```

- [ ] **Step 5: 运行确认通过**

Run: `cd agents/motionlab && npx vitest run server/orchestrate.test.js`
Expected: PASS

- [ ] **Step 6: 实现 index.js（http 服务，接线真实 deps + 成本）**

用 node 内置 `http` 起服务：`/config` 返回模型与 render 默认；`/generate` 调 `generate` 注入真实 `callLLM`+`validateComponent`，成功后 `estimateCost`+`addToTotal` 一并返回 `cost`/`total`；`/render` 调 `renderVideo`；其余路径静态托管 `web/`。错误统一返回 `{error}` + 非 200。

- [ ] **Step 7: 冒烟：起服务，curl /config**

Run: `cd agents/motionlab && node server/index.js &` 然后 `curl -s localhost:PORT/config`
Expected: 返回含 models 的 JSON；关掉后台进程。

- [ ] **Step 8: 提交**

```bash
git add agents/motionlab/server/orchestrate.js agents/motionlab/server/index.js agents/motionlab/server/prompt.js agents/motionlab/server/orchestrate.test.js
git commit -m "feat(motionlab): 编排主流程 + 自愈循环 + http 服务"
```

---

### Task 7: 前端工作台（对话 + 切换 + Player 预览 + 自动参数面板 + 成本条）

**Files:**
- Create: `agents/motionlab/web/index.html`
- Create: `agents/motionlab/web/app.js`
- Create: `agents/motionlab/web/player-bundle`（说明：Player 通过 esbuild 打包 generated 组件供浏览器预览；见 Step 说明）

**Interfaces:**
- Consumes: `GET /config`, `POST /generate`, `POST /render`。
- 参数面板按 `defaults` + propsSchema 的字段类型渲染控件；数值型按 min/max 约束（越界拦截）。

- [ ] **Step 1: 写 index.html 骨架（布局按 spec 第 4 节）**

顶栏：模型下拉（从 `/config` 填充）+ 成本条（本次/累计）。主体左预览区、右参数面板。底部对话框 + [生成] + [渲染成 mp4]。

- [ ] **Step 2: 实现 app.js —— 生成流程**

点[生成] → `POST /generate {modelId, desc}` → 拿回 `{code, defaults, cost, total}` → 更新成本条 → 用 defaults 初始化参数面板 → 触发预览。

- [ ] **Step 3: 实现自动参数面板**

按 `defaults` 每个字段类型出控件：string→文本框；number→滑块（min/max 来自 schema，缺省 0~2）；颜色（字段名含 color）→取色器。改动即更新本地 props state。**数值越界按 min/max clamp**。

- [ ] **Step 4: 接 @remotion/player 实时预览**

用 `@remotion/player` 的 `<Player>` 加载当前 generated 组件 + 当前 props state；改参数面板 → props 变 → Player 实时重渲染（不调后端）。generated 组件经服务端 esbuild 打包成浏览器可 import 的 bundle 暴露给前端。

- [ ] **Step 5: 实现[渲染成 mp4]**

点击 → `POST /render {code, props, durationSec}` → 拿回 `outputPath` → 界面提示"已存到 output/xxx.mp4"。

- [ ] **Step 6: 手动验证越界拦截**

打开页面，把某数值滑块拖到超范围输入框手填超限值 → 预览不崩、值被 clamp。

- [ ] **Step 7: 提交**

```bash
git add agents/motionlab/web
git commit -m "feat(motionlab): 前端工作台（预览/参数面板/成本条）"
```

---

### Task 8: 一键启动 + 端到端验证（A/B/C 三类各一）

**Files:**
- Create: `agents/motionlab/motionlab.command`
- Modify: `agents/motionlab/README.md`（补启动与端到端说明）

**Interfaces:**
- Produces: 双击 `.command` → 起 server → 自动开浏览器；关窗即停（对齐 posterdesigner）。

- [ ] **Step 1: 写 motionlab.command**

```bash
#!/bin/bash
# MotionLab · 工作台
cd "$(dirname "$0")" || exit 1
echo "MotionLab · 工作台启动中…（关闭本窗口即停止）"
node server/index.js
read -r -p "服务已停止，按回车关闭…" _
```

Run: `chmod +x agents/motionlab/motionlab.command`

- [ ] **Step 2: 设置 API key 环境变量并起服务**

Run: `export MOTIONLAB_API_KEY=<转转提供的 key>` 然后双击 command 或 `node server/index.js`
Expected: 浏览器打开工作台。

- [ ] **Step 3: 端到端①（C 生成式图形）**

描述"一堆彩色圆点从中心炸开又聚拢，循环，深色背景，15 秒" → 生成成功 → 预览能播 → 渲染出 mp4。

- [ ] **Step 4: 端到端②（A 信息/品牌动效）**

描述"标题'MotionLab'逐字淡入，下方一行小字滑入，米白背景" → 调参数面板改标题文案和主色，预览实时变 → 渲染 mp4。

- [ ] **Step 5: 端到端③（B UI 动效）+ 切模型对比**

描述"一个卡片从下方滑入并轻微回弹，投影渐显" → 切到另一个模型再生成一次，对比两版 → 各渲一个 mp4。

- [ ] **Step 6: 确认成本条累计正确**

三轮生成后，`.cost.json` 的 total ≈ 界面累计值；每次生成本次成本 > 0（前提：config 已填真实官方原价）。

- [ ] **Step 7: 补 README 并提交**

```bash
git add agents/motionlab/motionlab.command agents/motionlab/README.md
git commit -m "feat(motionlab): 一键启动 + 端到端验证"
```

---

## 备注（实现前须与转转确认）

1. **官方原价**：`config.json` 的 `priceInPerM`/`priceOutPerM` 目前是占位 0，需转转提供两个模型的官方原价（每百万 token 输入/输出），否则成本恒为 0。
2. **API key**：通过环境变量 `MOTIONLAB_API_KEY` 注入，转转需提供网关 key。
3. **端点确认**：两模型先都按 `/v1/chat/completions` 走；若某个模型该端点不通，切到 `/v1/responses`（gpt-6）或 `/v1/messages`（opus）并相应调整 `callLLM` 的 body/取值。
