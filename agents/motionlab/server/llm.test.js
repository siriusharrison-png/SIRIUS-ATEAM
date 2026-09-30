import { describe, it, expect } from "vitest";
import { extractUsage } from "./llm.js";

describe("extractUsage", () => {
  it("chat/completions 格式取 prompt_tokens/completion_tokens", () => {
    const raw = { usage: { prompt_tokens: 100, completion_tokens: 250 } };
    expect(extractUsage("gpt-6-astra", raw)).toEqual({
      inputTokens: 100,
      outputTokens: 250,
    });
  });

  it("anthropic messages 格式取 input_tokens/output_tokens", () => {
    const raw = { usage: { input_tokens: 80, output_tokens: 300 } };
    expect(extractUsage("claude-opus-5-5", raw)).toEqual({
      inputTokens: 80,
      outputTokens: 300,
    });
  });

  it("缺 usage 时返回 0 而非抛错", () => {
    expect(extractUsage("gpt-6-astra", {})).toEqual({
      inputTokens: 0,
      outputTokens: 0,
    });
  });
});
