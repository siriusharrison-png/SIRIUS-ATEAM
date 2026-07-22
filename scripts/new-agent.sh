#!/bin/bash
# 快速部署新 Agent 的脚本
# 用法: bash scripts/new-agent.sh agent-name "Agent 描述"

set -e

if [ $# -lt 2 ]; then
    echo "❌ 用法: bash scripts/new-agent.sh <agent-name> <description>"
    echo ""
    echo "示例:"
    echo "  bash scripts/new-agent.sh weather-reporter '天气数据采集 Agent'"
    echo ""
    exit 1
fi

AGENT_NAME=$1
AGENT_DESC=$2
AGENT_DIR="agents/$AGENT_NAME"

# 转换 Agent 名称为中文标准格式（假设直接使用英文名）
AGENT_CN="$AGENT_NAME"  # 可以根据需要扩展转换逻辑

echo "🚀 创建新 Agent: $AGENT_NAME"
echo "   描述: $AGENT_DESC"
echo ""

# 检查是否已存在
if [ -d "$AGENT_DIR" ]; then
    echo "❌ 错误: $AGENT_DIR 已存在"
    exit 1
fi

# 创建目录结构
echo "📁 创建目录结构..."
mkdir -p "$AGENT_DIR/scripts"
mkdir -p "$AGENT_DIR/tests"

# 复制主程序
echo "📄 复制程序模板..."
cp "agents/_template/scripts/main.py" "$AGENT_DIR/scripts/main.py"
sed -i "" "s/\[AGENT_NAME\]/$AGENT_NAME/g" "$AGENT_DIR/scripts/main.py"

# 创建 requirements.txt
echo "requests" > "$AGENT_DIR/requirements.txt"

# 创建 README
echo "📋 创建 README..."
cat > "$AGENT_DIR/README.md" << EOF
# $AGENT_NAME

$AGENT_DESC

## 快速开始

### 1. 安装依赖
\`\`\`bash
pip install -r requirements.txt
\`\`\`

### 2. 配置环境变量
复制 \`.env.example\` 并填写实际值：
\`\`\`bash
cp .env.example .env
\`\`\`

### 3. 本地测试
\`\`\`bash
python scripts/main.py
\`\`\`

## 工作流

- **自动触发**: GitHub Actions (定时或 workflow_dispatch)
- **手动触发**: \`python scripts/main.py\`

## 输出

- 日志: \`~/.claude/logs/$AGENT_NAME.jsonl\`
- 状态: \`agents/hub.json\` 中的 Agent 状态

## 相关文档

- [Agent 架构](../../AGENTS.md)
- [hub.json 规范](../../HUB_SCHEMA.md)
- [工作流调度](../../WORKFLOW_SCHEDULE.md)
EOF

# 创建 .env.example
echo "📝 创建环境变量模板..."
cat > "$AGENT_DIR/.env.example" << EOF
# $AGENT_NAME 配置示例
# 复制此文件为 .env 并填写实际值

# 示例: 替换为实际的配置
# YOUR_API_KEY=your_key_here
# YOUR_WEBHOOK=your_webhook_here
EOF

# 创建测试文件
echo "🧪 创建测试文件..."
cat > "$AGENT_DIR/tests/test_main.py" << EOF
import unittest
import sys
from pathlib import Path

# 添加父目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts.main import fetch_data, process_data


class Test$([[ \${AGENT_NAME} =~ ^[a-z] ]] && echo ${AGENT_NAME^} || echo $AGENT_NAME)(unittest.TestCase):
    """$AGENT_NAME 的单元测试"""

    def test_fetch_data(self):
        """测试数据获取"""
        data = fetch_data()
        self.assertIsInstance(data, dict)
        self.assertIn("status", data)

    def test_process_data(self):
        """测试数据处理"""
        raw_data = {"status": "success", "data": []}
        result = process_data(raw_data)
        self.assertIsInstance(result, dict)


if __name__ == "__main__":
    unittest.main()
EOF

# 创建工作流
echo "⚙️  创建 GitHub Actions 工作流..."
cp "agents/_template/workflow.yml.template" ".github/workflows/$AGENT_NAME.yml"
sed -i "" "s/\[AGENT_NAME\]/$AGENT_NAME/g" ".github/workflows/$AGENT_NAME.yml"

# 提示后续步骤
echo ""
echo "✅ Agent 创建完成！\n"
echo "📋 后续步骤："
echo "   1. 编辑 $AGENT_DIR/scripts/main.py 实现业务逻辑"
echo "   2. 编辑 $AGENT_DIR/.env.example 配置环境变量"
echo "   3. 编辑 .github/workflows/$AGENT_NAME.yml 设置工作流"
echo "   4. 在 GitHub Settings > Secrets 中添加对应的 secret"
echo "   5. 添加 Agent 到 AGENTS.md"
echo "   6. 运行 'python scripts/check-workflow-schedule.py' 验证调度"
echo "   7. 提交代码"
echo ""
echo "📖 更多信息: agents/_template/README.md"
echo ""
