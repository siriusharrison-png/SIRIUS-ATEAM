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

function writeGenerated(code) {
  fs.writeFileSync(GENERATED, code);
}

function ensureOutputDir() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// 试渲染第 0 帧：供 contract 闸③，失败抛错。
export async function renderStillFrame(code, props, _config) {
  writeGenerated(code);
  ensureOutputDir();
  const serveUrl = await bundle({ entryPoint: ENTRY });
  const composition = await selectComposition({
    serveUrl,
    id: "Motion",
    inputProps: props,
  });
  const output = path.join(OUTPUT_DIR, ".probe.png");
  await withTimeout(
    renderStill({ composition, serveUrl, output, inputProps: props, frame: 0 }),
    TIMEOUT_MS,
    "渲染超时",
  );
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
      output: outputPath,
      inputProps: props,
    }),
    TIMEOUT_MS,
    "渲染超时",
  );
  return { outputPath };
}
