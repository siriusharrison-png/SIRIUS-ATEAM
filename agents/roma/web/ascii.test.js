import { describe, it, expect } from 'vitest';
import { asciiCard } from './ascii.js';

describe('asciiCard', () => {
  it('标题含香水名与香调', () => {
    const out = asciiCard({ perfumeName: '玫瑰', family: '花香调', ascii: 'xxx' });
    expect(out).toMatch(/玫瑰/);
    expect(out).toMatch(/花香调/);
    expect(out).toContain('xxx');
  });

  it('ascii 为空也不抛错', () => {
    expect(() => asciiCard({ perfumeName: 'A', family: '', ascii: '' })).not.toThrow();
  });
});
