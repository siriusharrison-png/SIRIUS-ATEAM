import { describe, it, expect } from 'vitest';
import { escapeXml, wrapText, serialOf, risoFaceSvg, asciiFaceSvg, CARD } from './card.js';

const card = {
  perfumeName: '鸦',
  perfumeNameEn: 'CROW',
  family: '木质烟熏调',
  caption: '潮湿的夜里，一只黑鸟掠过松木与烟。',
  notes: { top: ['黑胡椒', '佛手柑'], mid: ['雪松'], base: ['广藿香', '麝香'] },
};
const riso = '<svg xmlns="http://www.w3.org/2000/svg" width="540" height="600" viewBox="0 0 540 600"></svg>';

describe('escapeXml', () => {
  it('转义 < > & " \'', () => {
    expect(escapeXml('<a href="x">&\'</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&apos;&lt;/a&gt;');
  });
  it('null / undefined 当空串', () => {
    expect(escapeXml(undefined)).toBe('');
    expect(escapeXml(null)).toBe('');
  });
});

describe('wrapText', () => {
  it('按字数折行', () => {
    expect(wrapText('abcdefgh', 3, 5)).toEqual(['abc', 'def', 'gh']);
  });
  it('超过最大行数时截断并加省略号', () => {
    const lines = wrapText('abcdefghij', 3, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith('…')).toBe(true);
  });
  it('空输入返回空数组', () => {
    expect(wrapText('', 10)).toEqual([]);
    expect(wrapText(undefined, 10)).toEqual([]);
  });
});

describe('serialOf', () => {
  it('# + 4 位数字，同一张卡结果稳定', () => {
    expect(serialOf(card)).toMatch(/^#\d{4}$/);
    expect(serialOf(card)).toBe(serialOf({ ...card }));
  });
  it('不同的卡编号不同', () => {
    expect(serialOf(card)).not.toBe(serialOf({ ...card, perfumeName: '猛虎蔷薇', perfumeNameEn: 'TIGEROSE' }));
  });
});

// 图片只保留最小身份标识（编号 + 中英文名），不再带香调/文案——那些挪到右侧小票面板。
describe('risoFaceSvg（图片只带最小身份标识）', () => {
  it('整张卡的画布尺寸与 CARD 一致', () => {
    const svg = risoFaceSvg(card, riso);
    expect(svg).toContain(`viewBox="0 0 ${CARD.w} ${CARD.h}"`);
  });

  it('包含中英双名与编号，不包含香调/文案', () => {
    const svg = risoFaceSvg(card, riso);
    for (const s of ['鸦', 'CROW', serialOf(card)]) expect(svg).toContain(s);
    expect(svg).not.toContain('木质烟熏调');
    expect(svg).not.toContain('潮湿的夜里');
  });

  it('嵌入艺术区 SVG', () => {
    expect(risoFaceSvg(card, riso)).toContain('width="540" height="600"');
  });

  it('不接受/不渲染香调金字塔——即便 card 带了 notes 也不出现', () => {
    const svg = risoFaceSvg(card, riso);
    for (const s of ['TOP', 'MID', 'BASE', '黑胡椒', '雪松', '麝香']) expect(svg).not.toContain(s);
  });

  it('LLM 文本（名字）被转义，不能注入元素', () => {
    const evil = { ...card, perfumeName: '<script>alert(1)</script>', perfumeNameEn: '"><img src=x onerror=alert(1)>' };
    const svg = risoFaceSvg(evil, riso);
    expect(svg).not.toContain('<script>');
    expect(svg).not.toContain('<img');
  });

  it('什么字段都没有也不抛错', () => {
    expect(() => risoFaceSvg({}, riso)).not.toThrow();
  });
});

describe('asciiFaceSvg（同样只带最小身份标识）', () => {
  const art = 'ab<c\n&&  \n@@@';

  it('每行一个 <text>，保留行数', () => {
    const svg = asciiFaceSvg(card, art);
    expect(svg.match(/data-ascii-line/g)).toHaveLength(3);
  });

  it('ASCII 内容里的 < & 被转义，空白被保留', () => {
    const svg = asciiFaceSvg(card, art);
    expect(svg).toContain('ab&lt;c');
    expect(svg).toContain('&amp;&amp;');
    expect(svg).toContain('xml:space="preserve"');
  });

  it('同样带中英双名与画布尺寸，不带香调/文案', () => {
    const svg = asciiFaceSvg(card, art);
    expect(svg).toContain('CROW');
    expect(svg).toContain(`viewBox="0 0 ${CARD.w} ${CARD.h}"`);
    expect(svg).not.toContain('木质烟熏调');
  });
});
