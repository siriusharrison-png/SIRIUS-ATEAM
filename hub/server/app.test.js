import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from './app.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturesAgents = path.relative(path.resolve(here, '../..'), path.join(here, '__fixtures__/agents'));

function fakePM() {
  return {
    start: async () => ({ ok: true }),
    stop: () => ({ ok: true }),
    status: () => ({ running: false }),
    logs: () => ['line1'],
  };
}
function fakeLauncher() {
  return { launchNonServer: async () => ({ ok: true, mode: 'doc' }) };
}

async function req(app, method, url) {
  const { default: supertest } = await import('supertest');
  return supertest(app)[method.toLowerCase()](url);
}

describe('hub API', () => {
  let app;
  beforeEach(() => {
    app = createApp({ scanRoots: [fixturesAgents], processManager: fakePM(), launcher: fakeLauncher() });
  });

  it('GET /api/capabilities 返回能力列表', async () => {
    const res = await req(app, 'GET', '/api/capabilities');
    expect(res.status).toBe(200);
    expect(res.body.capabilities.map(c => c.id)).toContain('good-server');
  });

  it('POST /api/launch/未知id → 404', async () => {
    const res = await req(app, 'POST', '/api/launch/does-not-exist');
    expect(res.status).toBe(404);
  });

  it('POST /api/launch/../secretary 这类构造路径 → 404', async () => {
    const res = await req(app, 'POST', '/api/launch/%2E%2E%2Fsecretary');
    expect(res.status).toBe(404);
  });

  it('GET /api/logs/good-server 返回行', async () => {
    const res = await req(app, 'GET', '/api/logs/good-server');
    expect(res.status).toBe(200);
    expect(res.body.lines).toEqual(['line1']);
  });
});
