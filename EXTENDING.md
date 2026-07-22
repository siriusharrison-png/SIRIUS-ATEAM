# 系统扩展指南

本文档详细说明如何安全、高效地向系统添加新 Agent。

## 目录

1. [快速开始](#快速开始)
2. [详细步骤](#详细步骤)
3. [最佳实践](#最佳实践)
4. [故障排查](#故障排查)
5. [案例：添加天气 Agent](#案例添加天气-agent)

---

## 快速开始

### 5 分钟快速部署

```bash
# 1. 创建新 Agent 骨架
bash scripts/new-agent.sh weather-reporter "每日天气播报"

# 2. 编辑主程序
vim agents/weather-reporter/scripts/main.py

# 3. 测试
python agents/weather-reporter/scripts/main.py

# 4. 验证工作流调度
python scripts/check-workflow-schedule.py

# 5. 提交
git add .
git commit -m "feat: 添加天气播报 Agent"
git push
```

---

## 详细步骤

### 第 1 步：规划 Agent

在开始编码前，明确以下几点：

**1.1 Agent 的职责**
```markdown
名称: 天气播报
职责: 每日获取天气数据，生成播报卡片推送到飞书
依赖: OpenWeather API
输出: 飞书卡片消息
```

**1.2 工作流调度**
```markdown
触发时间: 每日早上 07:00 (北京时间)
预期耗时: 10 分钟
与其他 Agent 的冲突: 无（07:00 时没有其他工作流）
```

**1.3 数据流**
```
OpenWeather API → 数据处理 → 飞书卡片 → hub.json
```

### 第 2 步：创建 Agent 项目

使用自动化脚本生成完整的项目骨架：

```bash
bash scripts/new-agent.sh weather-reporter "每日天气播报"
```

这将创建：
```
agents/weather-reporter/
├── scripts/
│   └── main.py                  # Agent 主程序（包含模板）
├── tests/
│   └── test_main.py             # 测试文件（模板）
├── requirements.txt             # Python 依赖
├── .env.example                 # 环境变量模板
└── README.md                    # 项目文档

.github/workflows/
└── weather-reporter.yml         # 工作流（自动生成）
```

### 第 3 步：实现业务逻辑

编辑 `agents/weather-reporter/scripts/main.py`，修改四个核心函数：

**3.1 环境验证**
```python
def validate_environment():
    """验证必需的环境变量和外部依赖"""
    api_key = os.environ.get("OPENWEATHER_API_KEY")
    if not api_key:
        raise ValueError("缺少 OPENWEATHER_API_KEY")
    
    # 检查网络连接
    try:
        requests.head("https://api.openweathermap.org", timeout=5)
    except:
        raise Exception("无法连接到 OpenWeather API")
```

**3.2 数据获取**
```python
def fetch_data():
    """从 OpenWeather API 获取天气数据"""
    api_key = os.environ.get("OPENWEATHER_API_KEY")
    response = requests.get(
        "https://api.openweathermap.org/data/2.5/weather",
        params={
            "q": "Beijing",
            "appid": api_key,
            "units": "metric"
        }
    )
    response.raise_for_status()
    return response.json()
```

**3.3 数据处理**
```python
def process_data(raw_data):
    """转换为飞书卡片格式"""
    return {
        "city": raw_data["name"],
        "temp": raw_data["main"]["temp"],
        "description": raw_data["weather"][0]["description"],
        "humidity": raw_data["main"]["humidity"]
    }
```

**3.4 结果导出**
```python
def export_results(processed_data):
    """推送到飞书"""
    webhook = os.environ.get("FEISHU_WEBHOOK")
    message = {
        "msg_type": "text",
        "content": {
            "text": f"☀️ {processed_data['city']}: {processed_data['temp']}°C, {processed_data['description']}"
        }
    }
    resp = requests.post(webhook, json=message)
    return resp.ok
```

### 第 4 步：配置环境变量

**4.1 创建本地 .env 文件**
```bash
cp agents/weather-reporter/.env.example agents/weather-reporter/.env
```

**4.2 填写本地值（用于测试）**
```env
OPENWEATHER_API_KEY=your_key_here
FEISHU_WEBHOOK=your_webhook_here
```

**4.3 在 GitHub 添加 Secret**
- 访问 Settings > Secrets and variables > Actions
- 点击 "New repository secret"
- 添加 `OPENWEATHER_API_KEY` 和 `FEISHU_WEBHOOK`

### 第 5 步：本地测试

```bash
# 加载环境变量
export $(cat agents/weather-reporter/.env | xargs)

# 运行 Agent
python agents/weather-reporter/scripts/main.py

# 预期输出：
# ☀️ 天气播报工作流启动
# 验证环境...
# 获取数据...
#   ✅ 获取成功
# 处理数据...
#   ✅ 处理成功
# 导出结果...
# ✅ 工作流完成
# ✅ 已更新协作中枢
```

### 第 6 步：配置工作流

编辑 `.github/workflows/weather-reporter.yml`：

**6.1 设置调度时间**
```yaml
on:
  schedule:
    # 北京时间 07:00 = UTC 23:00（前一天）
    - cron: '0 23 * * *'
```

**6.2 添加环境变量**
```yaml
env:
  OPENWEATHER_API_KEY: ${{ secrets.OPENWEATHER_API_KEY }}
  FEISHU_WEBHOOK: ${{ secrets.FEISHU_WEBHOOK }}
```

### 第 7 步：验证与测试

```bash
# 验证工作流调度（检查是否有冲突）
python scripts/check-workflow-schedule.py

# 预期输出：
# 📊 工作流调度表（北京时间）
# 时间         Agent                ...
# 23:00      weather-reporter     ...
# ✅ 所有工作流无冲突，调度合理
```

### 第 8 步：添加到文档

编辑 `AGENTS.md`，在 Agent 表格中添加新项：

```markdown
| Agent | 名称 | 职责 | 触发 | 优先级 |
|-------|------|------|------|--------|
| 天气播报 | weather-reporter | 每日获取天气数据推送飞书 | 每日 07:00 (UTC 23:00) | P2 |
```

并在详细定义部分添加：

```markdown
### 天气播报 (weather-reporter)

**职责**：
- 从 OpenWeather API 获取实时天气
- 生成飞书卡片推送
- 记录数据和日志

**关键数据**：
- 温度、湿度、天气描述
- 当日最高/最低温

**依赖**：
- OpenWeather API
- 飞书 Webhook

**失败处理**：
- 自动重试
- 失败告警到飞书
```

### 第 9 步：提交和部署

```bash
# 1. 检查修改
git status

# 2. 暂存文件
git add agents/weather-reporter .github/workflows/weather-reporter.yml AGENTS.md

# 3. 提交
git commit -m "feat: 添加天气播报 Agent

- 集成 OpenWeather API 获取天气数据
- 每日 07:00 推送飞书卡片
- 完整的日志和状态追踪"

# 4. 推送
git push

# 5. GitHub Actions 会自动运行新工作流
```

---

## 最佳实践

### 1. 遵循标准错误处理模式

```python
try:
    # 业务逻辑
    data = fetch_data()
except Exception as e:
    # 总是记录错误
    if HAS_LOGGER:
        logger.error(f"获取数据失败: {str(e)}")
    
    # 更新 hub.json 记录故障
    if HAS_HUB_MANAGER:
        hub.add_message("Agent名", "alert", f"失败: {str(e)[:100]}")
    
    sys.exit(1)
```

### 2. 记录关键指标

在 logger 中包含量化数据：

```python
logger.info(
    "工作流完成",
    status="success",
    items_processed=42,
    duration_seconds=125,
    api_calls_made=3
)
```

### 3. 设置合理的超时

```python
# 网络请求要有超时
response = requests.get(url, timeout=10)

# 整个工作流要有最大耗时限制
# 在 GitHub Actions 中设置 timeout-minutes
```

### 4. 实现幂等性

确保多次运行不会产生重复数据：

```python
# 好的做法：检查是否已处理
def fetch_data():
    cache_file = Path("data_cache.json")
    if cache_file.exists() and is_fresh(cache_file):
        return json.load(cache_file)
    
    data = fetch_from_api()
    data_cache.write_text(json.dumps(data))
    return data
```

### 5. 版本化 API 调用

```python
# 在环境变量中指定 API 版本
API_VERSION = os.environ.get("OPENWEATHER_API_VERSION", "2.5")
url = f"https://api.openweathermap.org/data/{API_VERSION}/weather"
```

---

## 故障排查

### 问题 1：工作流不运行

**排查步骤**：
1. 检查工作流文件是否在 `.github/workflows/`
2. 检查工作流文件格式是否正确（YAML 语法）
3. 在 GitHub Actions 页面查看是否有错误
4. 运行 `git push` 确保文件已上传

### 问题 2：Agent 报错"找不到模块"

**排查步骤**：
1. 检查 `requirements.txt` 是否包含所有依赖
2. 检查 Python 导入语句是否正确
3. 在本地运行一次确保环境正确
4. 检查 GitHub Actions 的 Python 版本

### 问题 3：hub.json 更新失败

**排查步骤**：
1. 检查 hub.json 文件是否存在
2. 检查文件权限
3. 尝试手动更新：
   ```python
   from agents.lib.hub_manager import HubManager
   hub = HubManager(Path(...) / "hub.json")
   hub.update_agent_status("AgentName", "active")
   ```

### 问题 4：环境变量未生效

**排查步骤**：
1. 检查 Secret 是否已添加到 GitHub
2. 检查工作流中是否正确引用：`env: { KEY: ${{ secrets.KEY }} }`
3. 检查本地 `.env` 是否已加载：`export $(cat .env | xargs)`

---

## 案例：添加天气 Agent

完整的从 0 到 1 的示例。

### 场景

创建一个"天气播报" Agent，每天早上 7 点从 OpenWeather API 获取天气并推送到飞书。

### 实现

**步骤 1-3：创建和实现**
```bash
bash scripts/new-agent.sh weather-reporter "天气播报"
```

**步骤 4：main.py 完整实现**
```python
# 详见第 3 步中的代码示例
```

**步骤 5-6：工作流配置**
```yaml
cron: '0 23 * * *'  # 北京时间 07:00
env:
  OPENWEATHER_API_KEY: ${{ secrets.OPENWEATHER_API_KEY }}
  FEISHU_WEBHOOK: ${{ secrets.FEISHU_WEBHOOK }}
```

**步骤 7：验证**
```bash
python scripts/check-workflow-schedule.py
# 确认 23:00 (weather-reporter) 无冲突
```

**步骤 8-9：提交**
```bash
git add .
git commit -m "feat: 添加天气播报 Agent"
git push
```

### 结果

- ✅ Agent 自动在每天 07:00 运行
- ✅ 数据推送到飞书
- ✅ 日志记录到 `~/.claude/logs/weather-reporter.jsonl`
- ✅ 状态在 hub.json 中维护
- ✅ 可在仪表板中监控

---

## 检查清单

添加新 Agent 时使用此清单确保所有步骤完成：

```markdown
□ 已规划 Agent 职责和工作流
□ 已运行 new-agent.sh 创建骨架
□ 已实现 4 个核心函数
□ 已创建 requirements.txt
□ 已本地测试成功
□ 已在 GitHub 添加 Secret
□ 已配置工作流调度时间
□ 已运行 check-workflow-schedule.py（无冲突）
□ 已添加到 AGENTS.md
□ 已提交代码
□ 已验证工作流成功运行
□ 已检查日志和仪表板
```

---

## 相关资源

- [AGENTS.md](AGENTS.md) - Agent 架构规范
- [HUB_SCHEMA.md](HUB_SCHEMA.md) - hub.json 数据结构
- [WORKFLOW_SCHEDULE.md](WORKFLOW_SCHEDULE.md) - 工作流调度优化
- [agents/_template/](agents/_template/) - Agent 项目模板
