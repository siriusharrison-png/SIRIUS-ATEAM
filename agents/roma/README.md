# roma · 香气卡片生成器

输入一段香味描述，或粘一支香水的名字与香调信息，生成一张纸白墨黑风格的香气卡片——正面 Riso（丝网印半调）、反面 ASCII，点击翻面切换，一键存当前朝向那一面的 PNG。

## 管线

```
描述 / 香水信息
  └─> LLM 一次调用：香调分类、前/中/后调、关键原料、中英双名、一句氛围文案、
      抽象图生成提示词(imagePrompt)
  └─> 网关图像模型：按 imagePrompt 出一张抽象源图
  └─> 同一张源图做两种处理（居中裁切、降采样取每格平均亮度）：
        ├─ 正面 Riso：亮度分档映射到 Risograph 真实油墨色、半调网点、
        │             套色轻微错位、multiply 混合模拟叠印
        └─ 反面 ASCII：亮度映射字符密度梯（@%#*+=-:. ），等宽排版
  └─> 卡面：中英双名 + 香调 + 文案 + 编号；香调金字塔（Top/Mid/Base）
      默认收起，勾选「显示香调」展开
```

ASCII 不是让模型直接吐字符串，而是真实图像经亮度映射转字符——开源通法见
[img2ascii](https://github.com/Technical-1/img2ascii)、
[jsascii](https://github.com/hassadee/jsascii)、
[Asciify](https://github.com/z-------------/Asciify)。

## 启动

**经 Playground Hub（推荐）**：双击仓库根 `hub.command`，在卡片网格里找到 roma，点「启动」。

**单独启动**：双击本目录的 `roma.command`（首次会自动装依赖），或命令行：

```bash
npm install
cp .env.example .env   # 填 GATEWAY_API_KEY（复用 posterdesigner 那个）
npm run server
```

浏览器打开 `http://127.0.0.1:4322`。

## 使用

1. 输入框写一段香味描述，或粘香水名字/香调信息。
2. 点「生成」。先拿结构化香调信息，再出一张抽象源图，最后渲染两面卡片。
3. 点卡片（或「翻面」按钮）在 Riso 面与 ASCII 面之间切换。
4. 「显示香调」勾选后，卡面下方展开 Top/Mid/Base 香调金字塔。
5. 「存图片」导出当前朝向那一面的 PNG。

## 测试

```bash
npm test
```

纯逻辑（prompt 构造、JSON 解析兜底、网关客户端、亮度映射、Riso 叠印、卡面排版、转义）都在 vitest 下单测；翻面/导出/multiply 混合这类依赖浏览器渲染的行为用 Playwright 做过端到端验收。

## 安全边界

- 服务只监听 `127.0.0.1`，端口 4322。
- 不读取、不回显 `.env` 内容。
- 用户输入只作为 LLM 提示词内容，绝不进入 shell / 文件路径拼接。
- 远程图像由服务端下载并转成 data: URI 再交给前端，避免浏览器 canvas 跨域污染。
