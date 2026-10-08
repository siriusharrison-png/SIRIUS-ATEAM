// 编排主流程：调 LLM → 契约校验 → 失败回喂重试（≤2 次），累计 usage。
import { buildMessages } from "./prompt.js";

const MAX_RETRIES = 2; // 额外重试次数；共调 LLM 最多 MAX_RETRIES + 1 次

export async function generate({ modelId, userDesc, config, deps }) {
  const { callLLM, validateComponent } = deps;
  let priorError = null;
  const totalUsage = { inputTokens: 0, outputTokens: 0 };

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    const { text, usage } = await callLLM({
      modelId,
      messages: buildMessages(userDesc, priorError),
      config,
    });
    totalUsage.inputTokens += usage.inputTokens;
    totalUsage.outputTokens += usage.outputTokens;

    const v = await validateComponent(text, config);
    if (v.ok) {
      return {
        code: v.code,
        defaults: v.defaults,
        usage: totalUsage,
        attempts: attempt,
      };
    }
    priorError = `${v.gate}: ${v.error}`;
  }

  return {
    error: `生成失败（已重试 ${MAX_RETRIES} 次）：${priorError}`,
    usage: totalUsage,
  };
}
