import { describe, expect, it } from "vitest";
import { parseAstJson } from "./parse";
import { sampleAst } from "./sample";

describe("parseAstJson", () => {
  it("accepts the sample AST", () => {
    const result = parseAstJson(JSON.stringify(sampleAst));
    expect(result).toEqual({ ok: true, ast: sampleAst });
  });

  it("reports invalid JSON", () => {
    const result = parseAstJson("{");
    expect(result.ok).toBe(false);
  });

  it("reports schema violations with paths", () => {
    const result = parseAstJson(
      JSON.stringify({ id: "a", type: "Box", text: "", children: [{ id: "b", type: "Nope", text: "", children: [] }] }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("children.0.type");
  });
});
