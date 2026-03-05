// handler.ts - Code Generation Logic

interface NodeData {
  id: string;
  name: string;
  type: string;
  width?: number;
  height?: number;
  fills?: Array<{ type: string; color?: { r: number; g: number; b: number }; opacity?: number }>;
  cornerRadius?: number;
  layoutMode?: string;
  itemSpacing?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  characters?: string;
  fontSize?: number;
  fontWeight?: number;
  children?: NodeData[];
}

interface Specs {
  states?: {
    default?: string;
    hover?: string;
    active?: string;
    disabled?: string;
    loading?: string;
  };
  contentRules?: {
    maxLines?: number;
    overflow?: string;
    emptyState?: string;
  };
  dataBinding?: string;
  visibility?: {
    condition?: string;
    description?: string;
  };
}

// 颜色映射到 Tailwind 类名
function colorToTailwind(color: { r: number; g: number; b: number }, type: 'bg' | 'text' = 'bg'): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);

  // 常见颜色映射（匹配 JIEKOU 项目的设计系统）
  const colorMap: Record<string, string> = {
    '24,160,251': 'primary',      // #18a0fb - brand
    '255,255,255': 'white',
    '0,0,0': 'black',
    '51,51,51': 'common-dark-1',  // #333
    '102,102,102': 'common-dark-2', // #666
    '153,153,153': 'common-dark-3', // #999
    '240,240,240': 'common-gray-1', // #f0f0f0
    '229,229,229': 'common-gray-2', // #e5e5e5
  };

  const key = `${r},${g},${b}`;
  if (colorMap[key]) {
    return `${type}-${colorMap[key]}`;
  }

  // 返回 hex 作为 arbitrary value
  const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  return `${type}-[${hex}]`;
}

// 间距映射
function spacingToTailwind(value: number): string {
  const spacingMap: Record<number, string> = {
    0: '0',
    4: '1',
    8: '2',
    12: '3',
    16: '4',
    20: '5',
    24: '6',
    32: '8',
    40: '10',
    48: '12',
    64: '16',
  };
  return spacingMap[value] || `[${value}px]`;
}

// 圆角映射
function radiusToTailwind(value: number): string {
  if (value === 0) return '';
  if (value === 4) return 'rounded-sm';
  if (value === 6) return 'rounded-md';
  if (value === 8) return 'rounded-lg';
  if (value >= 9999) return 'rounded-full';
  return `rounded-[${value}px]`;
}

// 生成组件代码
export function generateCode(nodeData: NodeData, specs?: Specs): string {
  const componentName = toPascalCase(nodeData.name);
  const classNames = extractClassNames(nodeData);
  const children = generateChildren(nodeData);

  let code = `export default function ${componentName}() {\n`;
  code += `  return (\n`;
  code += `    <div className="${classNames.join(' ')}">\n`;
  code += children;
  code += `    </div>\n`;
  code += `  )\n`;
  code += `}`;

  // 添加规范注释
  if (specs) {
    code = generateSpecsComment(specs) + '\n\n' + code;
  }

  return code;
}

function extractClassNames(node: NodeData): string[] {
  const classes: string[] = [];

  // Layout
  if (node.layoutMode === 'HORIZONTAL') {
    classes.push('flex');
  } else if (node.layoutMode === 'VERTICAL') {
    classes.push('flex', 'flex-col');
  }

  // Gap
  if (node.itemSpacing) {
    classes.push(`gap-${spacingToTailwind(node.itemSpacing)}`);
  }

  // Padding
  if (node.paddingTop || node.paddingRight || node.paddingBottom || node.paddingLeft) {
    const pt = node.paddingTop || 0;
    const pr = node.paddingRight || 0;
    const pb = node.paddingBottom || 0;
    const pl = node.paddingLeft || 0;

    if (pt === pr && pr === pb && pb === pl) {
      classes.push(`p-${spacingToTailwind(pt)}`);
    } else {
      if (pt) classes.push(`pt-${spacingToTailwind(pt)}`);
      if (pr) classes.push(`pr-${spacingToTailwind(pr)}`);
      if (pb) classes.push(`pb-${spacingToTailwind(pb)}`);
      if (pl) classes.push(`pl-${spacingToTailwind(pl)}`);
    }
  }

  // Background
  if (node.fills && node.fills.length > 0) {
    const fill = node.fills[0];
    if (fill.type === 'SOLID' && fill.color) {
      classes.push(colorToTailwind(fill.color, 'bg'));
    }
  }

  // Border radius
  if (node.cornerRadius) {
    const radius = radiusToTailwind(node.cornerRadius);
    if (radius) classes.push(radius);
  }

  return classes;
}

function generateChildren(node: NodeData, indent: number = 3): string {
  if (!node.children || node.children.length === 0) {
    return '';
  }

  const spaces = '  '.repeat(indent);
  let result = '';

  for (const child of node.children) {
    if (child.type === 'TEXT') {
      const textClasses = extractTextClasses(child);
      result += `${spaces}<span className="${textClasses.join(' ')}">${child.characters || ''}</span>\n`;
    } else if (child.type === 'FRAME' || child.type === 'GROUP') {
      const classes = extractClassNames(child);
      result += `${spaces}<div className="${classes.join(' ')}">\n`;
      result += generateChildren(child, indent + 1);
      result += `${spaces}</div>\n`;
    }
  }

  return result;
}

function extractTextClasses(node: NodeData): string[] {
  const classes: string[] = [];

  // Font size
  if (node.fontSize) {
    const sizeMap: Record<number, string> = {
      12: 'text-xs',
      14: 'text-sm',
      16: 'text-base',
      18: 'text-lg',
      20: 'text-xl',
      24: 'text-2xl',
    };
    classes.push(sizeMap[node.fontSize as number] || `text-[${node.fontSize}px]`);
  }

  // Font weight
  if (node.fontWeight) {
    const weightMap: Record<number, string> = {
      400: '',
      500: 'font-medium',
      600: 'font-semibold',
      700: 'font-bold',
    };
    const weight = weightMap[node.fontWeight as number];
    if (weight) classes.push(weight);
  }

  // Text color
  if (node.fills && node.fills.length > 0) {
    const fill = node.fills[0];
    if (fill.type === 'SOLID' && fill.color) {
      classes.push(colorToTailwind(fill.color, 'text'));
    }
  }

  return classes;
}

function generateSpecsComment(specs: Specs): string {
  const lines: string[] = ['/**', ' * Component Specs'];

  if (specs.states) {
    lines.push(' *');
    lines.push(' * States:');
    if (specs.states.default) lines.push(` *   - default: ${specs.states.default}`);
    if (specs.states.hover) lines.push(` *   - hover: ${specs.states.hover}`);
    if (specs.states.active) lines.push(` *   - active: ${specs.states.active}`);
    if (specs.states.disabled) lines.push(` *   - disabled: ${specs.states.disabled}`);
    if (specs.states.loading) lines.push(` *   - loading: ${specs.states.loading}`);
  }

  if (specs.contentRules) {
    lines.push(' *');
    lines.push(' * Content Rules:');
    if (specs.contentRules.maxLines) lines.push(` *   - maxLines: ${specs.contentRules.maxLines}`);
    if (specs.contentRules.overflow) lines.push(` *   - overflow: ${specs.contentRules.overflow}`);
    if (specs.contentRules.emptyState) lines.push(` *   - emptyState: "${specs.contentRules.emptyState}"`);
  }

  if (specs.visibility?.condition) {
    lines.push(' *');
    lines.push(' * Visibility:');
    lines.push(` *   - condition: ${specs.visibility.condition}`);
    if (specs.visibility.description) lines.push(` *   - ${specs.visibility.description}`);
  }

  lines.push(' */');
  return lines.join('\n');
}

function toPascalCase(str: string): string {
  return str
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
    .replace(/^(.)/, (c) => c.toUpperCase());
}
