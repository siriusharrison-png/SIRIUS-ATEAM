#!/bin/bash
# Playground Hub · 本地启动中枢
# 双击本文件 → 起中枢服务并自动打开浏览器。关掉本窗口即停止中枢。
cd "$(dirname "$0")/hub" || exit 1
echo "──────────────────────────────────"
echo "  Playground Hub 启动中…"
echo "──────────────────────────────────"
if [ ! -d node_modules/express ]; then
  echo "首次启动，安装依赖…"
  npm install || { echo "依赖安装失败"; read -r -p "按回车关闭…" _; exit 1; }
fi
npm start
