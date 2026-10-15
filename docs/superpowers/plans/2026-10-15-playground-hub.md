# Playground Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 做一个本地优先的启动中枢，自动发现仓库内的能力（agent / tool），能真·起/停服务型进程、看状态与日志，并为交互型和配置型能力提供一键入口。

**Architecture:** Node + Express 本地服务，监听 `127.0.0.1:7777`。启动时扫描 `agents/*/config.json` 的可选 `launch` 段，归一化为能力列表。按三种形态处理：`server`（spawn 常驻进程、PID 跟踪、端口探活、日志环形缓冲）、`interactive`（osascript 开新终端）、`doc`（open 目录）。前端为原生 HTML/CSS/JS 单页，轮询 `/api/capabilities` 刷新状态。

**Tech Stack:** Node.js、Express、vitest（测试，与 motionlab 一致）、原生前端（无框架）。

**Spec:** `docs/superpowers/specs/2026-10-13-playground-hub-design.md`

## Global Constraints

- 中枢只监听 `127.0.0.1`，绝不绑定 `0.0.0.0` 或对外网卡。
- `cmd` / `command` 只来自仓库内 config.json，API 永不接受页面传入的任意命令字符串。
- `:id` 必须经过白名单校验（必须是发现阶段已登记的能力目录名）。
- `cwd` 解析为绝对路径后必须落在仓库根目录内，越界路径一律拒绝。
- 不读取、不回显任何 `.env` 文件内容。
- 中枢代码独立放在 `hub/` 目录（与 `agents/` `tools/` 平级）。
- 默认中枢端口 7777；能力 `launch` 段缺省时自动归为 `doc` 型。
- 仓库根通过从 `hub/server/` 向上定位（`path.resolve(__dirname, '../..')`），不写死绝对路径。

## Review Focus

- **config.json 缺字段 / 格式损坏**：某能力的 config.json 是无效 JSON，或缺 `name`。发现阶段应跳过该目录并记一条警告，而不是整个中枢崩溃。（Task 2 覆盖）
- **port 被占用但不是本能力**：探活仅凭"端口在监听"判断运行中，可能把别的程序误判为本能力在跑。运行中状态须结合"本中枢持有该能力的 PID"来判定，端口探活只用于辅助/恢复提示。（Task 4 覆盖）
- **spawn 后进程瞬间退出**（依赖没装/命令错）：启动 API 不能立即返回"成功"了事；须保留退出码与日志，前端能看到失败原因。（Task 4 覆盖）
- **:id 为未知/构造路径**（如 `../secretary`、不存在的 id）：所有按 id 的 API 必须白名单校验，拒绝并返回 404，绝不据此拼路径。（Task 5 覆盖）
- **非 macOS 平台触发 interactive**：osascript 不存在时须优雅降级为"复制命令"提示，而非抛未捕获异常。（Task 6 覆盖）

---

### Task 1: hub 骨架 + 仓库根定位

**Files:**
- Create: `hub/package.json`
- Create: `hub/server/paths.js`
- Test: `hub/server/paths.test.js`

**Interfaces:**
- Produces: `repoRoot()` → string（仓库根绝对路径）；`isInsideRepo(absPath)` → boolean；`resolveInRepo(relPath)` → string（解析相对仓库根的路径，越界抛 `Error`）。

- [ ] **Step 1: 写 package.json**

```json
{
  "name": "playground-hub",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node server/index.js",
    "test": "vitest run"
  },
  "dependencies": {
    "express": "^4.21.2"
  },
  "devDependencies": {
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: 写失败测试 `hub/server/paths.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { repoRoot, isInsideRepo, resolveInRepo } from './paths.js';
import path from 'node:path';

describe('paths', () => {
  it('repoRoot 指向包含 agents 目录的仓库根', () => {
    const root = repoRoot();
    expect(path.isAbsolute(root)).toBe(true);
    expect(root.endsWith('SIRIUS-ATEAM')).toBe(true);
  });

  it('isInsideRepo 对仓库内路径返回 true', () => {
    expect(isInsideRepo(path.join(repoRoot(), 'agents/motionlab'))).toBe(true);
  });

  it('isInsideRepo 对越界路径返回 false', () => {
    expect(isInsideRepo('/etc/passwd')).toBe(false);
    expect(isInsideRepo(path.join(repoRoot(), '../elsewhere'))).toBe(false);
  });

  it('resolveInRepo 对越界相对路径抛错', () => {
    expect(() => resolveInRepo('../../etc')).toThrow();
  });

  it('resolveInRepo 对正常相对路径返回绝对路径', () => {
    expect(resolveInRepo('agents/motionlab')).toBe(path.join(repoRoot(), 'agents/motionlab'));
  });
});
```

- [ ] **Step 3: 运行测试确认失败**

Run: `cd hub && npm install && npx vitest run server/paths.test.js`
Expected: FAIL（`paths.js` 不存在 / 导出未定义）

- [ ] **Step 4: 写最小实现 `hub/server/paths.js`**

```js
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

export function repoRoot() {
  return ROOT;
}

export function isInsideRepo(absPath) {
  const resolved = path.resolve(absPath);
  const rel = path.relative(ROOT, resolved);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

export function resolveInRepo(relPath) {
  const resolved = path.resolve(ROOT, relPath);
  if (!isInsideRepo(resolved)) {
    throw new Error(`路径越界，拒绝：${relPath}`);
  }
  return resolved;
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd hub && npx vitest run server/paths.test.js`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add hub/package.json hub/package-lock.json hub/server/paths.js hub/server/paths.test.js
git commit -m "feat(hub): 骨架 + 仓库根定位与越界校验"
```

---

### Task 2: 能力发现（discover）

**Files:**
- Create: `hub/server/discover.js`
- Test: `hub/server/discover.test.js`
- Create (fixtures): `hub/server/__fixtures__/agents/good-server/config.json`
- Create (fixtures): `hub/server/__fixtures__/agents/good-interactive/config.json`
- Create (fixtures): `hub/server/__fixtures__/agents/plain-doc/config.json`
- Create (fixtures): `hub/server/__fixtures__/agents/broken/config.json`

**Interfaces:**
- Consumes: `resolveInRepo` from Task 1。
- Produces: `discoverCapabilities(scanRoots)` → `{ capabilities: Capability[], warnings: string[] }`。
  - `scanRoots`：string[]，相对仓库根的目录（如 `['agents']`）；缺省 `['agents']`。
  - `Capability`：`{ id, name, description, role, dir, launch }`，其中 `launch = { type: 'server'|'interactive'|'doc', cmd?, command?, cwd, port?, openUrl?, docs: string[] }`。
  - 归一化规则：无 `launch` 段 → `type:'doc'`；`cwd` 缺省为 config.json 所在目录（相对仓库根）；`server` 型 `openUrl` 缺省 `http://localhost:<port>`；`doc` 型 `docs` 缺省 `['README.md']`；`id` = 目录名。
  - 损坏/缺 `name` 的 config → 跳过并追加一条 `warnings`。

- [ ] **Step 1: 写夹具文件**

`hub/server/__fixtures__/agents/good-server/config.json`:
```json
{
  "name": "Good Server",
  "role": "specialist",
  "description": "一个服务型能力",
  "launch": { "type": "server", "cmd": "npm run server", "port": 4321 }
}
```

`hub/server/__fixtures__/agents/good-interactive/config.json`:
```json
{
  "name": "Good Interactive",
  "role": "specialist",
  "description": "一个交互型能力",
  "launch": { "type": "interactive", "command": "run.command" }
}
```

`hub/server/__fixtures__/agents/plain-doc/config.json`:
```json
{ "name": "Plain Doc", "role": "specialist", "description": "无 launch 段" }
```

`hub/server/__fixtures__/agents/broken/config.json`:
```
{ not valid json
```

- [ ] **Step 2: 写失败测试 `hub/server/discover.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { discoverCapabilities } from './discover.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturesAgents = path.relative(
  path.resolve(here, '../..'),
  path.join(here, '__fixtures__/agents')
);

describe('discoverCapabilities', () => {
  it('发现三个有效能力并给出一条损坏告警', () => {
    const { capabilities, warnings } = discoverCapabilities([fixturesAgents]);
    const ids = capabilities.map(c => c.id).sort();
    expect(ids).toEqual(['good-interactive', 'good-server', 'plain-doc']);
    expect(warnings.some(w => w.includes('broken'))).toBe(true);
  });

  it('无 launch 段归为 doc 型且 docs 缺省 README.md', () => {
    const { capabilities } = discoverCapabilities([fixturesAgents]);
    const doc = capabilities.find(c => c.id === 'plain-doc');
    expect(doc.launch.type).toBe('doc');
    expect(doc.launch.docs).toEqual(['README.md']);
  });

  it('server 型 openUrl 缺省由 port 推导', () => {
    const { capabilities } = discoverCapabilities([fixturesAgents]);
    const s = capabilities.find(c => c.id === 'good-server');
    expect(s.launch.openUrl).toBe('http://localhost:4321');
    expect(s.launch.cwd).toBe(path.join(fixturesAgents, 'good-server'));
  });
});
```

- [ ] **Step 3: 运行测试确认失败**

Run: `cd hub && npx vitest run server/discover.test.js`
Expected: FAIL（`discover.js` 不存在）

- [ ] **Step 4: 写最小实现 `hub/server/discover.js`**

```js
import fs from 'node:fs';
import path from 'node:path';
import { repoRoot } from './paths.js';

export function discoverCapabilities(scanRoots = ['agents']) {
  const root = repoRoot();
  const capabilities = [];
  const warnings = [];

  for (const scanRel of scanRoots) {
    const scanAbs = path.join(root, scanRel);
    if (!fs.existsSync(scanAbs)) continue;

    for (const entry of fs.readdirSync(scanAbs, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const dirRel = path.join(scanRel, entry.name);
      const cfgPath = path.join(scanAbs, entry.name, 'config.json');
      if (!fs.existsSync(cfgPath)) continue;

      let cfg;
      try {
        cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      } catch {
        warnings.push(`跳过 ${dirRel}：config.json 不是有效 JSON`);
        continue;
      }
      if (!cfg.name) {
        warnings.push(`跳过 ${dirRel}：config.json 缺 name`);
        continue;
      }

      capabilities.push(normalize(entry.name, dirRel, cfg));
    }
  }
  return { capabilities, warnings };
}

function normalize(id, dirRel, cfg) {
  const raw = cfg.launch || {};
  const type = raw.type || 'doc';
  const cwd = raw.cwd || dirRel;
  const launch = { type, cwd, docs: raw.docs || ['README.md'] };

  if (type === 'server') {
    launch.cmd = raw.cmd;
    launch.port = raw.port;
    launch.openUrl = raw.openUrl || (raw.port ? `http://localhost:${raw.port}` : undefined);
  } else if (type === 'interactive') {
    launch.command = raw.command;
  }

  return {
    id,
    name: cfg.name,
    description: cfg.description || '',
    role: cfg.role || '',
    dir: dirRel,
    launch,
  };
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd hub && npx vitest run server/discover.test.js`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add hub/server/discover.js hub/server/discover.test.js hub/server/__fixtures__
git commit -m "feat(hub): 清单驱动的能力发现与归一化"
```

---

### Task 3: 日志环形缓冲

**Files:**
- Create: `hub/server/log-buffer.js`
- Test: `hub/server/log-buffer.test.js`

**Interfaces:**
- Produces: `createLogBuffer(maxLines = 200)` → `{ push(line), lines() }`。`push` 超过上限时丢弃最旧行；`lines()` 返回当前数组副本。

- [ ] **Step 1: 写失败测试 `hub/server/log-buffer.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { createLogBuffer } from './log-buffer.js';

describe('createLogBuffer', () => {
  it('保留最近 N 行，丢弃最旧的', () => {
    const buf = createLogBuffer(3);
    buf.push('a'); buf.push('b'); buf.push('c'); buf.push('d');
    expect(buf.lines()).toEqual(['b', 'c', 'd']);
  });

  it('lines() 返回副本，外部修改不影响内部', () => {
    const buf = createLogBuffer(5);
    buf.push('x');
    const snap = buf.lines();
    snap.push('y');
    expect(buf.lines()).toEqual(['x']);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd hub && npx vitest run server/log-buffer.test.js`
Expected: FAIL

- [ ] **Step 3: 写最小实现 `hub/server/log-buffer.js`**

```js
export function createLogBuffer(maxLines = 200) {
  const lines = [];
  return {
    push(line) {
      lines.push(line);
      while (lines.length > maxLines) lines.shift();
    },
    lines() {
      return [...lines];
    },
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd hub && npx vitest run server/log-buffer.test.js`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add hub/server/log-buffer.js hub/server/log-buffer.test.js
git commit -m "feat(hub): 进程日志环形缓冲"
```

---

### Task 4: server 型进程管理（process-manager）

**Files:**
- Create: `hub/server/process-manager.js`
- Test: `hub/server/process-manager.test.js`
- Create (fixture): `hub/server/__fixtures__/scripts/tick.js`
- Create (fixture): `hub/server/__fixtures__/scripts/die.js`

**Interfaces:**
- Consumes: `createLogBuffer` from Task 3；`resolveInRepo` from Task 1。
- Produces: `createProcessManager()` → 对象：
  - `start(cap)` → Promise<`{ ok: boolean, error?: string }`>。`cap` 为 server 型 Capability。spawn `cap.launch.cmd`（经 shell）于 `resolveInRepo(cap.launch.cwd)`，记录 PID 与起始时间，stdout/stderr 并入日志缓冲。spawn 后等 400ms，若进程已退出则 `ok:false` 且 error 含退出码。
  - `stop(id)` → `{ ok: true }`。kill 已记录进程；对未知/已停止 id 幂等返回成功。
  - `status(id)` → `{ running: boolean, pid?: number, startedAt?: number }`。以本管理器是否持有存活子进程为准（不以端口探活为准）。
  - `logs(id)` → string[]。

- [ ] **Step 1: 写夹具脚本**

`hub/server/__fixtures__/scripts/tick.js`:
```js
setInterval(() => console.log('tick', Date.now()), 50);
```

`hub/server/__fixtures__/scripts/die.js`:
```js
console.error('boom');
process.exit(2);
```

- [ ] **Step 2: 写失败测试 `hub/server/process-manager.test.js`**

```js
import { describe, it, expect, afterEach } from 'vitest';
import { createProcessManager } from './process-manager.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const scriptsRel = path.relative(path.resolve(here, '../..'), path.join(here, '__fixtures__/scripts'));

function cap(id, script) {
  return { id, name: id, launch: { type: 'server', cmd: `node ${script}`, cwd: scriptsRel } };
}

let pm;
afterEach(() => { if (pm) pm.stop('ticker'); });

describe('process-manager', () => {
  it('启动常驻进程后 status.running 为 true，日志有输出', async () => {
    pm = createProcessManager();
    const r = await pm.start(cap('ticker', 'tick.js'));
    expect(r.ok).toBe(true);
    expect(pm.status('ticker').running).toBe(true);
    await new Promise(res => setTimeout(res, 150));
    expect(pm.logs('ticker').some(l => l.includes('tick'))).toBe(true);
  });

  it('瞬间退出的进程返回 ok:false 且带退出码与日志', async () => {
    pm = createProcessManager();
    const r = await pm.start(cap('dier', 'die.js'));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/2/);
    expect(pm.logs('dier').some(l => l.includes('boom'))).toBe(true);
  });

  it('stop 后 running 为 false，重复 stop 幂等', async () => {
    pm = createProcessManager();
    await pm.start(cap('ticker', 'tick.js'));
    pm.stop('ticker');
    expect(pm.status('ticker').running).toBe(false);
    expect(pm.stop('ticker')).toEqual({ ok: true });
  });

  it('stop 未知 id 幂等成功', () => {
    pm = createProcessManager();
    expect(pm.stop('nope')).toEqual({ ok: true });
  });
});
```

- [ ] **Step 3: 运行测试确认失败**

Run: `cd hub && npx vitest run server/process-manager.test.js`
Expected: FAIL

- [ ] **Step 4: 写最小实现 `hub/server/process-manager.js`**

```js
import { spawn } from 'node:child_process';
import { createLogBuffer } from './log-buffer.js';
import { resolveInRepo } from './paths.js';

export function createProcessManager() {
  const procs = new Map(); // id -> { child, pid, startedAt, buf, exited, exitCode }

  function start(cap) {
    return new Promise((resolve) => {
      const existing = procs.get(cap.id);
      if (existing && !existing.exited) {
        return resolve({ ok: true });
      }
      const cwd = resolveInRepo(cap.launch.cwd);
      const buf = createLogBuffer();
      const child = spawn(cap.launch.cmd, { cwd, shell: true });
      const rec = { child, pid: child.pid, startedAt: Date.now(), buf, exited: false, exitCode: null };
      procs.set(cap.id, rec);

      child.stdout.on('data', d => String(d).split('\n').filter(Boolean).forEach(l => buf.push(l)));
      child.stderr.on('data', d => String(d).split('\n').filter(Boolean).forEach(l => buf.push(l)));
      child.on('exit', code => { rec.exited = true; rec.exitCode = code; });

      setTimeout(() => {
        if (rec.exited) {
          resolve({ ok: false, error: `进程启动后立即退出（退出码 ${rec.exitCode}），请查看日志` });
        } else {
          resolve({ ok: true });
        }
      }, 400);
    });
  }

  function stop(id) {
    const rec = procs.get(id);
    if (rec && !rec.exited) {
      try { rec.child.kill('SIGTERM'); } catch { /* 已退出 */ }
      rec.exited = true;
    }
    return { ok: true };
  }

  function status(id) {
    const rec = procs.get(id);
    if (!rec || rec.exited) return { running: false };
    return { running: true, pid: rec.pid, startedAt: rec.startedAt };
  }

  function logs(id) {
    const rec = procs.get(id);
    return rec ? rec.buf.lines() : [];
  }

  return { start, stop, status, logs };
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd hub && npx vitest run server/process-manager.test.js`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add hub/server/process-manager.js hub/server/process-manager.test.js hub/server/__fixtures__/scripts
git commit -m "feat(hub): server 型进程管理（起停/状态/日志/瞬退捕获）"
```

---

### Task 5: HTTP API（index.js）

**Files:**
- Create: `hub/server/index.js`
- Create: `hub/server/app.js`
- Test: `hub/server/app.test.js`

**Interfaces:**
- Consumes: `discoverCapabilities` (Task 2)、`createProcessManager` (Task 4)、`launchNonServer` (Task 6，先以占位注入)。
- Produces: `createApp({ scanRoots, processManager, launcher })` → Express app（不自动 listen，便于测试）。`index.js` 负责 `createApp(...).listen(7777, '127.0.0.1')` 并打开浏览器。
  - `GET /api/capabilities` → `{ capabilities: [...], warnings: [...] }`，每个 server 型附 `status`。
  - `POST /api/launch/:id` → 按 type 分派；未知 id → 404。
  - `POST /api/stop/:id` → server 型停止；未知 id → 404。
  - `GET /api/logs/:id` → `{ lines: [...] }`；未知 id → 404。

- [ ] **Step 1: 写失败测试 `hub/server/app.test.js`**

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from './app.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturesAgents = path.relative(path.resolve(here, '../..'), path.join(here, '__fixtures__/agents'));

function fakePM() {
  return {
    start: async () => ({ ok: true }),
    stop: () => ({ ok: true }),
    status: () => ({ running: false }),
    logs: () => ['line1'],
  };
}
function fakeLauncher() {
  return { launchNonServer: async () => ({ ok: true, mode: 'doc' }) };
}

async function req(app, method, url) {
  const { default: supertest } = await import('supertest');
  return supertest(app)[method.toLowerCase()](url);
}

describe('hub API', () => {
  let app;
  beforeEach(() => {
    app = createApp({ scanRoots: [fixturesAgents], processManager: fakePM(), launcher: fakeLauncher() });
  });

  it('GET /api/capabilities 返回能力列表', async () => {
    const res = await req(app, 'GET', '/api/capabilities');
    expect(res.status).toBe(200);
    expect(res.body.capabilities.map(c => c.id)).toContain('good-server');
  });

  it('POST /api/launch/未知id → 404', async () => {
    const res = await req(app, 'POST', '/api/launch/does-not-exist');
    expect(res.status).toBe(404);
  });

  it('POST /api/launch/../secretary 这类构造路径 → 404', async () => {
    const res = await req(app, 'POST', '/api/launch/%2E%2E%2Fsecretary');
    expect(res.status).toBe(404);
  });

  it('GET /api/logs/good-server 返回行', async () => {
    const res = await req(app, 'GET', '/api/logs/good-server');
    expect(res.status).toBe(200);
    expect(res.body.lines).toEqual(['line1']);
  });
});
```

- [ ] **Step 2: 装 supertest 并运行测试确认失败**

Run: `cd hub && npm install -D supertest@^7.0.0 && npx vitest run server/app.test.js`
Expected: FAIL（`app.js` 不存在）

- [ ] **Step 3: 写最小实现 `hub/server/app.js`**

```js
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverCapabilities } from './discover.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export function createApp({ scanRoots = ['agents'], processManager, launcher }) {
  const app = express();
  app.use(express.json());

  function load() {
    return discoverCapabilities(scanRoots);
  }
  function findCap(id) {
    return load().capabilities.find(c => c.id === id);
  }

  app.get('/api/capabilities', (req, res) => {
    const { capabilities, warnings } = load();
    const withStatus = capabilities.map(c =>
      c.launch.type === 'server' ? { ...c, status: processManager.status(c.id) } : c
    );
    res.json({ capabilities: withStatus, warnings });
  });

  app.post('/api/launch/:id', async (req, res) => {
    const cap = findCap(req.params.id);
    if (!cap) return res.status(404).json({ error: '未知能力' });
    if (cap.launch.type === 'server') {
      const r = await processManager.start(cap);
      return res.status(r.ok ? 200 : 500).json(r);
    }
    const r = await launcher.launchNonServer(cap);
    return res.status(r.ok ? 200 : 500).json(r);
  });

  app.post('/api/stop/:id', (req, res) => {
    const cap = findCap(req.params.id);
    if (!cap) return res.status(404).json({ error: '未知能力' });
    res.json(processManager.stop(cap.id));
  });

  app.get('/api/logs/:id', (req, res) => {
    const cap = findCap(req.params.id);
    if (!cap) return res.status(404).json({ error: '未知能力' });
    res.json({ lines: processManager.logs(cap.id) });
  });

  app.use(express.static(path.join(here, '../web')));
  return app;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd hub && npx vitest run server/app.test.js`
Expected: PASS

- [ ] **Step 5: 写 `hub/server/index.js`（入口，不被测试直接覆盖）**

```js
import { exec } from 'node:child_process';
import { createApp } from './app.js';
import { createProcessManager } from './process-manager.js';
import { createLauncher } from './launcher.js';

const PORT = 7777;
const app = createApp({
  scanRoots: ['agents'],
  processManager: createProcessManager(),
  launcher: createLauncher(),
});

app.listen(PORT, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${PORT}`;
  console.log(`Playground Hub 已启动：${url}`);
  if (process.platform === 'darwin') exec(`open ${url}`);
});
```

注：`index.js` 依赖 Task 6 的 `createLauncher`。实现 Task 6 后此文件即可运行；在此之前先建文件、内容如上。

- [ ] **Step 6: 提交**

```bash
git add hub/server/app.js hub/server/app.test.js hub/server/index.js hub/package.json hub/package-lock.json
git commit -m "feat(hub): HTTP API（capabilities/launch/stop/logs + id 白名单）"
```

---

### Task 6: 非 server 型启动器（launcher）

**Files:**
- Create: `hub/server/launcher.js`
- Test: `hub/server/launcher.test.js`

**Interfaces:**
- Consumes: `resolveInRepo` from Task 1。
- Produces: `createLauncher({ platform = process.platform, run = defaultRun } = {})` → `{ launchNonServer(cap) }`。
  - `interactive` 型：macOS 下用 `osascript` 让 Terminal 打开并 `cd` 到 cwd、运行 `cap.launch.command`，返回 `{ ok:true, mode:'terminal' }`；非 macOS 返回 `{ ok:true, mode:'copy', hint: 'cd <cwd> && ./<command>' }`。
  - `doc` 型：`open` cwd 目录（macOS），返回 `{ ok:true, mode:'open' }`；非 macOS 返回 `{ ok:true, mode:'path', path: <cwd> }`。
  - `run` 为命令执行注入点（测试时替换为假函数，断言被调命令而不真的开窗）。

- [ ] **Step 1: 写失败测试 `hub/server/launcher.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { createLauncher } from './launcher.js';

function cap(type, extra = {}) {
  return { id: 't', name: 't', launch: { type, cwd: 'agents/motionlab', ...extra } };
}

describe('launcher', () => {
  it('macOS interactive 走 osascript 开终端', async () => {
    const calls = [];
    const l = createLauncher({ platform: 'darwin', run: (c) => { calls.push(c); } });
    const r = await l.launchNonServer(cap('interactive', { command: 'poster.command' }));
    expect(r.mode).toBe('terminal');
    expect(calls[0]).toMatch(/osascript/);
    expect(calls[0]).toMatch(/poster\.command/);
  });

  it('非 macOS interactive 降级为复制命令提示', async () => {
    const l = createLauncher({ platform: 'linux', run: () => {} });
    const r = await l.launchNonServer(cap('interactive', { command: 'poster.command' }));
    expect(r.mode).toBe('copy');
    expect(r.hint).toMatch(/poster\.command/);
  });

  it('macOS doc 走 open 目录', async () => {
    const calls = [];
    const l = createLauncher({ platform: 'darwin', run: (c) => { calls.push(c); } });
    const r = await l.launchNonServer(cap('doc'));
    expect(r.mode).toBe('open');
    expect(calls[0]).toMatch(/^open /);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd hub && npx vitest run server/launcher.test.js`
Expected: FAIL

- [ ] **Step 3: 写最小实现 `hub/server/launcher.js`**

```js
import { exec } from 'node:child_process';
import { resolveInRepo } from './paths.js';

function defaultRun(cmd) {
  exec(cmd);
}

export function createLauncher({ platform = process.platform, run = defaultRun } = {}) {
  async function launchNonServer(cap) {
    const cwd = resolveInRepo(cap.launch.cwd);

    if (cap.launch.type === 'interactive') {
      const command = cap.launch.command;
      if (platform === 'darwin') {
        const script = `tell application "Terminal" to do script "cd ${quote(cwd)} && ./${command}"`;
        run(`osascript -e ${quote(script)}`);
        return { ok: true, mode: 'terminal' };
      }
      return { ok: true, mode: 'copy', hint: `cd ${cwd} && ./${command}` };
    }

    // doc 型
    if (platform === 'darwin') {
      run(`open ${quote(cwd)}`);
      return { ok: true, mode: 'open' };
    }
    return { ok: true, mode: 'path', path: cwd };
  }

  return { launchNonServer };
}

function quote(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd hub && npx vitest run server/launcher.test.js`
Expected: PASS

- [ ] **Step 5: 全量测试一次**

Run: `cd hub && npx vitest run`
Expected: 全部 PASS

- [ ] **Step 6: 提交**

```bash
git add hub/server/launcher.js hub/server/launcher.test.js
git commit -m "feat(hub): 非 server 型启动器（终端/打开目录/非 mac 降级）"
```

---

### Task 7: 前端中枢页

**Files:**
- Create: `hub/web/index.html`
- Create: `hub/web/style.css`
- Create: `hub/web/app.js`

**Interfaces:**
- Consumes: `GET /api/capabilities`、`POST /api/launch/:id`、`POST /api/stop/:id`、`GET /api/logs/:id`。
- 本任务为前端静态资源，无单元测试；验收在 Task 9 端到端完成。手动验收标准见各步。

- [ ] **Step 1: 写 `hub/web/index.html`**

```html
<!doctype html>
<html lang="zh">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Playground Hub</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <header><h1>Playground Hub</h1><p id="warnings"></p></header>
  <main id="grid"></main>
  <dialog id="logDialog">
    <h2 id="logTitle">日志</h2>
    <pre id="logBody"></pre>
    <button id="logClose">关闭</button>
  </dialog>
  <script src="app.js" type="module"></script>
</body>
</html>
```

- [ ] **Step 2: 写 `hub/web/style.css`（像素风，延续根 index.html 气质）**

```css
:root { --bg:#1a1a2e; --card:#16213e; --ink:#e8e8e8; --accent:#4ade80; --stop:#f87171; --muted:#8aa; }
* { box-sizing:border-box; }
body { margin:0; background:var(--bg); color:var(--ink); font-family:ui-monospace,Menlo,monospace; }
header { padding:24px; }
h1 { margin:0; letter-spacing:2px; }
#warnings { color:#fbbf24; white-space:pre-wrap; font-size:12px; }
#grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:16px; padding:0 24px 24px; }
.card { background:var(--card); border:2px solid #0f3460; border-radius:8px; padding:16px; }
.card h3 { margin:0 0 6px; }
.role { font-size:11px; color:var(--muted); text-transform:uppercase; }
.desc { font-size:13px; color:#cbd; min-height:34px; }
.badge { display:inline-block; font-size:11px; padding:2px 8px; border-radius:10px; margin-bottom:8px; }
.badge.server{background:#0e4429;color:var(--accent);} .badge.interactive{background:#3b2f0e;color:#fbbf24;} .badge.doc{background:#1e293b;color:#93c5fd;}
.dot { width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:6px; }
.dot.on{background:var(--accent);} .dot.off{background:#555;}
button { font-family:inherit; cursor:pointer; border:none; border-radius:6px; padding:6px 12px; margin:4px 4px 0 0; background:#0f3460; color:var(--ink); }
button.stop{background:var(--stop);color:#111;}
dialog{background:var(--card);color:var(--ink);border:2px solid #0f3460;border-radius:8px;max-width:80vw;}
pre{max-height:50vh;overflow:auto;background:#0b1020;padding:12px;border-radius:6px;}
```

- [ ] **Step 3: 写 `hub/web/app.js`**

```js
const grid = document.getElementById('grid');
const warnings = document.getElementById('warnings');
const logDialog = document.getElementById('logDialog');
const logTitle = document.getElementById('logTitle');
const logBody = document.getElementById('logBody');
document.getElementById('logClose').onclick = () => logDialog.close();

async function load() {
  const res = await fetch('/api/capabilities');
  const { capabilities, warnings: w } = await res.json();
  warnings.textContent = (w && w.length) ? '⚠ ' + w.join('\n⚠ ') : '';
  render(capabilities);
}

function render(caps) {
  grid.innerHTML = '';
  for (const c of caps) grid.appendChild(cardOf(c));
}

function cardOf(c) {
  const el = document.createElement('div');
  el.className = 'card';
  const t = c.launch.type;
  const running = c.status && c.status.running;
  el.innerHTML = `
    <span class="badge ${t}">${t}</span>
    <h3>${c.name}</h3>
    <div class="role">${c.role || ''}</div>
    <div class="desc">${c.description || ''}</div>
    <div class="actions"></div>`;
  const actions = el.querySelector('.actions');

  if (t === 'server') {
    const dot = `<span class="dot ${running ? 'on' : 'off'}"></span>${running ? '运行中 :' + (c.launch.port ?? '') : '已停止'}`;
    const line = document.createElement('div'); line.innerHTML = dot; actions.appendChild(line);
    actions.appendChild(btn(running ? '停止' : '启动', running ? 'stop' : '', async () => {
      await fetch(`/api/${running ? 'stop' : 'launch'}/${c.id}`, { method: 'POST' });
      load();
    }));
    if (running && c.launch.openUrl) actions.appendChild(btn('打开', '', () => window.open(c.launch.openUrl, '_blank')));
    actions.appendChild(btn('日志', '', () => showLogs(c)));
  } else if (t === 'interactive') {
    actions.appendChild(btn('在终端运行', '', async () => {
      const r = await (await fetch(`/api/launch/${c.id}`, { method: 'POST' })).json();
      if (r.mode === 'copy') { await navigator.clipboard.writeText(r.hint); alert('已复制命令：\n' + r.hint); }
    }));
  } else {
    actions.appendChild(btn('打开目录', '', async () => {
      const r = await (await fetch(`/api/launch/${c.id}`, { method: 'POST' })).json();
      if (r.mode === 'path') alert('目录：' + r.path);
    }));
  }
  return el;
}

function btn(label, cls, onclick) {
  const b = document.createElement('button');
  b.textContent = label; if (cls) b.className = cls; b.onclick = onclick;
  return b;
}

async function showLogs(c) {
  logTitle.textContent = c.name + ' · 日志';
  const { lines } = await (await fetch(`/api/logs/${c.id}`)).json();
  logBody.textContent = (lines || []).join('\n') || '（暂无日志）';
  logDialog.showModal();
}

load();
setInterval(load, 3000);
```

- [ ] **Step 4: 手动验收（配合临时跑 server）**

Run: `cd hub && npm start`
Expected: 浏览器打开 `http://127.0.0.1:7777`，显示卡片网格（此时能力来自真实 `agents/`，多数为 doc 型，正常）。

- [ ] **Step 5: 提交**

```bash
git add hub/web/
git commit -m "feat(hub): 前端中枢页（卡片/状态灯/日志弹窗/轮询）"
```

---

### Task 8: 给 motionlab / posterdesigner 补 launch 段

**Files:**
- Modify: `agents/motionlab/config.json`
- Modify: `agents/posterdesigner/config.json`

**Interfaces:**
- 为真实能力补 §3 规定的 `launch` 段，使中枢能真正起它们。

- [ ] **Step 1: 读两个 config 确认结构**

Run: 读 `agents/motionlab/config.json`、`agents/posterdesigner/config.json`

- [ ] **Step 2: 给 motionlab 加 launch 段**

在 `agents/motionlab/config.json` 顶层对象加入：
```json
"launch": {
  "type": "server",
  "cmd": "npm run server",
  "cwd": "agents/motionlab",
  "port": 4321
}
```

- [ ] **Step 3: 给 posterdesigner 加 launch 段**

在 `agents/posterdesigner/config.json` 顶层对象加入：
```json
"launch": {
  "type": "interactive",
  "command": "poster.command",
  "cwd": "agents/posterdesigner"
}
```

- [ ] **Step 4: 校验 JSON 合法**

Run: `node -e "JSON.parse(require('fs').readFileSync('agents/motionlab/config.json','utf8')); JSON.parse(require('fs').readFileSync('agents/posterdesigner/config.json','utf8')); console.log('ok')"`
Expected: 输出 `ok`

- [ ] **Step 5: 提交**

```bash
git add agents/motionlab/config.json agents/posterdesigner/config.json
git commit -m "feat(hub): motionlab/posterdesigner 补 launch 清单"
```

---

### Task 9: hub.command 入口 + 端到端验证

**Files:**
- Create: `hub.command`
- Create: `hub/README.md`

**Interfaces:**
- 双击 `hub.command` → 装依赖（首次）→ `npm start` → 浏览器打开中枢。

- [ ] **Step 1: 写 `hub.command`**

```bash
#!/bin/bash
# Playground Hub · 本地启动中枢
# 双击本文件 → 起中枢服务并自动打开浏览器。关掉本窗口即停止中枢。
cd "$(dirname "$0")/hub" || exit 1
echo "──────────────────────────────────"
echo "  Playground Hub 启动中…"
echo "──────────────────────────────────"
if [ ! -d node_modules/express ]; then
  echo "首次启动，安装依赖…"
  npm install || { echo "依赖安装失败"; read -r -p "按回车关闭…" _; exit 1; }
fi
npm start
```

- [ ] **Step 2: 赋可执行权限**

Run: `chmod +x hub.command`

- [ ] **Step 3: 写 `hub/README.md`**

内容涵盖：用途、双击 `hub.command` 启动、三种能力形态说明、如何给新能力补 `launch` 段（给出 server/interactive/doc 三个示例片段）、安全边界（仅本地）。

- [ ] **Step 4: 端到端验证**

Run: `bash hub.command`（或双击）
Expected 清单：
1. 浏览器打开中枢页，卡片含 motionlab(server) / posterdesigner(interactive) / 其余(doc)。
2. 点 motionlab「启动」→ 状态灯转绿、显示 :4321；点「打开」→ 新标签打开 motionlab。
3. 点 motionlab「日志」→ 弹窗有输出。
4. 点 motionlab「停止」→ 状态灯转灰。
5. 点 posterdesigner「在终端运行」→ 新终端窗口打开并进入该目录运行 poster.command。
6. 点某 doc 能力「打开目录」→ Finder 打开对应目录。

- [ ] **Step 5: 提交**

```bash
git add hub.command hub/README.md
git commit -m "feat(hub): hub.command 入口与使用文档"
```

- [ ] **Step 6: 更新根 INDEX.md / README 增加 hub 指引（可选，若时间允许）**

在根 `INDEX.md` 增加一行指向 `hub/`，说明"本地启动中枢，双击 hub.command"。

```bash
git add INDEX.md
git commit -m "docs: INDEX 增加 Playground Hub 指引"
```
