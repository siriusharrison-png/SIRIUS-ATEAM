// 契约校验三道闸：静态检查 → schema 校验 → 试渲染 1 帧；配合自愈循环保证 LLM 代码可渲染。
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { renderStillFrame } from "./render.js";

const AGENT_DIR = path.resolve(fileURLToPath(import.meta.url), "../..");
// 临时目录放在 AGENT_DIR 内，esbuild 才能解析到项目的 node_modules（zod/remotion/react）。
const TMP_BASE = path.join(AGENT_DIR, ".tmp");

// 剥掉 markdown 围栏与前后解释文字，只留代码。
export function stripFences(text) {
  const m = text.match(/```(?:tsx|jsx|ts|js)?\s*([\s\S]*?)```/);
  return m ? m[1] : text;
}

// 闸①：能否 parse + 有无 export default 组件与 propsSchema。
export function gateStatic(code) {
  if (!/export\s+default/.test(code)) {
    return { ok: false, gate: "parse", error: "缺少 export default 组件" };
  }
  if (!/export\s+const\s+propsSchema/.test(code)) {
    return { ok: false, gate: "parse", error: "缺少 export const propsSchema" };
  }
  return { ok: true };
}

// 闸②：propsSchema 每个字段必须有默认值（能 parse 空对象即全部有默认值）。
export function gateSchema(schema) {
  try {
    const defaults = schema.parse({});
    return { ok: true, defaults };
  } catch (e) {
    return {
      ok: false,
      gate: "schema",
      error: "propsSchema 存在无默认值字段: " + e.message,
    };
  }
}

// 把 TSX 代码打包成临时 mjs 并动态 import，取出 propsSchema。
async function loadSchema(code) {
  const esbuild = await import("esbuild");
  fs.mkdirSync(TMP_BASE, { recursive: true });
  const tmpDir = fs.mkdtempSync(path.join(TMP_BASE, "comp-"));
  const inFile = path.join(tmpDir, "comp.tsx");
  const outFile = path.join(tmpDir, "comp.mjs");
  fs.writeFileSync(inFile, code);
  try {
    await esbuild.build({
      entryPoints: [inFile],
      outfile: outFile,
      bundle: true,
      format: "esm",
      platform: "node",
      jsx: "automatic",
      absWorkingDir: AGENT_DIR,
      logLevel: "silent",
    });
    const mod = await import(pathToFileURL(outFile).href + `?t=${Date.now()}`);
    if (!mod.propsSchema) {
      return { error: "打包后未找到 propsSchema 导出" };
    }
    return { schema: mod.propsSchema };
  } catch (e) {
    return { error: "代码无法编译: " + String(e).slice(0, 300) };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// 组装三道闸：静态 → schema → 试渲染。
export async function validateComponent(code, config) {
  const clean = stripFences(code);

  const s = gateStatic(clean);
  if (!s.ok) return s;

  const { schema, error } = await loadSchema(clean);
  if (error) return { ok: false, gate: "parse", error };

  const sc = gateSchema(schema);
  if (!sc.ok) return sc;

  try {
    await renderStillFrame(clean, sc.defaults, config);
  } catch (e) {
    return { ok: false, gate: "render", error: String(e).slice(0, 500) };
  }

  return { ok: true, defaults: sc.defaults, code: clean };
}
