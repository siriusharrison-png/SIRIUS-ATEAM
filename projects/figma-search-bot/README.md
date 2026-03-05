# Figma 设计稿搜索机器人

飞书机器人，帮助团队成员快速搜索 Figma 设计稿链接。

## 功能

- 分步引导搜索（产品 → 文件类型 → 关键词）
- 按更新时间排序，最新在前
- 飞书组织成员可用

## 快速开始

### 1. 安装依赖

```bash
cd ~/Desktop/figma-search-bot
pip install -r requirements.txt
```

### 2. 配置

复制配置模板并填入凭证：

```bash
cp .env.example .env
```

### 3. 同步 Figma 数据到多维表格

```bash
python scripts/sync_figma.py
```

### 4. 启动机器人

```bash
python src/bot.py
```

## 目录结构

```
figma-search-bot/
├── src/
│   ├── bot.py              # 飞书机器人主程序
│   ├── feishu_api.py       # 飞书 API 封装
│   └── figma_api.py        # Figma API 封装
├── scripts/
│   └── sync_figma.py       # 同步脚本
├── config/
│   └── products.json       # 产品配置
├── docs/
│   └── plans/              # 设计文档
├── .env.example            # 配置模板
└── requirements.txt        # 依赖
```
