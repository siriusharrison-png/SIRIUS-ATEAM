import fs from 'node:fs';
import path from 'node:path';
import { repoRoot } from './paths.js';

export function discoverCapabilities(scanRoots = ['agents']) {
  const root = repoRoot();
  const capabilities = [];
  const warnings = [];

  for (const scanRel of scanRoots) {
    const scanAbs = path.join(root, scanRel);
    if (!fs.existsSync(scanAbs)) continue;

    for (const entry of fs.readdirSync(scanAbs, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const dirRel = path.join(scanRel, entry.name);
      const cfgPath = path.join(scanAbs, entry.name, 'config.json');
      if (!fs.existsSync(cfgPath)) continue;

      let cfg;
      try {
        cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      } catch {
        warnings.push(`跳过 ${dirRel}：config.json 不是有效 JSON`);
        continue;
      }
      if (!cfg.name) {
        warnings.push(`跳过 ${dirRel}：config.json 缺 name`);
        continue;
      }

      capabilities.push(normalize(entry.name, dirRel, cfg));
    }
  }
  return { capabilities, warnings };
}

function normalize(id, dirRel, cfg) {
  const raw = cfg.launch || {};
  const type = raw.type || 'doc';
  const cwd = raw.cwd || dirRel;
  const launch = { type, cwd, docs: raw.docs || ['README.md'] };

  if (type === 'server') {
    launch.cmd = raw.cmd;
    launch.port = raw.port;
    launch.openUrl = raw.openUrl || (raw.port ? `http://localhost:${raw.port}` : undefined);
  } else if (type === 'interactive') {
    launch.command = raw.command;
  }

  return {
    id,
    name: cfg.name,
    description: cfg.description || '',
    role: cfg.role || '',
    dir: dirRel,
    launch,
  };
}
