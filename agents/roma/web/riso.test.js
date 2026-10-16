import { describe, it, expect } from 'vitest';
import { RISO_INKS, nearestInk, pickInks, inkLayers, risoSvgFromLuma } from './riso.js';

describe('nearestInk', () => {
  it('把任意颜色映射到油墨色板内', () => {
    expect(RISO_INKS).toContain(nearestInk('#ff49b1'));
  });

  it('非法输入返回安全油墨色而不抛错', () => {
    expect(RISO_INKS).toContain(nearestInk('不是颜色'));
    expect(RISO_INKS).toContain(nearestInk(undefined));
  });
});

describe('pickInks', () => {
  it('去重，且全部落在油墨色板内', () => {
    const inks = pickInks(['#FF48B0', '#ff49b1', '#0078BF']);
    expect(new Set(inks).size).toBe(inks.length);
    inks.forEach((i) => expect(RISO_INKS).toContain(i));
  });

  it('过滤非法颜色；全非法或为空时仍保留一个安全油墨', () => {
    expect(pickInks(['乱码', 'red?'])).toHaveLength(1);
    expect(pickInks([])).toHaveLength(1);
    expect(pickInks(undefined)).toHaveLength(1);
  });

  it('最多取 3 个油墨（Riso 套色不宜过多）', () => {
    expect(pickInks(RISO_INKS).length).toBeLessThanOrEqual(3);
  });
});

describe('inkLayers（叠印：每格返回所有参与上墨的墨层，浅墨在下深墨在上）', () => {
  const inks = ['#AAAAAA', '#555555', '#000000'];

  it('纯白不上墨（留纸白）', () => {
    expect(inkLayers(255, inks)).toEqual([]);
  });

  it('纯黑所有墨层叠印，最深的墨在最上且网点铺满', () => {
    const layers = inkLayers(0, inks);
    expect(layers.map((l) => l.ink)).toEqual(['#AAAAAA', '#555555', '#000000']);
    expect(layers[layers.length - 1].coverage).toBeCloseTo(1, 1);
  });

  it('越暗覆盖度越大', () => {
    const a = inkLayers(200, ['#111111'])[0];
    const b = inkLayers(100, ['#111111'])[0];
    expect(b.coverage).toBeGreaterThan(a.coverage);
  });

  it('中间调只让较浅的墨先上，深墨暂不出现', () => {
    const layers = inkLayers(200, inks); // 偏亮：只有最浅的墨参与
    expect(layers.map((l) => l.ink)).toEqual(['#AAAAAA']);
  });

  it('越界/NaN 亮度不抛错，NaN 当作留白', () => {
    expect(() => inkLayers(-20, inks)).not.toThrow();
    expect(() => inkLayers(999, inks)).not.toThrow();
    expect(inkLayers(NaN, inks)).toEqual([]);
  });
});

describe('risoSvgFromLuma', () => {
  const white = [[255, 255], [255, 255]];
  const black = [[0, 0], [0, 0]];

  it('产出合法 SVG，尺寸 = 列/行数 × 格宽', () => {
    const svg = risoSvgFromLuma(black, ['#0078BF'], { cell: 10 });
    expect(svg).toMatch(/^<svg[\s\S]*<\/svg>$/);
    expect(svg).toContain('viewBox="0 0 20 20"');
  });

  it('全白图没有任何网点', () => {
    const svg = risoSvgFromLuma(white, ['#0078BF'], { cell: 10 });
    expect(svg).not.toMatch(/<circle/);
  });

  it('全黑图每格一个网点', () => {
    const svg = risoSvgFromLuma(black, ['#0078BF'], { cell: 10 });
    expect(svg.match(/<circle/g)).toHaveLength(4);
  });

  it('多油墨分层，各层套色偏移不同（模拟丝网错位）', () => {
    const mid = [[60, 60], [60, 60]];
    const svg = risoSvgFromLuma(mid, ['#FF48B0', '#0078BF', '#000000'], { cell: 10 });
    const translates = svg.match(/translate\([^)]*\)/g) || [];
    expect(new Set(translates).size).toBeGreaterThan(1);
  });

  it('空矩阵不抛错', () => {
    expect(() => risoSvgFromLuma([], ['#0078BF'])).not.toThrow();
  });
});
