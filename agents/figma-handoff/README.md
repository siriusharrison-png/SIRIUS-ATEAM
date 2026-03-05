# Figma Design Handoff Plugin

设计交付助手 - 从 Figma 设计稿一键生成 React + Tailwind 代码，并管理设计规范。

## 功能

### Code Tab
- 选中组件自动提取设计属性
- 生成 React + TypeScript + Tailwind 代码
- 一键复制到剪贴板

### Specs Tab
- 填写交互状态（default/hover/active/disabled/loading）
- 定义内容边界规则（截断、空状态）
- 配置数据绑定（接口字段映射）
- 设置条件显示逻辑
- 规范保存到 Figma 节点或导出 JSON

## 安装

### 开发模式

1. 打开 Figma Desktop
2. Plugins → Development → Import plugin from manifest
3. 选择 `~/.claude/agents/figma-handoff/manifest.json`

### 依赖

- Vibma Relay 需要运行（端口 3055）
- Claude Code 需要运行

## 使用方式

1. 在 Figma 中选中一个组件
2. 运行插件：Plugins → Design Handoff → Generate Code
3. 在侧边栏查看生成的代码
4. 切换到 Specs Tab 填写规范
5. 点击 Save Specs 保存，或 Export 导出 JSON

## 与 QA Agent 配合

生成的代码可通过 design-qa-cli 检查还原度：

```bash
cd ~/Desktop/design-qa-cli
npx design-qa check path/to/component.tsx
```

## 项目结构

```
~/.claude/agents/figma-handoff/
├── manifest.json    # 插件配置
├── code.ts          # 插件主逻辑（TypeScript）
├── code.js          # 编译后的 JS
├── ui.html          # 插件 UI
├── handler.ts       # 代码生成逻辑
├── package.json     # 依赖配置
├── tsconfig.json    # TypeScript 配置
└── README.md        # 说明文档
```

## 更新日志

### v1.0.0 (2026-03-05)
- 初始版本
- 代码生成功能
- 规范填写界面
- WebSocket 连接支持
