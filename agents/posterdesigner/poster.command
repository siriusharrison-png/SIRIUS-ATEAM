#!/bin/bash
# 海报设计师 · 拖拽出图
# 双击本文件 → 把图片从访达拖进终端窗口 → 回车，即可出 zine 海报。
# 也可只回车（不拖图）走纯主题生成。

cd "$(dirname "$0")" || exit 1

# 加载网关 Key（.env 与本文件同目录；不入库）
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

echo "──────────────────────────────────"
echo "  海报设计师 · Minimal Zine Poster"
echo "──────────────────────────────────"
echo "把图片从访达拖进这个窗口（可多张），然后回车。"
echo "只想按主题生成？直接回车跳过。"
echo ""
read -r -p "图片> " line

# 拖进终端的路径是转义好的 shell token，还原成数组
paths=()
if [ -n "$line" ]; then
  eval "paths=($line)"
fi

echo ""
read -r -p "主题（可空，留空则按文件名）> " subject
echo ""

args=()
if [ ${#paths[@]} -gt 0 ]; then
  args+=(--image "${paths[@]}")
fi
if [ -n "$subject" ]; then
  args+=(--subject "$subject")
fi

if [ ${#args[@]} -eq 0 ]; then
  echo "没有图片也没有主题，退出。"
  read -r -p "按回车关闭…" _
  exit 0
fi

python3 scripts/design_poster.py "${args[@]}"
status=$?

echo ""
if [ $status -eq 0 ]; then
  echo "✅ 完成，成品在 output/ 目录。"
  open output 2>/dev/null
else
  echo "❌ 出错了（退出码 $status），看上面的日志。"
fi
read -r -p "按回车关闭…" _
