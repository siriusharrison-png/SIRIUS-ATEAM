# Tag Image - 图片标签工具

使用 Imagga AI API 为图片自动生成标签，帮助你的图片在 Unsplash 平台获得更好的曝光。

## 功能

- ✨ **批量处理** - 同时处理多张图片
- 🔗 **URL 支持** - 直接输入图片链接
- 📤 **文件上传** - 上传本地图片文件
- 🎯 **智能标签** - 基于 Imagga AI 的自动标签生成
- 📋 **一键复制** - 快速复制标签到剪贴板

## 快速开始

### 环境变量

创建 `.env.local` 文件：

```
IMAGGA_API_KEY=your_api_key
IMAGGA_API_SECRET=your_api_secret
```

### 本地开发

```bash
npm install
npm run dev
```

访问 `http://localhost:3000`

### 部署到 Vercel

```bash
npm run deploy
```

## API 使用

### 从 URL 生成标签

```bash
curl -X POST https://your-domain.vercel.app/api/tag \
  -H "Content-Type: application/json" \
  -d '{
    "urls": [
      "https://example.com/image1.jpg",
      "https://example.com/image2.jpg"
    ]
  }'
```

响应示例：

```json
[
  {
    "url": "https://example.com/image1.jpg",
    "tags": "background,flower,nature,garden",
    "success": true
  }
]
```

### 上传文件生成标签

```bash
curl -X POST https://your-domain.vercel.app/api/tag \
  -F "images=@image1.jpg" \
  -F "images=@image2.jpg"
```

## 标签格式

标签以逗号分隔的格式返回，例如：

```
background,flower,new,nature,garden,outdoor
```

可直接用于 Unsplash 上传时的标签字段。

## 技术栈

- Node.js
- Vercel Serverless Functions
- Imagga API
- Formidable (文件上传处理)

## 许可证

MIT
