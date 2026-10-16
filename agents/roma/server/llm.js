function extractText(raw) {
  return raw?.choices?.[0]?.message?.content ?? raw?.content?.[0]?.text ?? '';
}

export async function callLLM({ modelId, messages, config, fetchImpl = globalThis.fetch }) {
  const model = config.models.find((m) => m.id === modelId);
  if (!model) throw new Error(`未知模型: ${modelId}`);

  const apiKey = process.env[config.gateway.envKey];
  if (!apiKey) throw new Error(`缺少环境变量 ${config.gateway.envKey}`);

  const baseUrl = process.env[config.gateway.envBaseUrl] || config.gateway.defaultBaseUrl;

  const res = await fetchImpl(baseUrl + model.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: modelId, messages, max_tokens: 8000 }),
  });

  if (!res.ok) {
    throw new Error(`LLM 调用失败 ${res.status}: ${await res.text()}`);
  }
  const raw = await res.json();
  return { text: extractText(raw) };
}
