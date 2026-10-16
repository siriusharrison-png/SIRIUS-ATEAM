import { describe, it, expect } from 'vitest';
import { createHandler } from './app.js';
import { Readable } from 'node:stream';

const config = { models: [{ id: 'm1', label: 'M1', endpoint: '/c' }], gateway: {} };

function mockReq(method, url, body) {
  const r = Readable.from(body ? [JSON.stringify(body)] : []);
  r.method = method; r.url = url; r.headers = {};
  return r;
}
function mockRes() {
  return { statusCode: 200, headers: {}, body: '',
    setHeader(k, v) { this.headers[k] = v; },
    writeHead(c, h) { this.statusCode = c; Object.assign(this.headers, h || {}); },
    end(d) { this.body = d || ''; this.ended = true; } };
}

describe('roma handler', () => {
  it('GET /config 返回模型', async () => {
    const h = createHandler({ config, callLLMImpl: async () => ({ text: '{}' }) });
    const res = mockRes();
    await h(mockReq('GET', '/config'), res);
    expect(JSON.parse(res.body).models[0].id).toBe('m1');
  });

  it('POST /generate 空输入 → 400', async () => {
    const h = createHandler({ config, callLLMImpl: async () => ({ text: '{}' }) });
    const res = mockRes();
    await h(mockReq('POST', '/generate', { input: '  ', model: 'm1' }), res);
    expect(res.statusCode).toBe(400);
  });

  it('POST /generate 正常 → 200 卡片 JSON', async () => {
    const h = createHandler({ config, callLLMImpl: async () => ({ text: '{"perfumeName":"玫瑰"}' }) });
    const res = mockRes();
    await h(mockReq('POST', '/generate', { input: '玫瑰', model: 'm1' }), res);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).perfumeName).toBe('玫瑰');
  });

  it('POST /generate LLM 抛错 → 500 可读 error', async () => {
    const h = createHandler({ config, callLLMImpl: async () => { throw new Error('缺少环境变量 GATEWAY_API_KEY'); } });
    const res = mockRes();
    await h(mockReq('POST', '/generate', { input: '玫瑰', model: 'm1' }), res);
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).error).toMatch(/GATEWAY_API_KEY/);
  });
});
