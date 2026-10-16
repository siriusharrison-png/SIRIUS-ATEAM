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

// 按目标宽高比（宽/高）从源图中居中裁出一块，铺满目标区域而不拉伸变形。
export function coverCrop(srcW, srcH, aspect) {
  if (srcW / srcH > aspect) {
    const sw = Math.round(srcH * aspect);
    return { sx: Math.round((srcW - sw) / 2), sy: 0, sw, sh: srcH };
  }
  const sh = Math.round(srcW / aspect);
  return { sx: 0, sy: Math.round((srcH - sh) / 2), sw: srcW, sh };
}

// 浏览器侧：把 <img> 居中裁切成 aspect 比例，降采样成 cols×rows 的平均亮度矩阵。
// Riso 与 ASCII 两面共用这一步，所以两面看到的是同一块构图。
// 先画到 cols*S × rows*S 的中间画布再按块平均，比一次性大幅缩小更不易混叠。
export function lumaGrid(img, cols, rows, aspect) {
  const S = 6;
  const { sx, sy, sw, sh } = coverCrop(img.naturalWidth || img.width, img.naturalHeight || img.height, aspect);
  const canvas = document.createElement('canvas');
  canvas.width = cols * S;
  canvas.height = rows * S;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff'; // 透明区域按纸白处理
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return cellAverages(data, canvas.width, canvas.height, cols, rows);
}
