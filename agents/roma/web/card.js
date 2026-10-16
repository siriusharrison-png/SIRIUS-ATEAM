// 卡面排版：把艺术区（Riso 或 ASCII）+ 最小身份标识（编号 + 中英双名）拼成一份完整 SVG。
// 页面预览和导出 PNG 用同一份 SVG，所以"所见即所存"。
// 图片本身不再带香调/文案——那些信息在右侧小票面板（见 receipt.js）展示，
// 图片只负责视觉与一个可辨认的身份标签。
// 全部是纯函数，可在 node 下单测。LLM 生成的文字一律经 escapeXml 再拼进 SVG。

export const CARD = { w: 600, h: 820 };
export const ART = { x: 30, y: 40, w: 540, h: 600 };
// Riso 艺术区：54×60 个方格，每格 10px，正好铺满 ART
export const RISO_GRID = { cols: 54, rows: 60, cell: 10 };
// ASCII 艺术区：80 列 × 48 行；字号 11px 的等宽字约宽 6.6px，行高 12.5px，正好铺满 ART
export const ASCII = { cols: 80, rows: 48, fontSize: 11, lineH: 12.5 };

const PAPER = '#f4f1ea';
const INK = '#1a1a1a';
const MUTED = '#8a8378';
const SERIF = "'Songti SC','Noto Serif SC','STSong',Georgia,'Times New Roman',serif";
const MONO = "ui-monospace,'SF Mono',Menlo,Consolas,monospace";

export function escapeXml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]
  ));
}

// 按字数折行（按码点算，中英文都适用）；超出 maxLines 时最后一行以省略号收尾。
// 供 receipt.js 复用。
export function wrapText(text, perLine, maxLines = 99) {
  const chars = [...String(text ?? '').trim()];
  if (!chars.length) return [];
  const lines = [];
  for (let i = 0; i < chars.length; i += perLine) lines.push(chars.slice(i, i + perLine).join(''));
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = [...kept[maxLines - 1]].slice(0, Math.max(1, perLine - 1)).join('') + '…';
  return kept;
}

// 小票式编号：由名字稳定地算出 4 位数，同一张卡永远同一个号。供 receipt.js 复用。
export function serialOf(card) {
  const key = `${card?.perfumeName ?? ''}|${card?.perfumeNameEn ?? ''}|${card?.family ?? ''}`;
  let h = 5381;
  for (const ch of key) h = ((h * 33) ^ ch.codePointAt(0)) >>> 0;
  return `#${String(h % 10000).padStart(4, '0')}`;
}

function frame(card, art, tag) {
  const c = card ?? {};
  const name = c.perfumeName ?? '';
  const nameLen = [...name].length;
  const nameSize = nameLen <= 4 ? 40 : nameLen <= 8 ? 32 : 24;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD.w}" height="${CARD.h}" viewBox="0 0 ${CARD.w} ${CARD.h}">` +
    `<rect width="${CARD.w}" height="${CARD.h}" fill="${PAPER}"/>` +
    `<rect x="10" y="10" width="${CARD.w - 20}" height="${CARD.h - 20}" fill="none" stroke="${INK}" stroke-width="0.75"/>` +
    `<text x="30" y="30" font-family="${MONO}" font-size="11" letter-spacing="1" fill="${INK}">${escapeXml(serialOf(c))}</text>` +
    `<text x="570" y="30" text-anchor="end" font-family="${MONO}" font-size="9" letter-spacing="2" fill="${MUTED}">ROMA · ${tag}</text>` +
    art +
    `<text x="30" y="672" font-family="${SERIF}" font-size="${nameSize}" font-weight="700" fill="${INK}">${escapeXml(name)}</text>` +
    `<text x="30" y="700" font-family="${MONO}" font-size="12" letter-spacing="4" fill="${MUTED}">${escapeXml(c.perfumeNameEn ?? '')}</text>` +
    `</svg>`
  );
}

// risoSvg 由 riso.js 生成（内部可信），整体平移到艺术区。
export function risoFaceSvg(card, risoSvg) {
  return frame(card, `<g transform="translate(${ART.x} ${ART.y})">${risoSvg}</g>`, 'RISO');
}

// 每行一个 <text>，保留空白；字符一律转义。
export function asciiFaceSvg(card, asciiText) {
  const lines = String(asciiText ?? '').split('\n');
  const art = lines
    .map((line, i) => (
      `<text data-ascii-line xml:space="preserve" x="${ART.x}" y="${r2(ART.y + ASCII.fontSize + i * ASCII.lineH)}" ` +
      `font-family="${MONO}" font-size="${ASCII.fontSize}" fill="${INK}" style="white-space:pre">${escapeXml(line)}</text>`
    ))
    .join('');
  return frame(card, art, 'ASCII');
}

const r2 = (v) => +v.toFixed(2);
