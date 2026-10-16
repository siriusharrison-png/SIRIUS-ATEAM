import { describe, it, expect } from 'vitest';
import { parseCardJson } from './parse.js';

describe('parseCardJson', () => {
  it('解析被 ```json 代码块包裹的返回', () => {
    const text = '好的\n```json\n{"perfumeName":"X","visual":{"palette":["#FF48B0"]}}\n```\n完成';
    const r = parseCardJson(text);
    expect(r.perfumeName).toBe('X');
    expect(r.visual.palette).toEqual(['#FF48B0']);
  });

  it('缺字段走兜底：ascii/notes/caption', () => {
    const r = parseCardJson('{"perfumeName":"Y"}');
    expect(typeof r.ascii).toBe('string');
    expect(r.notes).toEqual({ top: [], mid: [], base: [] });
    expect(r.visual.palette.length).toBeGreaterThan(0);
    expect(r.caption).toBe('');
    expect(r.imagePrompt).toBe('');
  });

  it('彻底非法 JSON 抛可读错误', () => {
    expect(() => parseCardJson('这不是 json 只是一段话')).toThrow();
  });
});
