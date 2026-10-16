import { describe, it, expect } from 'vitest';
import { callLLM } from './llm.js';

const config = {
  gateway: { envKey: 'GATEWAY_API_KEY', envBaseUrl: 'GATEWAY_BASE_URL', defaultBaseUrl: 'https://x/v1' },
  models: [{ id: 'm1', endpoint: '/chat/completions' }],
};

describe('callLLM', () => {
  it('未知模型抛错', async () => {
    await expect(callLLM({ modelId: 'nope', messages: [], config, fetchImpl: async () => ({}) })).rejects.toThrow(/未知模型/);
  });

  it('缺 key 抛错', async () => {
    const old = process.env.GATEWAY_API_KEY; delete process.env.GATEWAY_API_KEY;
    await expect(callLLM({ modelId: 'm1', messages: [], config, fetchImpl: async () => ({}) })).rejects.toThrow(/GATEWAY_API_KEY/);
    if (old !== undefined) process.env.GATEWAY_API_KEY = old;
  });

  it('提取 chat/completions 文本', async () => {
    process.env.GATEWAY_API_KEY = 'k';
    const fetchImpl = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: '{"x":1}' } }] }) });
    const r = await callLLM({ modelId: 'm1', messages: [], config, fetchImpl });
    expect(r.text).toBe('{"x":1}');
  });

  it('非 2xx 抛含状态码错误', async () => {
    process.env.GATEWAY_API_KEY = 'k';
    const fetchImpl = async () => ({ ok: false, status: 401, text: async () => 'unauthorized' });
    await expect(callLLM({ modelId: 'm1', messages: [], config, fetchImpl })).rejects.toThrow(/401/);
  });
});
