import { exec } from 'node:child_process';
import { createApp } from './app.js';
import { createProcessManager } from './process-manager.js';
import { createLauncher } from './launcher.js';

const PORT = 7777;
const app = createApp({
  scanRoots: ['agents'],
  processManager: createProcessManager(),
  launcher: createLauncher(),
});

app.listen(PORT, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${PORT}`;
  console.log(`Playground Hub 已启动：${url}`);
  if (process.platform === 'darwin') exec(`open ${url}`);
});
