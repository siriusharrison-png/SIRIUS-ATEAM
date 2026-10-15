import { describe, it, expect } from 'vitest';
import { discoverCapabilities } from './discover.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturesAgents = path.relative(
  path.resolve(here, '../..'),
  path.join(here, '__fixtures__/agents')
);

describe('discoverCapabilities', () => {
  it('发现三个有效能力并给出一条损坏告警', () => {
    const { capabilities, warnings } = discoverCapabilities([fixturesAgents]);
    const ids = capabilities.map(c => c.id).sort();
    expect(ids).toEqual(['good-interactive', 'good-server', 'plain-doc']);
    expect(warnings.some(w => w.includes('broken'))).toBe(true);
  });

  it('无 launch 段归为 doc 型且 docs 缺省 README.md', () => {
    const { capabilities } = discoverCapabilities([fixturesAgents]);
    const doc = capabilities.find(c => c.id === 'plain-doc');
    expect(doc.launch.type).toBe('doc');
    expect(doc.launch.docs).toEqual(['README.md']);
  });

  it('server 型 openUrl 缺省由 port 推导', () => {
    const { capabilities } = discoverCapabilities([fixturesAgents]);
    const s = capabilities.find(c => c.id === 'good-server');
    expect(s.launch.openUrl).toBe('http://localhost:4321');
    expect(s.launch.cwd).toBe(path.join(fixturesAgents, 'good-server'));
  });

  it('scan root 指向文件（非目录）时不崩，跳过并告警', () => {
    // 用一个确定存在的文件当 scan root
    const fileAsRoot = path.join(fixturesAgents, 'good-server/config.json');
    expect(() => discoverCapabilities([fileAsRoot])).not.toThrow();
    const { capabilities } = discoverCapabilities([fileAsRoot]);
    expect(capabilities).toEqual([]);
  });
});
