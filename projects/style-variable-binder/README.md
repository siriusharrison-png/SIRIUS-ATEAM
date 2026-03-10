# Style Variable Binder

批量绑定 Figma Paint Style 到 Color Variable 的插件。

## 功能

- **自动匹配**：根据颜色值自动找到最接近的 Variable
- **颜色预览**：同时显示 Style 和 Variable 的颜色，方便对比
- **命名对照**：清晰展示 Style 名称和 Variable 名称
- **批量绑定**：一键绑定所有选中的匹配项
- **状态筛选**：按精确匹配/相近匹配/已绑定/未绑定筛选

## 安装

1. 打开 Figma Desktop
2. 进入 `Plugins` → `Development` → `Import plugin from manifest...`
3. 选择本目录下的 `manifest.json` 文件

## 使用

1. 打开包含 Paint Styles 和 Color Variables 的 Figma 文件
2. 运行插件：`Plugins` → `Development` → `Style Variable Binder`
3. 插件会自动扫描并匹配
4. 查看匹配结果：
   - **精确匹配**（绿色）：颜色值完全一致
   - **相近匹配**（橙色）：颜色差异在 20 以内
   - **已绑定**（蓝色）：已经绑定过的 Style
5. 勾选要绑定的项，或点击「选择精确匹配」
6. 点击「绑定选中项」执行绑定

## 匹配逻辑

1. **颜色值优先**：计算 RGB 欧几里得距离，找到最接近的 Variable
2. **距离阈值**：
   - `< 1`：精确匹配（推荐绑定）
   - `< 20`：相近匹配（需人工确认）
   - `>= 20`：差异较大（谨慎绑定）

## 文件结构

```
style-variable-binder/
├── manifest.json   # 插件配置
├── code.js         # 主逻辑
├── ui.html         # 用户界面
└── README.md       # 说明文档
```

## 注意事项

- 只支持 **SOLID（纯色）** 类型的 Paint Style
- 渐变、图案等样式会自动跳过
- 绑定后，Style 的颜色值会跟随 Variable 变化
- 建议先在测试文件中验证，再用于正式项目

## 版本

- **v1.0.0** (2026-03-10)
  - 初始版本
  - 支持颜色值自动匹配
  - 批量绑定功能

---

**SIRIUS ATEAM** | Figma Designer Agent
