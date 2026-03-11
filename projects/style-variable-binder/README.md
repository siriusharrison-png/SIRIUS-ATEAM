# Style Variable Binder

批量绑定 Figma Style 到 Variable 的插件，支持 Paint Style 和 Text Style。

## 功能

- **智能匹配**：综合颜色值 + 名称相似度，自动找到最佳 Variable
- **孤儿绑定检测**：自动清理绑定到已删除 Variable 的样式
- **颜色对比条**：左右对比展示 Style 和 Variable 的颜色差异
- **匹配度可视化**：进度条 + 标签直观展示匹配程度
- **分组折叠**：按 Style 命名分组，支持展开/折叠
- **批量操作**：一键绑定/解绑所有选中项

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

### Paint Style（颜色）
采用**综合评分**：颜色距离 70% + 名称相似度 30%

| 颜色距离 | 状态 | 说明 |
|----------|------|------|
| `< 1` | 精确匹配 | 推荐绑定 |
| `< 20` | 相近匹配 | 需人工确认 |
| `>= 20` | 差异较大 | 谨慎绑定 |

### 名称智能匹配
忽略分隔符差异（`/` `-` `_` `.` 空格）：

| Style 名称 | Variable 名称 | 匹配结果 |
|------------|---------------|---------|
| brand/primary/1 | brand-primary-1 | ✅ 匹配 |
| Gray/Text/1 | gray-text-1 | ✅ 匹配 |
| fill/strong | fill-strong | ✅ 匹配 |

### 孤儿绑定处理
如果 Style 绑定的 Variable 已被删除，插件会**自动解除绑定**，让该 Style 重新参与匹配

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

- **v2.1.0** (2026-03-11)
  - **孤儿绑定自动清理**：检测并自动解除绑定到已删除 Variable 的样式
  - **智能名称匹配**：支持 `brand/primary/1` 匹配 `brand-primary-1`（忽略分隔符差异）
  - **UI 全面优化**：
    - 顶部统计卡片，一目了然
    - 颜色对比条（左右对比）
    - 匹配度进度条
    - 分组可折叠
    - 紧凑布局，一屏显示更多

- **v2.0.0** (2026-03-10)
  - 新增 Text Style 绑定支持
  - 支持 fontSize / lineHeight / letterSpacing

- **v1.0.0** (2026-03-10)
  - 初始版本
  - 支持颜色值自动匹配
  - 批量绑定功能

---

**SIRIUS ATEAM** | Figma Designer Agent
