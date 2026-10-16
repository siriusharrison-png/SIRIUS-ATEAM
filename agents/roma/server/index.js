import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { agentDir } from './paths.js';
import { createHandler } from './app.js';
import { callLLM } from './llm.js';
import { generateImage } from './image.js';

const DIR = agentDir();
const WEB = path.join(DIR, 'web');
const PORT = Number(process.env.PORT ?? 4322);

function loadEnv() {
  const f = path.join(DIR, '.env');
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnv();

const config = JSON.parse(fs.readFileSync(path.join(DIR, 'config.json'), 'utf8'));
const api = createHandler({ config, callLLMImpl: callLLM, generateImageImpl: generateImage });

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

const server = http.createServer((req, res) => {
  if (req.url === '/config' || req.url === '/generate' || req.url === '/image') return api(req, res);
  // 静态
  const rel = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const file = path.join(WEB, rel);
  if (file.startsWith(WEB) && fs.existsSync(file) && fs.statSync(file).isFile()) {
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    return res.end(fs.readFileSync(file));
  }
  res.writeHead(404); res.end('not found');
});

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${PORT}`;
  console.log(`roma 已启动：${url}`);
  if (process.platform === 'darwin') exec(`open ${url}`);
});
