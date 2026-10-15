import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

export function repoRoot() {
  return ROOT;
}

export function isInsideRepo(absPath) {
  const resolved = path.resolve(absPath);
  const rel = path.relative(ROOT, resolved);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

export function resolveInRepo(relPath) {
  const resolved = path.resolve(ROOT, relPath);
  if (!isInsideRepo(resolved)) {
    throw new Error(`路径越界，拒绝：${relPath}`);
  }
  return resolved;
}
