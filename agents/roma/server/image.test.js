import { describe, it, expect } from 'vitest';
import { generateImage } from './image.js';

const config = {
  gateway: { envKey: 'GATEWAY_API_KEY', envBaseUrl: 'GATEWAY_BASE_URL', defaultBaseUrl: 'https://x/v1' },
  imageModel: 'gpt-image-2-text-to-image',
};

describe('generateImage', () => {
  it('缺 key 抛错', async () => {
    const old = process.env.GATEWAY_API_KEY; delete process.env.GATEWAY_API_KEY;
    await expect(generateImage({ prompt: 'p', config, fetchImpl: async () => ({}) })).rejects.toThrow(/GATEWAY_API_KEY/);
    if (old !== undefined) process.env.GATEWAY_API_KEY = old;
  });

  it('打到 /v3/{model}（base_url 的 /v1 换 /v3）', async () => {
    process.env.GATEWAY_API_KEY = 'k';
    let calledUrl = '';
    const fetchImpl = async (url) => { calledUrl = url; return { ok: true, json: async () => ({ images: ['https://img/x.png'] }) }; };
    await generateImage({ prompt: 'p', config, fetchImpl });
    expect(calledUrl).toBe('https://x/v3/gpt-image-2-text-to-image');
  });

  it('返回 url 形态的第一张图', async () => {
    process.env.GATEWAY_API_KEY = 'k';
    const fetchImpl = async () => ({ ok: true, json: async () => ({ images: ['https://img/x.png'] }) });
    const r = await generateImage({ prompt: 'p', config, fetchImpl });
    expect(r.image).toBe('https://img/x.png');
  });

  it('base64 形态补 data: 前缀', async () => {
    process.env.GATEWAY_API_KEY = 'k';
    const fetchImpl = async () => ({ ok: true, json: async () => ({ images: [{ b64_json: 'AAAA' }] }) });
    const r = await generateImage({ prompt: 'p', config, fetchImpl });
    expect(r.image).toBe('data:image/png;base64,AAAA');
  });

  it('非 2xx 抛含状态码错误', async () => {
    process.env.GATEWAY_API_KEY = 'k';
    const fetchImpl = async () => ({ ok: false, status: 500, text: async () => 'err' });
    await expect(generateImage({ prompt: 'p', config, fetchImpl })).rejects.toThrow(/500/);
  });
});
