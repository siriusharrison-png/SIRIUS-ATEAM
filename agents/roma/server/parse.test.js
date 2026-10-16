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
    expect(r.perfumeNameEn).toBe('');
  });

  it('imagePrompt 缺省时由 visual 字段合成，保证出图流程不断', () => {
    const r = parseCardJson('{"perfumeName":"鸦","visual":{"motif":"黑色羽毛","mood":"潮湿的夜"}}');
    expect(r.imagePrompt).toMatch(/abstract/);
    expect(r.imagePrompt).toContain('黑色羽毛');
    expect(r.imagePrompt).toContain('潮湿的夜');
  });

  it('什么字段都没有时也给出可用的通用 imagePrompt', () => {
    expect(parseCardJson('{}').imagePrompt).toMatch(/abstract/);
  });

  it('模型给了 imagePrompt 就原样使用，不覆盖', () => {
    expect(parseCardJson('{"imagePrompt":"my prompt"}').imagePrompt).toBe('my prompt');
  });

  it('保留英文名，缺省为空串', () => {
    expect(parseCardJson('{"perfumeName":"鸦","perfumeNameEn":"CROW"}').perfumeNameEn).toBe('CROW');
  });

  it('彻底非法 JSON 抛可读错误', () => {
    expect(() => parseCardJson('这不是 json 只是一段话')).toThrow();
  });
});
