# 设计系统管家 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 SIRIUS-ATEAM 团队里新增一个纯静态知识库型角色「设计系统管家」，统一管理组件风格信息，rams-system 仓库保持独立不动。

**Architecture:** 团队仓库内新增 `agents/design-system-keeper/`（config.json + README + knowledge/ 三份 markdown）；在 `index.html` 团队卡片区加一张卡片指向团队目录与 rams-system 线上；在 `hub.json` 登记新成员。组件代码只在 rams-system，团队只做「指针 + 知识层」。

**Tech Stack:** Markdown、JSON、静态 HTML（无构建、无脚本、无测试框架）。

## Global Constraints

- 角色类型 = 纯静态知识库：无 `engine`、无 scripts、`type=knowledge-base`。触发词是语义标签。
- **不修改 rams-system 仓库任何文件**（`~/Desktop/rams-system`）。
- config.json 结构对齐现有角色（参照 `agents/knowledge-keeper/config.json`）。
- 触发词固定为 `/designcomponent`；中文名固定为「设计系统管家」；文件夹固定为 `design-system-keeper`；reportTo 固定为「小秘书」。
- rams-system 地址：repo `https://github.com/siriusharrison-png/rams-system`，playground `https://rams-system.vercel.app`（落地前若转转给出真实域名则替换）。
- 所有文档用中文，非空、无 TODO 占位。
- 提交信息带 `Co-Authored-By: Claude <noreply@anthropic.com>`。

---

### Task 1: 角色注册文件（config.json + README）

**Files:**
- Create: `agents/design-system-keeper/config.json`
- Create: `agents/design-system-keeper/README.md`

**Interfaces:**
- Produces: 角色目录 `agents/design-system-keeper/`，供 Task 4 的 index.html 卡片 `openGitHub('agents/design-system-keeper')` 指向，供 Task 5 的 hub.json 成员「设计系统管家」呼应。

- [ ] **Step 1: 写 config.json**

```json
{
  "name": "设计系统管家",
  "role": "specialist",
  "type": "knowledge-base",
  "description": "承载设计系统组件风格的规范、延展与探索；当前以拉姆斯风格为演示 MVP，未来扩展多风格统一管理。",
  "capabilities": ["style_catalog", "component_spec", "extending_guide"],
  "triggers": ["/designcomponent"],
  "styles": [
    {
      "id": "rams",
      "name": "拉姆斯风格",
      "status": "mvp",
      "repo": "https://github.com/siriusharrison-png/rams-system",
      "playground": "https://rams-system.vercel.app"
    }
  ],
  "inputFrom": ["hub.json", "user_input"],
  "outputTo": ["hub.json", "knowledge/"],
  "reportTo": "小秘书",
  "deployment": "静态知识库 / 无脚本"
}
```

- [ ] **Step 2: 校验 config.json 合法且字段正确**

Run: `python3 -c "import json;d=json.load(open('agents/design-system-keeper/config.json'));assert d['name']=='设计系统管家';assert d['type']=='knowledge-base';assert 'engine' not in d;assert d['triggers']==['/designcomponent'];assert d['styles'][0]['id']=='rams';print('config OK')"`
Expected: 输出 `config OK`

- [ ] **Step 3: 写 README.md**

```markdown
# 设计系统管家

转转的 AI 团队成员，纯静态知识库型角色。负责设计系统 / 组件风格的**规范、延展与风格探索**的讨论与沉淀。

> **类型**：静态知识库，无脚本、不像 agent。触发词 `/designcomponent` 是「我想聊组件」的语义标签，不驱动程序。

---

## 定位

- 承载不同组件风格的信息，当前以**拉姆斯风格**作为演示 MVP。
- 组件代码只在独立仓库 [rams-system](https://github.com/siriusharrison-png/rams-system)，团队里只做统一入口 + 知识层。
- 未来扩展多风格：在 `knowledge/styles/` 下新增一个 `<name>.md` 即可。

## 组件库（拉姆斯风格 MVP）

- **仓库**：https://github.com/siriusharrison-png/rams-system
- **在线 Playground**：https://rams-system.vercel.app
- 内容：14 atoms + 3 modules + 4 devices + 材质体系 + 画廊 Playground（React + Vite）。

## 知识层

- `knowledge/styles/rams.md` — 拉姆斯风格档案（理念 / 材质契约 / 控件清单 / 地址）
- `knowledge/spec.md` — 跨风格通用组件规范（命名 / 变体 / token 契约 / 无障碍）
- `knowledge/extending.md` — 如何新增一个风格或组件

## 协作

- reportTo：小秘书
- 已登记于 `agents/hub.json` 成员表
```

- [ ] **Step 4: Commit**

```bash
git add agents/design-system-keeper/config.json agents/design-system-keeper/README.md
git commit -m "feat: 设计系统管家角色注册（config + README）

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: 风格档案 styles/rams.md

**Files:**
- Create: `agents/design-system-keeper/knowledge/styles/rams.md`

**Interfaces:**
- Consumes: 材质契约 9 个 `--surface-*` 变量（源自 rams-system 已有 spec，见下方内容，无需读取该仓库）。
- Produces: 首个风格档案，作为 Task 3 extending.md「新增风格照此结构」的样板。

- [ ] **Step 1: 写 styles/rams.md**

```markdown
# 拉姆斯风格（Rams）— 风格档案

- **状态**：MVP 演示
- **仓库**：https://github.com/siriusharrison-png/rams-system
- **在线 Playground**：https://rams-system.vercel.app

## 设计理念

以 Dieter Rams 的 Braun 器物为参照的拟物控件体系：真实材质质感、克制的配色、清晰的功能表达。控件只认「材质契约」，不认具体材质，一处切换即可换肤。

## 材质契约（9 个 `--surface-*` 变量）

所有材质实现同一组契约，`data-material` 挂在容器上，其下控件继承换肤：

| 变量 | 含义 | 变量 | 含义 |
| --- | --- | --- | --- |
| `--surface-case` | 外壳面 | `--surface-knob` | 旋钮面 |
| `--surface-text` | 主文字 | `--surface-text-2` | 次文字 |
| `--surface-sh-raised` | 凸起阴影 | `--surface-sh-inset` | 凹陷阴影 |
| `--surface-border` | 描边 | `--surface-groove` | 凹槽 |
| `--surface-backdrop` | 磨砂滤镜（仅玻璃赋值，默认 none） | | |

## 控件清单

- **atoms（14）**：Checkbox、ConvexKey、Display、Fader、JewelLamp、LED、LevelMeter、MagicEye、Nameplate、NumKey、RadioButton、ReflexBar、Rocker、RotarySelector、Slider、SpeakerGrille、SpeedRing、Stepper、Thumbwheel、TunerScale（以仓库 `src/atoms/index.ts` 为准）
- **modules（3）**：以仓库 `src/modules/` 为准
- **devices（4）**：CalculatorET66、MixerChannelMX、RadioT3 等，以仓库 `src/devices/` 为准

> 控件清单以 rams-system 仓库实际导出为准；本档案记录风格定位与契约，不复制代码。
```

- [ ] **Step 2: 校验文件非空且含契约表**

Run: `test -s agents/design-system-keeper/knowledge/styles/rams.md && grep -q "surface-case" agents/design-system-keeper/knowledge/styles/rams.md && echo "rams.md OK"`
Expected: 输出 `rams.md OK`

- [ ] **Step 3: Commit**

```bash
git add agents/design-system-keeper/knowledge/styles/rams.md
git commit -m "docs: 拉姆斯风格档案（材质契约+控件清单）

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: 通用规范 spec.md + 延展指南 extending.md

**Files:**
- Create: `agents/design-system-keeper/knowledge/spec.md`
- Create: `agents/design-system-keeper/knowledge/extending.md`

**Interfaces:**
- Consumes: Task 2 的 `styles/rams.md` 结构（extending.md 引用它作为新增风格的样板）。

- [ ] **Step 1: 写 spec.md**

```markdown
# 通用组件规范（跨风格）

不绑定具体风格的通用约定。任何风格档案都应满足这里的规则。

## 命名

- 组件名用 PascalCase，一个组件一对 `.tsx` + `.module.css`。
- 风格档案文件名用小写风格 id：`knowledge/styles/<id>.md`。
- 设计变量统一走契约前缀（如拉姆斯风格的 `--surface-*`），控件只认契约、不写死具体材质值。

## 变体

- 变体通过属性驱动（如 `data-material`、size、state），不为每个变体复制一份组件。
- 同一契约下的换肤，靠容器层切换属性完成，控件继承。

## Token / 材质契约

- 每个风格必须定义一组完整契约变量，并在风格档案里列出「变量 → 含义」表。
- 新风格接入时，实现同名契约变量即可复用全部控件。

## 无障碍

- 交互控件需有可聚焦状态与键盘可达性。
- 文字与背景对比满足可读性；状态变化不只依赖颜色。
```

- [ ] **Step 2: 写 extending.md**

```markdown
# 延展指南：新增一个风格 / 组件

## 新增一个风格

1. 在 `knowledge/styles/` 新建 `<id>.md`，结构照 [rams.md](styles/rams.md)：理念 / 材质契约表 / 控件清单 / 仓库与线上地址。
2. 在本角色 `config.json` 的 `styles` 数组追加一项：`{ "id", "name", "status", "repo", "playground" }`。
3. 组件代码仍放在该风格自己的仓库，团队里只加档案与入口。
4. 如需团队页可见，在 `index.html` 卡片描述或按钮体现（可选）。

## 新增一个组件（在已有风格内）

1. 在对应风格的源仓库（如 rams-system）按其 EXTENDING 规范新增控件。
2. 确认新控件遵守 [通用规范](spec.md)：命名、变体属性驱动、契约变量、无障碍。
3. 在风格档案的控件清单里补一行（保持「以仓库实际导出为准」的说明）。

## 原则

- 团队知识库不复制组件代码，只承载风格定位、契约与延展约定。
- rams-system 等源仓库保持独立，团队只做统一入口。
```

- [ ] **Step 3: 校验两文件非空**

Run: `test -s agents/design-system-keeper/knowledge/spec.md && test -s agents/design-system-keeper/knowledge/extending.md && echo "spec+extending OK"`
Expected: 输出 `spec+extending OK`

- [ ] **Step 4: Commit**

```bash
git add agents/design-system-keeper/knowledge/spec.md agents/design-system-keeper/knowledge/extending.md
git commit -m "docs: 通用组件规范 + 延展指南

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: 团队页卡片（index.html）

**Files:**
- Modify: `index.html`（在 `<!-- TEAM_CARDS_END -->` 注释前插入新卡片，约在第 1963 行海报设计师卡片之后）

**Interfaces:**
- Consumes: Task 1 的角色目录（`openGitHub('agents/design-system-keeper')`）、Global Constraints 的 playground 地址。
- Produces: 团队页可见的「设计系统管家」卡片。

- [ ] **Step 1: 在 `<!-- TEAM_CARDS_END -->` 前插入卡片**

在 `index.html` 中定位 `<!-- TEAM_CARDS_END -->`（现约第 1964 行），在它前面、海报设计师卡片 `</div>` 之后插入：

```html
        <div class="card">
          <div class="card-header">
            <div class="card-number">006 / DesignSystem</div>
            <div class="card-title">设计系统管家</div>
          </div>
          <div class="card-body">
            <div class="card-role">Design System Keeper</div>
            <div class="card-desc">设计系统 / 组件风格的规范、延展与探索。纯静态知识库，当前以拉姆斯风格为演示 MVP，未来统一管理多风格。</div>
            <div class="card-tasks">
<div><span class="task-marker">—</span> 风格档案</div>
<div><span class="task-marker">—</span> 通用组件规范</div>
<div><span class="task-marker">—</span> 延展指南</div>
            </div>
          </div>
          <div class="card-footer">
            <button class="card-btn" onclick="window.open('https://rams-system.vercel.app', '_blank')">组件库</button>
            <button class="card-btn" onclick="openGitHub('agents/design-system-keeper')">查看</button>
          </div>
        </div>
```

- [ ] **Step 2: 校验卡片已插入且锚点仍在**

Run: `grep -q "设计系统管家" index.html && grep -q "design-system-keeper" index.html && grep -q "TEAM_CARDS_END" index.html && echo "card OK"`
Expected: 输出 `card OK`

- [ ] **Step 3: 目视确认（可选）**

在浏览器打开 `index.html`，确认团队区多出「设计系统管家」卡片，两个按钮：「组件库」新开 rams-system 线上，「查看」新开团队目录。

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: team 页新增设计系统管家卡片

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: hub.json 登记成员

**Files:**
- Modify: `agents/hub.json`（`agents` 对象内新增「设计系统管家」）

**Interfaces:**
- Consumes: Task 1 的角色中文名「设计系统管家」。

- [ ] **Step 1: 在 hub.json 的 `agents` 对象追加成员**

用脚本安全写入（保留原有格式与其余内容），当前时间戳用北京时区：

```bash
python3 - <<'PY'
import json, datetime
p = 'agents/hub.json'
d = json.load(open(p, encoding='utf-8'))
now = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).isoformat()
d['agents']['设计系统管家'] = {"status": "active", "lastSeen": now}
json.dump(d, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('hub updated')
PY
```

- [ ] **Step 2: 校验成员已登记且 JSON 合法**

Run: `python3 -c "import json;d=json.load(open('agents/hub.json'));assert '设计系统管家' in d['agents'];assert d['agents']['设计系统管家']['status']=='active';print('hub OK')"`
Expected: 输出 `hub OK`

- [ ] **Step 3: Commit**

```bash
git add agents/hub.json
git commit -m "chore: hub 登记设计系统管家成员

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: 收尾验收

**Files:** 无新增，仅整体校验。

- [ ] **Step 1: 确认 rams-system 未被改动**

Run: `git -C ~/Desktop/rams-system status --porcelain`
Expected: 无输出（工作区干净，团队改动没碰到它）

- [ ] **Step 2: 确认团队目录结构齐全**

Run: `ls agents/design-system-keeper agents/design-system-keeper/knowledge agents/design-system-keeper/knowledge/styles`
Expected: config.json、README.md、knowledge/、spec.md、extending.md、styles/、rams.md 均在

- [ ] **Step 3: 确认全部改动已提交**

Run: `git -C ~/Desktop/SIRIUS-ATEAM status --porcelain`
Expected: 无输出

---

## Self-Review

**Spec coverage：**
- 角色目录/config/README → Task 1 ✓
- 知识层 A 风格档案 → Task 2 ✓；B 通用规范 + D 延展指南 → Task 3 ✓（C 按 spec 暂缓）
- 团队页卡片（两按钮） → Task 4 ✓
- hub.json 登记 → Task 5 ✓
- rams-system 不改动 → Task 6 Step 1 校验 ✓
- config 无 engine/无 scripts、type=knowledge-base → Task 1 Step 2 校验 ✓

**Placeholder scan：** 无 TODO/TBD；每步含实际内容或实际校验命令。

**Type consistency：** 文件夹名全程 `design-system-keeper`；中文名全程「设计系统管家」；触发词全程 `/designcomponent`；地址常量在 Global Constraints 统一定义，各任务引用一致。
