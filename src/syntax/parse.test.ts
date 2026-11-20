import { describe, expect, it } from "vitest";
import { AstSchema, type Ast } from "@/schema/ast";
import { sampleSource } from "@/viewer/sample";
import { parseSyntax } from "./parse";

const loginSource = `Box
  Text "Log in"
  Box
    Text "Email"
    Box "you@example.com"
  Box
    Text "Password"
    Box "*********"
  Box "Submit"
`;

const loginAst: Ast = {
  type: "Box",
  text: "",
  children: [
    { type: "Text", text: "Log in", children: [] },
    {
      type: "Box",
      text: "",
      children: [
        { type: "Text", text: "Email", children: [] },
        { type: "Box", text: "you@example.com", children: [] },
      ],
    },
    {
      type: "Box",
      text: "",
      children: [
        { type: "Text", text: "Password", children: [] },
        { type: "Box", text: "*********", children: [] },
      ],
    },
    { type: "Box", text: "Submit", children: [] },
  ],
};

function expectError(source: string, ...fragments: string[]) {
  const result = parseSyntax(source);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    for (const fragment of fragments) expect(result.error).toContain(fragment);
  }
}

describe("parseSyntax: sample", () => {
  it("parses the Login Form into the full expected AST", () => {
    expect(parseSyntax(loginSource)).toEqual({ ok: true, ast: loginAst });
  });

  it("produces an AST that passes AstSchema", () => {
    const result = parseSyntax(loginSource);
    expect(result.ok && AstSchema.safeParse(result.ast).success).toBe(true);
  });

  it("parses the viewer's sample source (Login Form with a Row of Cancel and Submit buttons)", () => {
    const sampleAst: Ast = {
      ...loginAst,
      children: [
        ...loginAst.children.slice(0, -1),
        {
          type: "Row",
          text: "",
          children: [
            { type: "Box", text: "Cancel", children: [] },
            { type: "Box", text: "Submit", children: [] },
          ],
        },
      ],
    };
    const result = parseSyntax(sampleSource);
    expect(result).toEqual({ ok: true, ast: sampleAst });
    expect(result.ok && AstSchema.safeParse(result.ast).success).toBe(true);
  });

  it("is deterministic", () => {
    expect(parseSyntax(loginSource)).toEqual(parseSyntax(loginSource));
  });
});

describe("parseSyntax: basic cases", () => {
  it("parses an empty source file as a blank (empty Text) root", () => {
    expect(parseSyntax("")).toEqual({ ok: true, ast: { type: "Text", text: "", children: [] } });
  });

  it("parses whitespace-only input as a blank (empty Text) root", () => {
    expect(parseSyntax("  \n\n   \n")).toEqual({
      ok: true,
      ast: { type: "Text", text: "", children: [] },
    });
  });

  it("parses `Box`", () => {
    expect(parseSyntax("Box")).toEqual({ ok: true, ast: { type: "Box", text: "", children: [] } });
  });

  it("parses `Text`", () => {
    expect(parseSyntax("Text")).toEqual({ ok: true, ast: { type: "Text", text: "", children: [] } });
  });

  it('parses `Box "Some Text"`', () => {
    expect(parseSyntax('Box "Some Text"')).toEqual({
      ok: true,
      ast: { type: "Box", text: "Some Text", children: [] },
    });
  });

  it('parses `Text "Some Text"`', () => {
    expect(parseSyntax('Text "Some Text"')).toEqual({
      ok: true,
      ast: { type: "Text", text: "Some Text", children: [] },
    });
  });
});

describe("parseSyntax: Row", () => {
  it("parses `Row`", () => {
    expect(parseSyntax("Row")).toEqual({ ok: true, ast: { type: "Row", text: "", children: [] } });
  });

  it('parses `Row "Some Text"`', () => {
    expect(parseSyntax('Row "Some Text"')).toEqual({
      ok: true,
      ast: { type: "Row", text: "Some Text", children: [] },
    });
  });

  it("parses a Row with several children, preserving order", () => {
    expect(parseSyntax('Row\n  Box "Cancel"\n  Text "or"\n  Box "Submit"\n')).toEqual({
      ok: true,
      ast: {
        type: "Row",
        text: "",
        children: [
          { type: "Box", text: "Cancel", children: [] },
          { type: "Text", text: "or", children: [] },
          { type: "Box", text: "Submit", children: [] },
        ],
      },
    });
  });

  it("parses a Row nested inside a Box and a Box nested inside a Row", () => {
    expect(parseSyntax('Box\n  Row\n    Box "a"\n    Row\n      Text "b"\n')).toEqual({
      ok: true,
      ast: {
        type: "Box",
        text: "",
        children: [
          {
            type: "Row",
            text: "",
            children: [
              { type: "Box", text: "a", children: [] },
              { type: "Row", text: "", children: [{ type: "Text", text: "b", children: [] }] },
            ],
          },
        ],
      },
    });
  });

  it("rejects a lowercase `row`", () => {
    expectError("row", "Line 1", "row");
    expectError("Box\n  row", "Line 2", "row");
  });
});

describe("parseSyntax: text forms", () => {
  it('treats `""` as empty text, equal to omitted text', () => {
    expect(parseSyntax('Box ""')).toEqual(parseSyntax("Box"));
  });

  it("does not interpret escape sequences", () => {
    const result = parseSyntax('Box "a\\nb"');
    expect(result.ok && result.ast.text).toBe("a\\nb");
  });

  it("keeps whitespace inside quotes", () => {
    const result = parseSyntax('Box "  a  b  "');
    expect(result.ok && result.ast.text).toBe("  a  b  ");
  });

  it("ignores blank lines and handles CRLF line endings", () => {
    const result = parseSyntax('Box\r\n\r\n  Text "a"\r\n   \r\n  Text "b"\r\n');
    expect(result).toEqual({
      ok: true,
      ast: {
        type: "Box",
        text: "",
        children: [
          { type: "Text", text: "a", children: [] },
          { type: "Text", text: "b", children: [] },
        ],
      },
    });
  });

  it("allows returning to a shallower level", () => {
    const result = parseSyntax("Box\n  Box\n    Text\n  Text\n");
    expect(result.ok && result.ast.children.map((c) => [c.type, c.children.length])).toEqual([
      ["Box", 1],
      ["Text", 0],
    ]);
  });
});

describe("parseSyntax: errors", () => {
  it("rejects an unknown type with its line number", () => {
    expectError("Box\n  Button", "Line 2", "Button");
  });

  it("rejects a lowercase type", () => {
    expectError("box", "Line 1");
  });

  it("rejects bare unquoted text", () => {
    expectError("Box Some Text", "Line 1");
    expectError('Box\n  Text hello', "Line 2");
  });

  it("rejects tab characters", () => {
    expectError("Box\n\tText", "Line 2", "Tab");
  });

  it("rejects indentation that is not a multiple of 2 spaces", () => {
    expectError("Box\n Text", "Line 2", "multiple of 2");
    expectError("Box\n  Box\n     Text", "Line 3", "multiple of 2");
  });

  it("rejects indentation that skips a level", () => {
    expectError("Box\n    Text", "Line 2", "skips");
    expectError("Box\n  Box\n      Text", "Line 3", "skips");
  });

  it("rejects multiple root nodes", () => {
    expectError("Box\nBox", "Line 2", "root");
    expectError("Box\n  Text\nText", "Line 3", "root");
  });

  it("rejects a non-zero-indent first line", () => {
    expectError("  Box", "Line 1");
    expectError("\n\n  Box", "Line 3");
  });

  it("rejects an unterminated quoted string", () => {
    expectError('Box "oops', "Line 1", "Unterminated");
    expectError('Box\n  Text "', "Line 2", "Unterminated");
  });

  it("rejects trailing characters after a closing quote", () => {
    expectError('Box "a" b', "Line 1");
    expectError('Box\n  Text "a""', "Line 2");
    expectError('Box "a" ', "Line 1");
  });

  it("counts blank lines when reporting line numbers", () => {
    expectError("Box\n\n\n  Nope", "Line 4");
  });
});
