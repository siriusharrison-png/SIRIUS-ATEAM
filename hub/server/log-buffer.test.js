import { describe, it, expect } from 'vitest';
import { createLogBuffer } from './log-buffer.js';

describe('createLogBuffer', () => {
  it('保留最近 N 行，丢弃最旧的', () => {
    const buf = createLogBuffer(3);
    buf.push('a'); buf.push('b'); buf.push('c'); buf.push('d');
    expect(buf.lines()).toEqual(['b', 'c', 'd']);
  });

  it('lines() 返回副本，外部修改不影响内部', () => {
    const buf = createLogBuffer(5);
    buf.push('x');
    const snap = buf.lines();
    snap.push('y');
    expect(buf.lines()).toEqual(['x']);
  });
});
