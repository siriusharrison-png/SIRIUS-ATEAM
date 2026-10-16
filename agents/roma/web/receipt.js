// 小票面板：把卡片信息拆成一组结构化行，供 app.js 逐行渐显并用 textContent 渲染
// （所以这里只返回原始文本，不做任何转义——转义是渲染层的职责）。
// 纯函数，可在 node 下单测。
import { serialOf } from './card.js';

function notesRows(notes) {
  const n = notes ?? {};
  const rows = [['TOP', n.top], ['MID', n.mid], ['BASE', n.base]];
  return rows
    .filter(([, items]) => Array.isArray(items) && items.length)
    .map(([label, items]) => ({ kind: 'notes', label, items }));
}

// 返回按展示顺序排列的行数组：serial → title → subtitle → family → [caption] → [notes×≤3]
export function receiptLines(card, { showNotes = false } = {}) {
  const c = card ?? {};
  const lines = [
    { kind: 'serial', text: serialOf(c) },
    { kind: 'title', text: c.perfumeName ?? '' },
    { kind: 'subtitle', text: c.perfumeNameEn ?? '' },
    { kind: 'family', text: c.family ?? '' },
  ];
  const caption = String(c.caption ?? '').trim();
  if (caption) lines.push({ kind: 'caption', text: caption });
  if (showNotes) lines.push(...notesRows(c.notes));
  return lines;
}
