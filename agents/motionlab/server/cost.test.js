import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { estimateCost, addToTotal } from "./cost.js";

const config = {
  models: [
    { id: "claude-opus-5-5", discount: 0.46, priceInPerM: 10, priceOutPerM: 40 },
  ],
};

describe("estimateCost", () => {
  it("按 输入/输出单价 × 折扣 计算", () => {
    // 输入 1e6 token → 10 ; 输出 1e6 → 40 ; 合 50 × 0.46 = 23
    const { cost } = estimateCost(
      "claude-opus-5-5",
      { inputTokens: 1e6, outputTokens: 1e6 },
      config,
    );
    expect(cost).toBeCloseTo(23, 5);
  });

  it("未知模型抛错", () => {
    expect(() => estimateCost("nope", { inputTokens: 1, outputTokens: 1 }, config)).toThrow();
  });
});

describe("addToTotal", () => {
  it("累加并持久化到文件", () => {
    const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "cost-")), ".cost.json");
    expect(addToTotal(1.5, f).total).toBeCloseTo(1.5, 5);
    expect(addToTotal(2.5, f).total).toBeCloseTo(4.0, 5);
    expect(JSON.parse(fs.readFileSync(f, "utf8")).total).toBeCloseTo(4.0, 5);
  });
});
