# 交互文档系统（规划中）

> 项目状态：💡 想法阶段，待设计

## 背景

在设计交付流程中，除了 Design Token（基础规范）之外，还需要一层「交互文档」来承载：
- 产品功能说明
- 业务逻辑
- 交互设计说明
- 开发注意事项

## 目标

1. **帮助 Agent 做产品设计检查** - 有了交互说明，AI 能更准确地理解设计意图
2. **告诉开发需要注意什么** - 减少沟通成本，设计意图不丢失
3. **QA 检查依据** - 代码提交后，对比交互文档 + 基本规范

## 初步想法

### 存在形式
- 以**文档**的方式存在
- 格式待定（JSON？Markdown？YAML？）

### 关键需求
- 需要做成 **Figma 插件**
- 让设计师在 Figma 中直接关联组件和说明
- 组件 ↔ 说明 一一对应

### 工作流设想

```
设计师在 Figma 中
     ↓
选中组件 → 打开插件 → 填写交互说明
     ↓
说明和组件 ID 绑定存储
     ↓
导出给开发 / 被 Agent 读取
```

## 待解决的问题

- [ ] 文档格式怎么设计？
- [ ] 数据存在哪里？（Figma 插件数据 / 外部服务 / 本地文件）
- [ ] 如何和现有的 design-token、component-mapping 整合？
- [ ] Figma 插件开发用什么技术栈？

## 参考

- Design Token 项目：`~/Desktop/SIRIUS-ATEAM/projects/design-token/`
- Component Mapping：`~/.claude/component-mapping/`
- Vibma（Figma 操控）：已有 MCP 可用

## 相关资源

- [Figma 插件开发文档](https://www.figma.com/plugin-docs/)
- [Figma Plugin API](https://www.figma.com/plugin-docs/api/api-reference/)

---

创建日期：2026-03-08
