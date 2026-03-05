/**
 * 输出检测报告
 */

export function printReport(issues, colors) {
  if (issues.length === 0) {
    console.log(colors.green('✅ 太棒了！没有发现问题，代码完全符合设计规范！\n'));
    return;
  }

  // 按文件分组
  const grouped = {};
  for (const issue of issues) {
    if (!grouped[issue.file]) {
      grouped[issue.file] = [];
    }
    grouped[issue.file].push(issue);
  }

  // 输出每个文件的问题
  for (const [file, fileIssues] of Object.entries(grouped)) {
    console.log(colors.yellow(`📄 ${file}`));

    for (const issue of fileIssues) {
      const icon = getIcon(issue.type);
      const lineInfo = colors.dim(`第${issue.line}行`);
      const value = colors.red(issue.value);
      const suggestion = colors.green(issue.suggestion);

      console.log(`   ${icon} ${lineInfo}  ${value} → ${suggestion}`);
      console.log(colors.dim(`      ${issue.message}`));
    }

    console.log('');
  }

  // 统计信息
  const colorCount = issues.filter(i => i.type === 'color').length;
  const spacingCount = issues.filter(i => i.type === 'spacing').length;
  const fontSizeCount = issues.filter(i => i.type === 'fontSize').length;

  console.log(colors.blue('━'.repeat(50)));
  console.log(colors.red(`\n❌ 检测完成，发现 ${issues.length} 个问题：`));

  if (colorCount > 0) console.log(`   🎨 颜色问题: ${colorCount} 个`);
  if (spacingCount > 0) console.log(`   📏 间距问题: ${spacingCount} 个`);
  if (fontSizeCount > 0) console.log(`   🔤 字号问题: ${fontSizeCount} 个`);

  console.log(colors.dim('\n提示: 请将硬编码值替换为设计系统 tokens\n'));
}

function getIcon(type) {
  switch (type) {
    case 'color': return '🎨';
    case 'spacing': return '📏';
    case 'fontSize': return '🔤';
    default: return '⚠️';
  }
}
