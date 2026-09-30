import { describe, it, expect } from "vitest";
import { z } from "zod";
import { stripFences, gateStatic, gateSchema } from "./contract.js";

describe("stripFences", () => {
  it("剥掉 ```tsx 围栏", () => {
    const input = "解释一下：\n```tsx\nexport default X;\n```\n完成";
    expect(stripFences(input).trim()).toBe("export default X;");
  });

  it("无围栏时原样返回", () => {
    expect(stripFences("export default X;").trim()).toBe("export default X;");
  });
});

describe("gateStatic", () => {
  it("缺 export default 时报 parse 闸失败", () => {
    const r = gateStatic("export const propsSchema = 1;");
    expect(r.ok).toBe(false);
    expect(r.gate).toBe("parse");
  });

  it("缺 propsSchema 时报 parse 闸失败", () => {
    const r = gateStatic("export default function C(){}");
    expect(r.ok).toBe(false);
    expect(r.gate).toBe("parse");
  });

  it("两者都有时通过", () => {
    expect(
      gateStatic("export default function C(){}\nexport const propsSchema = 1;")
        .ok,
    ).toBe(true);
  });
});

describe("gateSchema", () => {
  it("所有字段有默认值时通过并返回 defaults", () => {
    const schema = z.object({
      title: z.string().default("hi"),
      speed: z.number().default(1),
    });
    const r = gateSchema(schema);
    expect(r.ok).toBe(true);
    expect(r.defaults).toEqual({ title: "hi", speed: 1 });
  });

  it("有字段缺默认值时报 schema 闸失败", () => {
    const schema = z.object({ title: z.string() });
    expect(gateSchema(schema).ok).toBe(false);
  });
});
