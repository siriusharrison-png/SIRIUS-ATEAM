# 配置指南

## 第一步：创建飞书应用

1. 打开 [飞书开放平台](https://open.feishu.cn/app)
2. 点击「创建企业自建应用」
3. 填写应用名称：`Figma 设计稿助手`
4. 记下 **App ID** 和 **App Secret**

### 配置应用权限

在应用的「权限管理」中开启以下权限：

| 权限 | 说明 |
|------|------|
| `bitable:app` | 读写多维表格 |
| `im:message` | 接收和发送消息 |
| `im:message:send_as_bot` | 以机器人身份发消息 |

### 配置事件订阅

在「事件订阅」中：
1. 设置请求地址为你的服务器地址 + `/webhook`（例如 `https://your-server.com/webhook`）
2. 订阅事件：`im.message.receive_v1`（接收消息）

### 配置机器人

在「应用功能」→「机器人」中启用机器人功能。

---

## 第二步：创建飞书多维表格

1. 在飞书中创建一个新的多维表格
2. 添加以下字段：

| 字段名 | 类型 |
|--------|------|
| 产品名称 | 单选（PPIO / NOVITA / JIEKOU / 设计系统） |
| 文件类型 | 单选（设计系统 / 常规迭代） |
| 文件名 | 文本 |
| 页面名称 | 文本 |
| 板块名称 | 文本 |
| 节点类型 | 单选（页面 / 板块 / 分区） |
| Figma链接 | 链接 |
| 更新时间 | 日期 |

3. 获取表格信息：
   - 打开表格，从 URL 获取 **App Token**：`https://xxx.feishu.cn/base/{APP_TOKEN}?table={TABLE_ID}`
   - **Table ID** 也在 URL 中

---

## 第三步：配置项目

```bash
cd ~/Desktop/figma-search-bot
cp .env.example .env
```

编辑 `.env` 文件：

```bash
# Figma 配置（使用你现有的 Token）
FIGMA_TOKEN=你的_figma_token

# 飞书配置（第一步获取）
FEISHU_APP_ID=cli_xxx
FEISHU_APP_SECRET=xxx

# 多维表格配置（第二步获取）
FEISHU_BITABLE_APP_TOKEN=xxx
FEISHU_BITABLE_TABLE_ID=tblxxx
```

---

## 第四步：配置 Figma 文件

编辑 `config/products.json`，添加你的 Figma 文件：

```json
{
  "products": [
    {
      "name": "PPIO",
      "figma_files": [
        {
          "file_key": "从 Figma URL 获取",
          "file_type": "常规迭代"
        }
      ]
    }
  ]
}
```

**如何获取 file_key：**
- Figma 文件 URL 格式：`https://www.figma.com/design/{FILE_KEY}/文件名`
- 例如：`https://www.figma.com/design/abc123xyz/PPIO-Design` → file_key 是 `abc123xyz`

---

## 第五步：测试同步

```bash
# 安装依赖
pip install -r requirements.txt

# 测试单个文件同步
python scripts/sync_figma.py --file YOUR_FILE_KEY --product PPIO

# 全量同步
python scripts/sync_figma.py
```

---

## 第六步：启动机器人

本地测试：
```bash
python src/bot.py
```

需要将服务部署到公网才能接收飞书的回调。推荐：
- 本地测试：使用 [ngrok](https://ngrok.com) 暴露本地端口
- 正式部署：部署到云服务器或使用 Serverless

---

## 使用

在飞书中 @机器人 发送任意消息即可开始搜索流程。
