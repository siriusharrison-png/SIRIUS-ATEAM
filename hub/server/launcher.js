import { exec } from 'node:child_process';
import { resolveInRepo } from './paths.js';

function defaultRun(cmd) {
  exec(cmd);
}

export function createLauncher({ platform = process.platform, run = defaultRun } = {}) {
  async function launchNonServer(cap) {
    const cwd = resolveInRepo(cap.launch.cwd);

    if (cap.launch.type === 'interactive') {
      const command = cap.launch.command;
      if (platform === 'darwin') {
        const script = `tell application "Terminal" to do script "cd ${quote(cwd)} && ./${command}"`;
        run(`osascript -e ${quote(script)}`);
        return { ok: true, mode: 'terminal' };
      }
      return { ok: true, mode: 'copy', hint: `cd ${cwd} && ./${command}` };
    }

    // doc 型
    if (platform === 'darwin') {
      run(`open ${quote(cwd)}`);
      return { ok: true, mode: 'open' };
    }
    return { ok: true, mode: 'path', path: cwd };
  }

  return { launchNonServer };
}

function quote(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}
