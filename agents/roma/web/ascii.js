// 图像 → ASCII：亮度映射字符密度（开源通法：img2ascii / jsascii / Asciify）。
// 纯函数部分（asciiFromLuma / lumaOf / cellAverages）可在 node 下单测；
// asciiFromImage 依赖浏览器 canvas，走手动验收。

// 由密到疏：最暗像素用 '@'，最亮像素用空格（纸白背景）。
export const DEFAULT_RAMP = '@%#*+=-:. ';

// Rec.601 亮度加权：绿色权重最大。
export function lumaOf(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

// lumaRows: number[][]，每个值 0(黑)~255(白)；越界/NaN 按白处理或夹紧。
export function asciiFromLuma(lumaRows, ramp = DEFAULT_RAMP) {
  const last = ramp.length - 1;
  return lumaRows
    .map((row) =>
      row
        .map((v) => {
          const n = Number.isFinite(v) ? Math.min(255, Math.max(0, v)) : 255;
          return ramp[Math.round((n / 255) * last)];
        })
        .join('')
    )
    .join('\n');
}

// data: RGBA 像素（Uint8ClampedArray）；把 width×height 的图切成 rows×cols 格，返回每格平均亮度。
// 透明像素按纸白底合成，避免透明区被当成黑色。
export function cellAverages(data, width, height, cols, rows) {
  const out = [];
  for (let r = 0; r < rows; r++) {
    const y0 = Math.floor((r * height) / rows);
    const y1 = Math.max(y0 + 1, Math.floor(((r + 1) * height) / rows));
    const line = [];
    for (let c = 0; c < cols; c++) {
      const x0 = Math.floor((c * width) / cols);
      const x1 = Math.max(x0 + 1, Math.floor(((c + 1) * width) / cols));
      let sum = 0;
      let count = 0;
      for (let y = y0; y < y1 && y < height; y++) {
        for (let x = x0; x < x1 && x < width; x++) {
          const i = (y * width + x) * 4;
          const a = data[i + 3] / 255;
          const l = lumaOf(data[i], data[i + 1], data[i + 2]);
          sum += l * a + 255 * (1 - a);
          count++;
        }
      }
      line.push(count ? sum / count : 255);
    }
    out.push(line);
  }
  return out;
}

// 浏览器侧：把 <img> 画到离屏 canvas，按 cols 列转 ASCII。
// 等宽字符高约为宽的 2 倍，所以行数按 0.5 折算以保持比例。
export function asciiFromImage(img, cols = 80, ramp = DEFAULT_RAMP) {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const rows = Math.max(1, Math.round(cols * (h / w) * 0.5));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  return asciiFromLuma(cellAverages(data, w, h, cols, rows), ramp);
}
