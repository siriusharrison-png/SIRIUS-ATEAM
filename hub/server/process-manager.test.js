import { describe, it, expect, afterEach } from 'vitest';
import { createProcessManager } from './process-manager.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const scriptsRel = path.relative(path.resolve(here, '../..'), path.join(here, '__fixtures__/scripts'));

function cap(id, script) {
  return { id, name: id, launch: { type: 'server', cmd: `node ${script}`, cwd: scriptsRel } };
}

let pm;
afterEach(() => { if (pm) pm.stop('ticker'); });

describe('process-manager', () => {
  it('启动常驻进程后 status.running 为 true，日志有输出', async () => {
    pm = createProcessManager();
    const r = await pm.start(cap('ticker', 'tick.js'));
    expect(r.ok).toBe(true);
    expect(pm.status('ticker').running).toBe(true);
    await new Promise(res => setTimeout(res, 150));
    expect(pm.logs('ticker').some(l => l.includes('tick'))).toBe(true);
  });

  it('瞬间退出的进程返回 ok:false 且带退出码与日志', async () => {
    pm = createProcessManager();
    const r = await pm.start(cap('dier', 'die.js'));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/2/);
    expect(pm.logs('dier').some(l => l.includes('boom'))).toBe(true);
  });

  it('stop 后 running 为 false，重复 stop 幂等', async () => {
    pm = createProcessManager();
    await pm.start(cap('ticker', 'tick.js'));
    pm.stop('ticker');
    expect(pm.status('ticker').running).toBe(false);
    expect(pm.stop('ticker')).toEqual({ ok: true });
  });

  it('stop 未知 id 幂等成功', () => {
    pm = createProcessManager();
    expect(pm.stop('nope')).toEqual({ ok: true });
  });
});
