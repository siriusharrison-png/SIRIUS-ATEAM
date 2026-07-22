#!/bin/bash
# 启动日志仪表板服务

cd "$(dirname "$0")"

PORT=${1:-8000}

echo "🚀 启动 Agent 日志仪表板..."
echo "📊 访问地址: http://localhost:$PORT/dashboard.html"
echo ""

python3 server.py $PORT
