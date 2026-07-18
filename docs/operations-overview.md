# 运行总览

本文档用于管理 `SIRIUS-ATEAM` 当前保留的日报、推送与同步机制，并记录已归档或已删除项目的处理结果。

## 0. 全局说明

1. 本项目相关内容以中文为第一语言，英文为第二语言，韩语为第三语言。
2. 项目相关说明文档统一采用中英双语编写。
3. 在参与视觉设计的部分，可以引入 `Astra` 项目作为设计支持与规范参考。

## 1. 当前作用

这份文档是当前项目的运行控制图，用来快速判断：

- 哪些日报和推送机制仍然保留
- 哪些同步任务仍在运行
- 哪些项目可以继续保留、归档或删除
- 哪些设计相关工作可以借助 `Astra` 的规范和模板

## 2. 当前流程

```mermaid
flowchart TD
  A[GitHub Actions Scheduler] --> B[photographer daily]
  A --> C[secretary daily]
  A --> D[knowledge sync]

  B --> B1[agents/image-guardian/scripts/run-daily-cloud.py]
  B1 --> B2[FEISHU_WEBHOOK_PHOTOGRAPHER]

  C --> C1[/tmp/claude-config/scripts/merge-daily-insights.py]
  C1 --> C2[FEISHU_WEBHOOK_SECRETARY]

  D --> D1[sync-feishu-docs.py]
  D --> D2[sync-gitlab-workspace.py]
  D1 --> D3[Notion]
  D2 --> D3
  D3 --> C1

  E[api/push-feishu.js] --> F[secretary-report]
  E --> G[photographer-stats]
  E --> H[knowledge-weekly]
  E --> I[test]
```

## 3. 流程清单

| 流程 | 触发方式 | 主脚本 | 输出 | 状态 |
|---|---|---|---|---|
| 摄影师日报 | GitHub Actions `schedule` at `0 1 * * *` | `agents/image-guardian/scripts/run-daily-cloud.py` | 飞书 Webhook | 保留 |
| SIRIUS TEAM 工作日报 | GitHub Actions `schedule` at `3 10 * * *` | `/tmp/claude-config/scripts/merge-daily-insights.py` | 飞书 Webhook | 保留 |
| 知识管理飞书同步 | GitHub Actions `schedule` at `0 0 * * *` | `agents/knowledge-keeper/scripts/sync-feishu-docs.py` | Notion + `hub.json` 链路 | 保留 |
| 知识管理 GitLab 同步 | GitHub Actions `schedule` at `0 4 * * *` | `agents/knowledge-keeper/scripts/sync-gitlab-workspace.py` | Notion + `hub.json` 链路 | 保留 |
| 统一飞书推送 API | 手动调用 / Serverless | `api/push-feishu.js` | 飞书 Webhook | 保留 |

## 4. 维护原则

使用下面的规则判断某个项目是保留、归档还是删除。

| 条件 | 处理方式 |
|---|---|
| 被其他活跃工作流引用 | 保留 |
| 最近仍有提交或运行依赖 | 保留 |
| 仓库内没有任何引用 | 可作为归档/删除候选 |
| 长时间未更新且确认没有实际使用 | 先归档，确认无用后再删除 |
| 独立工具类插件，虽无引用但仍可能复用 | 优先归档，除非你明确要清理空间 |

## 5. 已删除项目

### `style-variable-binder`

状态：

- 原路径：`projects/style-variable-binder`
- 最后可见提交：`2026-03-11`
- 处理结果：已删除

判断依据：

- 仓库内没有除自身目录外的引用
- 没有接入当前任何自动化流程
- 目录内容是独立的 Figma 插件资产，不影响当前主链路

处理说明：

- 该目录已从仓库中移除
- 若未来需要恢复，可从历史提交或外部备份中取回
