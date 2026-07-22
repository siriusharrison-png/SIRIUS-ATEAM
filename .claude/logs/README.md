# Agent 日志系统

实时监控和管理所有 Agent 的运行状态。

## 日志位置

所有日志存储在 `~/.claude/logs/` 目录下，格式为 JSON Lines：

```
~/.claude/logs/
├── 摄影师.jsonl           # 影像守门员日志
├── 知识管理.jsonl         # 知识管理 Agent 日志
├── 秘书.jsonl            # 秘书日志（如果有）
├── dashboard.html        # 仪表板 HTML
├── server.py            # 仪表板服务
└── start-dashboard.sh   # 启动脚本
```

## 日志格式

每条日志是一个 JSON 对象，包含：

```json
{
  "timestamp": "2026-07-22T10:30:45.123456+08:00",
  "date": "2026-07-22",
  "level": "INFO",
  "agent": "摄影师",
  "message": "完成数据采集",
  "context": {
    "downloads": 1234,
    "views": 5678,
    "likes": 89
  }
}
```

### 日志级别

- **DEBUG**: 调试信息，不影响业务
- **INFO**: 信息性日志，表示正常操作
- **WARNING**: 警告，可能需要关注
- **ERROR**: 错误，影响任务完成
- **CRITICAL**: 严重错误，系统级问题

## 使用方法

### 1. 启动仪表板

```bash
# 在仪表板目录
cd .claude/logs
bash start-dashboard.sh

# 或指定端口
bash start-dashboard.sh 9000
```

然后打开浏览器访问：`http://localhost:8000/dashboard.html`

### 2. 查询日志

#### 使用 Python

```python
from pathlib import Path
from lib.agent_logger import AgentLogger

# 获取所有日志
logs = AgentLogger.get_logs("摄影师", limit=100)
for log in logs:
    print(log)

# 获取统计信息
summary = AgentLogger.get_summary("摄影师")
print(f"总条数: {summary['total']}")
print(f"错误: {summary['errors']}")
print(f"警告: {summary['warnings']}")
```

#### 使用 jq

```bash
# 查看摄影师日志（最后 10 条）
tail -10 ~/.claude/logs/摄影师.jsonl | jq .

# 搜索错误
cat ~/.claude/logs/摄影师.jsonl | jq 'select(.level == "ERROR")'

# 统计各级别日志数
cat ~/.claude/logs/摄影师.jsonl | jq -r '.level' | sort | uniq -c
```

### 3. 监控 Agent 状态

在生产环境中，可以集成仪表板到监控系统：

```bash
# 每分钟检查一次错误
watch -n 60 'cat ~/.claude/logs/*.jsonl | jq "select(.level == \"ERROR\")" | wc -l'
```

## 与 hub.json 的关系

- **hub.json**: Agent 的实时状态中枢（最后运行时间、当前任务等）
- **日志系统**: 详细的操作日志，供查询和分析

两者配合使用：
- hub.json 快速查看 Agent 是否在线
- 日志系统查看具体做了什么、是否有错误

## 注意事项

1. **日志会持续增长**：生产环境中建议定期清理旧日志
   ```bash
   # 保留最近 7 天的日志
   find ~/.claude/logs -name "*.jsonl" -mtime +7 -delete
   ```

2. **性能考虑**：仪表板加载的是最近 100 条日志，足以反映最新状态

3. **隐私**：日志文件包含运行时的上下文数据，不应上传到公开仓库

## 集成到 CI/CD

在 GitHub Actions 中上传日志作为构建工件：

```yaml
- name: Upload logs
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: agent-logs
    path: ~/.claude/logs/
    retention-days: 7
```

## 扩展

添加新的日志查询工具：

```python
# tools/analyze-logs.py
from pathlib import Path
import json

def analyze_agent_performance(agent_name, days=7):
    """分析 Agent 在过去 N 天的表现"""
    log_file = Path.home() / f".claude/logs/{agent_name}.jsonl"
    
    with open(log_file) as f:
        logs = [json.loads(line) for line in f]
    
    # 统计各级别
    # 统计平均执行时间
    # 识别常见错误
```
