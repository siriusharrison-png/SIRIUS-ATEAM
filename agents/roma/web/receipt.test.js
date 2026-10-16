import { describe, it, expect } from 'vitest';
import { receiptLines } from './receipt.js';

const card = {
  perfumeName: '鸦',
  perfumeNameEn: 'CROW',
  family: '木质烟熏调',
  caption: '潮湿的夜里，一只黑鸟掠过松木与烟。',
  notes: { top: ['黑胡椒', '佛手柑'], mid: ['雪松'], base: ['广藿香', '麝香'] },
};

describe('receiptLines（小票面板的结构化文字行，纯数据，不拼 HTML）', () => {
  it('始终包含编号、中英文名、香调分类', () => {
    const lines = receiptLines(card, { showNotes: false });
    const kinds = lines.map((l) => l.kind);
    expect(kinds).toContain('serial');
    expect(kinds).toContain('title');
    expect(kinds).toContain('family');
    const title = lines.find((l) => l.kind === 'title');
    expect(title.text).toBe('鸦');
    expect(lines.find((l) => l.kind === 'subtitle').text).toBe('CROW');
  });

  it('showNotes=false 时不含 notes 行；true 且有数据时含三行', () => {
    expect(receiptLines(card, { showNotes: false }).some((l) => l.kind === 'notes')).toBe(false);
    const withNotes = receiptLines(card, { showNotes: true }).filter((l) => l.kind === 'notes');
    expect(withNotes).toHaveLength(3);
    expect(withNotes.map((l) => l.label)).toEqual(['TOP', 'MID', 'BASE']);
  });

  it('showNotes=true 但 notes 全空时不产出 notes 行', () => {
    const lines = receiptLines({ ...card, notes: {} }, { showNotes: true });
    expect(lines.some((l) => l.kind === 'notes')).toBe(false);
  });

  it('caption 为空时不产出 caption 行', () => {
    const lines = receiptLines({ ...card, caption: '' }, { showNotes: false });
    expect(lines.some((l) => l.kind === 'caption')).toBe(false);
  });

  it('什么字段都没有也不抛错，且仍有 serial 行', () => {
    expect(() => receiptLines({}, { showNotes: true })).not.toThrow();
    expect(receiptLines({}, {}).some((l) => l.kind === 'serial')).toBe(true);
  });

  it('文本都是原始字符串（未转义），渲染层用 textContent 负责安全', () => {
    const evil = { ...card, perfumeName: '<script>alert(1)</script>' };
    const title = receiptLines(evil, {}).find((l) => l.kind === 'title');
    expect(title.text).toBe('<script>alert(1)</script>');
  });
});
