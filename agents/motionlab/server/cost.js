// 成本估算：按官方原价 × 折扣系数 × token 数，累计持久化到 .cost.json。
import fs from "node:fs";

export function estimateCost(modelId, usage, config) {
  const m = config.models.find((x) => x.id === modelId);
  if (!m) throw new Error(`未知模型: ${modelId}`);
  const raw =
    (usage.inputTokens / 1e6) * m.priceInPerM +
    (usage.outputTokens / 1e6) * m.priceOutPerM;
  return { cost: raw * m.discount };
}

export function addToTotal(cost, costFilePath) {
  let total = 0;
  try {
    total = JSON.parse(fs.readFileSync(costFilePath, "utf8")).total ?? 0;
  } catch {
    total = 0;
  }
  total += cost;
  fs.writeFileSync(costFilePath, JSON.stringify({ total }, null, 2));
  return { total };
}
