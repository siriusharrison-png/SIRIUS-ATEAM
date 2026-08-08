#!/usr/bin/env node
/**
 * 本地批量打标签脚本
 *
 * 扫描一个文件夹里的所有图片，调用 Imagga 生成 Unsplash 友好的标签，
 * 结果同时：1) 打印到控制台  2) 汇总写入 tags.csv
 *
 * 用法：
 *   node tag-local.js                 # 处理 ./photos 文件夹
 *   node tag-local.js /path/to/dir    # 处理指定文件夹
 */

const fs = require('fs');
const path = require('path');

// --- 手动加载 .env.local（脚本直接 node 运行，不经过 vercel）---
function loadEnv() {
  const envPath = path.join(__dirname, '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('❌ 找不到 .env.local，请先在项目根目录创建它并填入 Imagga 凭证：');
    console.error('   IMAGGA_API_KEY=你的key');
    console.error('   IMAGGA_API_SECRET=你的secret');
    process.exit(1);
  }
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadEnv();

const { uploadAndTagImage } = require('./lib/imagga');

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp']);

async function main() {
  const targetDir = process.argv[2] || path.join(__dirname, 'photos');

  if (!fs.existsSync(targetDir)) {
    console.error(`❌ 文件夹不存在：${targetDir}`);
    console.error(`   请把照片放进去，或指定路径：node tag-local.js /你的/照片文件夹`);
    process.exit(1);
  }

  const files = fs.readdirSync(targetDir)
    .filter(f => IMAGE_EXT.has(path.extname(f).toLowerCase()))
    .sort();

  if (files.length === 0) {
    console.error(`⚠️  ${targetDir} 里没有找到图片（支持 jpg/png/webp/gif/bmp）`);
    process.exit(1);
  }

  console.log(`📷 找到 ${files.length} 张图片，开始打标签...\n`);

  const rows = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filePath = path.join(targetDir, file);
    process.stdout.write(`[${i + 1}/${files.length}] ${file} ... `);
    try {
      const tags = await uploadAndTagImage(filePath);
      const tagStr = tags.join(',');
      console.log(`✅\n    ${tagStr}\n`);
      rows.push({ file, tags: tagStr, success: true });
    } catch (err) {
      console.log(`❌ ${err.message}\n`);
      rows.push({ file, tags: '', success: false, error: err.message });
    }
    // 免费额度友好：每张之间稍作停顿
    if (i < files.length - 1) await new Promise(r => setTimeout(r, 300));
  }

  // 写 CSV（Excel/Numbers 可直接打开）
  const csvPath = path.join(targetDir, 'tags.csv');
  const csv = ['文件名,标签', ...rows.map(r =>
    `"${r.file}","${r.tags}"`
  )].join('\n');
  fs.writeFileSync(csvPath, '﻿' + csv, 'utf8'); // BOM 让 Excel 正确识别中文

  const ok = rows.filter(r => r.success).length;
  console.log(`\n完成：${ok}/${files.length} 张成功`);
  console.log(`📄 标签表已保存：${csvPath}`);
}

main().catch(err => {
  console.error('运行出错：', err);
  process.exit(1);
});
