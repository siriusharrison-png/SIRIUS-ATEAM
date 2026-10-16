// 网关图像客户端：图像走 /v3/{model}（与 chat 的 /v1 不同根），文生图返回 { images: [...] }。
// 接口约定沿用 posterdesigner 已验证的做法。

const DEFAULT_IMAGE_MODEL = 'gpt-image-2-text-to-image';

function toImageRef(item) {
  if (!item) return '';
  const v = typeof item === 'string' ? item : (item.url || item.b64_json || item.image || '');
  if (!v) return '';
  // url 或已带 data: 前缀的原样返回，纯 base64 补前缀
  if (/^(https?:|data:)/i.test(v)) return v;
  return `data:image/png;base64,${v}`;
}

export async function generateImage({ prompt, config, size = '1024x1536', fetchImpl = globalThis.fetch }) {
  const apiKey = process.env[config.gateway.envKey];
  if (!apiKey) throw new Error(`缺少环境变量 ${config.gateway.envKey}`);

  const baseUrl = process.env[config.gateway.envBaseUrl] || config.gateway.defaultBaseUrl;
  const root = baseUrl.replace(/\/+$/, '').replace(/\/v1$/, '');
  const model = config.imageModel || DEFAULT_IMAGE_MODEL;

  const res = await fetchImpl(`${root}/v3/${model}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ prompt, size, quality: 'medium' }),
  });

  if (!res.ok) {
    throw new Error(`图像生成失败 ${res.status}: ${await res.text()}`);
  }
  const raw = await res.json();
  const image = toImageRef(raw?.images?.[0]);
  if (!image) throw new Error('网关没有返回图像数据');
  return { image };
}
