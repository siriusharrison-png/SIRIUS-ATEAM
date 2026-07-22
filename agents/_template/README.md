# Agent 模板

这是一个标准化的 Agent 项目模板。使用此模板可以快速创建新的 Agent。

## 快速开始

### 1. 使用模板创建新 Agent

```bash
bash scripts/new-agent.sh my-agent "我的 Agent 描述"
```

这将创建：
- `agents/my-agent/` 目录
- 所有必需的文件和配置
- 自动集成 HubManager 和 AgentLogger

### 2. 填写业务逻辑

编辑 `agents/my-agent/scripts/main.py`，修改以下部分：

```python
def validate_environment():
    """验证你需要的环境变量"""
    pass

def fetch_data():
    """获取数据"""
    pass

def process_data(raw_data):
    """处理数据"""
    pass

def export_results(processed_data):
    """导出结果"""
    pass
```

### 3. 配置环境变量

编辑 `agents/my-agent/.env.example`：

```env
MY_AGENT_API_KEY=your_key_here
MY_AGENT_WEBHOOK_URL=your_webhook_here
```

在 GitHub Settings > Secrets and variables > Actions 中添加对应的 secret。

### 4. 创建工作流

复制 `workflow.yml.template` 到 `.github/workflows/my-agent.yml`：

```bash
cp agents/_template/workflow.yml.template .github/workflows/my-agent.yml
```

修改以下内容：
- `name: [AGENT_NAME] Workflow` → `name: My Agent Workflow`
- `cron: '0 0 * * *'` → 设置你的调度时间（北京时间）
- 添加你的环境变量 secret

### 5. 本地测试

```bash
cd agents/my-agent
python scripts/main.py
```

### 6. 部署

```bash
# 1. 添加到 AGENTS.md
# 2. 运行检查脚本
python scripts/check-workflow-schedule.py

# 3. 提交代码
git add .
git commit -m "feat: 添加 My Agent"
git push

# 4. GitHub Actions 会自动运行新工作流
```

## 项目结构

```
agents/my-agent/
├── scripts/
│   └── main.py          # Agent 主程序
├── tests/
│   └── test_main.py     # 单元测试
├── requirements.txt     # Python 依赖
├── README.md           # 项目文档
└── .env.example        # 环境变量示例
```

## 模板文件说明

### scripts/main.py

完整的 Agent 实现模板，包含：
- 环境变量验证
- HubManager 和 AgentLogger 集成
- 标准错误处理
- 自动告警机制

### workflow.yml.template

GitHub Actions 工作流模板，包含：
- 定时调度配置
- 环境变量和 secret 管理
- 故障告警
- 日志收集

## 核心集成

所有 Agent 自动集成以下功能：

### HubManager
```python
hub = HubManager(Path(__file__).parent.parent.parent / "hub.json")
hub.update_agent_status("我的Agent", "active")
hub.add_message("我的Agent", "update", "完成工作", data={...})
```

### AgentLogger
```python
logger = AgentLogger("我的Agent")
logger.info("开始工作")
logger.error(f"失败: {error}")
```

## 工作流调度

### UTC 转北京时间

北京时间 = UTC + 8 小时

示例：
- 北京时间 09:00 = UTC 01:00 → `cron: '0 1 * * *'`
- 北京时间 18:00 = UTC 10:00 → `cron: '0 10 * * *'`

### 避免冲突

运行 `scripts/check-workflow-schedule.py` 检查是否与其他工作流冲突。

## 常见问题

### Q: 我的 Agent 需要外部 API
A: 在 GitHub Settings 中添加对应的 secret，然后在工作流中引用。

### Q: 我的 Agent 有依赖包
A: 创建 `requirements.txt`，工作流会自动安装。

### Q: 我想本地测试 Agent
A: 设置本地环境变量后直接运行 `python scripts/main.py`。

### Q: 添加后看不到日志
A: 运行 `bash .claude/logs/start-dashboard.sh` 启动仪表板。

## 下一步

- 阅读 [AGENTS.md](../../AGENTS.md) - 了解 Agent 架构
- 阅读 [HUB_SCHEMA.md](../../HUB_SCHEMA.md) - 了解消息格式
- 查看现有 Agent 的实现 - `agents/image-guardian/scripts/run-daily-cloud.py`

## 支持

有问题？查看：
- 工作流日志：GitHub Actions 页面
- 运行时日志：`.claude/logs/我的Agent.jsonl`
- 状态：`.claude/logs/dashboard.html`
