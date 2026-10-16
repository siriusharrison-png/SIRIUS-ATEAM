// Riso（丝网印）风格渲染：源图亮度 → 多油墨叠印的半调网点 SVG。
// 纯函数（nearestInk / pickInks / inkLayers / risoSvgFromLuma）可在 node 下单测；
// risoFromImage 依赖浏览器 canvas，走手动验收。
import { cellAverages, lumaOf } from './ascii.js';

export const PAPER = '#f4f1ea';

// 真实 Risograph 油墨色板子集（荧光粉 / 蓝 / 黄 / 绿 / 橙 / 紫 / 黑）。
// 颜色只会从这张白名单里取，所以拼进 SVG 属性是安全的。
export const RISO_INKS = ['#FF48B0', '#0078BF', '#FFE800', '#00A95C', '#FF6C2F', '#765BA7', '#000000'];
const DEFAULT_INK = '#0078BF';

// 套色错位：各层相对格宽的位移比例，模拟丝网印刷的对位偏差。
const OFFSETS = [[0, 0], [0.15, -0.1], [-0.1, 0.15]];

const r2 = (v) => +v.toFixed(2);

// 只接受 #RGB / #RRGGBB（必须带 #，避免把 "bad"、"fed" 这类单词误当颜色）。
function hexToRgb(hex) {
  let s = String(hex ?? '').trim();
  if (!s.startsWith('#')) return null;
  s = s.slice(1);
  if (/^[0-9a-f]{3}$/i.test(s)) s = s.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(s)) return null;
  const n = parseInt(s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// 任意颜色 → 最接近的 Riso 油墨色；非法输入返回安全默认墨。
export function nearestInk(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return DEFAULT_INK;
  let best = RISO_INKS[0];
  let bestD = Infinity;
  for (const ink of RISO_INKS) {
    const [r, g, b] = hexToRgb(ink);
    const d = (r - rgb[0]) ** 2 + (g - rgb[1]) ** 2 + (b - rgb[2]) ** 2;
    if (d < bestD) { bestD = d; best = ink; }
  }
  return best;
}

// LLM 给的 palette → 去重后的油墨列表（最多 3 个）；全非法时保底一个安全墨。
export function pickInks(palette, max = 3) {
  const out = [];
  for (const c of Array.isArray(palette) ? palette : []) {
    if (!hexToRgb(c)) continue;
    const ink = nearestInk(c);
    if (!out.includes(ink)) out.push(ink);
    if (out.length === max) break;
  }
  return out.length ? out : [DEFAULT_INK];
}

function lightestFirst(inks) {
  const lumaOfInk = (h) => {
    const [r, g, b] = hexToRgb(h) ?? [0, 0, 0];
    return lumaOf(r, g, b);
  };
  return [...inks].sort((a, b) => lumaOfInk(b) - lumaOfInk(a));
}

// 一个格子的叠印：亮度越低，参与上墨的层越多、网点越大。
// 返回 [{ ink, coverage }]，顺序为浅墨在下、深墨在上。纯白（或 NaN）不上墨，留纸白。
export function inkLayers(luma, inks) {
  const v = Number.isFinite(luma) ? Math.min(255, Math.max(0, luma)) : 255;
  const darkness = 1 - v / 255;
  if (darkness < 0.02) return [];
  const sorted = lightestFirst(inks);
  const k = sorted.length;
  const layers = [];
  sorted.forEach((ink, i) => {
    const threshold = i / k;
    if (darkness > threshold) {
      layers.push({ ink, coverage: (darkness - threshold) / (1 - threshold) });
    }
  });
  return layers;
}

// lumaRows: 二维亮度矩阵（0 黑 ~ 255 白）→ 半调网点 SVG 字符串。
// 每种墨一个 <g>，multiply 混合模拟油墨叠印，并按层给轻微位移模拟套色错位。
export function risoSvgFromLuma(lumaRows, palette, { cell = 10, paper = PAPER } = {}) {
  const rows = lumaRows.length;
  const cols = rows ? lumaRows[0].length : 0;
  const W = cols * cell;
  const H = rows * cell;
  const inks = lightestFirst(pickInks(palette));
  const buckets = new Map(inks.map((ink) => [ink, []]));

  lumaRows.forEach((line, r) => {
    line.forEach((v, c) => {
      for (const { ink, coverage } of inkLayers(v, inks)) {
        if (coverage < 0.03) continue; // 太小的点印不出来，省掉
        // 面积正比于覆盖度，所以半径取平方根；略放大 10% 让满墨处网点相连成实地
        const rad = r2((cell / 2) * Math.sqrt(coverage) * 1.1);
        buckets
          .get(ink)
          .push(`<circle cx="${r2(c * cell + cell / 2)}" cy="${r2(r * cell + cell / 2)}" r="${rad}"/>`);
      }
    });
  });

  const groups = inks
    .map((ink, i) => {
      const dots = buckets.get(ink);
      if (!dots.length) return '';
      const [dx, dy] = OFFSETS[i % OFFSETS.length];
      return `<g fill="${ink}" transform="translate(${r2(dx * cell)} ${r2(dy * cell)})" style="mix-blend-mode:multiply">${dots.join('')}</g>`;
    })
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${paper}"/>${groups}</svg>`;
}

// 浏览器侧：把 <img> 画到离屏 canvas，按 cols 列切成方格求平均亮度，再生成 Riso SVG。
export function risoFromImage(img, palette, cols = 60, cell = 10) {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const rows = Math.max(1, Math.round(cols * (h / w)));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  return risoSvgFromLuma(cellAverages(data, w, h, cols, rows), palette, { cell });
}
