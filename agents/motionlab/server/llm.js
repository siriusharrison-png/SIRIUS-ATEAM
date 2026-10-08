// LLM 客户端：封装两个模型（chat/completions 与 anthropic messages 格式）的调用与 usage 提取。

export function extractUsage(modelId, raw) {
  const u = raw?.usage ?? {};
  const inputTokens = u.prompt_tokens ?? u.input_tokens ?? 0;
  const outputTokens = u.completion_tokens ?? u.output_tokens ?? 0;
  return { inputTokens, outputTokens };
}

function extractText(raw) {
  // chat/completions: choices[0].message.content ; anthropic: content[0].text
  return raw?.choices?.[0]?.message?.content ?? raw?.content?.[0]?.text ?? "";
}

export async function callLLM({ modelId, messages, config }) {
  const model = config.models.find((m) => m.id === modelId);
  if (!model) throw new Error(`未知模型: ${modelId}`);

  const apiKey = process.env[config.gateway.envKey];
  if (!apiKey) throw new Error(`缺少环境变量 ${config.gateway.envKey}`);

  const baseUrl =
    process.env[config.gateway.envBaseUrl] || config.gateway.defaultBaseUrl;

  const res = await fetch(baseUrl + model.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: modelId, messages, max_tokens: 8000 }),
  });

  if (!res.ok) {
    throw new Error(`LLM 调用失败 ${res.status}: ${await res.text()}`);
  }

  const raw = await res.json();
  return { text: extractText(raw), usage: extractUsage(modelId, raw) };
}
