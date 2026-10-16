import { describe, it, expect } from 'vitest';
import { buildMessages } from './prompt.js';

describe('buildMessages', () => {
  it('含 JSON 输出约束与关键字段名', () => {
    const msgs = buildMessages('雨后的木头');
    const sys = msgs.find(m => m.role === 'system').content;
    expect(sys).toMatch(/JSON/);
    expect(sys).toMatch(/palette/);
    expect(sys).toMatch(/imagePrompt/);
    expect(sys).toMatch(/perfumeNameEn/);
    expect(msgs.find(m => m.role === 'user').content).toContain('雨后的木头');
  });
});
