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

  it('POST /image 正常 → 200 返回源图', async () => {
    const h = createHandler({
      config, callLLMImpl: async () => ({ text: '{}' }),
      generateImageImpl: async ({ prompt }) => ({ image: `img:${prompt}` }),
    });
    const res = mockRes();
    await h(mockReq('POST', '/image', { imagePrompt: 'abstract rose' }), res);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).image).toBe('img:abstract rose');
  });

  it('POST /image 空 imagePrompt → 400，且不调用图像模型', async () => {
    let called = false;
    const h = createHandler({
      config, callLLMImpl: async () => ({ text: '{}' }),
      generateImageImpl: async () => { called = true; return { image: 'x' }; },
    });
    const res = mockRes();
    await h(mockReq('POST', '/image', { imagePrompt: '   ' }), res);
    expect(res.statusCode).toBe(400);
    expect(called).toBe(false);
  });

  it('POST /image 图像模型抛错 → 500 可读 error', async () => {
    const h = createHandler({
      config, callLLMImpl: async () => ({ text: '{}' }),
      generateImageImpl: async () => { throw new Error('图像生成失败 500: err'); },
    });
    const res = mockRes();
    await h(mockReq('POST', '/image', { imagePrompt: 'x' }), res);
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).error).toMatch(/图像生成失败/);
  });

  it('POST /generate LLM 抛错 → 500 可读 error', async () => {
    const h = createHandler({ config, callLLMImpl: async () => { throw new Error('缺少环境变量 GATEWAY_API_KEY'); } });
    const res = mockRes();
    await h(mockReq('POST', '/generate', { input: '玫瑰', model: 'm1' }), res);
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).error).toMatch(/GATEWAY_API_KEY/);
  });
});
