import { describe, it, expect, vi } from "vitest";
import { generate } from "./orchestrate.js";

const config = {
  models: [{ id: "m", discount: 1, priceInPerM: 0, priceOutPerM: 0 }],
};

describe("generate (自愈循环)", () => {
  it("首次校验失败则回喂重试，第二次成功", async () => {
    const callLLM = vi
      .fn()
      .mockResolvedValueOnce({ text: "坏代码", usage: { inputTokens: 1, outputTokens: 1 } })
      .mockResolvedValueOnce({ text: "好代码", usage: { inputTokens: 1, outputTokens: 1 } });
    const validateComponent = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, gate: "parse", error: "缺 export" })
      .mockResolvedValueOnce({ ok: true, defaults: { title: "x" }, code: "好代码" });

    const r = await generate({
      modelId: "m",
      userDesc: "一个标题淡入",
      config,
      deps: { callLLM, validateComponent },
    });

    expect(r.attempts).toBe(2);
    expect(r.code).toBe("好代码");
    expect(callLLM).toHaveBeenCalledTimes(2);
  });

  it("连续 3 次失败则返回 error 不抛出", async () => {
    const callLLM = vi
      .fn()
      .mockResolvedValue({ text: "坏", usage: { inputTokens: 1, outputTokens: 1 } });
    const validateComponent = vi
      .fn()
      .mockResolvedValue({ ok: false, gate: "render", error: "渲染挂了" });

    const r = await generate({
      modelId: "m",
      userDesc: "x",
      config,
      deps: { callLLM, validateComponent },
    });

    expect(r.error).toBeTruthy();
    expect(callLLM).toHaveBeenCalledTimes(3);
  });
});
