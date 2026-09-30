#!/bin/bash
# MotionLab · Motion 工作台
# 双击本文件 → 起本地服务并自动打开浏览器 → 描述出片。
# 关掉这个终端窗口即停止服务。

cd "$(dirname "$0")" || exit 1

echo "──────────────────────────────────"
echo "  MotionLab · Motion 工作台启动中…"
echo "──────────────────────────────────"

# 首次使用：装依赖
if [ ! -d node_modules/remotion ]; then
  echo "首次启动，正在安装依赖（含 Remotion，会下载 headless Chrome，需几分钟）…"
  npm install || { echo "依赖安装失败"; read -r -p "按回车关闭…" _; exit 1; }
fi

# 检查 .env
if [ ! -f .env ]; then
  echo "⚠️  未找到 .env —— 请先把 .env.example 复制为 .env 并填入网关 key（复用 posterdesigner 那个）。"
  echo "   cp .env.example .env && 用编辑器填 GATEWAY_API_KEY"
  read -r -p "按回车关闭…" _
  exit 1
fi

PORT="${PORT:-4321}"
echo "浏览器会自动打开 http://localhost:${PORT} 。关闭本窗口即停止服务。"
echo ""

# 后台等服务起来再开浏览器
( for _ in $(seq 1 30); do
    if curl -s --noproxy '*' "http://localhost:${PORT}/config" >/dev/null 2>&1; then
      open "http://localhost:${PORT}"; break
    fi
    sleep 0.5
  done ) &

PORT="$PORT" node server/index.js

echo ""
read -r -p "服务已停止，按回车关闭…" _
