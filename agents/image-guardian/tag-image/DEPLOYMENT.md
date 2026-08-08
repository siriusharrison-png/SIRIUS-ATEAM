# Tag Image 项目配置

## 环境变量

在 Vercel 项目设置中添加以下环境变量：

```
IMAGGA_API_KEY=your_imagga_api_key
IMAGGA_API_SECRET=your_imagga_api_secret
```

## 项目结构

```
tag-image/
├── api/
│   └── tag.js              # 主 API 端点
├── lib/
│   └── imagga.js           # Imagga API 集成
├── public/
│   └── index.html          # Web UI
├── package.json
├── vercel.json             # Vercel 配置
├── .gitignore
└── README.md
```

## 部署步骤

1. 初始化 git 仓库
2. 连接到 Vercel
3. 设置环境变量
4. 部署

## API 端点

- `GET /api/tag` - 获取 API 文档
- `POST /api/tag` - 处理图片标签（支持 JSON 和 multipart/form-data）

## 功能说明

### URL 模式
- 接收 JSON 格式的 URL 数组
- 返回每个 URL 对应的标签

### 文件上传模式
- 接收 multipart/form-data 格式的文件
- 返回每个文件对应的标签

### 标签处理
- 过滤置信度低于 20% 的标签
- 最多返回 20 个标签
- 以逗号分隔的格式返回
