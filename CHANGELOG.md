# SIRIUS ATEAM 更新日志

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
