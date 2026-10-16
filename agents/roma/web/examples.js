// 左侧轮播的默认静态示例：固定卡片信息 + 确定性生成的抽象图案，零网络调用、打开即用。
import { risoSvgFromLuma, RISO_PALETTES } from './riso.js';
import { asciiFromLuma } from './ascii.js';

export const EXAMPLES = [
  {
    id: 'crow',
    card: {
      perfumeName: '鸦', perfumeNameEn: 'CROW', family: '木质烟熏调',
      caption: '潮湿的夜里，一只黑鸟掠过松木与烟。',
      notes: { top: ['黑胡椒', '佛手柑'], mid: ['雪松', '乳香'], base: ['广藿香', '麝香'] },
      visual: { palette: RISO_PALETTES.mono },
    },
  },
  {
    id: 'tigerose',
    card: {
      perfumeName: '猛虎蔷薇', perfumeNameEn: 'TIGEROSE', family: '花香木质调',
      caption: '烈日下的花园，玫瑰混着一丝野性。',
      notes: { top: ['玫瑰', '血橙'], mid: ['牡丹', '天竺葵'], base: ['檀木', '皮革'] },
      visual: { palette: RISO_PALETTES.warm },
    },
  },
  {
    id: 'glacier',
    card: {
      perfumeName: '冰川', perfumeNameEn: 'GLACIER', family: '清新木质调',
      caption: '雪融化的清晨，松针上的第一滴水。',
      notes: { top: ['薄荷', '柠檬'], mid: ['海藻', '铃兰'], base: ['白麝香', '白松'] },
      visual: { palette: RISO_PALETTES.cool },
    },
  },
  {
    id: 'amberdust',
    card: {
      perfumeName: '琥珀尘', perfumeNameEn: 'AMBER DUST', family: '东方琥珀调',
      caption: '旧书店打烊后，光尘落在琥珀色的沉默里。',
      notes: { top: ['肉桂', '小豆蔻'], mid: ['琥珀', '安息香'], base: ['香草', '檀香'] },
      visual: { palette: RISO_PALETTES.classic },
    },
  },
  {
    id: 'saltwind',
    card: {
      perfumeName: '盐风', perfumeNameEn: 'SALT WIND', family: '海洋柑橘调',
      caption: '退潮后的礁石，咸味混着阳光晒过的皮肤。',
      notes: { top: ['海盐', '青柑橘'], mid: ['无花果叶', '鸢尾'], base: ['琥珀灰', '白麝香'] },
      visual: { palette: RISO_PALETTES.cool },
    },
  },
  {
    id: 'inkgarden',
    card: {
      perfumeName: '墨园', perfumeNameEn: 'INK GARDEN', family: '绿意苔藻调',
      caption: '雨后的竹林，墨汁未干的纸页气味。',
      notes: { top: ['绿叶', '竹'], mid: ['苔藻', '无花果'], base: ['雪松', '岩兰草'] },
      visual: { palette: RISO_PALETTES.mono },
    },
  },
];

// 基于字符串 seed 的确定性伪随机：同一个 seed 永远产出同一张"图"，
// 不依赖真实图片也能稳定生成有机感的斑块图案。
function hashSeed(seed) {
  let h = 2166136261;
  for (const ch of String(seed)) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a) {
  return function rand() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 生成 rows×cols 的亮度矩阵（0 黑 ~ 255 白）：几个随机斑点叠加 + 对角渐变，
// 呈现出和真实抽象图类似的有机团块感。
export function generateLuma(seed, cols, rows) {
  const rand = mulberry32(hashSeed(seed));
  const blobs = Array.from({ length: 3 }, () => ({
    cx: rand() * cols, cy: rand() * rows, r: (0.25 + rand() * 0.3) * Math.min(cols, rows),
  }));
  const diag = rand() * 0.2;

  const out = [];
  for (let r = 0; r < rows; r++) {
    const line = [];
    for (let c = 0; c < cols; c++) {
      let dark = 0;
      for (const b of blobs) {
        const d = Math.hypot(c - b.cx, r - b.cy) / b.r;
        dark = Math.max(dark, Math.max(0, 1 - d));
      }
      const gradient = (c / cols + r / rows) / 2 * diag;
      line.push(Math.round(255 * (1 - Math.min(1, dark * 0.9 + gradient))));
    }
    out.push(line);
  }
  return out;
}

// 把一条示例变成可直接渲染的 riso/ascii 艺术字符串，复用正式的渲染器——
// 所以示例看起来和真实生成结果是同一套视觉语言。
export function materializeExample(example) {
  const luma60x54 = generateLuma(example.id, 54, 60);
  const luma80x24 = generateLuma(example.id, 80, 24);
  return {
    risoArt: risoSvgFromLuma(luma60x54, example.card.visual?.palette, { cell: 10 }),
    asciiArt: asciiFromLuma(luma80x24),
  };
}
