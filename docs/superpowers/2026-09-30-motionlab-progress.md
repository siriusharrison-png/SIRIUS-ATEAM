# MotionLab 进度报告（恢复用 · 读这份就能接上）

- **日期**：2026-09-30
- **分支**：`worktree-motionlab`（隔离 worktree，**未合并回 main**）
- **worktree 路径**：`/Users/ppio-dn-275/Desktop/SIRIUS-ATEAM/.claude/worktrees/motionlab`
- **代码根**：`agents/motionlab/`
- **执行方式**：Native inline（superpowers:executing-plans）+ TDD，最后整分支复审
- **交付形态（已定）**：我收尾 + 打包成双击即用的本地工具（像 posterdesigner）

## 关键文档
- Spec：`docs/superpowers/specs/2026-09-30-motionlab-design.md`
- Plan（8 任务）：`docs/superpowers/plans/2026-09-30-motionlab.md`
- Ledger（进度台账 + rulings）：`.superpowers/sdd/2026-09-30-motionlab/progress.md`

---

## 一句话状态

**8 个任务完成 7 个。后端全通 + 前端验证通过，单元测试 17/17。只剩 Task 8（一键启动 + 真实 key 端到端）。**

---

## 任务进度

| # | 任务 | 状态 | commit | 验证 |
|---|------|------|--------|------|
| 1 | 骨架+config+Remotion 底座 | ✅ | 823a2b6..df3f9cc | remotion compositions 列出 Motion |
| 2 | LLM 客户端（两模型+usage） | ✅ | 01742bd | vitest 3/3 |
| 3 | 契约校验三道闸 | ✅ | c626e25 | vitest 7/7 + esbuild 探针 |
| 4 | Remotion 渲染封装+超时 | ✅ | dd6ddfd | vitest 2/2 |
| 5 | 成本估算+累计 | ✅ | 069d8b9 | vitest 3/3 |
| 6 | 编排+自愈循环+http 服务 | ✅ | cdefc57 | vitest 2/2 + /config 冒烟 |
| 7 | 前端工作台 | ✅ | 27f8e07 | Playwright 全项通过（见下） |
| 8 | 一键启动+真实端到端 | ⬜ 未做 | — | 需 API key + 官方原价 |

Task 7 Playwright 验证结果：页面加载✓/模型2项✓/参数面板 title+speed 自动生成✓/成本条¥0.0123✓/渲染按钮启用✓/越界 clamp speed=3✓/预览挂载✓/0 控制台错误。

---

## 重要 Rulings（偏离 plan 的决定，已记 ledger）

1. **环境变量对齐 posterdesigner**：用 `GATEWAY_API_KEY`/`GATEWAY_BASE_URL`（从 agent 目录 `.env` 读），替换 plan 里的 `MOTIONLAB_API_KEY`。原因：复用图片生成同一个 key。
2. **Task 3↔4 换序**：先做 Task 4（渲染）再 Task 3（契约），因为契约闸③依赖渲染。
3. **loadSchema 临时文件放 `AGENT_DIR/.tmp`**：放 /tmp 时 esbuild 解析不到项目 node_modules。
4. **Playwright 验证须 bypass 代理**：环境有 `http_proxy`，会拦本地请求致页面空白（**非代码 bug**）。测试用 `proxy:{server:'http://localhost:1',bypass:'localhost,127.0.0.1'}` + `domcontentloaded`。

---

## 架构速记（三层）

```
web/          前端单页：对话框 + 模型切换 + @remotion/player 预览 + 自动参数面板 + 成本条
  index.html, app.js, player-entry.jsx（被 esbuild 打成浏览器 IIFE）
server/       编排层（Node http）
  index.js       http 服务：GET /config、POST /generate、POST /render、GET /preview-bundle、静态托管 web/
  llm.js         callLLM / extractUsage（两模型统一）
  contract.js    stripFences / gateStatic / gateSchema / loadSchema(esbuild) / validateComponent（三道闸）
  render.js      withTimeout / renderStillFrame / renderVideo
  cost.js        estimateCost / addToTotal
  orchestrate.js generate（自愈循环，≤2 次重试）
  prompt.js      buildMessages（系统 prompt 写死契约要求）
remotion/     渲染引擎
  index.ts, Root.tsx, placeholder.tsx, generated/current.tsx（LLM 生成组件覆盖此文件）
config.json   models（含 discount，priceInPerM/priceOutPerM 占位0）+ render + gateway
output/       渲染出的 mp4（gitignore）
.cost.json    累计成本（gitignore）
```

数据流：描述 → /generate（LLM 写码→契约校验→自愈）→ current.tsx 落盘 → 前端 /preview-bundle 挂 Player 预览 → 调参数（不重调 LLM）→ /render 出 mp4。

---

## 剩余工作（Task 8，下次继续）

1. **写 `motionlab.command`**（双击启动脚本，参考 posterdesigner/workbench.command）：`cd` 到目录 → `node server/index.js` → 提示浏览器打开。
2. **需转转提供**（届时才需要）：
   - `GATEWAY_API_KEY`（复用 posterdesigner 的，填进 `agents/motionlab/.env`；已有 `.env.example`）
   - 两个模型**官方原价**（每百万 token 输入/输出），填进 `config.json` 的 `priceInPerM`/`priceOutPerM`，否则成本恒 ¥0
3. **真实端到端**：起服务 → 浏览器描述一个动态图形/文字动画 → 生成成功 → 预览能播 → 渲染出 mp4；覆盖 A/B/C 各一个典型（转转确认方向是 **A 动态图形/文字型**）。
4. **整分支复审**（executing-plans 的 Final Review）：`review-package` + 复审，修 Critical/Important。
5. **收尾**：删 workspace、finishing-a-development-branch、打包傻瓜使用说明。

## 下次如何接上
1. 进 worktree：`cd /Users/ppio-dn-275/Desktop/SIRIUS-ATEAM/.claude/worktrees/motionlab`（若 worktree 已清理则重新 EnterWorktree 或从分支 checkout）
2. 读 ledger `.superpowers/sdd/2026-09-30-motionlab/progress.md` 确认最后完成的 task
3. `cd agents/motionlab && npx vitest run` 应 17/17 通过
4. 从 Task 8 继续
