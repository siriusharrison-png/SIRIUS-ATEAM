import { describe, it, expect } from 'vitest';
import { createLauncher } from './launcher.js';

function cap(type, extra = {}) {
  return { id: 't', name: 't', launch: { type, cwd: 'agents/motionlab', ...extra } };
}

describe('launcher', () => {
  it('macOS interactive 走 osascript 开终端', async () => {
    const calls = [];
    const l = createLauncher({ platform: 'darwin', run: (c) => { calls.push(c); } });
    const r = await l.launchNonServer(cap('interactive', { command: 'poster.command' }));
    expect(r.mode).toBe('terminal');
    expect(calls[0]).toMatch(/osascript/);
    expect(calls[0]).toMatch(/poster\.command/);
  });

  it('非 macOS interactive 降级为复制命令提示', async () => {
    const l = createLauncher({ platform: 'linux', run: () => {} });
    const r = await l.launchNonServer(cap('interactive', { command: 'poster.command' }));
    expect(r.mode).toBe('copy');
    expect(r.hint).toMatch(/poster\.command/);
  });

  it('macOS doc 走 open 目录', async () => {
    const calls = [];
    const l = createLauncher({ platform: 'darwin', run: (c) => { calls.push(c); } });
    const r = await l.launchNonServer(cap('doc'));
    expect(r.mode).toBe('open');
    expect(calls[0]).toMatch(/^open /);
  });
});
