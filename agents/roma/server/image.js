// 网关图像客户端：图像走 /v3/{model}（与 chat 的 /v1 不同根），文生图返回 { images: [...] }。
// 接口约定沿用 posterdesigner 已验证的做法。

const DEFAULT_IMAGE_MODEL = 'gpt-image-2-text-to-image';

// 网关错误体内容不可控，只截一小段给用户当线索，不整段回显。
function truncate(s, max = 200) {
  const t = String(s ?? '');
  return t.length > max ? t.slice(0, max) + '…' : t;
}

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
    throw new Error(`图像生成失败 ${res.status}: ${truncate(await res.text())}`);
  }
  const raw = await res.json();
  const ref = toImageRef(raw?.images?.[0]);
  if (!ref) throw new Error('网关没有返回图像数据');
  return { image: await inlineRemote(ref, fetchImpl) };
}

// 远程地址由服务端下载并内联为 data: URI。
// 浏览器 canvas 读取跨域图片会被污染（getImageData 抛 SecurityError），
// 而 Riso / ASCII 两面都要读像素，所以必须在这里转成同源数据。
async function inlineRemote(ref, fetchImpl) {
  if (!/^https?:/i.test(ref)) return ref;
  const res = await fetchImpl(ref);
  if (!res.ok) throw new Error(`下载图像失败 ${res.status}`);
  const type = res.headers?.get?.('content-type') || 'image/png';
  const buf = Buffer.from(await res.arrayBuffer());
  return `data:${type};base64,${buf.toString('base64')}`;
}
