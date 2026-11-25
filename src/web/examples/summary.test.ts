import { describe, expect, it } from "vitest";
import { NodeTypeSchema } from "@/schema/ast";
import { SyntaxSummarySchema, syntaxSummary } from "./summary";

describe("SyntaxSummarySchema", () => {
  it("requires a non-empty heading and at least one non-empty rule, and rejects other keys", () => {
    expect(SyntaxSummarySchema.safeParse({ heading: "H", rules: ["r"] }).success).toBe(true);
    expect(SyntaxSummarySchema.safeParse({ heading: "", rules: ["r"] }).success).toBe(false);
    expect(SyntaxSummarySchema.safeParse({ heading: "H", rules: [] }).success).toBe(false);
    expect(SyntaxSummarySchema.safeParse({ heading: "H", rules: [""] }).success).toBe(false);
    expect(SyntaxSummarySchema.safeParse({ heading: "H", rules: ["r"], extra: 1 }).success).toBe(false);
  });
});

describe("syntaxSummary", () => {
  it("has the heading and the nine topics", () => {
    expect(SyntaxSummarySchema.safeParse(syntaxSummary).success).toBe(true);
    expect(syntaxSummary.heading).toBe("How Trellis syntax works");
    expect(syntaxSummary.rules).toHaveLength(9);
  });

  it("mentions every node type", () => {
    const text = syntaxSummary.rules.join("\n");
    for (const type of ["Page", ...NodeTypeSchema.options]) expect(text).toContain(type);
  });

  it("mentions every attribute key", () => {
    const text = syntaxSummary.rules.join("\n");
    for (const key of ["id", "link-to", "width", "font", "font-size", "aspect-ratio"]) expect(text).toContain(`\`${key}`);
  });
});
