#!/bin/bash
# 共用：挑一个能用的 Python 解释器，结果放进 $PY。
#
# 本 agent 的代码用了 `X | None` 类型写法，需要 Python 3.10+。
# macOS 自带的是 3.9，直接用 python3 会报 TypeError，所以按优先级挑：
#   1. .venv/bin/python      —— README「准备」里建的虚拟环境（依赖也装在这）
#   2. python3.13 / 3.12 …   —— Homebrew 装的具体版本
#   3. python3               —— 仅当它本身 ≥ 3.10
#
# 用法：在 agent 根目录下 `source scripts/_python.sh` 后使用 "$PY"。

_agent_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PY=""

# 1. 优先虚拟环境：依赖（openai/pillow）都装在这里
if [ -x "$_agent_dir/.venv/bin/python" ]; then
  PY="$_agent_dir/.venv/bin/python"
else
  # 2. 找具体版本号的 Python（新版优先）
  for _c in python3.14 python3.13 python3.12 python3.11 python3.10; do
    if command -v "$_c" >/dev/null 2>&1; then
      PY="$_c"
      break
    fi
  done
  # 3. 兜底：裸 python3，但必须自身 ≥ 3.10
  if [ -z "$PY" ] && command -v python3 >/dev/null 2>&1; then
    if python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)' 2>/dev/null; then
      PY="python3"
    fi
  fi
fi

if [ -z "$PY" ]; then
  echo "❌ 没找到 Python 3.10+（本 agent 需要）。"
  echo ""
  echo "   装一个并建好虚拟环境："
  echo "     brew install python@3.13"
  echo "     cd \"$_agent_dir\""
  echo "     python3.13 -m venv .venv"
  echo "     .venv/bin/pip install -r requirements.txt"
  echo ""
  return 1 2>/dev/null || exit 1
fi

# 用的不是虚拟环境时提醒一句：依赖可能没装（dry-run 不受影响）
if [ "$PY" != "$_agent_dir/.venv/bin/python" ]; then
  if ! "$PY" -c "import openai" >/dev/null 2>&1; then
    echo "⚠️  当前用的是 ${PY} —— 它没装 openai 依赖，出图会失败。"
    echo "   建议按 README「准备」建虚拟环境：python3.13 -m venv .venv"
    echo ""
  fi
fi
