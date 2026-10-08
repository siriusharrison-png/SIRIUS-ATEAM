import { describe, it, expect } from "vitest";
import { withTimeout } from "./render.js";

describe("withTimeout", () => {
  it("超时抛错", async () => {
    const slow = new Promise((r) => setTimeout(r, 100));
    await expect(withTimeout(slow, 10, "渲染超时")).rejects.toThrow("渲染超时");
  });

  it("按时完成则返回结果", async () => {
    const fast = Promise.resolve("done");
    await expect(withTimeout(fast, 100, "渲染超时")).resolves.toBe("done");
  });
});
