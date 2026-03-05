/**
 * 解析 design tokens 文件，提取颜色、间距、字号等规范值
 * 适配 Figma Design Tokens 插件导出格式
 */

export function parseTokens(tokensData) {
  const tokens = {
    colors: new Map(),      // 颜色值 -> token 名称
    spacing: new Set(),     // 允许的间距值
    fontSize: new Map(),    // 字号值 -> token 名称
    radius: new Set(),      // 允许的圆角值
  };

  // 递归遍历 tokens 对象
  function traverse(obj, path = []) {
    if (!obj || typeof obj !== 'object') return;

    // 如果是 token 节点（有 value 或 $value 属性）
    const value = obj.value || obj.$value;
    const type = obj.type || obj.$type;

    if (value !== undefined && type) {
      const tokenName = path.join('-');

      if (type === 'color') {
        // 颜色 token - 处理 8 位和 6 位 hex
        let hex = value;
        if (typeof hex === 'string' && hex.startsWith('#')) {
          // 转换 #rrggbbaa 为 #rrggbb
          if (hex.length === 9) {
            hex = hex.slice(0, 7);
          }
          tokens.colors.set(hex.toLowerCase(), tokenName);
        }
      } else if (type === 'spacing' || type === 'dimension') {
        // 间距 token
        const num = parseFloat(value);
        if (!isNaN(num)) {
          tokens.spacing.add(num);
        }
      } else if (type === 'number' && path.some(p => p.includes('radius'))) {
        // 圆角 token
        const num = parseFloat(value);
        if (!isNaN(num)) {
          tokens.radius.add(num);
        }
      }

      return;
    }

    // 继续遍历子节点
    for (const [key, val] of Object.entries(obj)) {
      if (key.startsWith('$') || key === 'extensions' || key === 'description' || key === 'blendMode') {
        continue; // 跳过元数据
      }
      traverse(val, [...path, key]);
    }
  }

  traverse(tokensData);

  // 如果没有找到间距，使用默认的常用值
  if (tokens.spacing.size === 0) {
    [0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 120].forEach(v => tokens.spacing.add(v));
  }

  // 如果没有找到圆角，使用默认值
  if (tokens.radius.size === 0) {
    [0, 2, 4, 6, 8, 12, 16, 999].forEach(v => tokens.radius.add(v));
  }

  // 输出解析结果（调试用）
  console.log(`   已加载 ${tokens.colors.size} 个颜色 tokens`);
  console.log(`   已加载 ${tokens.spacing.size} 个间距规范值`);
  console.log('');

  return tokens;
}

/**
 * 查找最接近的 token 值
 */
export function findClosestSpacing(value, spacingSet) {
  const arr = Array.from(spacingSet).sort((a, b) => a - b);
  let closest = arr[0];
  let minDiff = Math.abs(value - closest);

  for (const s of arr) {
    const diff = Math.abs(value - s);
    if (diff < minDiff) {
      minDiff = diff;
      closest = s;
    }
  }

  return closest;
}
