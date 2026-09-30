# Siri 一期（骨架）实施计划

> ⛔ **已废弃（2026-09-30）**：本计划基于 Vercel Functions 自建飞书应用方案。后发现转转已有飞书智能伙伴平台（Aily）agent，平台原生提供收发消息、定时、连接器、卡片生成等全部骨架能力，无需自建。架构已改为「共享表格中心 + Siri 常驻 + Claude 按需 + 飞书 API 触发」。**本计划不再执行**，保留仅作历史记录。最新设计见 spec 第 3 节，新分期见 spec 第 12 节。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 打通飞书自建应用与 Vercel 的事件回调链路，做到「@Siri 发消息，Siri 回一句话」，验证常驻响应链路。

**Architecture:** 飞书自建应用订阅消息事件 → 事件回调打到 Vercel Function (`api/siri-events.js`) → Function 校验请求来源、解析 @消息 → 通过飞书应用凭证获取 token、调消息 API 回复。纯逻辑（URL 校验、签名校验、消息解析）抽到 `agents/siri/lib/` 便于单测；真实 API 调用（取 token、发消息）单独封装。

**Tech Stack:** Node.js 20+ (ES modules), Vercel Serverless Functions, Node 内置 `node:test` 测试框架（零依赖），飞书开放平台自建应用 API。

**Spec:** `docs/superpowers/specs/2026-09-29-siri-design-delivery-workflow-design.md`

## Global Constraints

- **语言/模块**：纯 JavaScript ES modules（`export`/`import`），与现有 `api/push-feishu.js` 一致，不引入 TypeScript。
- **依赖**：零第三方运行时依赖。测试用 Node 内置 `node:test` + `node:assert`。加密/签名用 Node 内置 `node:crypto`。
- **凭证**：飞书 `SIRI_APP_ID` / `SIRI_APP_SECRET` / `SIRI_VERIFICATION_TOKEN`（可选 `SIRI_ENCRYPT_KEY`）存 Vercel 环境变量，绝不入库。本地测试用 `.env`（已在 `.gitignore`）。
- **时区**：所有时间显示用 `Asia/Shanghai`。
- **agent 结构**：Siri 作为新 agent 纳入 `agents/siri/`，沿用现有 agent 约定（README.md + config.json + lib/）。
- **本期边界**：只做「收消息→回一句话」。不碰多维表格、不碰 Linear/GitHub/Vercel API、不碰卡片规范、不碰定时任务、不碰意图理解。回复内容为固定占位话术。

## Review Focus

本期规格隐含、但任务测试未必天然覆盖、且最可能坑到真实使用的输入类别：

1. **飞书 URL 校验请求（url_verification）**：配置回调地址时飞书会先发 challenge，端点必须原样回 challenge，否则回调地址配置失败。→ 覆盖于 Task 2。
2. **重复投递的事件**：飞书事件可能重复投递（at-least-once），同一 `event_id` 不应触发多次回复。→ 覆盖于 Task 4。
3. **非法/伪造请求**：签名校验失败或 token 不匹配的请求必须拒绝，防止端点被滥用。→ 覆盖于 Task 3。
4. **非 @Siri 的消息**：群里普通消息（未 @Siri）不应触发回复。→ 覆盖于 Task 4。
5. **飞书 token 获取失败**：`app_id/secret` 错误或网络异常时，回复流程要优雅失败、不崩端点。→ 覆盖于 Task 5。

---

## 前置：你（转转）需要先做的事

这些只有你能操作，实施前或实施中我会明确指引每一步。**本计划的代码任务不依赖这些提前完成**（纯逻辑任务可先做、先测），但联调验证（Task 6）需要：

1. 飞书开放平台（open.feishu.cn）创建**自建应用**「Siri」
2. 拿到 **App ID** 和 **App Secret**
3. 开启**机器人**能力
4. 添加权限：`im:message`（收发消息）、`im:message.group_at_msg`（群内被@）
5. 事件订阅里拿到 **Verification Token**（先不开加密，简化一期）
6. 把上述凭证配到 Vercel 项目环境变量
7. 事件回调地址填 `https://<你的域名>/api/siri-events`（Task 6 部署后）

---

## Task 1: Siri agent 骨架（README + config + 目录）

**Files:**
- Create: `agents/siri/README.md`
- Create: `agents/siri/config.json`
- Create: `agents/siri/lib/.gitkeep`

**Interfaces:**
- Produces: `agents/siri/` 目录结构，后续 lib 与端点归属于此 agent。

- [ ] **Step 1: 参照现有 agent 写 config.json**

读 `agents/secretary/config.json` 确认字段格式，然后创建 `agents/siri/config.json`：

```json
{
  "name": "Siri",
  "role": "设计交付工作流协调",
  "description": "对外发布信息、收集信息、回答问题的工作场景 agent。归档任务、推送待办与交付卡片、维护状态流转、回答历史问题。真实设计工作由转转与团队完成。",
  "type": "feishu-bot",
  "runtime": "vercel-functions",
  "status": "building",
  "phase": "1-skeleton"
}
```

- [ ] **Step 2: 写 README.md（说明定位与一期范围）**

创建 `agents/siri/README.md`，内容包含：Siri 定位（引用 spec）、一期目标（收消息→回一句话）、目录结构说明、指向 spec 路径。至少包含：

```markdown
# Siri — 设计交付工作流机器人

飞书自建应用机器人，转转 AI 团队的工作场景成员。对外发布信息、收集信息、回答问题；真实设计工作由转转与团队完成。

**设计文档**：`docs/superpowers/specs/2026-09-29-siri-design-delivery-workflow-design.md`

## 一期（骨架）范围

打通飞书事件回调链路：@Siri 发消息 → Siri 回一句话。验证常驻响应链路，暂不含台账/多平台/卡片/定时。

## 目录

- `lib/verify.js` — 请求校验（URL 校验、签名）纯逻辑
- `lib/message.js` — 消息解析纯逻辑
- `lib/feishu.js` — 飞书 API（取 token、发消息）
- 端点：`/api/siri-events.js`（项目根 api/ 下）

## 环境变量

- `SIRI_APP_ID` / `SIRI_APP_SECRET` — 自建应用凭证
- `SIRI_VERIFICATION_TOKEN` — 事件订阅校验 token
```

- [ ] **Step 3: 占位 lib 目录**

创建空文件 `agents/siri/lib/.gitkeep`（保证空目录入库）。

- [ ] **Step 4: Commit**

```bash
git add agents/siri/
git commit -m "feat(siri): agent 骨架 - README/config/目录结构"
```

---

## Task 2: URL 校验响应（url_verification challenge）

**Files:**
- Create: `agents/siri/lib/verify.js`
- Test: `agents/siri/lib/verify.test.js`

**Interfaces:**
- Produces: `handleUrlVerification(body)` — 入参飞书请求体对象，若为 `type: 'url_verification'` 返回 `{ challenge }`，否则返回 `null`。

- [ ] **Step 1: 写失败测试**

创建 `agents/siri/lib/verify.test.js`：

```javascript
import { test } from 'node:test';
import assert from 'node:assert';
import { handleUrlVerification } from './verify.js';

test('url_verification 请求返回 challenge', () => {
  const body = { type: 'url_verification', challenge: 'abc123', token: 't' };
  assert.deepStrictEqual(handleUrlVerification(body), { challenge: 'abc123' });
});

test('非 url_verification 请求返回 null', () => {
  const body = { type: 'event_callback', event: {} };
  assert.strictEqual(handleUrlVerification(body), null);
});

test('body 为空时返回 null', () => {
  assert.strictEqual(handleUrlVerification(null), null);
  assert.strictEqual(handleUrlVerification(undefined), null);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test agents/siri/lib/verify.test.js`
Expected: FAIL（`handleUrlVerification` 未定义 / 模块不存在）

- [ ] **Step 3: 写最小实现**

创建 `agents/siri/lib/verify.js`：

```javascript
// 飞书事件回调请求校验
export function handleUrlVerification(body) {
  if (!body || body.type !== 'url_verification') return null;
  return { challenge: body.challenge };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test agents/siri/lib/verify.test.js`
Expected: PASS（3 个用例）

- [ ] **Step 5: Commit**

```bash
git add agents/siri/lib/verify.js agents/siri/lib/verify.test.js
git commit -m "feat(siri): URL 校验 challenge 响应"
```

---

## Task 3: 请求来源校验（Verification Token）

**Files:**
- Modify: `agents/siri/lib/verify.js`
- Test: `agents/siri/lib/verify.test.js`（追加用例）

**Interfaces:**
- Consumes: `agents/siri/lib/verify.js`
- Produces: `verifyToken(body, expectedToken)` — 校验请求体中的 token 与期望 token 是否一致，返回 `boolean`。

- [ ] **Step 1: 追加失败测试**

在 `agents/siri/lib/verify.test.js` 追加：

```javascript
import { verifyToken } from './verify.js';

test('token 匹配返回 true', () => {
  assert.strictEqual(verifyToken({ token: 'secret' }, 'secret'), true);
});

test('token 不匹配返回 false', () => {
  assert.strictEqual(verifyToken({ token: 'wrong' }, 'secret'), false);
});

test('token 缺失或期望值缺失返回 false', () => {
  assert.strictEqual(verifyToken({}, 'secret'), false);
  assert.strictEqual(verifyToken({ token: 'secret' }, ''), false);
  assert.strictEqual(verifyToken(null, 'secret'), false);
});
```

注意：飞书 v2 事件里 token 可能在 `body.token` 或 `body.header.token`，实现需两处都查。

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test agents/siri/lib/verify.test.js`
Expected: FAIL（`verifyToken` 未定义）

- [ ] **Step 3: 写实现**

在 `agents/siri/lib/verify.js` 追加：

```javascript
// 校验请求 token（飞书 v1 在 body.token，v2 在 body.header.token）
export function verifyToken(body, expectedToken) {
  if (!body || !expectedToken) return false;
  const token = body.token || (body.header && body.header.token);
  return token === expectedToken;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test agents/siri/lib/verify.test.js`
Expected: PASS（全部用例）

- [ ] **Step 5: Commit**

```bash
git add agents/siri/lib/verify.js agents/siri/lib/verify.test.js
git commit -m "feat(siri): Verification Token 请求来源校验"
```

---

## Task 4: 消息解析（是否@Siri + 去重）

**Files:**
- Create: `agents/siri/lib/message.js`
- Test: `agents/siri/lib/message.test.js`

**Interfaces:**
- Produces:
  - `parseMessage(body)` — 从事件体提取 `{ eventId, chatId, messageId, text, isAtBot }`；非消息事件返回 `null`。
  - `isDuplicate(eventId, seen)` — `seen` 为一个 `Set`，若 `eventId` 已存在返回 `true`，否则记入并返回 `false`。

- [ ] **Step 1: 写失败测试**

创建 `agents/siri/lib/message.test.js`：

```javascript
import { test } from 'node:test';
import assert from 'node:assert';
import { parseMessage, isDuplicate } from './message.js';

// 飞书 v2 消息事件（群内 @机器人）结构简化样本
function sampleEvent({ eventId = 'e1', text = '@Siri 你好', mentions = ['ou_bot'] } = {}) {
  return {
    header: { event_id: eventId, event_type: 'im.message.receive_v1' },
    event: {
      message: {
        message_id: 'm1',
        chat_id: 'oc_chat',
        content: JSON.stringify({ text }),
        mentions: mentions.map(id => ({ id: { open_id: id } })),
      },
    },
  };
}

test('提取消息基本字段', () => {
  const r = parseMessage(sampleEvent());
  assert.strictEqual(r.eventId, 'e1');
  assert.strictEqual(r.chatId, 'oc_chat');
  assert.strictEqual(r.messageId, 'm1');
  assert.match(r.text, /你好/);
});

test('非消息事件返回 null', () => {
  assert.strictEqual(parseMessage({ header: { event_type: 'other' } }), null);
  assert.strictEqual(parseMessage(null), null);
});

test('isDuplicate 首次 false，重复 true', () => {
  const seen = new Set();
  assert.strictEqual(isDuplicate('e1', seen), false);
  assert.strictEqual(isDuplicate('e1', seen), true);
  assert.strictEqual(isDuplicate('e2', seen), false);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test agents/siri/lib/message.test.js`
Expected: FAIL（模块/函数未定义）

- [ ] **Step 3: 写实现**

创建 `agents/siri/lib/message.js`：

```javascript
// 解析飞书消息事件，提取核心字段
export function parseMessage(body) {
  if (!body || !body.header || body.header.event_type !== 'im.message.receive_v1') {
    return null;
  }
  const msg = body.event && body.event.message;
  if (!msg) return null;

  let text = '';
  try {
    text = JSON.parse(msg.content || '{}').text || '';
  } catch {
    text = '';
  }
  const mentions = msg.mentions || [];

  return {
    eventId: body.header.event_id,
    chatId: msg.chat_id,
    messageId: msg.message_id,
    text,
    isAtBot: mentions.length > 0, // 一期简化：群内被@即视为@Siri
  };
}

// 事件去重（飞书 at-least-once 投递）
export function isDuplicate(eventId, seen) {
  if (seen.has(eventId)) return true;
  seen.add(eventId);
  return false;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test agents/siri/lib/message.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add agents/siri/lib/message.js agents/siri/lib/message.test.js
git commit -m "feat(siri): 消息解析与事件去重"
```

---

## Task 5: 飞书 API 封装（取 token + 发消息）

**Files:**
- Create: `agents/siri/lib/feishu.js`
- Test: `agents/siri/lib/feishu.test.js`

**Interfaces:**
- Produces:
  - `getTenantToken(appId, appSecret, fetchFn)` — 调飞书 API 换 `tenant_access_token`，返回 token 字符串；失败抛错。`fetchFn` 默认 `globalThis.fetch`，测试时注入桩。
  - `replyMessage(messageId, text, token, fetchFn)` — 调飞书回复消息 API，返回 `boolean`（成功与否）。

- [ ] **Step 1: 写失败测试（注入 fetch 桩，不打真实网络）**

创建 `agents/siri/lib/feishu.test.js`：

```javascript
import { test } from 'node:test';
import assert from 'node:assert';
import { getTenantToken, replyMessage } from './feishu.js';

test('getTenantToken 成功返回 token', async () => {
  const fakeFetch = async () => ({
    json: async () => ({ code: 0, tenant_access_token: 'tok_123', expire: 7200 }),
  });
  const token = await getTenantToken('id', 'secret', fakeFetch);
  assert.strictEqual(token, 'tok_123');
});

test('getTenantToken 失败抛错', async () => {
  const fakeFetch = async () => ({
    json: async () => ({ code: 99991663, msg: 'app not found' }),
  });
  await assert.rejects(() => getTenantToken('id', 'bad', fakeFetch), /app not found/);
});

test('replyMessage 成功返回 true', async () => {
  const fakeFetch = async () => ({ json: async () => ({ code: 0 }) });
  const ok = await replyMessage('m1', '你好', 'tok', fakeFetch);
  assert.strictEqual(ok, true);
});

test('replyMessage 失败返回 false', async () => {
  const fakeFetch = async () => ({ json: async () => ({ code: 1, msg: 'err' }) });
  const ok = await replyMessage('m1', '你好', 'tok', fakeFetch);
  assert.strictEqual(ok, false);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test agents/siri/lib/feishu.test.js`
Expected: FAIL（模块/函数未定义）

- [ ] **Step 3: 写实现**

创建 `agents/siri/lib/feishu.js`：

```javascript
// 飞书自建应用 API 封装
const BASE = 'https://open.feishu.cn/open-apis';

// 换取 tenant_access_token
export async function getTenantToken(appId, appSecret, fetchFn = globalThis.fetch) {
  const resp = await fetchFn(`${BASE}/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });
  const data = await resp.json();
  if (data.code !== 0) {
    throw new Error(`获取 token 失败: ${data.msg || data.code}`);
  }
  return data.tenant_access_token;
}

// 回复指定消息（文本）
export async function replyMessage(messageId, text, token, fetchFn = globalThis.fetch) {
  const resp = await fetchFn(`${BASE}/im/v1/messages/${messageId}/reply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      msg_type: 'text',
      content: JSON.stringify({ text }),
    }),
  });
  const data = await resp.json();
  return data.code === 0;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test agents/siri/lib/feishu.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add agents/siri/lib/feishu.js agents/siri/lib/feishu.test.js
git commit -m "feat(siri): 飞书 API 封装 - 取 token 与回复消息"
```

---

## Task 6: Vercel 事件端点（组装链路）

**Files:**
- Create: `api/siri-events.js`
- Test: `api/siri-events.test.js`

**Interfaces:**
- Consumes: `agents/siri/lib/verify.js`、`message.js`、`feishu.js` 全部导出。
- Produces: 默认导出 `handler(req, res)` —— Vercel Function 入口。

- [ ] **Step 1: 写失败测试（mock req/res + 注入依赖）**

创建 `api/siri-events.test.js`。测试端点的编排逻辑：URL 校验直接回 challenge、非法 token 返回 401、@Siri 消息触发回复、重复事件不重复回复。用 mock 的 `res` 收集响应，用环境变量桩。

```javascript
import { test } from 'node:test';
import assert from 'node:assert';
import handler, { __resetSeen } from './siri-events.js';

function mockRes() {
  return {
    _status: 0, _json: null, _ended: false,
    setHeader() {},
    status(c) { this._status = c; return this; },
    json(o) { this._json = o; return this; },
    end() { this._ended = true; return this; },
  };
}

test('url_verification 回 challenge', async () => {
  __resetSeen();
  const req = { method: 'POST', body: { type: 'url_verification', challenge: 'c1', token: process.env.SIRI_VERIFICATION_TOKEN || 'tkn' } };
  process.env.SIRI_VERIFICATION_TOKEN = 'tkn';
  req.body.token = 'tkn';
  const res = mockRes();
  await handler(req, res);
  assert.deepStrictEqual(res._json, { challenge: 'c1' });
});

test('token 不匹配返回 401', async () => {
  __resetSeen();
  process.env.SIRI_VERIFICATION_TOKEN = 'tkn';
  const req = { method: 'POST', body: { type: 'event_callback', header: { token: 'wrong' }, event: {} } };
  const res = mockRes();
  await handler(req, res);
  assert.strictEqual(res._status, 401);
});

test('非 POST 返回 405', async () => {
  __resetSeen();
  const req = { method: 'GET' };
  const res = mockRes();
  await handler(req, res);
  assert.strictEqual(res._status, 405);
});
```

说明：真实回复依赖飞书凭证与网络，端点内对 `getTenantToken`/`replyMessage` 的调用在缺少凭证时应捕获异常、返回 200（避免飞书因非 200 重试轰炸），并在日志记录。上面三个用例覆盖不需真实网络的编排分支；真实回复在 Step 6 手动联调验证。

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test api/siri-events.test.js`
Expected: FAIL（端点未创建）

- [ ] **Step 3: 写端点实现**

创建 `api/siri-events.js`：

```javascript
// Vercel Serverless Function: Siri 飞书事件回调
// POST /api/siri-events
import { handleUrlVerification, verifyToken } from '../agents/siri/lib/verify.js';
import { parseMessage, isDuplicate } from '../agents/siri/lib/message.js';
import { getTenantToken, replyMessage } from '../agents/siri/lib/feishu.js';

// 进程内去重集合（Vercel 实例存活期间有效；一期够用，二期上持久层）
const seen = new Set();
export function __resetSeen() { seen.clear(); } // 仅测试用

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body;

  // 1. URL 校验（配置回调地址时飞书先发 challenge）
  const verification = handleUrlVerification(body);
  if (verification) {
    return res.status(200).json(verification);
  }

  // 2. 请求来源校验
  const expectedToken = process.env.SIRI_VERIFICATION_TOKEN;
  if (!verifyToken(body, expectedToken)) {
    return res.status(401).json({ error: 'invalid token' });
  }

  // 3. 解析消息
  const msg = parseMessage(body);
  // 非消息事件 / 未@机器人：确认收到即可，不回复
  if (!msg || !msg.isAtBot) {
    return res.status(200).json({ ok: true });
  }

  // 4. 事件去重
  if (isDuplicate(msg.eventId, seen)) {
    return res.status(200).json({ ok: true, duplicate: true });
  }

  // 5. 回复一句话（一期固定话术）；失败不抛出，避免飞书重试轰炸
  try {
    const token = await getTenantToken(process.env.SIRI_APP_ID, process.env.SIRI_APP_SECRET);
    await replyMessage(msg.messageId, '收到，我是 Siri（一期骨架已通）。', token);
  } catch (err) {
    console.error('[siri] 回复失败:', err.message);
  }

  return res.status(200).json({ ok: true });
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test api/siri-events.test.js`
Expected: PASS（3 个用例）

- [ ] **Step 5: 跑全部测试 + 提交代码**

Run: `node --test agents/siri/lib/*.test.js api/siri-events.test.js`
Expected: 全绿

```bash
git add api/siri-events.js api/siri-events.test.js
git commit -m "feat(siri): Vercel 事件端点，打通收消息-回复链路"
```

- [ ] **Step 6: 真实联调（需转扭配好凭证 + 部署）**

这步需要真实飞书应用与部署，按序验证：

1. 确认 Vercel 环境变量已配：`SIRI_APP_ID`、`SIRI_APP_SECRET`、`SIRI_VERIFICATION_TOKEN`
2. 部署到 Vercel（push 到 main 触发，或 `vercel --prod`）
3. 飞书开放平台 → 事件订阅 → 回调地址填 `https://<域名>/api/siri-events` → 保存，确认飞书**校验通过**（验证 Task 2 的 challenge 逻辑）
4. 订阅事件 `im.message.receive_v1`（接收消息）
5. 把 Siri 机器人拉进一个测试群，@Siri 发「你好」
6. 预期：Siri 回复「收到，我是 Siri（一期骨架已通）。」
7. 若无回复：查 Vercel 日志（Functions 日志），对照 `[siri]` 错误定位（多半是权限未开或凭证错）

**一期完成判定**：@Siri 能稳定收到回复，且飞书回调地址校验通过。

---

## 一期完成后

一期跑通即验证了常驻响应链路。二期（归档 + 台账）在此基础上加飞书多维表格与存储层。届时另写二期计划。

进程内去重（`seen` Set）是一期的临时方案，二期上持久层后替换为基于存储的去重。
