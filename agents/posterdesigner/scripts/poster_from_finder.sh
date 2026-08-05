#!/bin/bash
# 被访达右键快捷指令调用：出 zine 海报。
# 两种传参：
#   poster_from_finder.sh <img1> <img2> ...        # 直接传路径
#   poster_from_finder.sh --paths-file /tmp/xxx     # 从文件读（每行一个路径）
# 主题留空，由 design_poster.py 按文件名兜底。

AGENT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$AGENT_DIR" || exit 1

# 加载网关 Key（.env 不入库）
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

# 收集图片路径
imgs=()
if [ "${1:-}" = "--paths-file" ] && [ -n "${2:-}" ]; then
  while IFS= read -r line; do
    [ -n "$line" ] && imgs+=("$line")
  done < "$2"
  rm -f "$2"
else
  imgs=("$@")
fi

if [ "${#imgs[@]}" -eq 0 ]; then
  echo "没有选中图片。"
  read -r -p "按回车关闭…" _
  exit 1
fi

echo "──────────────────────────────────"
echo "  海报设计师 · 出图中（${#imgs[@]} 张）"
echo "──────────────────────────────────"

python3 scripts/design_poster.py --image "${imgs[@]}"
status=$?

echo ""
if [ $status -eq 0 ]; then
  echo "✅ 完成，成品在 output/。"
  open output 2>/dev/null
else
  echo "❌ 出错了（退出码 $status），看上面的日志。"
fi
read -r -p "按回车关闭…" _
exit $status
