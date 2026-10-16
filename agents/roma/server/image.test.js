import { describe, it, expect } from 'vitest';
import { generateImage } from './image.js';

const config = {
  gateway: { envKey: 'GATEWAY_API_KEY', envBaseUrl: 'GATEWAY_BASE_URL', defaultBaseUrl: 'https://x/v1' },
  imageModel: 'gpt-image-2-text-to-image',
};

// 第一次调用是图像接口（/v3/...），之后对 http(s) 图片地址的调用是下载。
function gateway(images, { download } = {}) {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (String(url).includes('/v3/')) return { ok: true, json: async () => ({ images }) };
    return download ?? {
      ok: true,
      headers: { get: () => 'image/png' },
      arrayBuffer: async () => Buffer.from('hi'),
    };
  };
  return { fetchImpl, calls };
}

describe('generateImage', () => {
  it('缺 key 抛错', async () => {
    const old = process.env.GATEWAY_API_KEY; delete process.env.GATEWAY_API_KEY;
    await expect(generateImage({ prompt: 'p', config, fetchImpl: async () => ({}) })).rejects.toThrow(/GATEWAY_API_KEY/);
    if (old !== undefined) process.env.GATEWAY_API_KEY = old;
  });

  it('打到 /v3/{model}（base_url 的 /v1 换 /v3）', async () => {
    process.env.GATEWAY_API_KEY = 'k';
    const { fetchImpl, calls } = gateway(['data:image/png;base64,AAAA']);
    await generateImage({ prompt: 'p', config, fetchImpl });
    expect(calls[0]).toBe('https://x/v3/gpt-image-2-text-to-image');
  });

  it('远程 URL 由服务端下载并内联为 data: URI（避免浏览器 canvas 跨域污染）', async () => {
    process.env.GATEWAY_API_KEY = 'k';
    const { fetchImpl, calls } = gateway(['https://img/x.png']);
    const r = await generateImage({ prompt: 'p', config, fetchImpl });
    expect(calls[1]).toBe('https://img/x.png');
    expect(r.image).toBe(`data:image/png;base64,${Buffer.from('hi').toString('base64')}`);
  });

  it('下载失败抛可读错误', async () => {
    process.env.GATEWAY_API_KEY = 'k';
    const { fetchImpl } = gateway(['https://img/x.png'], { download: { ok: false, status: 403 } });
    await expect(generateImage({ prompt: 'p', config, fetchImpl })).rejects.toThrow(/下载.*403/);
  });

  it('data: 形态原样返回，不再发起下载', async () => {
    process.env.GATEWAY_API_KEY = 'k';
    const { fetchImpl, calls } = gateway(['data:image/png;base64,AAAA']);
    const r = await generateImage({ prompt: 'p', config, fetchImpl });
    expect(r.image).toBe('data:image/png;base64,AAAA');
    expect(calls).toHaveLength(1);
  });

  it('base64 形态补 data: 前缀', async () => {
    process.env.GATEWAY_API_KEY = 'k';
    const { fetchImpl } = gateway([{ b64_json: 'AAAA' }]);
    const r = await generateImage({ prompt: 'p', config, fetchImpl });
    expect(r.image).toBe('data:image/png;base64,AAAA');
  });

  it('网关返回空 images 抛可读错误', async () => {
    process.env.GATEWAY_API_KEY = 'k';
    const { fetchImpl } = gateway([]);
    await expect(generateImage({ prompt: 'p', config, fetchImpl })).rejects.toThrow(/没有返回图像/);
  });

  it('非 2xx 抛含状态码错误', async () => {
    process.env.GATEWAY_API_KEY = 'k';
    const fetchImpl = async () => ({ ok: false, status: 500, text: async () => 'err' });
    await expect(generateImage({ prompt: 'p', config, fetchImpl })).rejects.toThrow(/500/);
  });
});
