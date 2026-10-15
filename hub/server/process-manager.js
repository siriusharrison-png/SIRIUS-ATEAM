import { spawn } from 'node:child_process';
import { createLogBuffer } from './log-buffer.js';
import { resolveInRepo } from './paths.js';

export function createProcessManager() {
  const procs = new Map(); // id -> { child, pid, startedAt, buf, exited, exitCode }

  function start(cap) {
    return new Promise((resolve) => {
      const existing = procs.get(cap.id);
      if (existing && !existing.exited) {
        return resolve({ ok: true });
      }
      const cwd = resolveInRepo(cap.launch.cwd);
      const buf = createLogBuffer();
      const child = spawn(cap.launch.cmd, { cwd, shell: true });
      const rec = { child, pid: child.pid, startedAt: Date.now(), buf, exited: false, exitCode: null };
      procs.set(cap.id, rec);

      child.stdout.on('data', d => String(d).split('\n').filter(Boolean).forEach(l => buf.push(l)));
      child.stderr.on('data', d => String(d).split('\n').filter(Boolean).forEach(l => buf.push(l)));
      child.on('exit', code => { rec.exited = true; rec.exitCode = code; });

      setTimeout(() => {
        if (rec.exited) {
          resolve({ ok: false, error: `进程启动后立即退出（退出码 ${rec.exitCode}），请查看日志` });
        } else {
          resolve({ ok: true });
        }
      }, 400);
    });
  }

  function stop(id) {
    const rec = procs.get(id);
    if (rec && !rec.exited) {
      try { rec.child.kill('SIGTERM'); } catch { /* 已退出 */ }
      rec.exited = true;
    }
    return { ok: true };
  }

  function status(id) {
    const rec = procs.get(id);
    if (!rec || rec.exited) return { running: false };
    return { running: true, pid: rec.pid, startedAt: rec.startedAt };
  }

  function logs(id) {
    const rec = procs.get(id);
    return rec ? rec.buf.lines() : [];
  }

  return { start, stop, status, logs };
}
