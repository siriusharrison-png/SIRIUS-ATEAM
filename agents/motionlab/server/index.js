// MotionLab 本地 http 服务：/config、/generate、/render，其余静态托管 web/。
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { callLLM } from "./llm.js";
import { validateComponent } from "./contract.js";
import { renderVideo } from "./render.js";
import { estimateCost, addToTotal } from "./cost.js";
import { generate } from "./orchestrate.js";

const AGENT_DIR = path.resolve(fileURLToPath(import.meta.url), "../..");
const WEB_DIR = path.join(AGENT_DIR, "web");
const COST_FILE = path.join(AGENT_DIR, ".cost.json");
const PORT = Number(process.env.PORT ?? 4321);

const config = JSON.parse(
  fs.readFileSync(path.join(AGENT_DIR, "config.json"), "utf8"),
);

// 启动时把 .env 读进环境变量（已设置的不覆盖），与 posterdesigner 一致。
function loadEnv() {
  const envFile = path.join(AGENT_DIR, ".env");
  if (!fs.existsSync(envFile)) return;
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim();
    if (!(k in process.env)) process.env[k] = v;
  }
}
loadEnv();

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp4": "video/mp4",
  ".png": "image/png",
};

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function readTotal() {
  try {
    return JSON.parse(fs.readFileSync(COST_FILE, "utf8")).total ?? 0;
  } catch {
    return 0;
  }
}

function serveStatic(req, res) {
  let rel = decodeURIComponent(req.url.split("?")[0]);
  if (rel === "/") rel = "/index.html";
  const filePath = path.join(WEB_DIR, rel);
  // 防目录穿越
  if (!filePath.startsWith(WEB_DIR)) return send(res, 403, { error: "forbidden" });
  fs.readFile(filePath, (err, buf) => {
    if (err) return send(res, 404, { error: "not found" });
    send(res, 200, buf, MIME[path.extname(filePath)] ?? "application/octet-stream");
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = req.url.split("?")[0];

    if (req.method === "GET" && url === "/config") {
      return send(res, 200, {
        models: config.models.map((m) => ({ id: m.id, label: m.label })),
        render: config.render,
        total: readTotal(),
      });
    }

    if (req.method === "POST" && url === "/generate") {
      const { modelId, desc } = await readBody(req);
      const r = await generate({
        modelId,
        userDesc: desc,
        config,
        deps: { callLLM, validateComponent },
      });
      if (r.error) return send(res, 422, { error: r.error });
      const { cost } = estimateCost(modelId, r.usage, config);
      const { total } = addToTotal(cost, COST_FILE);
      return send(res, 200, {
        code: r.code,
        defaults: r.defaults,
        attempts: r.attempts,
        cost,
        total,
      });
    }

    if (req.method === "POST" && url === "/render") {
      const { code, props, durationSec } = await readBody(req);
      const { outputPath } = await renderVideo(code, props, config, {
        durationSec: durationSec ?? config.render.defaultDurationSec,
      });
      return send(res, 200, { outputPath: path.basename(outputPath) });
    }

    return serveStatic(req, res);
  } catch (e) {
    send(res, 500, { error: String(e).slice(0, 500) });
  }
});

server.listen(PORT, () => {
  console.log(`MotionLab 工作台: http://localhost:${PORT}`);
});
