#!/bin/bash
# 海报设计师 · 工作台
# 双击本文件 → 起本地服务并自动打开浏览器 → 拖图出海报。
# 关掉这个终端窗口即停止服务。

cd "$(dirname "$0")" || exit 1

echo "──────────────────────────────────"
echo "  海报设计师 · 工作台启动中…"
echo "──────────────────────────────────"
echo "浏览器会自动打开。关闭本窗口即停止服务。"
echo ""

source scripts/_python.sh || { read -r -p "按回车关闭…" _; exit 1; }

"$PY" scripts/serve.py

echo ""
read -r -p "服务已停止，按回车关闭…" _
