/**
 * 扫描代码文件，检测硬编码的样式值
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname, relative } from 'path';
import { findClosestSpacing } from './tokens-parser.js';

// 要扫描的文件类型
const SCAN_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.css', '.scss', '.vue', '.svelte'];

// 颜色正则
const COLOR_HEX_REGEX = /#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g;

// 间距/字号正则 (匹配 px 值)
const PX_VALUE_REGEX = /:\s*(\d+(?:\.\d+)?)\s*px/g;

// 间距属性
const SPACING_PROPS = ['padding', 'margin', 'gap', 'top', 'right', 'bottom', 'left', 'width', 'height'];

// 忽略的属性（不算间距问题）
const IGNORE_PROPS = ['border', 'outline', 'box-shadow', 'text-shadow'];

// 字号属性
const FONT_SIZE_PROPS = ['font-size', 'fontSize'];

/**
 * 递归获取目录下所有文件
 */
function getAllFiles(dirPath, files = []) {
  const items = readdirSync(dirPath);

  for (const item of items) {
    // 跳过 node_modules 和隐藏目录
    if (item === 'node_modules' || item.startsWith('.')) continue;

    const fullPath = join(dirPath, item);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      getAllFiles(fullPath, files);
    } else if (SCAN_EXTENSIONS.includes(extname(item))) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * 扫描单个文件
 */
function scanFile(filePath, tokens, basePath) {
  const issues = [];
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const relativePath = relative(basePath, filePath);

  lines.forEach((line, index) => {
    const lineNum = index + 1;

    // 跳过注释行
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;

    // 跳过已经使用 var() 或 CSS 变量的行
    if (line.includes('var(--') || line.includes('$')) return;

    // 检测硬编码颜色
    let colorMatch;
    while ((colorMatch = COLOR_HEX_REGEX.exec(line)) !== null) {
      const hexColor = colorMatch[0].toLowerCase();
      const tokenName = tokens.colors.get(hexColor);

      if (tokenName) {
        // 颜色在 tokens 中，但用了硬编码
        issues.push({
          file: relativePath,
          line: lineNum,
          type: 'color',
          value: hexColor,
          message: `颜色 ${hexColor} 应使用 var(--${tokenName})`,
          suggestion: `var(--${tokenName})`,
        });
      }
    }
    COLOR_HEX_REGEX.lastIndex = 0; // 重置正则

    // 检测硬编码间距/字号
    let pxMatch;
    while ((pxMatch = PX_VALUE_REGEX.exec(line)) !== null) {
      const pxValue = parseFloat(pxMatch[1]);
      const fullMatch = pxMatch[0];

      // 跳过边框等不需要检测的属性
      const shouldIgnore = IGNORE_PROPS.some(prop =>
        line.toLowerCase().includes(prop.toLowerCase())
      );
      if (shouldIgnore) continue;

      // 判断是间距还是字号
      const isFontSize = FONT_SIZE_PROPS.some(prop =>
        line.toLowerCase().includes(prop.toLowerCase())
      );

      if (isFontSize) {
        // 字号检测
        const tokenName = tokens.fontSize.get(pxValue);
        if (tokenName) {
          issues.push({
            file: relativePath,
            line: lineNum,
            type: 'fontSize',
            value: `${pxValue}px`,
            message: `字号 ${pxValue}px 应使用 var(--${tokenName})`,
            suggestion: `var(--${tokenName})`,
          });
        }
      } else {
        // 间距检测
        if (!tokens.spacing.has(pxValue)) {
          const closest = findClosestSpacing(pxValue, tokens.spacing);
          issues.push({
            file: relativePath,
            line: lineNum,
            type: 'spacing',
            value: `${pxValue}px`,
            message: `间距 ${pxValue}px 不在规范内`,
            suggestion: `${closest}px`,
          });
        }
      }
    }
    PX_VALUE_REGEX.lastIndex = 0; // 重置正则
  });

  return issues;
}

/**
 * 扫描目录下所有文件
 */
export async function scanFiles(targetPath, tokens) {
  const files = getAllFiles(targetPath);
  let allIssues = [];

  for (const file of files) {
    const issues = scanFile(file, tokens, targetPath);
    allIssues = allIssues.concat(issues);
  }

  return allIssues;
}
