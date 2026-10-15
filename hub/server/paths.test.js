import { describe, it, expect } from 'vitest';
import { repoRoot, isInsideRepo, resolveInRepo } from './paths.js';
import path from 'node:path';
import fs from 'node:fs';

describe('paths', () => {
  it('repoRoot 指向包含 agents 目录的仓库根', () => {
    const root = repoRoot();
    expect(path.isAbsolute(root)).toBe(true);
    expect(fs.existsSync(path.join(root, 'agents'))).toBe(true);
  });

  it('isInsideRepo 对仓库内路径返回 true', () => {
    expect(isInsideRepo(path.join(repoRoot(), 'agents/motionlab'))).toBe(true);
  });

  it('isInsideRepo 对越界路径返回 false', () => {
    expect(isInsideRepo('/etc/passwd')).toBe(false);
    expect(isInsideRepo(path.join(repoRoot(), '../elsewhere'))).toBe(false);
  });

  it('resolveInRepo 对越界相对路径抛错', () => {
    expect(() => resolveInRepo('../../etc')).toThrow();
  });

  it('resolveInRepo 对正常相对路径返回绝对路径', () => {
    expect(resolveInRepo('agents/motionlab')).toBe(path.join(repoRoot(), 'agents/motionlab'));
  });
});
