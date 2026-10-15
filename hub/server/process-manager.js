import { spawn } from 'node:child_process';
import { createLogBuffer } from './log-buffer.js';
import { resolveInRepo } from './paths.js';

export function createProcessManager() {
  const procs = new Map(); // id -> { child, pid, startedAt, buf, exited, exitCode, stopping, exitPromise }

  async function start(cap) {
    const existing = procs.get(cap.id);
    if (existing && !existing.exited && !existing.stopping) {
      return { ok: true };
    }
    // 旧进程正在停止：等它真正退出（释放端口）再起新的，避免端口冲突
    if (existing && existing.stopping && existing.exitPromise) {
      await existing.exitPromise;
    }

    const cwd = resolveInRepo(cap.launch.cwd);
    const buf = createLogBuffer();
    const child = spawn(cap.launch.cmd, { cwd, shell: true });
    const rec = {
      child, pid: child.pid, startedAt: Date.now(), buf,
      exited: false, exitCode: null, stopping: false, exitPromise: null,
    };
    rec.exitPromise = new Promise(res => {
      child.on('exit', code => { rec.exited = true; rec.exitCode = code; res(); });
    });
    procs.set(cap.id, rec);

    child.stdout.on('data', d => String(d).split('\n').filter(Boolean).forEach(l => buf.push(l)));
    child.stderr.on('data', d => String(d).split('\n').filter(Boolean).forEach(l => buf.push(l)));

    await new Promise(res => setTimeout(res, 400));
    if (rec.exited) {
      return { ok: false, error: `进程启动后立即退出（退出码 ${rec.exitCode}），请查看日志` };
    }
    return { ok: true };
  }

  function stop(id) {
    const rec = procs.get(id);
    if (rec && !rec.exited) {
      rec.stopping = true;
      try { rec.child.kill('SIGTERM'); } catch { /* 已退出 */ }
    }
    return { ok: true };
  }

  function status(id) {
    const rec = procs.get(id);
    if (!rec || rec.exited || rec.stopping) return { running: false };
    return { running: true, pid: rec.pid, startedAt: rec.startedAt };
  }

  function logs(id) {
    const rec = procs.get(id);
    return rec ? rec.buf.lines() : [];
  }

  return { start, stop, status, logs };
}
