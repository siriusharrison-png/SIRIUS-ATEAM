import { describe, it, expect } from 'vitest';
import { agentDir } from './paths.js';
import path from 'node:path';
import fs from 'node:fs';

describe('agentDir', () => {
  it('指向含 config.json 的 roma 目录', () => {
    const d = agentDir();
    expect(path.isAbsolute(d)).toBe(true);
    expect(fs.existsSync(path.join(d, 'config.json'))).toBe(true);
  });
});
