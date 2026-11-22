import { describe, expect, it } from "vitest";
import { AstSchema, PageSchema, WidthSchema } from "./ast";

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

describe("AstSchema: Spacer", () => {
  const withNodes = (...children: unknown[]) => ({ pages: [{ title: "p", children }] });
  const spacer = { type: "Spacer", text: "", children: [] };
  const row = (...children: unknown[]) => ({ type: "Row", text: "", children });
  const text = (value: string) => ({ type: "Text", text: value, children: [] });
  const messages = (ast: unknown) => {
    const result = AstSchema.safeParse(ast);
    return result.success ? [] : result.error.issues.map((i) => i.message);
  };

  it("accepts a Row with one Spacer between two children and keeps the AST", () => {
    const ast = withNodes(row(text("A"), spacer, text("B")));
    expect(AstSchema.safeParse(ast).success).toBe(true);
    expect(AstSchema.parse(ast)).toEqual(ast);
  });

  it("accepts a Spacer first, last, alone and several in a Row", () => {
    for (const r of [
      row(spacer, text("A")),
      row(text("A"), spacer),
      row(spacer),
      row(spacer, text("A"), spacer, text("B"), spacer),
    ]) {
      expect(AstSchema.safeParse(withNodes(r)).success).toBe(true);
    }
  });

  it("accepts a Spacer in a Row nested in a Box or in another Row", () => {
    expect(AstSchema.safeParse(withNodes({ type: "Box", text: "", children: [row(text("A"), spacer)] })).success).toBe(true);
    expect(AstSchema.safeParse(withNodes(row(spacer, row(text("A"), spacer)))).success).toBe(true);
  });

  it("rejects a Spacer directly in a page", () => {
    expect(messages(withNodes(spacer))).toEqual(["Spacer must be inside a Row"]);
  });

  it("rejects a Spacer in a Box, a Text or another Spacer", () => {
    expect(AstSchema.safeParse(withNodes({ type: "Box", text: "", children: [spacer] })).success).toBe(false);
    expect(AstSchema.safeParse(withNodes({ type: "Text", text: "", children: [spacer] })).success).toBe(false);
    expect(messages(withNodes(row({ ...spacer, children: [spacer] })))).toContain("Spacer must be inside a Row");
  });

  it("rejects a Spacer in a Box inside a Row (only a direct child counts)", () => {
    expect(AstSchema.safeParse(withNodes(row({ type: "Box", text: "", children: [spacer] }))).success).toBe(false);
  });

  it("rejects a Spacer with text", () => {
    expect(messages(withNodes(row({ ...spacer, text: "x" })))).toEqual(["Spacer cannot have text"]);
  });

  it("rejects a Spacer with children", () => {
    expect(messages(withNodes(row({ ...spacer, children: [text("x")] })))).toEqual(["Spacer cannot have children"]);
  });

  it("rejects a Spacer with a linkTo", () => {
    expect(messages(withNodes(row({ ...spacer, linkTo: "x" })))).toEqual(["Spacer cannot have link-to"]);
  });

  it("still rejects unknown keys on a Spacer", () => {
    expect(AstSchema.safeParse(withNodes(row({ ...spacer, color: "red" }))).success).toBe(false);
  });
});

describe("AstSchema: links", () => {
  const withNodes = (...children: unknown[]) => ({ pages: [{ title: "p", children }] });
  const page = (title: string, id?: unknown) => ({ title, ...(id === undefined ? {} : { id }), children: [] });

  it("accepts a page with an id and keeps it", () => {
    const ast = { pages: [page("Home", "test-id")] };
    expect(AstSchema.safeParse(ast).success).toBe(true);
    expect(AstSchema.parse(ast)).toEqual(ast);
  });

  it("accepts ids with letters, digits, `-` and `_`", () => {
    expect(AstSchema.safeParse({ pages: [page("a", "A_b-9")] }).success).toBe(true);
  });

  it("accepts a node with linkTo, also nested", () => {
    const linked = { type: "Text", linkTo: "test-id", text: "My Link", children: [] };
    expect(AstSchema.safeParse(withNodes(linked)).success).toBe(true);
    const nested = { type: "Box", text: "", children: [{ type: "Box", text: "", children: [linked] }] };
    expect(AstSchema.safeParse(withNodes(nested)).success).toBe(true);
    expect(AstSchema.parse(withNodes(nested))).toEqual(withNodes(nested));
  });

  it("rejects an empty or invalid page id", () => {
    for (const id of ["", "a b", "a.b", 5]) {
      expect(AstSchema.safeParse({ pages: [page("a", id)] }).success).toBe(false);
    }
  });

  it("rejects an empty or invalid linkTo", () => {
    for (const linkTo of ["", "a b", "a.b", 5]) {
      expect(AstSchema.safeParse(withNodes({ type: "Box", linkTo, text: "", children: [] })).success).toBe(false);
    }
  });

  it("rejects duplicate page ids", () => {
    const result = AstSchema.safeParse({ pages: [page("a", "x"), page("b", "y"), page("c", "x")] });
    expect(result.success).toBe(false);
    expect(!result.success && result.error.issues[0]!.message).toBe('Duplicate page id "x"');
  });

  it("accepts several pages without ids", () => {
    expect(AstSchema.safeParse({ pages: [page("a"), page("b"), page("")] }).success).toBe(true);
  });

  it("accepts the same id once only alongside pages without ids", () => {
    expect(AstSchema.safeParse({ pages: [page("a", "x"), page("b"), page("c")] }).success).toBe(true);
  });

  it("still rejects unknown keys on pages and nodes", () => {
    expect(AstSchema.safeParse({ pages: [{ ...page("a", "x"), color: "red" }] }).success).toBe(false);
    expect(
      AstSchema.safeParse(withNodes({ type: "Box", linkTo: "x", text: "", children: [], color: "red" })).success,
    ).toBe(false);
  });
});

describe("AstSchema: width", () => {
  const withNodes = (...children: unknown[]) => ({ pages: [{ title: "p", children }] });
  const nodeOf = (type: string, width: unknown) => ({ type, text: "", children: [], width });

  it("exports WidthSchema accepting whole numbers from 1 to 12", () => {
    for (const width of [1, 6, 12]) expect(WidthSchema.safeParse(width).success).toBe(true);
    for (const width of [0, 13, 2.5, -1, "3", null]) expect(WidthSchema.safeParse(width).success).toBe(false);
  });

  it("accepts widths 1 and 12 on each node type and keeps them", () => {
    for (const type of ["Box", "Text", "Row", "Spacer"]) {
      for (const width of [1, 12]) {
        const ast = withNodes({ type: "Row", text: "", children: [nodeOf(type, width)] });
        expect(AstSchema.safeParse(ast).success).toBe(true);
        expect(AstSchema.parse(ast)).toEqual(ast);
      }
    }
  });

  it("accepts a width outside a Row", () => {
    expect(AstSchema.safeParse(withNodes(nodeOf("Box", 5))).success).toBe(true);
  });

  it("accepts nodes without a width and leaves the key out", () => {
    const parsed = AstSchema.parse(withNodes({ type: "Box", text: "", children: [] }));
    expect(Object.keys(parsed.pages[0]!.children[0]!)).toEqual(["type", "text", "children"]);
  });

  it("rejects 0, 13, a non-integer and a non-number width", () => {
    for (const width of [0, 13, 2.5, "3", null]) {
      expect(AstSchema.safeParse(withNodes(nodeOf("Box", width))).success).toBe(false);
    }
  });

  it("rejects a width key on a Page", () => {
    expect(AstSchema.safeParse({ pages: [{ title: "p", width: 3, children: [] }] }).success).toBe(false);
  });
});
