import { describe, expect, it } from "vitest";
import { AstSchema, PageSchema } from "./ast";

/** Simple Login Form: Email input, Password input, Submit button. */
type RawNode = { type: string; text: unknown; children: RawNode[] };

const loginForm: RawNode = {
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
        { type: "Box", text: "********", children: [] },
      ],
    },
    { type: "Box", text: "Submit", children: [] },
  ],
};

const loginPage = { title: "Log in", children: [loginForm] };
const loginAst = { pages: [loginPage] };

describe("AstSchema: pages", () => {
  it("accepts a single page with a nested Login Form", () => {
    expect(AstSchema.safeParse(loginAst).success).toBe(true);
  });

  it("accepts several pages", () => {
    const ast = {
      pages: [loginPage, { title: "Forgot password", children: [{ type: "Text", text: "Hi", children: [] }] }],
    };
    expect(AstSchema.safeParse(ast).success).toBe(true);
    expect(AstSchema.parse(ast)).toEqual(ast);
  });

  it("accepts a page with an empty title", () => {
    expect(AstSchema.safeParse({ pages: [{ title: "", children: [loginForm] }] }).success).toBe(true);
  });

  it("accepts a page with no children", () => {
    expect(AstSchema.safeParse({ pages: [{ title: "Blank", children: [] }] }).success).toBe(true);
    expect(PageSchema.safeParse({ title: "", children: [] }).success).toBe(true);
  });

  it("rejects a page without a title key", () => {
    expect(AstSchema.safeParse({ pages: [{ children: [loginForm] }] }).success).toBe(false);
  });

  it("rejects a page without a children key", () => {
    expect(AstSchema.safeParse({ pages: [{ title: "x" }] }).success).toBe(false);
  });

  it("rejects an empty pages array", () => {
    expect(AstSchema.safeParse({ pages: [] }).success).toBe(false);
  });

  it("rejects a missing pages key", () => {
    expect(AstSchema.safeParse({}).success).toBe(false);
  });

  it("rejects a bare node as the root", () => {
    expect(AstSchema.safeParse(loginForm).success).toBe(false);
  });

  it("rejects a Page nested inside a node's children", () => {
    const nested = { title: "Inner", children: [] };
    const bad = { pages: [{ title: "Outer", children: [{ type: "Box", text: "", children: [nested] }] }] };
    expect(AstSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a node with type Page", () => {
    const bad = { pages: [{ title: "Outer", children: [{ type: "Page", text: "", children: [] }] }] };
    expect(AstSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects unknown keys on a page and on the root", () => {
    expect(AstSchema.safeParse({ pages: [{ ...loginPage, color: "red" }] }).success).toBe(false);
    expect(AstSchema.safeParse({ ...loginAst, extra: 1 }).success).toBe(false);
  });

  it("round-trips the payload through JSON", () => {
    const parsed = AstSchema.parse(JSON.parse(JSON.stringify(loginAst)));
    expect(parsed).toEqual(loginAst);
  });
});

describe("AstSchema: nodes", () => {
  const withNodes = (...children: unknown[]) => ({ pages: [{ title: "p", children }] });

  it("rejects an unknown node type", () => {
    expect(AstSchema.safeParse(withNodes({ type: "Button", text: "", children: [] })).success).toBe(false);
  });

  it("accepts a Row node with and without children and text", () => {
    expect(AstSchema.safeParse(withNodes({ type: "Row", text: "", children: [] })).success).toBe(true);
    expect(AstSchema.safeParse(withNodes({ type: "Row", text: "Label", children: [] })).success).toBe(true);
    const row = {
      type: "Row",
      text: "Actions",
      children: [
        { type: "Box", text: "Cancel", children: [] },
        { type: "Box", text: "Submit", children: [] },
      ],
    };
    expect(AstSchema.safeParse(withNodes(row)).success).toBe(true);
    expect(AstSchema.parse(withNodes(row))).toEqual(withNodes(row));
  });

  it("rejects a lowercase row type", () => {
    expect(AstSchema.safeParse(withNodes({ type: "row", text: "", children: [] })).success).toBe(false);
  });

  it("rejects invalid nodes deep in the tree", () => {
    const bad = structuredClone(loginAst);
    bad.pages[0]!.children[0]!.children[1]!.children[1]!.children = [{ type: "Box", text: 42, children: [] }];
    expect(AstSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects missing required node fields", () => {
    expect(AstSchema.safeParse(withNodes({ type: "Box", text: "" })).success).toBe(false);
    expect(AstSchema.safeParse(withNodes({ text: "", children: [] })).success).toBe(false);
  });

  it("rejects unknown node properties", () => {
    expect(AstSchema.safeParse(withNodes({ ...loginForm, color: "red" })).success).toBe(false);
  });

  it("rejects an id property on a node", () => {
    expect(AstSchema.safeParse(withNodes({ ...loginForm, id: "root" })).success).toBe(false);
  });
});
