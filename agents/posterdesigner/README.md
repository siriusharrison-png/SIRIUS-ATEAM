# 海报设计师 Agent

转转的 AI 团队成员，负责把上传图片或主题优化成极简 **zine 纸感海报**。

底层风格来自 skill `gc-minimal-zine-poster-v0-1`（日韩独立杂志风：大量留白、旧纸质感、实验性排版、单一高饱和色锚点），出图引擎为 `gpt-image-2`（支持图生图/编辑），通过 **OpenAI 兼容网关的 Images API** 调用。

---

## 职责

| 任务 | 说明 |
|------|------|
| 图生图优化 | 把上传照片重新诠释为 zine 风格纸感海报 |
| Prompt 编译 | 按 skill 规则编译四段式高保真 prompt |
| 风格变体 | 每次自动选布局/锚点/排版/纹理/色彩，且不重复上次布局 |
| 批量出图 | 对 `input/` 下所有图片各出一张 |

## 目录结构

```
agents/posterdesigner/
├── scripts/
│   ├── prompt_compiler.py         # zine 风格 prompt 编译器（skill 规则落地）
│   ├── design_poster.py           # 主程序：读图 → 编译 → 出图 → 写 hub
│   ├── poster_from_finder.sh      # 访达右键调用的包装脚本
│   └── install_quick_action.sh    # 一键安装/卸载访达右键快捷指令
├── poster.command                 # 双击打开、拖图出海报
├── tests/
│   └── test_prompt_compiler.py
├── input/                         # 放待优化的图片（不入库）
├── output/                        # 生成的海报（不入库）
├── config.json
├── requirements.txt
└── .env.example
```

## 准备

```bash
cd agents/posterdesigner
pip install -r requirements.txt
# 配置网关（OpenAI 兼容 Images API，调 gpt-image-2 出图）
export GATEWAY_API_KEY=your_gateway_key
export GATEWAY_BASE_URL=https://apiproxy.paigod.work/v1
# 可选：覆盖模型名 / 尺寸
# export POSTER_MODEL=gpt-image-2
# export POSTER_SIZE=1024x1536
```

## 上传图片（推荐两种便捷入口）

不用再手动往 `input/` 拷图，任意位置的图片都能直接处理。

### A. 访达右键出海报（最省事）

一次性安装快捷指令：

```bash
bash agents/posterdesigner/scripts/install_quick_action.sh
# 卸载：加 --uninstall
```

装好后：访达里选中一张或多张图片 → 右键 → 快速操作 → **出 zine 海报**。
出图完成会弹通知并自动打开 `output/`。主题默认按文件名生成。

### B. 拖拽进终端

双击 `agents/posterdesigner/poster.command`，把图片从访达拖进窗口（可多张，含空格路径也行），回车即可。会先问一句可选主题，留空则按文件名。

> 两种入口都从与脚本同目录的 `.env` 读网关 Key，先按下面「准备」配好即可。

## 命令行用法

```bash
# 1. 图生图：单张 / 多张 / 目录都行
python scripts/design_poster.py --image input/photo.jpg --subject "海边的旧信箱"
python scripts/design_poster.py --image a.jpg b.jpg ~/Desktop/photos --subject "夏天"

# 2. 省略主题：按每张图文件名兜底
python scripts/design_poster.py --image ~/Desktop/photos

# 3. 纯主题生成（无参考图）
python scripts/design_poster.py --subject "雨后的旧车站" --text "still raining"

# 4. 批量：input/ 下所有图各出一张
python scripts/design_poster.py --batch --subject "夏天的记忆"

# 5. 只出 prompt 不出图（无 Key 时校对用）
python scripts/design_poster.py --subject "旧书" --dry-run

# 6. 单色模式
python scripts/design_poster.py --subject "雪夜" --mono
```

### 参数

| 参数 | 说明 |
|------|------|
| `--subject` | 主题 / 核心意象（一句话）。省略时按每张图文件名生成 |
| `--image` | 参考图路径，可多张，也可传目录（相对仓库根 / `~` / 绝对路径均可） |
| `--batch` | 对 `input/` 下所有图片批量出图 |
| `--text` | 海报内出现的短句（可选，图像模型会扭曲长文字，宜短） |
| `--mono` | 单色模式，弱化高饱和色锚点 |
| `--dry-run` | 只编译打印 prompt，不实际出图 |

## 工作流

1. 读取参考图（或纯主题）。
2. `prompt_compiler` 用种子确定性地选一套变体配方（layout / anchor / typography / texture / mood / color），并避开上次用过的布局。
3. 编译成四段式 prompt：画布+留白 → 主体+纸感改造 → 排版+高饱和色+印刷缺陷 → 平扫氛围+负向约束。
4. 调 Gemini 图生图出图，存到 `output/`。
5. 通过 HubManager 上报协作中枢 `hub.json`。

## 协作规范

每次出图后写入 `agents/hub.json`：

```json
{
  "from": "海报设计师",
  "type": "update",
  "content": "海报出图：主题「...」，配方 ...，产出 N 张",
  "data": { "subject": "...", "recipe": "...", "outputs": ["output/..."] }
}
```

## 测试

```bash
python -m unittest agents.posterdesigner.tests.test_prompt_compiler -v
```

## 说明

- 风格规则单一来源：`~/.claude/skills/gc-minimal-zine-poster/SKILL.md`。想调风格改那里，本 agent 只负责编译与调用。
- `prompt_compiler.py` 无外部依赖，可离线运行与测试；仅出图步骤需要网关 Key。
- 出图走 OpenAI 兼容 Images API：有参考图用 `client.images.edit`（对应 `/v1/images/edits`），无参考图用 `client.images.generate`（对应 `/v1/images/generations`）。返回兼容 `b64_json` 与 `url` 两种形态。
- 图像模型对长文字渲染不佳，`--text` 请保持简短。
