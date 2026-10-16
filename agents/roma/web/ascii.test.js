import { describe, it, expect } from 'vitest';
import { asciiFromLuma, DEFAULT_RAMP, lumaOf, cellAverages } from './ascii.js';

describe('asciiFromLuma（亮度 → 字符密度）', () => {
  it('全黑映射为最密字符，全白映射为空格', () => {
    const out = asciiFromLuma([[0, 255]]);
    expect(out[0]).toBe(DEFAULT_RAMP[0]);
    expect(out[1]).toBe(' ');
  });

  it('亮度越高字符越稀疏（单调）', () => {
    const row = [0, 64, 128, 192, 255];
    const out = asciiFromLuma([row]);
    const idx = [...out].map((ch) => DEFAULT_RAMP.indexOf(ch));
    for (let i = 1; i < idx.length; i++) expect(idx[i]).toBeGreaterThanOrEqual(idx[i - 1]);
  });

  it('多行输出以换行连接，行数与输入一致', () => {
    const out = asciiFromLuma([[0, 0], [255, 255], [128, 128]]);
    expect(out.split('\n')).toHaveLength(3);
  });

  it('空输入、越界亮度值不抛错', () => {
    expect(asciiFromLuma([])).toBe('');
    expect(() => asciiFromLuma([[-50, 999, NaN]])).not.toThrow();
  });

  it('支持自定义字符梯', () => {
    // 最暗 → 梯子首字符，最亮 → 梯子末字符（"白即空格"来自默认梯子末尾的空格，不是硬编码）
    const out = asciiFromLuma([[0, 255]], '#.');
    expect(out).toBe('#.');
  });
});

describe('lumaOf（RGB → 亮度）', () => {
  it('纯白 255、纯黑 0，绿色权重大于蓝色', () => {
    expect(Math.round(lumaOf(255, 255, 255))).toBe(255);
    expect(lumaOf(0, 0, 0)).toBe(0);
    expect(lumaOf(0, 255, 0)).toBeGreaterThan(lumaOf(0, 0, 255));
  });
});

describe('cellAverages（像素 → 字符格平均亮度）', () => {
  it('把 RGBA 像素块按格求平均，输出 rows×cols 的亮度矩阵', () => {
    // 4x2 图：左半黑、右半白；切成 2 列 1 行
    const px = [];
    for (let y = 0; y < 2; y++) for (let x = 0; x < 4; x++) {
      const v = x < 2 ? 0 : 255;
      px.push(v, v, v, 255);
    }
    const m = cellAverages(new Uint8ClampedArray(px), 4, 2, 2, 1);
    expect(m).toHaveLength(1);
    expect(m[0]).toHaveLength(2);
    expect(m[0][0]).toBeCloseTo(0, 0);
    expect(m[0][1]).toBeCloseTo(255, 0);
  });
});
