// Remotion 渲染封装：试渲染 1 帧（供契约校验闸③）与渲染完整 mp4，均带超时保护。
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";

const AGENT_DIR = path.resolve(fileURLToPath(import.meta.url), "../..");
const ENTRY = path.join(AGENT_DIR, "remotion", "index.ts");
const GENERATED = path.join(AGENT_DIR, "remotion", "generated", "current.tsx");
const OUTPUT_DIR = path.join(AGENT_DIR, "output");
const TMP_BASE = path.join(AGENT_DIR, ".tmp");

// 把一段组件代码写成独立的临时 Remotion entry（组件 + Root + index），返回 { entry, dir }。
// 用于校验试渲染，避免污染正式的 generated/current.tsx。临时目录须在 AGENT_DIR 内，
// 否则 esbuild/bundler 解析不到项目 node_modules。
function makeTempEntry(code) {
  fs.mkdirSync(TMP_BASE, { recursive: true });
  const dir = fs.mkdtempSync(path.join(TMP_BASE, "render-"));
  fs.writeFileSync(path.join(dir, "comp.tsx"), code);
  fs.writeFileSync(
    path.join(dir, "Root.tsx"),
    `import { Composition } from "remotion";
import Comp, { propsSchema } from "./comp";
export const Root = () => (
  <Composition id="Motion" component={Comp} durationInFrames={450} fps={30}
    width={1920} height={1080} defaultProps={propsSchema.parse({})} />
);
`,
  );
  fs.writeFileSync(
    path.join(dir, "index.ts"),
    `import { registerRoot } from "remotion";
import { Root } from "./Root";
registerRoot(Root);
`,
  );
  return { entry: path.join(dir, "index.ts"), dir };
}

// 把成功通过校验的代码写入正式 generated/current.tsx（供预览与正式渲染）。
export function writeGenerated(code) {
  fs.writeFileSync(GENERATED, code);
}

const TIMEOUT_MS = Number(process.env.RENDER_TIMEOUT_MS ?? 120000);

export function withTimeout(promise, ms, msg) {
  let t;
  const timeout = new Promise((_, rej) => {
    t = setTimeout(() => rej(new Error(msg)), ms);
  });
  return Promise.race([Promise.resolve(promise), timeout]).finally(() =>
    clearTimeout(t),
  );
}

function tsNow() {
  const d = new Date();
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  );
}

function ensureOutputDir() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// 试渲染第 0 帧：供 contract 闸③，失败抛错。
// 走独立临时 entry，不写 current.tsx —— 校验失败不会污染正式文件/预览。
export async function renderStillFrame(code, props, _config) {
  ensureOutputDir();
  const { entry, dir } = makeTempEntry(code);
  try {
    const serveUrl = await bundle({ entryPoint: entry });
    const composition = await selectComposition({
      serveUrl,
      id: "Motion",
      inputProps: props,
    });
    const output = path.join(dir, "probe.png");
    await withTimeout(
      renderStill({ composition, serveUrl, output, inputProps: props, frame: 0 }),
      TIMEOUT_MS,
      "渲染超时",
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// 渲染完整 mp4，存 output/，文件名带时间戳。
export async function renderVideo(code, props, config, { durationSec }) {
  writeGenerated(code);
  ensureOutputDir();
  const serveUrl = await bundle({ entryPoint: ENTRY });
  const fps = config.render.fps;
  const composition = await selectComposition({
    serveUrl,
    id: "Motion",
    inputProps: props,
  });
  composition.durationInFrames = Math.round(durationSec * fps);
  const outputPath = path.join(OUTPUT_DIR, `${tsNow()}-motion.mp4`);
  await withTimeout(
    renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation: outputPath,
      inputProps: props,
    }),
    TIMEOUT_MS,
    "渲染超时",
  );
  return { outputPath };
}
