import { buildMessages } from './prompt.js';
import { parseCardJson } from './parse.js';

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => resolve(data));
  });
}
function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

export function createHandler({ config, callLLMImpl }) {
  return async function handler(req, res) {
    try {
      if (req.method === 'GET' && req.url === '/config') {
        return sendJson(res, 200, { models: config.models });
      }
      if (req.method === 'POST' && req.url === '/generate') {
        const body = JSON.parse((await readBody(req)) || '{}');
        const input = (body.input || '').trim();
        if (!input) return sendJson(res, 400, { error: '先写点香味描述' });
        const { text } = await callLLMImpl({
          modelId: body.model || config.models[0].id,
          messages: buildMessages(input),
          config,
        });
        return sendJson(res, 200, parseCardJson(text));
      }
      sendJson(res, 404, { error: 'not found' });
    } catch (e) {
      sendJson(res, 500, { error: String(e.message || e) });
    }
  };
}
