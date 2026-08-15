# 多设备用量数据同步（方案 C）

> 一句话：每台设备只把自己的用量数据推到自己专属分支，GitHub Actions 汇总所有分支后推飞书。配置文件完全不碰。

日期：2026-08-15

---

## 一、问题

目标是让日报汇总多台设备、多个项目的 Claude Code 用量。当前每天 18:00 的汇总任务稳定输出「没有找到数据」，一天都没成功过。

三个原因，逐层叠加：

**1. 数据写错了地方。** 本机 `extract-session-data.py` 是单设备旧版（3 月 5 日），写到平铺目录 `usage-data/daily-insights/`。汇总脚本 `merge-daily-insights.py` 读的是 `usage-data/devices/<设备ID>/daily-insights/`。后者在本机和远端都不存在。

**2. 数据字段不全。** 本机 `save-daily-insights.py` 产出的 `stats` 只有 `total_sessions` 和 `top_tools`，缺 `total_input_tokens`、`total_output_tokens`、`total_duration_minutes`。汇总脚本要读这三个来算 token 和成本，缺了就显示 0。

**3. 数据推不出去。** `auto-sync.sh` 执行 `git add -A` → `commit` → `push`，没有 `pull`。远端被另一台设备推进新提交后，push 永久失败。自 2026-08-10 起日志全是 `! [rejected] main -> main (fetch first)`。本机现已超前 105 个提交、落后 642 个。

## 二、现状事实

两台设备共用 `claude-config` 私有仓库：

| | 这台 | 另一台 |
|---|---|---|
| 用户名 | `Administrator` | `ppio-dn-275` |
| `CLAUDE.md` | 238 行（Tailwind 映射、设计系统规范、称呼规范、GitHub Actions 铁律） | 33 行（Astra 框架、角色机制） |
| 项目数 | SIRIUS-ATEAM 等 | SIRIUS、claude、jiekou、novita、ppinfra、ppio 共 6 个 |

分叉点 2026-03-24。404 个文件双方都改过，但按类型拆分后，**真正的配置冲突只有 `CLAUDE.md` 一个**：

| 数量 | 类型 | 真冲突 |
|---|---|---|
| 205 | 会话记录 `projects/` | 否，路径按设备天然分开 |
| 186 | 用量数据 `usage-data/` | 否，生成物 |
| 8 | 日志 `logs/` | 否，追加型 |
| 1 | `CLAUDE.md` | **是，两边内容互斥** |
| 3 | `history.jsonl`、`plans/`、`sessions/*.json` | 状态文件，可弃 |

远端 `CLAUDE.md` 引用 `/Users/ppio-dn-275/Desktop/astra/` 等本机不存在的路径。所以 `git pull` 或 `reset --hard origin/main` 会用一份指向无效路径的配置覆盖本机 238 行规范。**不能简单合并 main。**

## 三、设计

### 核心：每设备一个分支

```
claude-config
├── main                    ← 配置与能力，本方案完全不碰
├── device/administrator    ← 仅 usage-data/devices/administrator/
└── device/ppio-dn-275      ← 仅 usage-data/devices/ppio-dn-275/
```

选这个结构的理由：

- 每台设备只写自己的分支，物理上不可能与其他设备冲突
- `main` 不参与，现有 105/642 分叉**绕开而非解决**
- 符合既有文档 `docs/cross-device-sync.md` 的保守原则

### 与「推送手动」铁律的关系

`docs/cross-device-sync.md` 定的四条契约是：后台运行、只快进、脏树跳过、只 pull 不 push，写入必须人工确认。

本方案对用量数据自动推送，是刻意的例外，依据是两类数据风险不同：

| | 能力（脚本/技能/角色） | 用量数据 |
|---|---|---|
| 性质 | 人工编写，有语义 | 机器生成，追加型 |
| 冲突可能 | 高，同一文件多处改 | 无，按设备+日期分文件 |
| 误覆盖后果 | 丢失共享成果 | 可重新生成 |

约束：推送脚本**只允许** `git add usage-data/devices/<自己的ID>/`，不得使用 `git add -A`，不得触碰其他路径。

### 数据流

```
会话结束（Stop hook）
  └── extract-session-data.py（升级为多设备版）
        └── 写入 usage-data/devices/<DEVICE_ID>/daily-insights/<日期>.json

每天 22:00（crontab）
  └── push-usage-data.sh（新建）
        └── 只提交 usage-data/devices/<DEVICE_ID>/ → push 到 device/<DEVICE_ID>

每天 18:00（GitHub Actions secretary-daily.yml）
  └── 抓取所有 device/* 分支 → merge-daily-insights.py → 飞书汇总日报
```

## 四、改动清单

| # | 动作 | 文件 | 风险 |
|---|---|---|---|
| 1 | 用远端多设备版替换本机旧版收集脚本 | `~/.claude/scripts/extract-session-data.py` | 低。旧版先备份 |
| 2 | 设定本机 DEVICE_ID 为 `administrator` | 推送脚本内声明 | 低 |
| 3 | 新建只推用量数据的脚本 | `~/.claude/scripts/push-usage-data.sh`（新） | 低。只碰一个目录 |
| 4 | crontab 与 Stop hook 中的 `auto-sync.sh` 换为新脚本 | `crontab`、`~/.claude/settings.json` | 中。见下方说明 |
| 5 | workflow 改为抓取所有 `device/*` 分支 | `.github/workflows/secretary-daily.yml` | 低。走 PR 流程 |
| 6 | 本地 18:00 launchd 任务去掉飞书推送与 `/insights` 调用 | `com.claude.insight-feishu` | 低。见下方说明 |

### 第 4 步的影响

`auto-sync.sh` 同时挂在 crontab（22:00）和 Stop hook 上。它的 push 早已失效，但仍在本地累积提交（105 个，含会话记录与配置变更）。

换掉之后：`~/.claude` 的配置变更不再自动备份到远端。这符合 `cross-device-sync.md` 的「推送手动」原则，但需明确——配置备份此后需手动触发，或另建一个符合四条契约的版本。

本地那 105 个提交保留不动，不删除。

### 第 6 步的影响

本地 launchd 任务 `com.claude.insight-feishu` 每天 18:00 推一张「Claude Code 日报」卡片，与将要生效的汇总日报重复。同时它内部执行 `claude -p "/insights"`，每天产生一次真实 API 调用开销。

处理方式：去掉飞书推送与 `/insights` 调用，保留报告页生成与归档（`/report` 仍可用）。数据收集改由 Stop hook 的 `extract-session-data.py` 负责，该脚本只读本地会话文件，不产生 API 开销。

## 五、明确不做

- 不修改 `CLAUDE.md`，两台设备各自保留
- 不解决 `main` 的 105/642 分叉
- 不触碰 `skills/`、`agents/`、`plugins/`
- 不删除本地已有的 105 个提交
- 不改另一台设备（`ppio-dn-275`），由用户后续照此文档操作

## 六、验证方式

1. 手动执行升级后的 `extract-session-data.py`，确认生成 `usage-data/devices/administrator/daily-insights/<今日>.json`
2. 检查该文件 `stats` 含 `total_input_tokens`、`total_output_tokens`、`total_duration_minutes`、`top_tools`
3. 手动执行 `push-usage-data.sh`，确认 `device/administrator` 分支创建成功且**仅**包含 `usage-data/devices/administrator/` 下的文件
4. 用 `workflow_dispatch` 手动触发 `secretary-daily.yml`，确认日志不再输出「没有找到数据」，飞书收到含设备明细的卡片
5. 确认 `main` 分支未被本次操作改动

## 七、已知限制

- 另一台设备未接入前，日报只显示一台设备的数据。仍优于当前的「没有找到数据」
- 另一台设备的实际状态无法从本机验证，可能已装或未装收集脚本
- 汇总脚本按 Claude Opus 单价估算成本（输入 $15/M、输出 $75/M），若实际用了其他模型，成本为高估
