# SIRIUS ATEAM 更新日志

## [2026-07-18] 收纳展示与临时记录文件

### 新增
- **`studio/` 统一收纳层** - 用于管理展示页、分享页、临时存档和思考记录
- **团队展示页同步脚本** - `scripts/sync-team-page.mjs`，在 `main` 分支部署前自动校准展示页

### 调整
- 将 `PROJECT_OPTIMIZATION_2026-07-10.md` 与 `projects/0310-share.html` 迁入 `studio/`
- GitHub Pages 部署流程新增展示页同步步骤

## [2026-07-18] 团队成员结构对齐

### 调整
- 将 `README.md` 的团队成员区拆分为“在轨成员”和“已离轨成员”
- 为成员补充上线时间、当前版本、下线时间和更新计划
- 移除已不存在的目录引用，避免文档与仓库结构漂移

### 备注
- `Figma 设计员工` 与 `测试QA` 已离轨，保留历史信息用于版本管理

## [2026-07-18] 清理未引用的 Figma 插件

### 删除
- **Style Variable Binder** - `projects/style-variable-binder` 已确认无仓库外引用，删除目录并同步清理展示页

### 备注
- 该插件为独立 Figma 资产，不影响当前日报、推送或同步流程

## [2026-03-09] 飞书推送功能上线

### 新增
- **飞书推送功能** - 页面上可直接点击按钮推送到飞书群
- **前后端分离架构** - GitHub Pages（页面） + Vercel（API）
- **小秘书日报** - 展示代码变更详情（谁、什么时候、什么项目、做了什么、仓库链接）
- **摄影师数据** - 展示 Unsplash 统计（下载量、浏览量、点赞数、周变化）

### 技术细节
- API 端点：`sirius-ateam.vercel.app/api/push-feishu`
- 环境变量：`FEISHU_WEBHOOK_URL`
- 推送数据来源：`index.html` 顶部的 `agentData` 对象

---

## [2026-03-05] 项目初始化

### 新增
- 像素风格 Agent 形象展示
- Tag 切换查看各成员详情
- WORKFLOW 协作流程图
- LOG 更新日志功能
- 重命名为 SIRIUS TEAM
