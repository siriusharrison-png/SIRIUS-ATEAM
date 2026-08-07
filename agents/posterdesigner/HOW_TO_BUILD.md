# 如何构建 posterdesigner（海报设计师 Agent）

这份文档讲清楚三件事：这个 agent 是**怎么搭起来的**、**现在有哪些能力**、以及**怎么接入 Key 和生图模型**。照着走，从零复现或迁移到新机器都不难。

---

## 一、这个 agent 是什么

海报设计师是 SIRIUS 团队里的一个 **specialist agent**：把上传的照片或一句主题，编译成一段精心设计的图像 prompt，再通过生图模型出成品图。它不是一个常驻服务，而是**本地交互、手动触发**——你想出图时才起它。

两种出图风格（skill）：

| skill | 产出 | 照片 |
|---|---|---|
| **zine**（极简 Zine 海报） | 纸感 zine 海报，高饱和单色锚点 | 可选（能纯主题生成） |
| **editorial**（照片抽象编辑） | 保留原照片 ＋ 下方象牙色抽象记忆面板 ＋ 诗意英文标题 | 必需 |

出图前在工作台顶部 **tab 切换**选风格。

---

## 二、搭建思路（架构）

核心设计是**三层解耦**：prompt 编译 → 出图调用 → 交互入口。加新 skill 只动前两层，入口不变。

```
用户（照片/主题）
      │
      ├─ 交互入口（三选一）
      │    • web/index.html + serve.py   ← 浏览器工作台（推荐）
      │    • workbench.command           ← 双击起工作台
      │    • poster.command / CLI        ← 终端拖拽出图
      │
      ├─ prompt 编译层（按 skill 分流）
      │    • prompt_compiler.py    ← zine：种子配方引擎，四段式 prompt
      │    • editorial_prompt.py   ← editorial：读本地中文 prompt + 用户意象提示
      │
      ├─ 出图调用层
      │    • design_poster.py::generate_image()
      │      → OpenAI 兼容网关 Images API → 生图模型
      │
      └─ 产出 + 记录
           • output/            ← 成品 PNG
           • agents/hub.json    ← 协作中枢出图日志
```

### 目录结构

```
agents/posterdesigner/
├── config.json              # agent 元信息：skill 清单、引擎、触发词
├── .env                     # 网关 Key（不入库）
├── .env.example             # Key 模板，照它复制成 .env
├── requirements.txt         # 依赖：openai, pillow
├── HOW_TO_BUILD.md          # 本文档
├── README.md                # 使用速查
├── workbench.command        # 双击 → 起工作台
├── poster.command           # 双击 → 终端拖拽出图
├── scripts/
│   ├── serve.py             # 本地 Web 工作台（标准库 http.server）
│   ├── design_poster.py     # 主程序：出图调用 + CLI 入口
│   ├── prompt_compiler.py   # zine skill 的 prompt 编译器
│   └── editorial_prompt.py  # editorial skill 的 prompt 编译器
├── skills/
│   └── photo-abstract-editorial.zh-CN.md   # editorial 中文 prompt 本地副本
├── web/
│   └── index.html           # 工作台前端（tab / 拖拽 / 结果卡）
├── input/                   # 批量出图的输入图目录
├── output/                  # 成品与临时上传图（gitignore）
└── tests/
    └── test_prompt_compiler.py
```

### 为什么这么分

- **prompt 编译独立成模块**：prompt 是这个 agent 的灵魂，独立出来才好调、好测、好加新 skill。zine 用种子驱动的配方引擎（同主题换种子得不同视觉），editorial 用作者调好的固定长 prompt——两者接口对齐（都有 `compile_prompt` 和带 `as_line()` 的 recipe），所以上层能统一分流。
- **skill 自包含**：editorial 的 prompt 正文存了一份**本地副本**在 `skills/`，不依赖外部 skill 仓库是否安装，保证换机也能复现。
- **零额外依赖的工作台**：`serve.py` 只用 Python 标准库 `http.server`，出图才需要 `openai`。所以哪怕没配 Key，工作台也能开、prompt 也能编译（dry-run）。

---

## 三、现有能力

- **图生图**：上传照片 → 按 skill 改造出图（zine 走 `images.edit`）。
- **纯文生图**：只给主题不给图（仅 zine，走 `images.generate`）。
- **双 skill 切换**：工作台 tab 或 CLI `--skill` 选风格；切换时表单控件随之变化。
- **zine 配方引擎**：布局 / 锚点 / 字体 / 纹理 / 情绪 / 色彩六轴变体，种子驱动可复现，自动避开上次布局避免雷同；支持锁定布局、单色模式。
- **editorial 照片守卫**：照片必需，前端禁用按钮 + CLI 跳过 + 服务端拦截三层兜底。
- **批量出图**：`--batch` 对 `input/` 下所有图各出一张。
- **dry-run**：只编译打印 prompt 不出图，无 Key 也能校对。
- **协作中枢记录**：每次出图写进 `agents/hub.json`。
- **三种入口**：浏览器工作台、双击 command、终端 CLI。

---

## 四、如何接入 Key

出图通过一个 **OpenAI 兼容网关**（gateway）走，需要两样东西：网关的 **API Key** 和 **地址**。

### 步骤

1. 进 agent 目录，复制模板：
   ```bash
   cd agents/posterdesigner
   cp .env.example .env
   ```

2. 编辑 `.env`，填真实值：
   ```bash
   # 网关 API Key（图生图必需）
   GATEWAY_API_KEY=你的真实key

   # 网关地址（OpenAI 兼容 endpoint，以 /v1 结尾）
   GATEWAY_BASE_URL=https://apiproxy.paigod.work/v1
   ```

3. 完成。`.env` 已在 `.gitignore` 里，**不会入库**。

### Key 是怎么被读到的

- **工作台**（`serve.py`）：启动时自动 `_load_env()` 读同级 `.env` 灌进环境变量。
- **command 入口**（`poster.command`）：`source .env` 加载。
- **纯 CLI**：`.env` 不会自动读，需要自己 `export`，或用 command 入口。

> 安全提醒：`.env` 含真实 Key，别提交、别贴聊天、别截图。换机时手动重建，不要从旧机拷贝到公开位置。

---

## 五、如何接入生图模型

模型通过网关的 **Images API** 调用，全部走标准 OpenAI SDK，所以任何 OpenAI 兼容的生图 endpoint 都能接。

### 相关环境变量

| 变量 | 必需 | 默认 | 说明 |
|---|---|---|---|
| `GATEWAY_API_KEY` | ✅ | — | 网关 Key |
| `GATEWAY_BASE_URL` | ✅ | — | 网关地址，`/v1` 结尾 |
| `POSTER_MODEL` | ⬜ | `gpt-image-2` | 覆盖模型名 |
| `POSTER_SIZE` | ⬜ | `1024x1536` | 出图尺寸（竖版，最接近 zine 3:5） |

### 调用逻辑（design_poster.py::generate_image）

```python
from openai import OpenAI
client = OpenAI(api_key=GATEWAY_API_KEY, base_url=GATEWAY_BASE_URL)

if 有参考图:
    resp = client.images.edit(model=模型, image=f, prompt=prompt, size=尺寸)   # 图生图
else:
    resp = client.images.generate(model=模型, prompt=prompt, size=尺寸)         # 文生图
```

返回兼容 `b64_json` 和 `url` 两种形式，落成 PNG 到 `output/`。

### 换一个模型 / 网关

- **只换模型**：在 `.env` 加 `POSTER_MODEL=新模型名`。
- **换网关**：改 `GATEWAY_BASE_URL`（和对应的 `GATEWAY_API_KEY`），只要它兼容 OpenAI Images API 即可，代码不用动。
- **换尺寸**：加 `POSTER_SIZE=宽x高`。

---

## 六、跑起来

```bash
# 装依赖（一次）
pip install -r requirements.txt

# 方式一：工作台（推荐）
python3 scripts/serve.py            # 默认 http://127.0.0.1:8765
#   或双击 workbench.command

# 方式二：CLI
python3 scripts/design_poster.py --skill zine --image input/photo.jpg --subject "海边的旧信箱"
python3 scripts/design_poster.py --skill editorial --image input/photo.jpg
python3 scripts/design_poster.py --subject "雨后的旧车站" --dry-run   # 只出 prompt 不出图
python3 scripts/design_poster.py --batch --subject "夏天的记忆"       # 批量

# 跑测试
python3 -m unittest discover -s tests -p "test_*.py"
```

> 改完代码记得**重启服务**（`Ctrl+C` 再起），否则跑的还是旧进程里的旧代码。

---

## 七、如何再加一个 skill

三步，照 editorial 的样子：

1. **写编译器** `scripts/<新skill>_prompt.py`——提供 `build_recipe()` 和 `compile_prompt()`，recipe 带 `as_line()`（供日志/hub 记录）。prompt 正文要长、要固定的，存一份到 `skills/`。
2. **注册**：`serve.py` 的 `SKILLS` 列表加一项（`id/name/desc/photoRequired/fields`），`_do_generate` 加一个分流分支；`design_poster.py` 的 `--skill` choices 加上。
3. **配置**：`config.json` 的 `skills` 数组加一项。

前端不用改——tab 和表单字段都是读 `/api/skills` 动态渲染的。
