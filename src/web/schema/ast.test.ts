import { describe, expect, it } from "vitest";
import {
  AspectRatioSchema,
  AstSchema,
  FontSchema,
  FontSizeSchema,
  PageSchema,
  POINTER_KINDS,
  PointerRefSchema,
  WidthSchema,
} from "./ast";

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
    expect(AstSchema.safeParse(withNodes({ type: "boxrow", text: "", children: [] })).success).toBe(false);
  });

  it("accepts a BoxRow node with text, children and width", () => {
    expect(AstSchema.safeParse(withNodes({ type: "BoxRow", text: "", children: [] })).success).toBe(true);
    expect(AstSchema.safeParse(withNodes({ type: "BoxRow", text: "Label", children: [] })).success).toBe(true);
    const boxRow = {
      type: "BoxRow",
      text: "Actions",
      width: 6,
      children: [
        { type: "Box", text: "Cancel", children: [] },
        { type: "Box", text: "Submit", children: [] },
      ],
    };
    expect(AstSchema.safeParse(withNodes(boxRow)).success).toBe(true);
    expect(AstSchema.parse(withNodes(boxRow))).toEqual(withNodes(boxRow));
  });

  it("accepts a BoxRow nested in a Page, a Box, a Row and a BoxRow", () => {
    const boxRow = (...children: unknown[]) => ({ type: "BoxRow", text: "", children });
    const box = { type: "Box", text: "", children: [boxRow()] };
    const row = { type: "Row", text: "", children: [boxRow()] };
    const nested = boxRow(boxRow());
    for (const node of [boxRow(), box, row, nested]) {
      expect(AstSchema.safeParse(withNodes(node)).success).toBe(true);
    }
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
    expect(messages(withNodes(spacer))).toEqual(["Spacer must be inside a Row or BoxRow"]);
  });

  it("accepts a Spacer directly in a BoxRow, and rejects it in a Box or Text with the new message", () => {
    const boxRow = (...children: unknown[]) => ({ type: "BoxRow", text: "", children });
    expect(AstSchema.safeParse(withNodes(boxRow(text("A"), spacer, text("B")))).success).toBe(true);
    expect(AstSchema.safeParse(withNodes(boxRow(spacer))).success).toBe(true);
    expect(messages(withNodes({ type: "Box", text: "", children: [spacer] }))).toEqual([
      "Spacer must be inside a Row or BoxRow",
    ]);
    expect(messages(withNodes({ type: "Text", text: "", children: [spacer] }))).toEqual([
      "Spacer must be inside a Row or BoxRow",
    ]);
    expect(messages(withNodes(boxRow({ type: "Box", text: "", children: [spacer] })))).toEqual([
      "Spacer must be inside a Row or BoxRow",
    ]);
  });

  it("rejects a Spacer in a Box, a Text or another Spacer", () => {
    expect(AstSchema.safeParse(withNodes({ type: "Box", text: "", children: [spacer] })).success).toBe(false);
    expect(AstSchema.safeParse(withNodes({ type: "Text", text: "", children: [spacer] })).success).toBe(false);
    expect(messages(withNodes(row({ ...spacer, children: [spacer] })))).toContain("Spacer must be inside a Row or BoxRow");
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
    for (const type of ["Box", "Text", "Row", "BoxRow", "Spacer"]) {
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

describe("AstSchema: font and font size", () => {
  const withNodes = (...children: unknown[]) => ({ pages: [{ title: "p", children }] });
  const inRow = (node: unknown) => withNodes({ type: "Row", text: "", children: [node] });
  const nodeOf = (type: string, extra: Record<string, unknown>) => ({ type, text: "", children: [], ...extra });
  const messages = (ast: unknown) => {
    const result = AstSchema.safeParse(ast);
    return result.success ? [] : result.error.issues.map((i) => i.message);
  };

  it("exports FontSchema (bold only) and FontSizeSchema (sm, md, lg)", () => {
    expect(FontSchema.safeParse("bold").success).toBe(true);
    for (const value of ["italic", "Bold", "", 1, true, null]) expect(FontSchema.safeParse(value).success).toBe(false);
    for (const value of ["sm", "md", "lg"]) expect(FontSizeSchema.safeParse(value).success).toBe(true);
    for (const value of ["xl", "LG", "", 12, null]) expect(FontSizeSchema.safeParse(value).success).toBe(false);
  });

  it("accepts font bold on Box, Text, Row and BoxRow and keeps it", () => {
    for (const type of ["Box", "Text", "Row", "BoxRow"]) {
      const ast = withNodes(nodeOf(type, { font: "bold" }));
      expect(AstSchema.safeParse(ast).success).toBe(true);
      expect(AstSchema.parse(ast)).toEqual(ast);
    }
  });

  it("accepts each fontSize on Box, Text, Row and BoxRow and keeps it", () => {
    for (const type of ["Box", "Text", "Row", "BoxRow"]) {
      for (const fontSize of ["sm", "md", "lg"]) {
        const ast = withNodes(nodeOf(type, { fontSize }));
        expect(AstSchema.safeParse(ast).success).toBe(true);
        expect(AstSchema.parse(ast)).toEqual(ast);
      }
    }
  });

  it("accepts font and fontSize together, also nested", () => {
    const inner = nodeOf("Text", { font: "bold", fontSize: "lg" });
    const ast = withNodes({ type: "Box", text: "", font: "bold", fontSize: "sm", children: [inner] });
    expect(AstSchema.safeParse(ast).success).toBe(true);
    expect(AstSchema.parse(ast)).toEqual(ast);
  });

  it("leaves the font keys out of nodes that do not have them", () => {
    const parsed = AstSchema.parse(withNodes(nodeOf("Box", {})));
    expect(Object.keys(parsed.pages[0]!.children[0]!)).toEqual(["type", "text", "children"]);
  });

  it("rejects other font values and non-strings", () => {
    for (const font of ["italic", "Bold", "", 1, true, null]) {
      expect(AstSchema.safeParse(withNodes(nodeOf("Box", { font }))).success).toBe(false);
    }
  });

  it("rejects other fontSize values and non-strings", () => {
    for (const fontSize of ["xl", "LG", "", 12, true, null]) {
      expect(AstSchema.safeParse(withNodes(nodeOf("Box", { fontSize }))).success).toBe(false);
    }
  });

  it("rejects font and fontSize on a Spacer", () => {
    expect(messages(inRow(nodeOf("Spacer", { font: "bold" })))).toEqual(["Spacer cannot have font"]);
    expect(messages(inRow(nodeOf("Spacer", { fontSize: "lg" })))).toEqual(["Spacer cannot have font-size"]);
  });

  it("rejects a font or fontSize key on a Page", () => {
    expect(AstSchema.safeParse({ pages: [{ title: "p", font: "bold", children: [] }] }).success).toBe(false);
    expect(AstSchema.safeParse({ pages: [{ title: "p", fontSize: "lg", children: [] }] }).success).toBe(false);
  });
});

describe("AstSchema: Image", () => {
  const withNodes = (...children: unknown[]) => ({ pages: [{ title: "p", children }] });
  const image = (extra: Record<string, unknown> = {}) => ({ type: "Image", text: "", children: [], ...extra });
  const messages = (ast: unknown) => {
    const result = AstSchema.safeParse(ast);
    return result.success ? [] : result.error.issues.map((i) => i.message);
  };

  it("accepts an Image in a page, a Box, a Row and a BoxRow and keeps the AST", () => {
    const asts = [
      withNodes(image()),
      withNodes({ type: "Box", text: "", children: [image()] }),
      withNodes({ type: "Text", text: "", children: [image()] }),
      withNodes({ type: "Row", text: "", children: [image()] }),
      withNodes({ type: "BoxRow", text: "", children: [image(), image()] }),
    ];
    for (const ast of asts) {
      expect(AstSchema.safeParse(ast).success).toBe(true);
      expect(AstSchema.parse(ast)).toEqual(ast);
    }
  });

  it("accepts an Image with and without linkTo and width", () => {
    for (const extra of [{}, { linkTo: "home" }, { width: 4 }, { linkTo: "home", width: 4 }]) {
      const ast = withNodes({ type: "Row", text: "", children: [image(extra)] });
      expect(AstSchema.safeParse(ast).success).toBe(true);
      expect(AstSchema.parse(ast)).toEqual(ast);
    }
  });

  it("does not add fields to an Image", () => {
    const parsed = AstSchema.parse(withNodes(image()));
    expect(Object.keys(parsed.pages[0]!.children[0]!)).toEqual(["type", "text", "children"]);
  });

  it("rejects an Image with text", () => {
    expect(messages(withNodes(image({ text: "x" })))).toEqual(["Image cannot have text"]);
  });

  it("rejects an Image with children", () => {
    const child = { type: "Box", text: "", children: [] };
    expect(messages(withNodes(image({ children: [child] })))).toEqual(["Image cannot have children"]);
  });

  it("rejects an Image with a font or a fontSize", () => {
    expect(messages(withNodes(image({ font: "bold" })))).toEqual(["Image cannot have font"]);
    expect(messages(withNodes(image({ fontSize: "lg" })))).toEqual(["Image cannot have font-size"]);
  });

  it("still rejects unknown keys on an Image", () => {
    expect(AstSchema.safeParse(withNodes(image({ color: "red" }))).success).toBe(false);
  });

  it("exports AspectRatioSchema accepting W:H with each part from 1 to 99", () => {
    for (const value of ["1:1", "16:9", "3:4", "99:99", "10:1"]) {
      expect(AspectRatioSchema.safeParse(value).success).toBe(true);
    }
    for (const value of ["", "1", "1:", ":1", "0:1", "1:0", "100:1", "01:1", "1:1:1", "1.5:1", "-1:1", "a:b", 1, null]) {
      expect(AspectRatioSchema.safeParse(value).success).toBe(false);
    }
  });

  it("accepts an Image with an aspectRatio, alone and with linkTo and width, and keeps it", () => {
    for (const extra of [{ aspectRatio: "1:1" }, { aspectRatio: "16:9", linkTo: "home", width: 4 }]) {
      const ast = withNodes({ type: "Row", text: "", children: [image(extra)] });
      expect(AstSchema.safeParse(ast).success).toBe(true);
      expect(AstSchema.parse(ast)).toEqual(ast);
    }
  });

  it("rejects an invalid aspectRatio on an Image", () => {
    for (const aspectRatio of ["1", "0:1", "100:1", "1.5:1", 1]) {
      expect(AstSchema.safeParse(withNodes(image({ aspectRatio }))).success).toBe(false);
    }
  });

  it("rejects an aspectRatio on any node that is not an Image", () => {
    for (const type of ["Box", "Text", "Row", "BoxRow"]) {
      expect(messages(withNodes({ type, text: "", aspectRatio: "1:1", children: [] }))).toEqual([
        `${type} cannot have aspect-ratio`,
      ]);
    }
    const spacerInRow = { type: "Row", text: "", children: [{ type: "Spacer", text: "", aspectRatio: "1:1", children: [] }] };
    expect(messages(withNodes(spacerInRow))).toEqual(["Spacer cannot have aspect-ratio"]);
    expect(AstSchema.safeParse({ pages: [{ title: "p", aspectRatio: "1:1", children: [] }] }).success).toBe(false);
  });
});

describe("AstSchema: pointer references", () => {
  const withNodes = (...children: unknown[]) => ({ pages: [{ title: "p", children }] });
  const ref = (extra: Record<string, unknown> = {}) => ({
    entity: "User",
    field: "FirstName",
    kind: "label",
    line: 3,
    ...extra,
  });
  const node = (type: string, extra: Record<string, unknown> = {}) => ({ type, text: "", children: [], ...extra });
  const messages = (ast: unknown) => {
    const result = AstSchema.safeParse(ast);
    return result.success ? [] : result.error.issues.map((i) => i.message);
  };

  it("exports the five pointer kinds and PointerRefSchema accepting a complete ref", () => {
    expect(POINTER_KINDS).toEqual(["entity", "field", "dataType", "label", "mock"]);
    for (const kind of POINTER_KINDS) expect(PointerRefSchema.safeParse(ref({ kind })).success).toBe(true);
  });

  it("rejects a ref with an unknown kind, a bad line, a missing key or an unknown key", () => {
    const bad = [
      ref({ kind: "value" }),
      ref({ line: 0 }),
      ref({ line: 1.5 }),
      ref({ extra: 1 }),
      { entity: "User", kind: "mock", line: 1 },
    ];
    for (const value of bad) expect(PointerRefSchema.safeParse(value).success).toBe(false);
  });

  it("accepts a ref on a Box, Text, Row and BoxRow and keeps it", () => {
    for (const type of ["Box", "Text", "Row", "BoxRow"]) {
      const ast = withNodes(node(type, { ref: ref() }));
      expect(AstSchema.safeParse(ast).success).toBe(true);
      expect(AstSchema.parse(ast)).toEqual(ast);
    }
  });

  it("accepts a node without a ref and adds no ref key", () => {
    const parsed = AstSchema.parse(withNodes(node("Box")));
    expect("ref" in parsed.pages[0]!.children[0]!).toBe(false);
  });

  it("rejects a ref on a Spacer and on an Image", () => {
    const spacer = node("Row", { children: [node("Spacer", { ref: ref() })] });
    expect(messages(withNodes(spacer))).toEqual(["Spacer cannot have text"]);
    expect(messages(withNodes(node("Image", { ref: ref() })))).toEqual(["Image cannot have text"]);
  });

  it("rejects a ref on a Page", () => {
    expect(PageSchema.safeParse({ title: "p", ref: ref(), children: [] }).success).toBe(false);
    expect(AstSchema.safeParse({ pages: [{ title: "p", ref: ref(), children: [] }] }).success).toBe(false);
  });

  it("rejects an invalid ref deep in the tree", () => {
    const ast = withNodes(node("Box", { children: [node("Text", { ref: ref({ kind: "nope" }) })] }));
    expect(AstSchema.safeParse(ast).success).toBe(false);
  });
});
