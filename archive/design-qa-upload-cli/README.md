# Design QA CLI

检测代码是否正确使用设计系统 tokens，找出硬编码的样式值。

## 特点

- 🎨 检测硬编码颜色值
- 📏 检测不规范的间距
- 🔤 检测硬编码字号
- ⚙️ **支持自定义 tokens 文件**

## 使用方法

```bash
# 1. 克隆仓库
git clone https://github.com/siriusharrison-png/design-qa-agent-.git
cd design-qa-agent-

# 2. 运行检测
node bin/cli.js check <你的代码目录> --tokens <tokens文件>

# 示例：使用示例 tokens
node bin/cli.js check ./src --tokens ./design-tokens.example.json

# 示例：使用自己的 tokens
node bin/cli.js check ./src --tokens ./my-tokens.json
```

## 自定义 Tokens 文件

工具支持使用你自己的设计系统 tokens 文件。

### 方式一：使用 Figma Design Tokens 插件导出

1. 在 Figma 中安装 [Design Tokens](https://www.figma.com/community/plugin/888356646278934516) 插件
2. 导出你的设计系统为 JSON 文件
3. 运行时指定你的文件：`--tokens ./your-tokens.json`

### 方式二：手动创建

创建一个 JSON 文件，格式如下：

```json
{
  "color": {
    "brand": {
      "primary": {
        "type": "color",
        "value": "#1161fe"
      }
    }
  },
  "spacing": {
    "sm": {
      "type": "spacing",
      "value": "8px"
    }
  }
}
```

### 示例文件

仓库中的 `design-tokens.example.json` 是一个完整的示例，包含：
- 品牌色、边框色、填充色、文字色
- 间距规范（0-120px）
- 圆角规范
- 字号规范

## 输出示例

```
🔍 Design QA 检测中...

   已加载 34 个颜色 tokens
   已加载 32 个间距规范值

📄 Button.tsx
   🎨 第8行  #1161fe → var(--brand-0)
      颜色 #1161fe 应使用 var(--brand-0)

📄 Card.css
   📏 第6行  15px → 16px
      间距 15px 不在规范内

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ 检测完成，发现 2 个问题：
   🎨 颜色问题: 1 个
   📏 间距问题: 1 个
```

## 支持的文件类型

| 类型 | 扩展名 |
|------|--------|
| JavaScript | `.js` `.jsx` |
| TypeScript | `.ts` `.tsx` |
| CSS | `.css` `.scss` |
| Vue | `.vue` |
| Svelte | `.svelte` |

## 相关链接

- [在线 Pitch 页面](https://siriusharrison-png.github.io/design-qa-agent-/)
- [项目文档](./project-design-qa-agent.md)
- [项目总结](./design-qa-agent-summary.md)

## Roadmap

- [x] CLI 基础版本
- [x] 支持自定义 tokens 文件
- [ ] 发布到 npm
- [ ] 自动修复功能
- [ ] VS Code 插件
- [ ] CI/CD 集成

## License

MIT
