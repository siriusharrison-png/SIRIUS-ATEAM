import { describe, it, expect } from 'vitest';
import { EXAMPLES, generateLuma, materializeExample } from './examples.js';

describe('EXAMPLES（静态预制示例，零网络调用）', () => {
  it('至少 4 条，每条都有完整的卡片信息字段', () => {
    expect(EXAMPLES.length).toBeGreaterThanOrEqual(4);
    for (const ex of EXAMPLES) {
      expect(ex.id).toBeTruthy();
      expect(ex.card.perfumeName).toBeTruthy();
      expect(ex.card.perfumeNameEn).toBeTruthy();
      expect(ex.card.family).toBeTruthy();
      expect(ex.card.caption).toBeTruthy();
      expect(ex.card.notes.top.length).toBeGreaterThan(0);
    }
  });

  it('id 互不相同', () => {
    const ids = EXAMPLES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('generateLuma（确定性生成亮度矩阵，纯函数，不需要真实图片）', () => {
  it('同一个 seed 永远产出同样的矩阵', () => {
    const a = generateLuma('crow', 10, 10);
    const b = generateLuma('crow', 10, 10);
    expect(a).toEqual(b);
  });

  it('不同 seed 产出不同的矩阵', () => {
    const a = generateLuma('crow', 10, 10);
    const b = generateLuma('tigerose', 10, 10);
    expect(a).not.toEqual(b);
  });

  it('输出尺寸符合 rows×cols，所有值落在 0~255', () => {
    const m = generateLuma('x', 6, 4);
    expect(m).toHaveLength(4);
    m.forEach((row) => {
      expect(row).toHaveLength(6);
      row.forEach((v) => {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(255);
      });
    });
  });
});

describe('materializeExample（示例 → 可直接渲染的 riso/ascii 艺术）', () => {
  it('为每条示例产出 risoArt 与 asciiArt 字符串，不抛错', () => {
    for (const ex of EXAMPLES) {
      const art = materializeExample(ex);
      expect(typeof art.risoArt).toBe('string');
      expect(art.risoArt).toContain('<svg');
      expect(typeof art.asciiArt).toBe('string');
      expect(art.asciiArt.length).toBeGreaterThan(0);
    }
  });
});
