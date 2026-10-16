#!/bin/bash
# roma · 香气卡片生成器
# 双击本文件 → 起本地服务并自动打开浏览器。关掉本窗口即停止服务。
cd "$(dirname "$0")" || exit 1
echo "──────────────────────────────────"
echo "  roma · 香气卡片生成器 启动中…"
echo "──────────────────────────────────"
if [ ! -d node_modules/vitest ]; then
  echo "首次启动，安装依赖…"
  npm install || { echo "依赖安装失败"; read -r -p "按回车关闭…" _; exit 1; }
fi
if [ ! -f .env ]; then
  echo "⚠️  未找到 .env —— 复制 .env.example 为 .env 并填 GATEWAY_API_KEY（复用 posterdesigner 那个）。"
fi
npm run server
