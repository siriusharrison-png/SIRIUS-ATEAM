const DEFAULT_PALETTE = ['#FF48B0', '#0078BF', '#FFE800'];

function stripFence(text) {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) return fence[1];
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) return text.slice(first, last + 1);
  return text;
}

// 模型漏给 imagePrompt 时，用 visual 里已有的意象合成一条，避免出图流程中断。
function synthImagePrompt(visual) {
  const hints = [visual.motif, visual.texture, visual.mood].filter(Boolean).join(', ');
  return (
    'abstract organic form, soft grain, monochrome ink wash on paper, high contrast, no text' +
    (hints ? `, inspired by: ${hints}` : '')
  );
}

export function parseCardJson(text) {
  let obj;
  try {
    obj = JSON.parse(stripFence(text).trim());
  } catch {
    throw new Error('模型没返回有效 JSON，换个描述再试一次');
  }
  const notes = obj.notes || {};
  const visual = obj.visual || {};
  return {
    perfumeName: obj.perfumeName || '',
    perfumeNameEn: typeof obj.perfumeNameEn === 'string' ? obj.perfumeNameEn : '',
    family: obj.family || '',
    notes: {
      top: Array.isArray(notes.top) ? notes.top : [],
      mid: Array.isArray(notes.mid) ? notes.mid : [],
      base: Array.isArray(notes.base) ? notes.base : [],
    },
    keyMaterials: Array.isArray(obj.keyMaterials) ? obj.keyMaterials : [],
    visual: {
      palette: Array.isArray(visual.palette) && visual.palette.length ? visual.palette : DEFAULT_PALETTE,
      motif: visual.motif || '',
      texture: visual.texture || '',
      mood: visual.mood || '',
    },
    caption: obj.caption || '',
    imagePrompt:
      typeof obj.imagePrompt === 'string' && obj.imagePrompt.trim()
        ? obj.imagePrompt
        : synthImagePrompt(visual),
    ascii: typeof obj.ascii === 'string' && obj.ascii.trim() ? obj.ascii : '  ~  ~  ~\n (no ascii)\n  ~  ~  ~',
  };
}
