# 海报设计师 Agent

转转的 AI 团队成员，负责把上传图片或主题优化成极简 **zine 纸感海报**。

出图引擎为 `gpt-image-2`（支持图生图/编辑），通过 **OpenAI 兼容网关的 Images API** 调用。

## 四种风格

工作台顶部 tab 切换，命令行用 `--skill` 指定。

| id | 名称 | 照片 | 说明 |
|----|------|------|------|
| `zine` | 旧杂志风格（默认） | 可选 | 日韩独立杂志风：大量留白、旧纸质感、实验性排版、单一高饱和色锚点。唯一有种子变体配方的风格 |
| `editorial` | 元素抽象风格 | 必需 | 保留原照片＋下方象牙色抽象记忆面板＋诗意英文标题 |
| `scenes` | 实景杂志风格 | 必需 | 真景为锚＋插画成场＋撕纸成界：繁复细节压成安静图形，一色作结构，手撕纤维毛边 |
| `stamp` | 档案图章风格 | 必需 | 一侧忠实保留原照片＋一侧暖白档案纸盖定制手工图章，两块面板直缝相接 |

`stamp` 有三条可选轴（默认全 auto，交给模型按主体定）：

| 轴 | 取值 |
|----|------|
| 图章形状 `--seal-shape` | `auto` / `circle` / `square` / `arch` / `panoramic` / `silhouette` |
| 图章位置 `--seal-corner` | `auto` / `upper-left` / `upper-right` / `lower-left` / `lower-right` |
| 拼接方向 `--splice` | `lr` 左右（横版 1536x1024，默认） / `tb` 上下（竖版 1024x1536） |

其余三种风格均为竖版 1024x1536。

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
│   ├── prompt_compiler.py         # zine 风格 prompt 编译器（种子变体配方）
│   ├── editorial_prompt.py        # 元素抽象风格 prompt 编译器
│   ├── scenes_gathered_prompt.py  # 实景杂志风格 prompt 编译器
│   ├── stamp_archive_prompt.py    # 档案图章风格 prompt 编译器
│   ├── design_poster.py           # 主程序：读图 → 编译 → 出图 → 写 hub
│   ├── serve.py                   # 本地工作台服务（复用主程序核心逻辑）
│   ├── poster_from_finder.sh      # 访达右键调用的包装脚本
│   └── install_quick_action.sh    # 一键安装/卸载访达右键快捷指令
├── web/
│   └── index.html                 # 工作台前端（拖图/预览/重出，纯本地）
├── poster.command                 # 双击打开、拖图出海报
├── workbench.command              # 双击打开、启动可视化工作台
├── tests/
│   └── test_prompt_compiler.py
├── input/                         # 放待优化的图片（不入库）
├── output/                        # 生成的海报（不入库）
├── config.json
├── requirements.txt
└── .env.example
```

## 准备

需要 **Python 3.10+**（代码里用了 `X | None` 写法，3.9 会报 `TypeError`）。
macOS 自带的是 3.9，所以用 Homebrew 装一个，并建虚拟环境隔离依赖：

```bash
brew install python@3.13

cd agents/posterdesigner
python3.13 -m venv .venv                  # .venv 已在 .gitignore 里
.venv/bin/pip install -r requirements.txt
```

之后所有命令都用 `.venv/bin/python` 开头（下文示例里的 `python` 均指它）。

```bash
# 配置网关（OpenAI 兼容 Images API，调 gpt-image-2 出图）
export GATEWAY_API_KEY=your_gateway_key
export GATEWAY_BASE_URL=https://apiproxy.paigod.work/v1
# 可选：覆盖模型名 / 尺寸（POSTER_SIZE 会覆盖 skill 自己的横竖判断）
# export POSTER_MODEL=gpt-image-2
# export POSTER_SIZE=1024x1536
```

> `.command` 双击入口与访达右键走的是系统 `python3`。如果你主要用那两个入口，
> 需要让 `python3` 指向 3.10+，或把脚本里的解释器改成 `.venv/bin/python`。

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

### C. 本地工作台（可视化，推荐反复调风格时用）

双击 `agents/posterdesigner/workbench.command`，浏览器自动打开一个网页：拖图 → 选主题/单色/锁定布局 → 点生成 → 网格里看大图、下载、一键换配方重出。

```bash
# 或命令行启动
python3 scripts/serve.py            # 默认 http://127.0.0.1:8765
python3 scripts/serve.py --port 9000
```

纯本地服务（标准库 http.server，无新依赖），只监听 `127.0.0.1`，图和 Key 都不出本机。

> 以上入口都从 agent 目录下的 `.env` 读网关 Key（由 `design_poster.load_env()` 统一处理），
> 先按上面「准备」配好即可。已经 export 到 shell 的变量优先，不会被 `.env` 覆盖。

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

# 7. 换风格（后三种都必需照片）
python scripts/design_poster.py --skill editorial --image a.jpg
python scripts/design_poster.py --skill scenes --image a.jpg --text "Almost home"

# 8. 档案图章：默认自动定形，或显式指定三条轴
python scripts/design_poster.py --skill stamp --image a.jpg
python scripts/design_poster.py --skill stamp --image a.jpg \
    --seal-shape square --seal-corner lower-right --splice lr --text "HARBOUR"
```

### 参数

| 参数 | 说明 |
|------|------|
| `--skill` | 出图风格：`zine`（默认）/ `editorial` / `scenes` / `stamp` |
| `--seal-shape` `--seal-corner` `--splice` | `stamp` 专用三条轴，见上文表格 |
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
4. 调网关 `gpt-image-2` 图生图出图，存到 `output/`。
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
cd agents/posterdesigner
python3 -m unittest discover -s tests -p "test_*.py"     # 全部 35 条
```

## 说明

- `zine` 风格规则单一来源：`~/.claude/skills/gc-minimal-zine-poster/SKILL.md`。
- `editorial` / `scenes` / `stamp` 的 prompt 正文放在本 agent 的 `skills/*.zh-CN.md`，改风格直接改那几个 md，compiler 只负责读取＋拼补充约束。
- `stamp` 来源：[Dlcccc71913/skill-make-photo-stamp-archive](https://github.com/Dlcccc71913/skill-make-photo-stamp-archive)（MIT）。
- `prompt_compiler.py` 无外部依赖，可离线运行与测试；仅出图步骤需要网关 Key。
- 出图走 OpenAI 兼容 Images API：有参考图用 `client.images.edit`（对应 `/v1/images/edits`），无参考图用 `client.images.generate`（对应 `/v1/images/generations`）。返回兼容 `b64_json` 与 `url` 两种形态。
- 图像模型对长文字渲染不佳，`--text` 请保持简短。
- 网关可能不完全遵守请求的 `size`：实测请求 1536x1024 时返回 1448x1086（同为 4:3 横版，方向正确）。
  代码只负责按 skill 请求正确的横竖比例，最终像素由网关决定。
