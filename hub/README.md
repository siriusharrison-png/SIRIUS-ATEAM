# Playground Hub · 本地启动中枢

统一入口，自动发现仓库内的能力（agent / tool），一处管理：真·起/停服务型进程、看状态与日志，交互型一键开终端，配置型一键打开目录。

## 启动

双击仓库根的 **`hub.command`**（首次会自动装依赖），浏览器自动打开 `http://127.0.0.1:7777`。关掉终端窗口即停止中枢。

命令行等价：

```bash
cd hub && npm install && npm start
```

## 三种能力形态

中枢扫描 `agents/*/config.json` 的可选 `launch` 段，按三种形态处理：

| 形态 | 行为 | 卡片动作 |
|---|---|---|
| `server` | 常驻端口进程 | 启动/停止、状态灯、端口、看日志、打开浏览器 |
| `interactive` | 交互式脚本（需终端输入） | 在新终端窗口运行 |
| `doc` | 无进程，纯配置/文档 | 打开目录 |

没有 `launch` 段的能力自动归为 `doc` 型。

## 给新能力接入中枢

在该能力的 `config.json` 顶层加一段 `launch`。无需改动中枢代码，下次启动自动出现。

**server 型**（起常驻服务，如 motionlab）：

```json
"launch": {
  "type": "server",
  "cmd": "npm run server",
  "cwd": "agents/你的能力",
  "port": 4321
}
```

**interactive 型**（交互脚本，如 posterdesigner）：

```json
"launch": {
  "type": "interactive",
  "command": "run.command",
  "cwd": "agents/你的能力"
}
```

**doc 型**（无进程，可省略——缺省即 doc）：

```json
"launch": {
  "type": "doc",
  "docs": ["README.md"]
}
```

字段说明：

- `cwd`：相对仓库根的目录，缺省为 config.json 所在目录。
- `cmd`（server）：在 `cwd` 下执行的启动命令。
- `port`（server）：用于显示和"打开浏览器"，`openUrl` 缺省由此推导。
- `command`（interactive）：相对 `cwd` 的脚本文件。

## 安全边界

- 中枢只监听 `127.0.0.1`，不对外暴露。
- 可执行的命令只来自仓库内 config.json，API 不接受页面传入的任意命令。
- 能力 id 走白名单校验，`cwd` 越界仓库根一律拒绝。
- 非 macOS 平台 interactive 型降级为"复制命令"提示。

## 测试

```bash
cd hub && npm test
```
