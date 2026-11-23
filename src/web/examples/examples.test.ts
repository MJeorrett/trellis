import { describe, expect, it } from "vitest";
import { DataDictionaryRowSchema } from "@/data-dictionary/schema";
import { NodeTypeSchema, type AstNode } from "@/schema/ast";
import { isCommentLine } from "@/syntax/comments";
import { compileSyntax } from "@/syntax/compile";
import { ExampleSchema, exampleDataDictionary, examples } from "./examples";

const typesOf = (nodes: readonly AstNode[]): string[] => nodes.flatMap((node) => [node.type, ...typesOf(node.children)]);

describe("exampleDataDictionary", () => {
  it("holds valid rows, at least User/FirstName and User/Email, with labels and mock values", () => {
    for (const row of exampleDataDictionary) expect(DataDictionaryRowSchema.safeParse(row).success).toBe(true);
    for (const field of ["FirstName", "Email"]) {
      const row = exampleDataDictionary.find((r) => r.entity === "User" && r.field === field);
      expect(row?.label).not.toBe("");
      expect(row?.mockValues).not.toBe("");
    }
  });

  it("has a field with several mock values separated by ;", () => {
    expect(exampleDataDictionary.some((row) => row.mockValues.includes(";"))).toBe(true);
  });
});

describe("ExampleSchema", () => {
  it("requires a non-empty title and a source, and rejects other keys", () => {
    expect(ExampleSchema.safeParse({ title: "A", source: "" }).success).toBe(true);
    expect(ExampleSchema.safeParse({ title: "", source: "x" }).success).toBe(false);
    expect(ExampleSchema.safeParse({ title: "A" }).success).toBe(false);
    expect(ExampleSchema.safeParse({ title: "A", source: "x", extra: 1 }).success).toBe(false);
  });
});

describe("examples", () => {
  it("is validated by ExampleSchema", () => {
    for (const example of examples) expect(ExampleSchema.safeParse(example).success).toBe(true);
  });

  it("starts with the elements, in order", () => {
    expect(examples.slice(0, 8).map((example) => example.title)).toEqual([
      "Page",
      "Box",
      "Text",
      "Row",
      "BoxRow",
      "Spacer",
      "Image",
      "Table and TableColumn",
    ]);
  });

  it("has a unique title for each example", () => {
    const titles = examples.map((example) => example.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  for (const example of examples) {
    it(`compiles "${example.title}" without an error`, () => {
      const result = compileSyntax(example.source, undefined, exampleDataDictionary);
      expect(result).toEqual({ ok: true, ast: expect.anything() });
    });

    it(`explains "${example.title}" with at least one comment`, () => {
      expect(example.source.split("\n").some(isCommentLine)).toBe(true);
    });
  }

  it("uses every node type together", () => {
    const used = new Set<string>();
    for (const example of examples) {
      const result = compileSyntax(example.source, undefined, exampleDataDictionary);
      if (!result.ok) throw new Error(result.error);
      for (const page of result.ast.pages) typesOf(page.children).forEach((type) => used.add(type));
    }
    expect([...used].sort()).toEqual([...NodeTypeSchema.options].sort());
  });
});
