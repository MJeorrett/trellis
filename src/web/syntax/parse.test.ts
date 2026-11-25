import { describe, expect, it } from "vitest";
import { AstSchema, type Ast, type AstNode } from "@/schema/ast";
import { wireFrameEditorSource } from "@/features/wireframes/wire-frame-editor";
import { pageLinksSource } from "@/features/wireframes/page-links";
import { featuresListSource } from "@/features/wireframes/features-list";
import { parseSyntax } from "./parse";

const loginSource = `Page "Log in"
  Box
    Text "Log in"
    Box
      Text "Email"
      Box "you@example.com"
    Box
      Text "Password"
      Box "*********"
    Box "Submit"
`;

const loginBox: AstNode = {
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

const loginAst: Ast = { pages: [{ title: "Log in", children: [loginBox] }] };

const node = (type: AstNode["type"], text = "", children: AstNode[] = []): AstNode => ({ type, text, children });
const ast = (...pages: Ast["pages"]): Ast => ({ pages });

function expectError(source: string, error: string) {
  expect(parseSyntax(source)).toEqual({ ok: false, error });
}

describe("parseSyntax: sample", () => {
  it("parses the Login Form wrapped in a Page into the full expected AST", () => {
    expect(parseSyntax(loginSource)).toEqual({ ok: true, ast: loginAst });
  });

  it("produces an AST that passes AstSchema", () => {
    const result = parseSyntax(loginSource);
    expect(result.ok && AstSchema.safeParse(result.ast).success).toBe(true);
  });

  it("parses the Wire frame editor feature's source (Log in page and Forgot password page)", () => {
    const bold = (n: AstNode): AstNode => ({ ...n, font: "bold" });
    const heading = (text: string): AstNode => ({ ...node("Text", text), font: "bold", fontSize: "lg" });
    const loginWithRow: AstNode = node("Box", "", [
      heading("Log in"),
      node("Box", "", [bold(node("Text", "Email")), node("Box", "you@example.com")]),
      node("Box", "", [bold(node("Text", "Password")), node("Box", "*********")]),
      { ...node("Text", "Forgot password?"), linkTo: "forgot", fontSize: "sm" },
      node("BoxRow", "", [node("Box", "Cancel"), node("Box", "Submit")]),
    ]);
    const sampleAst = ast(
      { id: "login", title: "Log in", children: [loginWithRow] },
      {
        id: "forgot",
        title: "Forgot password",
        children: [
          node("Box", "", [
            heading("Forgot password"),
            node("Box", "", [{ ...node("Text", "Enter your email"), fontSize: "sm" }, node("Box", "you@example.com")]),
            node("Box", "Send reset link"),
            { ...node("Text", "Back to log in"), linkTo: "login" },
          ]),
        ],
      },
    );
    const result = parseSyntax(wireFrameEditorSource);
    expect(result).toEqual({ ok: true, ast: sampleAst });
    expect(result.ok && AstSchema.safeParse(result.ast).success).toBe(true);
  });

  it("is deterministic", () => {
    expect(parseSyntax(loginSource)).toEqual(parseSyntax(loginSource));
  });

  it("parses every seeded sample source, each using font and font-size", () => {
    const collect = (nodes: readonly AstNode[]): AstNode[] => nodes.flatMap((n) => [n, ...collect(n.children)]);
    for (const source of [wireFrameEditorSource, pageLinksSource, featuresListSource]) {
      const result = parseSyntax(source);
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      const all = collect(result.ast.pages.flatMap((p) => p.children));
      expect(all.some((n) => n.font === "bold")).toBe(true);
      expect(all.some((n) => n.fontSize !== undefined)).toBe(true);
    }
  });
});

describe("parseSyntax: Page", () => {
  it('parses `Page "Title"`', () => {
    expect(parseSyntax('Page "Title"')).toEqual({ ok: true, ast: ast({ title: "Title", children: [] }) });
  });

  it('parses `Page ""` as an empty title', () => {
    expect(parseSyntax('Page ""')).toEqual({ ok: true, ast: ast({ title: "", children: [] }) });
  });

  it('parses `Page "Title"` with nested children', () => {
    expect(parseSyntax('Page "Title"\n  Box "a"\n    Text "b"\n  Text "c"\n')).toEqual({
      ok: true,
      ast: ast({
        title: "Title",
        children: [node("Box", "a", [node("Text", "b")]), node("Text", "c")],
      }),
    });
  });

  it("parses a Page containing Row, Box and Text children", () => {
    expect(parseSyntax('Page "Mixed"\n  Row\n    Box "a"\n  Box "b"\n  Text "c"\n')).toEqual({
      ok: true,
      ast: ast({
        title: "Mixed",
        children: [node("Row", "", [node("Box", "a")]), node("Box", "b"), node("Text", "c")],
      }),
    });
  });

  it("parses multiple indent-0 pages in source order", () => {
    const source = 'Page "One"\n  Box "a"\n\nPage "Two"\nPage ""\n  Text "c"\n';
    expect(parseSyntax(source)).toEqual({
      ok: true,
      ast: ast(
        { title: "One", children: [node("Box", "a")] },
        { title: "Two", children: [] },
        { title: "", children: [node("Text", "c")] },
      ),
    });
  });

  it("does not leak children of one page into the next", () => {
    const result = parseSyntax('Page "One"\n  Box\n    Text "deep"\nPage "Two"\n  Text "x"\n');
    expect(result.ok && result.ast.pages.map((p) => p.children.length)).toEqual([1, 1]);
    expect(result.ok && result.ast.pages[1]!.children).toEqual([node("Text", "x")]);
  });

  it("rejects a `Page` without a title", () => {
    expectError("Page", "Line 1: Page requires a title");
    expectError('Page "a"\n\nPage', "Line 3: Page requires a title");
    expectError('Page "a"\nPage ', "Line 2: Page requires a title");
  });

  it("rejects a Page nested at any depth", () => {
    expectError('Page "a"\n  Page "b"', "Line 2: Page cannot be nested");
    expectError('Page "a"\n  Box\n    Page "b"', "Line 3: Page cannot be nested");
    expectError('Page "a"\n\n  Page', "Line 3: Page cannot be nested");
  });

  it("rejects a lowercase `page`", () => {
    expectError('page "a"', "Line 1: root node must be Page");
    expectError('Page "a"\n  page "b"', 'Line 2: Unknown type "page" (expected Box or Text or Row or BoxRow or Spacer or Image or Table or TableColumn)');
  });

  it("rejects bare unquoted and malformed titles", () => {
    expectError("Page Home", 'Line 1: Expected a double-quoted string after the type (e.g. Box "Some Text"), found "Home"');
    expectError('Page "Home', "Line 1: Unterminated quoted string");
    expectError('Page "Home" x', 'Line 1: Unexpected characters after closing quote: " x"');
  });
});

describe("parseSyntax: trailing whitespace", () => {
  it("parses a trailing space on a quote, a page, a pointer and a type as the line without it", () => {
    const pairs = [
      ['Page "p"\n  Box "a" ', 'Page "p"\n  Box "a"'],
      ['Page "Home" ', 'Page "Home"'],
      ['Page "p"\n  Box @User.FirstName ', 'Page "p"\n  Box @User.FirstName'],
      ['Page "p"\n  Row\n    Spacer ', 'Page "p"\n  Row\n    Spacer'],
    ];
    for (const [spaced, plain] of pairs) {
      const parsed = parseSyntax(spaced);
      expect(parsed.ok).toBe(true);
      expect(parsed).toEqual(parseSyntax(plain));
    }
  });

  it("removes a trailing tab the same way", () => {
    expect(parseSyntax('Page "Home"\t\n  Box "a"\t\n  Row\n    Spacer\t')).toEqual(
      parseSyntax('Page "Home"\n  Box "a"\n  Row\n    Spacer'),
    );
    expect(parseSyntax('Page "p"\n  Box @User.FirstName\t')).toEqual(parseSyntax('Page "p"\n  Box @User.FirstName'));
  });

  it("still ignores a line that is only whitespace", () => {
    expect(parseSyntax('Page "p"\n   \n\t\n  Box "a"\n')).toEqual(parseSyntax('Page "p"\n  Box "a"\n'));
    expect(parseSyntax("   \n\t\n")).toEqual(parseSyntax(""));
  });

  it("keeps leading spaces as the indentation", () => {
    expect(parseSyntax('Page "p"\n  Box "a" \n    Text "b"')).toEqual(parseSyntax('Page "p"\n  Box "a"\n    Text "b"'));
    expectError('Page "p"\n Box "a"', "Line 2: Indentation must be a multiple of 2 spaces, found 1");
  });

  it("keeps spaces inside quotes", () => {
    const result = parseSyntax('Page "p"\n  Box "a "');
    expect(result.ok && result.ast.pages[0]!.children[0]!.text).toBe("a ");
  });

  it("still rejects spaces that are not at the end of the line", () => {
    expectError(
      'Page "p"\n  Box  "x"',
      'Line 2: Expected a double-quoted string after the type (e.g. Box "Some Text"), found "\\"x\\""',
    );
    expectError('Page "p"\n  Box "a"  width=3', 'Line 2: Unexpected characters after closing quote: "  width=3"');
  });
});

describe("parseSyntax: blank source", () => {
  it("parses an empty source to one blank page", () => {
    expect(parseSyntax("")).toEqual({ ok: true, ast: ast({ title: "", children: [] }) });
  });

  it("parses whitespace-only input to one blank page", () => {
    expect(parseSyntax("  \n\n   \n")).toEqual({ ok: true, ast: ast({ title: "", children: [] }) });
  });
});

describe("parseSyntax: root must be Page", () => {
  it("rejects an unwrapped legacy source (starting with `Box`)", () => {
    expectError('Box\n  Text "Log in"\n', "Line 1: root node must be Page");
  });

  it("rejects each non-Page type at indent 0", () => {
    expectError("Box", "Line 1: root node must be Page");
    expectError("Text", "Line 1: root node must be Page");
    expectError("Row", "Line 1: root node must be Page");
    expectError("Button", "Line 1: root node must be Page");
  });

  it("rejects a non-Page indent-0 node after a page, counting blank lines", () => {
    expectError('Page "a"\n  Box\n\nBox "x"', "Line 4: root node must be Page");
  });

  it("rejects an indented first line", () => {
    expectError("  Box", "Line 1: The first node must not be indented");
    expectError("\n\n  Box", "Line 3: The first node must not be indented");
  });
});

describe("parseSyntax: node types", () => {
  const wrap = (body: string) => `Page "p"\n${body}`;

  it("parses `Box`, `Text` and `Row` inside a page", () => {
    expect(parseSyntax(wrap("  Box\n  Text\n  Row\n"))).toEqual({
      ok: true,
      ast: ast({ title: "p", children: [node("Box"), node("Text"), node("Row")] }),
    });
  });

  it('parses `Box "Some Text"`, `Text "Some Text"` and `Row "Some Text"`', () => {
    expect(parseSyntax(wrap('  Box "Some Text"\n  Text "Some Text"\n  Row "Some Text"'))).toEqual({
      ok: true,
      ast: ast({
        title: "p",
        children: [node("Box", "Some Text"), node("Text", "Some Text"), node("Row", "Some Text")],
      }),
    });
  });

  it("parses a Row with several children, preserving order", () => {
    expect(parseSyntax(wrap('  Row\n    Box "Cancel"\n    Text "or"\n    Box "Submit"\n'))).toEqual({
      ok: true,
      ast: ast({
        title: "p",
        children: [node("Row", "", [node("Box", "Cancel"), node("Text", "or"), node("Box", "Submit")])],
      }),
    });
  });

  it("parses a Row nested inside a Box and a Box nested inside a Row", () => {
    expect(parseSyntax(wrap('  Box\n    Row\n      Box "a"\n      Row\n        Text "b"\n'))).toEqual({
      ok: true,
      ast: ast({
        title: "p",
        children: [
          node("Box", "", [node("Row", "", [node("Box", "a"), node("Row", "", [node("Text", "b")])])]),
        ],
      }),
    });
  });

  it("parses `BoxRow` and `BoxRow \"Some Text\"` inside a page", () => {
    expect(parseSyntax(wrap("  BoxRow\n"))).toEqual({
      ok: true,
      ast: ast({ title: "p", children: [node("BoxRow")] }),
    });
    expect(parseSyntax(wrap('  BoxRow "Some Text"'))).toEqual({
      ok: true,
      ast: ast({ title: "p", children: [node("BoxRow", "Some Text")] }),
    });
  });

  it("parses a BoxRow with several children, preserving order", () => {
    expect(parseSyntax(wrap('  BoxRow\n    Box "Cancel"\n    Text "or"\n    Box "Submit"\n'))).toEqual({
      ok: true,
      ast: ast({
        title: "p",
        children: [node("BoxRow", "", [node("Box", "Cancel"), node("Text", "or"), node("Box", "Submit")])],
      }),
    });
  });

  it("parses a BoxRow nested in a Box, a Row and a BoxRow", () => {
    expect(parseSyntax(wrap("  Box\n    BoxRow\n  Row\n    BoxRow\n      BoxRow\n"))).toEqual({
      ok: true,
      ast: ast({
        title: "p",
        children: [
          node("Box", "", [node("BoxRow")]),
          node("Row", "", [node("BoxRow", "", [node("BoxRow")])]),
        ],
      }),
    });
  });

  it("rejects `boxrow` and `Boxrow` (type names are case-sensitive)", () => {
    expectError(wrap("  boxrow"), 'Line 2: Unknown type "boxrow" (expected Box or Text or Row or BoxRow or Spacer or Image or Table or TableColumn)');
    expectError(wrap("  Boxrow"), 'Line 2: Unknown type "Boxrow" (expected Box or Text or Row or BoxRow or Spacer or Image or Table or TableColumn)');
  });

  it("rejects a lowercase `row`", () => {
    expectError(wrap("  row"), 'Line 2: Unknown type "row" (expected Box or Text or Row or BoxRow or Spacer or Image or Table or TableColumn)');
    expectError(wrap("  Box\n    row"), 'Line 3: Unknown type "row" (expected Box or Text or Row or BoxRow or Spacer or Image or Table or TableColumn)');
  });

  it("allows returning to a shallower level", () => {
    const result = parseSyntax(wrap("  Box\n    Box\n      Text\n    Text\n"));
    expect(result.ok && result.ast.pages[0]!.children[0]!.children.map((c) => [c.type, c.children.length])).toEqual([
      ["Box", 1],
      ["Text", 0],
    ]);
  });
});

describe("parseSyntax: text forms", () => {
  const wrap = (line: string) => `Page "p"\n  ${line}`;
  const firstText = (source: string) => {
    const result = parseSyntax(source);
    return result.ok ? result.ast.pages[0]!.children[0]!.text : undefined;
  };

  it('treats `""` as empty text, equal to omitted text', () => {
    expect(parseSyntax(wrap('Box ""'))).toEqual(parseSyntax(wrap("Box")));
  });

  it("does not interpret escape sequences", () => {
    expect(firstText(wrap('Box "a\\nb"'))).toBe("a\\nb");
  });

  it("keeps whitespace inside quotes", () => {
    expect(firstText(wrap('Box "  a  b  "'))).toBe("  a  b  ");
  });

  it("ignores blank lines and handles CRLF line endings", () => {
    expect(parseSyntax('Page "p"\r\n\r\n  Box\r\n   \r\n    Text "a"\r\n    Text "b"\r\n')).toEqual({
      ok: true,
      ast: ast({ title: "p", children: [node("Box", "", [node("Text", "a"), node("Text", "b")])] }),
    });
  });
});

describe("parseSyntax: errors", () => {
  const wrap = (body: string) => `Page "p"\n${body}`;

  it("rejects an unknown type with its line number", () => {
    expectError(wrap("  Box\n    Button"), 'Line 3: Unknown type "Button" (expected Box or Text or Row or BoxRow or Spacer or Image or Table or TableColumn)');
  });

  it("rejects a lowercase type", () => {
    expectError(wrap("  box"), 'Line 2: Unknown type "box" (expected Box or Text or Row or BoxRow or Spacer or Image or Table or TableColumn)');
  });

  it("rejects bare unquoted text", () => {
    expectError(
      wrap("  Box Some Text"),
      'Line 2: Expected a double-quoted string after the type (e.g. Box "Some Text"), found "Some Text"',
    );
    expectError(
      wrap("  Box\n    Text hello"),
      'Line 3: Expected a double-quoted string after the type (e.g. Box "Some Text"), found "hello"',
    );
  });

  it("rejects tab characters", () => {
    expectError(
      wrap("\tBox"),
      "Line 2: Tab characters are not allowed; indent with 2 spaces per level",
    );
  });

  it("rejects indentation that is not a multiple of 2 spaces", () => {
    expectError(wrap(" Box"), "Line 2: Indentation must be a multiple of 2 spaces, found 1");
    expectError(wrap("  Box\n     Text"), "Line 3: Indentation must be a multiple of 2 spaces, found 5");
  });

  it("rejects indentation that skips a level", () => {
    expectError(wrap("    Box"), "Line 2: Indentation skips a level (expected at most 2 spaces, found 4)");
    expectError(wrap("  Box\n      Text"), "Line 3: Indentation skips a level (expected at most 4 spaces, found 6)");
  });

  it("does not allow the previous page's depth to carry over", () => {
    expectError(
      'Page "a"\n  Box\n    Box\nPage "b"\n    Box',
      "Line 5: Indentation skips a level (expected at most 2 spaces, found 4)",
    );
  });

  it("rejects an unterminated quoted string", () => {
    expectError(wrap('  Box "oops'), "Line 2: Unterminated quoted string");
    expectError(wrap('  Box\n    Text "'), "Line 3: Unterminated quoted string");
  });

  it("rejects trailing characters after a closing quote", () => {
    expectError(wrap('  Box "a" b'), 'Line 2: Unexpected characters after closing quote: " b"');
    expectError(wrap('  Text "a""'), 'Line 2: Unexpected characters after closing quote: "\\""');
  });

  it("parses a single trailing space as the same line without it", () => {
    expect(parseSyntax(wrap('  Box "a" '))).toEqual(parseSyntax(wrap('  Box "a"')));
  });

  it("counts blank lines when reporting line numbers", () => {
    expectError('Page "p"\n\n\n  Nope', 'Line 4: Unknown type "Nope" (expected Box or Text or Row or BoxRow or Spacer or Image or Table or TableColumn)');
  });
});

describe("parseSyntax: Spacer", () => {
  const wrap = (body: string) => `Page "p"\n${body}`;
  const spacer = (): AstNode => ({ type: "Spacer", text: "", children: [] });
  const page = (...children: AstNode[]) => ast({ title: "p", children });

  it("parses a Row with Text, Spacer, Text into the full AST, in order", () => {
    expect(parseSyntax(wrap('  Row\n    Text "A"\n    Spacer\n    Text "B"\n'))).toEqual({
      ok: true,
      ast: page(node("Row", "", [node("Text", "A"), spacer(), node("Text", "B")])),
    });
  });

  it("parses a Spacer first and last in a Row", () => {
    expect(parseSyntax(wrap('  Row\n    Spacer\n    Text "A"\n'))).toEqual({
      ok: true,
      ast: page(node("Row", "", [spacer(), node("Text", "A")])),
    });
    expect(parseSyntax(wrap('  Row\n    Text "A"\n    Spacer\n'))).toEqual({
      ok: true,
      ast: page(node("Row", "", [node("Text", "A"), spacer()])),
    });
  });

  it("parses several Spacers in a Row", () => {
    expect(parseSyntax(wrap('  Row\n    Spacer\n    Text "A"\n    Spacer\n    Text "B"\n    Spacer\n'))).toEqual({
      ok: true,
      ast: page(node("Row", "", [spacer(), node("Text", "A"), spacer(), node("Text", "B"), spacer()])),
    });
  });

  it("parses a Row nested in a Box with a Spacer", () => {
    expect(parseSyntax(wrap('  Box\n    Row\n      Box "a"\n      Spacer\n'))).toEqual({
      ok: true,
      ast: page(node("Box", "", [node("Row", "", [node("Box", "a"), spacer()])])),
    });
  });

  it("parses a Spacer in a Row inside a Row", () => {
    expect(parseSyntax(wrap('  Row\n    Spacer\n    Row\n      Text "a"\n      Spacer\n      Text "b"\n'))).toEqual({
      ok: true,
      ast: page(node("Row", "", [spacer(), node("Row", "", [node("Text", "a"), spacer(), node("Text", "b")])])),
    });
  });

  it("produces an AST that passes AstSchema", () => {
    const result = parseSyntax(wrap("  Row\n    Spacer\n    Spacer\n"));
    expect(result.ok && AstSchema.safeParse(result.ast).success).toBe(true);
  });

  it("rejects a lowercase `spacer`", () => {
    expectError(wrap("  Row\n    spacer"), 'Line 3: Unknown type "spacer" (expected Box or Text or Row or BoxRow or Spacer or Image or Table or TableColumn)');
  });

  it("rejects a Spacer that is not directly in a Row or BoxRow", () => {
    const MESSAGE = "Spacer must be inside a Row or BoxRow";
    expectError(wrap("  Spacer"), `Line 2: ${MESSAGE}`);
    expectError(wrap("  Box\n    Spacer"), `Line 3: ${MESSAGE}`);
    expectError(wrap("  Text\n    Spacer"), `Line 3: ${MESSAGE}`);
    expectError(wrap("  Row\n    Spacer\n      Spacer"), `Line 4: ${MESSAGE}`);
    expectError(wrap("  Row\n    Box\n      Spacer"), `Line 4: ${MESSAGE}`);
    expectError(wrap("  BoxRow\n    Box\n      Spacer"), `Line 4: ${MESSAGE}`);
    expectError('Page "a"\n  Row\n    Spacer\nPage "b"\n  Spacer', `Line 5: ${MESSAGE}`);
  });

  it("accepts a Spacer in a BoxRow, alone or between children", () => {
    expect(parseSyntax(wrap('  BoxRow\n    Text "A"\n    Spacer\n    Text "B"\n'))).toEqual({
      ok: true,
      ast: page(node("BoxRow", "", [node("Text", "A"), spacer(), node("Text", "B")])),
    });
    expect(parseSyntax(wrap("  BoxRow\n    Spacer"))).toEqual({
      ok: true,
      ast: page(node("BoxRow", "", [spacer()])),
    });
  });

  it("rejects text, attributes and children on a Spacer in a BoxRow", () => {
    expectError(wrap('  BoxRow\n    Spacer "x"'), "Line 3: Spacer cannot have text");
    expectError(wrap("  BoxRow\n    Spacer link-to=a"), "Line 3: Spacer cannot have link-to");
    expectError(wrap("  BoxRow\n    Spacer\n      Box"), "Line 4: Spacer cannot have children");
  });

  it("rejects text on a Spacer", () => {
    expectError(wrap('  Row\n    Spacer "x"'), "Line 3: Spacer cannot have text");
  });

  it('treats `Spacer ""` as a Spacer without text, like omitted text', () => {
    expect(parseSyntax(wrap('  Row\n    Spacer ""'))).toEqual(parseSyntax(wrap("  Row\n    Spacer")));
  });

  it("rejects attributes on a Spacer", () => {
    expectError(wrap("  Row\n    Spacer link-to=a"), "Line 3: Spacer cannot have link-to");
    expectError(wrap("  Row\n    Spacer id=a"), "Line 3: Spacer cannot have id");
  });

  it("rejects children of a Spacer", () => {
    expectError(wrap("  Row\n    Spacer\n      Box"), "Line 4: Spacer cannot have children");
    expectError(wrap('  Row\n    Spacer\n      Text "a"'), "Line 4: Spacer cannot have children");
  });
});

describe("parseSyntax: page ids and links", () => {
  const wrap = (body: string) => `Page "p"\n${body}`;
  const linked = (type: AstNode["type"], text: string, linkTo: string): AstNode => ({ ...node(type, text), linkTo });
  const VALUE_ERROR = (name: string) => `Attribute "${name}" requires a value of letters, digits, "-" or "_"`;

  it('parses `Page "Title" id=my-id` into a page with an id', () => {
    expect(parseSyntax('Page "My Page" id=test-id')).toEqual({
      ok: true,
      ast: ast({ id: "test-id", title: "My Page", children: [] }),
    });
    expect(parseSyntax('Page "" id=A_b-9')).toEqual({ ok: true, ast: ast({ id: "A_b-9", title: "", children: [] }) });
  });

  it("parses `Text` and `Box` with link-to, with and without text", () => {
    expect(parseSyntax(wrap('  Text "My Link" link-to=test-id'))).toEqual({
      ok: true,
      ast: ast({ title: "p", children: [linked("Text", "My Link", "test-id")] }),
    });
    expect(parseSyntax(wrap('  Box "Go" link-to=a'))).toEqual({
      ok: true,
      ast: ast({ title: "p", children: [linked("Box", "Go", "a")] }),
    });
    expect(parseSyntax(wrap("  Box link-to=a\n  Text link-to=b"))).toEqual({
      ok: true,
      ast: ast({ title: "p", children: [linked("Box", "", "a"), linked("Text", "", "b")] }),
    });
  });

  it("parses a linked node with children and nested links", () => {
    expect(parseSyntax(wrap('  Box "a" link-to=x\n    Text "b" link-to=y\n    Text "c"'))).toEqual({
      ok: true,
      ast: ast({
        title: "p",
        children: [{ ...linked("Box", "a", "x"), children: [linked("Text", "b", "y"), node("Text", "c")] }],
      }),
    });
  });

  it("accepts a link to a page id that does not exist", () => {
    const result = parseSyntax('Page "a" id=a\n  Text "x" link-to=nope');
    expect(result.ok).toBe(true);
  });

  it("accepts a link written before its target page", () => {
    const result = parseSyntax('Page "a" id=a\n  Text "x" link-to=b\nPage "b" id=b');
    expect(result.ok && AstSchema.safeParse(result.ast).success).toBe(true);
  });

  it("keeps text containing `=` or attribute-like content inside quotes as text", () => {
    expect(parseSyntax(wrap('  Box "a=b link-to=x"'))).toEqual({
      ok: true,
      ast: ast({ title: "p", children: [node("Box", "a=b link-to=x")] }),
    });
  });

  it("produces no id or linkTo keys when there are no attributes", () => {
    const result = parseSyntax('Page "a"\n  Box "b"');
    expect(result.ok && Object.keys(result.ast.pages[0]!)).toEqual(["title", "children"]);
    expect(result.ok && Object.keys(result.ast.pages[0]!.children[0]!)).toEqual(["type", "text", "children"]);
  });

  it("allows pages without ids next to pages with ids", () => {
    const result = parseSyntax('Page "a" id=a\nPage "b"\nPage "c" id=c');
    expect(result.ok && result.ast.pages.map((p) => p.id)).toEqual(["a", undefined, "c"]);
  });

  it("rejects an unknown attribute", () => {
    expectError(wrap('  Box "a" foo=x'), 'Line 2: Unknown attribute "foo"');
    expectError('Page "a" color=red', 'Line 1: Unknown attribute "color"');
    expectError(wrap("  Box foo=x"), 'Line 2: Unknown attribute "foo"');
  });

  it("rejects a duplicated attribute", () => {
    expectError(wrap('  Box "a" link-to=x link-to=y'), 'Line 2: Duplicate attribute "link-to"');
    expectError('Page "a" id=x id=y', 'Line 1: Duplicate attribute "id"');
  });

  it("rejects a missing or invalid value", () => {
    expectError('Page "a" id=', `Line 1: ${VALUE_ERROR("id")}`);
    expectError('Page "a" id=a.b', `Line 1: ${VALUE_ERROR("id")}`);
    expectError(wrap('  Text "a" link-to='), `Line 2: ${VALUE_ERROR("link-to")}`);
    expectError(wrap("  Box link-to=a.b"), `Line 2: ${VALUE_ERROR("link-to")}`);
    expectError(wrap('  Box "a" link-to="x"'), `Line 2: ${VALUE_ERROR("link-to")}`);
  });

  it("rejects a value with a space as an invalid attribute", () => {
    expectError('Page "a" id=a b', 'Line 1: Invalid attribute "b" (expected key=value)');
    expectError(wrap('  Box "a" link-to=x y'), 'Line 2: Invalid attribute "y" (expected key=value)');
  });

  it("rejects id on Box, Text and Row", () => {
    expectError(wrap('  Box "a" id=x'), "Line 2: Box cannot have id");
    expectError(wrap("  Text id=x"), "Line 2: Text cannot have id");
    expectError(wrap("  Row id=x"), "Line 2: Row cannot have id");
  });

  it("rejects link-to on Page and on Row", () => {
    expectError('Page "a" link-to=x', "Line 1: Page cannot have link-to");
    expectError(wrap("  Row link-to=x"), "Line 2: Row cannot have link-to");
    expectError(wrap('  Row "a" link-to=x'), "Line 2: Row cannot have link-to");
  });

  it("rejects id and link-to on BoxRow", () => {
    expectError(wrap("  BoxRow id=x"), "Line 2: BoxRow cannot have id");
    expectError(wrap("  BoxRow link-to=x"), "Line 2: BoxRow cannot have link-to");
    expectError(wrap('  BoxRow "a" link-to=x'), "Line 2: BoxRow cannot have link-to");
  });

  it("requires a title before attributes on a Page", () => {
    expectError("Page id=x", "Line 1: Page requires a title");
    expectError('Page "a"\nPage link-to=x', "Line 2: Page requires a title");
  });

  it("rejects a duplicate page id at the second page's line", () => {
    expectError('Page "a" id=x\nPage "b" id=y\n\nPage "c" id=x', 'Line 4: Duplicate page id "x"');
  });

  it("keeps the existing text errors when attributes are involved", () => {
    expectError(wrap('  Box "oops link-to=x'), "Line 2: Unterminated quoted string");
    expectError(wrap('  Box "a" b'), 'Line 2: Unexpected characters after closing quote: " b"');
    expectError(wrap('  Box "a"  link-to=x'), 'Line 2: Unexpected characters after closing quote: "  link-to=x"');
    expectError(wrap("  Box Some link-to=x"), 'Line 2: Expected a double-quoted string after the type (e.g. Box "Some Text"), found "Some link-to=x"');
  });
});

describe("parseSyntax: width", () => {
  const wrap = (body: string) => `Page "p"\n${body}`;
  const withWidth = (n: AstNode, width: number): AstNode => ({ ...n, width });
  const WIDTH_ERROR = 'Attribute "width" requires a whole number from 1 to 12';

  it("parses width on Box, Text, Row and Spacer inside a Row into the full AST", () => {
    expect(parseSyntax(wrap('  Row\n    Box "a" width=3\n    Text "b" width=9\n    Row width=12\n    Spacer width=1'))).toEqual({
      ok: true,
      ast: ast({
        title: "p",
        children: [
          node("Row", "", [
            withWidth(node("Box", "a"), 3),
            withWidth(node("Text", "b"), 9),
            withWidth(node("Row"), 12),
            withWidth(node("Spacer"), 1),
          ]),
        ],
      }),
    });
  });

  it("parses width combined with link-to in both orders", () => {
    const expected = { ...withWidth(node("Text", "Home"), 3), linkTo: "home" };
    expect(parseSyntax(wrap('  Text "Home" link-to=home width=3'))).toEqual({
      ok: true,
      ast: ast({ title: "p", children: [expected] }),
    });
    expect(parseSyntax(wrap('  Text "Home" width=3 link-to=home'))).toEqual({
      ok: true,
      ast: ast({ title: "p", children: [expected] }),
    });
  });

  it("parses width on a BoxRow, and on its children, into the full AST", () => {
    expect(parseSyntax(wrap('  Row\n    BoxRow width=6\n      Box "a" width=3\n    Box "b"'))).toEqual({
      ok: true,
      ast: ast({
        title: "p",
        children: [
          node("Row", "", [
            withWidth(node("BoxRow", "", [withWidth(node("Box", "a"), 3)]), 6),
            node("Box", "b"),
          ]),
        ],
      }),
    });
    expectError(wrap("  BoxRow width=13"), `Line 2: ${WIDTH_ERROR}`);
    expectError(wrap("  BoxRow width=3 width=4"), 'Line 2: Duplicate attribute "width"');
  });

  it("keeps a width outside a Row", () => {
    expect(parseSyntax(wrap('  Box "a" width=5\n    Text "b" width=2'))).toEqual({
      ok: true,
      ast: ast({
        title: "p",
        children: [{ ...withWidth(node("Box", "a", [withWidth(node("Text", "b"), 2)]), 5) }],
      }),
    });
  });

  it("allows the text to be omitted before the attribute", () => {
    expect(parseSyntax(wrap("  Box width=3"))).toEqual({
      ok: true,
      ast: ast({ title: "p", children: [withWidth(node("Box"), 3)] }),
    });
    expect(parseSyntax(wrap("  Box link-to=a width=3"))).toEqual({
      ok: true,
      ast: ast({ title: "p", children: [{ ...withWidth(node("Box"), 3), linkTo: "a" }] }),
    });
  });

  it("accepts a Spacer with width but not with link-to", () => {
    expect(parseSyntax(wrap("  Row\n    Spacer width=2")).ok).toBe(true);
    expectError(wrap("  Row\n    Spacer link-to=x"), "Line 3: Spacer cannot have link-to");
  });

  it("produces no width key unless written", () => {
    const result = parseSyntax(wrap('  Box "a" link-to=x'));
    expect(result.ok && "width" in result.ast.pages[0]!.children[0]!).toBe(false);
  });

  it("rejects width on a Page, before checking the value", () => {
    expectError('Page "x" width=3', "Line 1: Page cannot have width");
    expectError('Page "x" width=99', "Line 1: Page cannot have width");
  });

  it("rejects a missing or invalid width value", () => {
    for (const value of ["", "0", "13", "abc", "03", "2.5", "-1"]) {
      expectError(wrap(`  Box width=${value}`), `Line 2: ${WIDTH_ERROR}`);
    }
    expectError(wrap('  Text "a" width=13'), `Line 2: ${WIDTH_ERROR}`);
    expectError(wrap("  Row\n    Spacer width=0"), `Line 3: ${WIDTH_ERROR}`);
  });

  it("rejects a duplicate width", () => {
    expectError(wrap('  Box "a" width=3 width=4'), 'Line 2: Duplicate attribute "width"');
    expectError(wrap("  Box width=3 link-to=a width=4"), 'Line 2: Duplicate attribute "width"');
  });
});

describe("parseSyntax: font and font-size", () => {
  const wrap = (body: string) => `Page "p"\n${body}`;
  const page = (...children: AstNode[]) => ast({ title: "p", children });
  const FONT_ERROR = 'Attribute "font" requires the value bold';
  const SIZE_ERROR = 'Attribute "font-size" requires one of sm, md or lg';

  it("parses font=bold and each font-size on Box, Text, Row and BoxRow into the full AST", () => {
    for (const type of ["Box", "Text", "Row", "BoxRow"] as const) {
      expect(parseSyntax(wrap(`  ${type} "a" font=bold`))).toEqual({
        ok: true,
        ast: page({ ...node(type, "a"), font: "bold" }),
      });
      for (const fontSize of ["sm", "md", "lg"] as const) {
        expect(parseSyntax(wrap(`  ${type} "a" font-size=${fontSize}`))).toEqual({
          ok: true,
          ast: page({ ...node(type, "a"), fontSize }),
        });
      }
    }
  });

  it("keeps font-size=md as written", () => {
    expect(parseSyntax(wrap('  Text "a" font-size=md'))).toEqual({
      ok: true,
      ast: page({ ...node("Text", "a"), fontSize: "md" }),
    });
  });

  it("parses all four attributes together in more than one order", () => {
    const expected = { ...node("Text", "Title"), font: "bold", fontSize: "lg", linkTo: "home", width: 6 } as AstNode;
    for (const attrs of [
      "font=bold font-size=lg link-to=home width=6",
      "width=6 link-to=home font-size=lg font=bold",
      "link-to=home font-size=lg width=6 font=bold",
    ]) {
      expect(parseSyntax(wrap(`  Text "Title" ${attrs}`))).toEqual({ ok: true, ast: page(expected) });
    }
  });

  it("parses the attributes with the text omitted", () => {
    expect(parseSyntax(wrap("  Text font=bold"))).toEqual({
      ok: true,
      ast: page({ ...node("Text"), font: "bold" }),
    });
    expect(parseSyntax(wrap("  Box font-size=sm font=bold"))).toEqual({
      ok: true,
      ast: page({ ...node("Box"), font: "bold", fontSize: "sm" }),
    });
  });

  it("parses the attributes on nested nodes and leaves children without them", () => {
    expect(parseSyntax(wrap('  Box "a" font=bold\n    Text "b"'))).toEqual({
      ok: true,
      ast: page({ ...node("Box", "a", [node("Text", "b")]), font: "bold" }),
    });
  });

  it("produces no font keys unless written", () => {
    const result = parseSyntax(wrap('  Box "a" link-to=x width=3'));
    expect(result.ok && "font" in result.ast.pages[0]!.children[0]!).toBe(false);
    expect(result.ok && "fontSize" in result.ast.pages[0]!.children[0]!).toBe(false);
  });

  it("rejects font and font-size on a Page, before checking the value", () => {
    expectError('Page "x" font=bold', "Line 1: Page cannot have font");
    expectError('Page "x" font-size=lg', "Line 1: Page cannot have font-size");
    expectError('Page "x" font=italic', "Line 1: Page cannot have font");
    expectError('Page "x" font-size=xl', "Line 1: Page cannot have font-size");
  });

  it("rejects font and font-size on a Spacer, but still accepts width", () => {
    expectError(wrap("  Row\n    Spacer font=bold"), "Line 3: Spacer cannot have font");
    expectError(wrap("  Row\n    Spacer font-size=sm"), "Line 3: Spacer cannot have font-size");
    expectError(wrap("  Row\n    Spacer font=italic"), "Line 3: Spacer cannot have font");
    expect(parseSyntax(wrap("  Row\n    Spacer width=2")).ok).toBe(true);
  });

  it("rejects a missing or other font value", () => {
    for (const value of ["", "italic", "Bold"]) {
      expectError(wrap(`  Box font=${value}`), `Line 2: ${FONT_ERROR}`);
    }
    expectError(wrap('  Text "a" font=italic'), `Line 2: ${FONT_ERROR}`);
  });

  it("rejects a missing or other font-size value", () => {
    for (const value of ["", "xl", "LG"]) {
      expectError(wrap(`  Box font-size=${value}`), `Line 2: ${SIZE_ERROR}`);
    }
    expectError(wrap('  BoxRow "a" font-size=xl'), `Line 2: ${SIZE_ERROR}`);
  });

  it("rejects duplicate font and font-size", () => {
    expectError(wrap("  Box font=bold font=bold"), 'Line 2: Duplicate attribute "font"');
    expectError(wrap("  Box font-size=sm font-size=lg"), 'Line 2: Duplicate attribute "font-size"');
    expectError(wrap("  Box font=bold width=3 font=bold"), 'Line 2: Duplicate attribute "font"');
  });
});

describe("parseSyntax: Image", () => {
  const wrap = (body: string) => `Page "p"\n${body}`;
  const page = (...children: AstNode[]) => ast({ title: "p", children });
  const image = (extra: Partial<AstNode> = {}): AstNode => ({ type: "Image", text: "", children: [], ...extra });

  it("parses an Image as a child of a Page into the full AST", () => {
    expect(parseSyntax(wrap("  Image"))).toEqual({ ok: true, ast: page(image()) });
  });

  it("parses an Image as a child of a Box and of a Row", () => {
    expect(parseSyntax(wrap('  Box\n    Text "a"\n    Image'))).toEqual({
      ok: true,
      ast: page(node("Box", "", [node("Text", "a"), image()])),
    });
    expect(parseSyntax(wrap("  Row\n    Image\n    Image"))).toEqual({
      ok: true,
      ast: page(node("Row", "", [image(), image()])),
    });
    expect(parseSyntax(wrap("  BoxRow\n    Image"))).toEqual({
      ok: true,
      ast: page(node("BoxRow", "", [image()])),
    });
  });

  it("parses an Image with width and link-to, in either order", () => {
    const expected = image({ linkTo: "home", width: 4 });
    expect(parseSyntax(wrap("  Row\n    Image link-to=home width=4"))).toEqual({
      ok: true,
      ast: page(node("Row", "", [expected])),
    });
    expect(parseSyntax(wrap("  Row\n    Image width=4 link-to=home"))).toEqual({
      ok: true,
      ast: page(node("Row", "", [expected])),
    });
    expect(parseSyntax(wrap("  Image width=4"))).toEqual({ ok: true, ast: page(image({ width: 4 })) });
    expect(parseSyntax(wrap("  Image link-to=home"))).toEqual({ ok: true, ast: page(image({ linkTo: "home" })) });
  });

  it("produces an AST that passes AstSchema and has no extra keys", () => {
    const result = parseSyntax(wrap("  Image"));
    expect(result.ok && AstSchema.safeParse(result.ast).success).toBe(true);
    expect(result.ok && Object.keys(result.ast.pages[0]!.children[0]!)).toEqual(["type", "text", "children"]);
  });

  it("treats `Image \"\"` as an Image without text, like omitted text", () => {
    expect(parseSyntax(wrap('  Image ""'))).toEqual(parseSyntax(wrap("  Image")));
  });

  it("rejects a lowercase `image` with its line number", () => {
    expectError(wrap("  image"), 'Line 2: Unknown type "image" (expected Box or Text or Row or BoxRow or Spacer or Image or Table or TableColumn)');
  });

  it("rejects text on an Image", () => {
    expectError(wrap('  Image "x"'), "Line 2: Image cannot have text");
    expectError(wrap('  Row\n    Image "x" width=3'), "Line 3: Image cannot have text");
  });

  it("rejects children of an Image, on the child's line", () => {
    expectError(wrap("  Image\n    Box"), "Line 3: Image cannot have children");
    expectError(wrap('  Image\n    Text "a"'), "Line 3: Image cannot have children");
    expectError(wrap("  Image\n    Image"), "Line 3: Image cannot have children");
  });

  it("rejects font, font-size and id on an Image", () => {
    expectError(wrap("  Image font=bold"), "Line 2: Image cannot have font");
    expectError(wrap("  Image font-size=lg"), "Line 2: Image cannot have font-size");
    expectError(wrap("  Image id=x"), "Line 2: Image cannot have id");
  });

  it("applies the usual attribute rules to an Image", () => {
    expectError(wrap("  Image width=13"), 'Line 2: Attribute "width" requires a whole number from 1 to 12');
    expectError(wrap("  Image width=3 width=4"), 'Line 2: Duplicate attribute "width"');
    expectError(wrap("  Image foo=x"), 'Line 2: Unknown attribute "foo"');
  });

  describe("aspect-ratio", () => {
    const RATIO_ERROR = 'Attribute "aspect-ratio" requires a ratio such as 16:9 (whole numbers from 1 to 99)';

    it("parses aspect-ratio on an Image into the full AST", () => {
      expect(parseSyntax(wrap("  Image aspect-ratio=1:1"))).toEqual({
        ok: true,
        ast: page(image({ aspectRatio: "1:1" })),
      });
      expect(parseSyntax(wrap("  Image aspect-ratio=16:9"))).toEqual({
        ok: true,
        ast: page(image({ aspectRatio: "16:9" })),
      });
      expect(parseSyntax(wrap("  Image aspect-ratio=99:1"))).toEqual({
        ok: true,
        ast: page(image({ aspectRatio: "99:1" })),
      });
    });

    it("parses aspect-ratio combined with link-to and width in any order", () => {
      const expected = image({ linkTo: "home", width: 4, aspectRatio: "4:3" });
      for (const attrs of [
        "link-to=home width=4 aspect-ratio=4:3",
        "aspect-ratio=4:3 width=4 link-to=home",
        "width=4 aspect-ratio=4:3 link-to=home",
      ]) {
        expect(parseSyntax(wrap(`  Row\n    Image ${attrs}`))).toEqual({
          ok: true,
          ast: page(node("Row", "", [expected])),
        });
      }
    });

    it("writes no aspectRatio key unless written", () => {
      const result = parseSyntax(wrap("  Image width=3"));
      expect(result.ok && "aspectRatio" in result.ast.pages[0]!.children[0]!).toBe(false);
    });

    it("rejects a missing or invalid value", () => {
      for (const value of ["", "1", "1:", ":1", "0:1", "1:0", "100:1", "01:1", "1:1:1", "1.5:1", "a:b", "-1:1"]) {
        expectError(wrap(`  Image aspect-ratio=${value}`), `Line 2: ${RATIO_ERROR}`);
      }
    });

    it("rejects a duplicate aspect-ratio", () => {
      expectError(wrap("  Image aspect-ratio=1:1 aspect-ratio=2:1"), 'Line 2: Duplicate attribute "aspect-ratio"');
    });

    it("rejects aspect-ratio on every other type, before checking the value", () => {
      expectError(wrap("  Box aspect-ratio=1:1"), "Line 2: Box cannot have aspect-ratio");
      expectError(wrap('  Text "a" aspect-ratio=1:1'), "Line 2: Text cannot have aspect-ratio");
      expectError(wrap("  Row aspect-ratio=1:1"), "Line 2: Row cannot have aspect-ratio");
      expectError(wrap("  BoxRow aspect-ratio=1:1"), "Line 2: BoxRow cannot have aspect-ratio");
      expectError(wrap("  Row\n    Spacer aspect-ratio=1:1"), "Line 3: Spacer cannot have aspect-ratio");
      expectError('Page "x" aspect-ratio=1:1', "Line 1: Page cannot have aspect-ratio");
      expectError(wrap("  Box aspect-ratio=bad"), "Line 2: Box cannot have aspect-ratio");
    });
  });
});

describe("parseSyntax: pointers", () => {
  const wrap = (body: string) => `Page "p"\n${body}`;
  const page = (...children: AstNode[]) => ast({ title: "p", children });
  const pointer = (
    type: AstNode["type"],
    ref: { entity?: string; field?: string; kind: NonNullable<AstNode["ref"]>["kind"]; line: number },
    extra: Partial<AstNode> = {},
  ): AstNode => ({
    type,
    text: "",
    ref: { entity: "User", field: "FirstName", ...ref },
    children: [],
    ...extra,
  });
  const INVALID = "(expected @Entity.Field or @Entity.Field.<entity|field|dataType|label|mock>)";

  it("parses a pointer without a suffix as the mock value, with empty text and the line", () => {
    expect(parseSyntax(wrap("  Box @User.FirstName"))).toEqual({
      ok: true,
      ast: page(pointer("Box", { kind: "mock", line: 2 })),
    });
  });

  it("parses each kind as written", () => {
    for (const kind of ["entity", "field", "dataType", "label", "mock"] as const) {
      expect(parseSyntax(wrap(`  Text @User.FirstName.${kind}`))).toEqual({
        ok: true,
        ast: page(pointer("Text", { kind, line: 2 })),
      });
    }
  });

  it("accepts a pointer as the text of a Box, Text, Row and BoxRow", () => {
    for (const type of ["Box", "Text", "Row", "BoxRow"] as const) {
      expect(parseSyntax(wrap(`  ${type} @User.FirstName.label`))).toEqual({
        ok: true,
        ast: page(pointer(type, { kind: "label", line: 2 })),
      });
    }
  });

  it("accepts attributes after a pointer, in any order", () => {
    const expected = pointer("Text", { kind: "label", line: 3 }, { font: "bold", width: 4 });
    for (const attrs of ["font=bold width=4", "width=4 font=bold"]) {
      expect(parseSyntax(wrap(`  Row\n    Text @User.FirstName.label ${attrs}`))).toEqual({
        ok: true,
        ast: page(node("Row", "", [expected])),
      });
    }
  });

  it("records the line of each pointer and nests pointers under parents", () => {
    const result = parseSyntax(wrap('  Box\n    Text "a"\n    Text @User.LastName'));
    expect(result).toEqual({
      ok: true,
      ast: page(
        node("Box", "", [node("Text", "a"), pointer("Text", { field: "LastName", kind: "mock", line: 4 })]),
      ),
    });
  });

  it("does not write a ref key for quoted text", () => {
    const result = parseSyntax(wrap('  Box "a"'));
    expect(result.ok && "ref" in result.ast.pages[0]!.children[0]!).toBe(false);
  });

  it("treats a quoted pointer as plain text", () => {
    expect(parseSyntax(wrap('  Text "@User.FirstName"'))).toEqual({
      ok: true,
      ast: page(node("Text", "@User.FirstName")),
    });
  });

  it("produces an AST that passes AstSchema", () => {
    const result = parseSyntax(wrap("  Box @User.FirstName.dataType"));
    expect(result.ok && AstSchema.safeParse(result.ast).success).toBe(true);
  });

  it("rejects a malformed pointer with Invalid pointer", () => {
    for (const token of [
      "@user.FirstName",
      "@User.firstName",
      "@User.",
      "@User..FirstName",
      "@.FirstName",
      "@",
      "@User.FirstName.value",
      "@User.FirstName.Label",
      "@User.FirstName.label.x",
      "@User.First_Name",
      '@User.FirstName"',
    ]) {
      expectError(wrap(`  Box ${token}`), `Line 2: Invalid pointer ${JSON.stringify(token)} ${INVALID}`);
    }
  });

  it("rejects an entity pointer as it must name a field", () => {
    expectError(wrap("  Box @User"), 'Line 2: Pointer "@User" must name a field (expected @Entity.Field)');
    expectError(wrap("  Row\n    Text @User font=bold"), 'Line 3: Pointer "@User" must name a field (expected @Entity.Field)');
  });

  it("reports the line of the pointer", () => {
    expectError(wrap("  Box\n\n    Text @bad"), `Line 4: Invalid pointer "@bad" ${INVALID}`);
  });

  it("still rejects other bare text", () => {
    expectError(
      wrap("  Box Some Text"),
      'Line 2: Expected a double-quoted string after the type (e.g. Box "Some Text"), found "Some Text"',
    );
    expectError(
      wrap("  Box User.FirstName"),
      'Line 2: Expected a double-quoted string after the type (e.g. Box "Some Text"), found "User.FirstName"',
    );
  });

  it("rejects text that follows a pointer and is not an attribute", () => {
    expectError(wrap("  Box @User.FirstName extra"), 'Line 2: Unexpected characters after pointer: " extra"');
  });

  it("parses a trailing space after a pointer as the same line without it", () => {
    expect(parseSyntax(wrap("  Box @User.FirstName "))).toEqual(parseSyntax(wrap("  Box @User.FirstName")));
  });

  it("applies the usual attribute rules after a pointer", () => {
    expectError(wrap("  Box @User.FirstName width=13"), 'Line 2: Attribute "width" requires a whole number from 1 to 12');
    expectError(wrap("  Box @User.FirstName foo=x"), 'Line 2: Unknown attribute "foo"');
  });

  it("rejects a pointer on a Page", () => {
    expectError("Page @User.FirstName", 'Line 1: Expected a double-quoted string after the type (e.g. Box "Some Text"), found "@User.FirstName"');
  });

  it("rejects a pointer on a Spacer and an Image", () => {
    expectError(wrap("  Row\n    Spacer @User.FirstName"), "Line 3: Spacer cannot have text");
    expectError(wrap("  Image @User.FirstName"), "Line 2: Image cannot have text");
  });
});

describe("parseSyntax: Table", () => {
  const wrap = (body: string) => `Page "p"\n${body}`;
  const page = (...children: AstNode[]) => ast({ title: "p", children });
  const column = (text: string, extra: Partial<AstNode> = {}): AstNode => ({ type: "TableColumn", text, children: [], ...extra });
  const pointerColumn = (field: string, line: number, extra: Partial<AstNode> = {}): AstNode => ({
    type: "TableColumn",
    text: "",
    ref: { entity: "User", field, kind: "mock", line },
    children: [],
    ...extra,
  });
  const table = (...columns: AstNode[]): AstNode => node("Table", "", columns);
  const VALUES_ERROR = 'Invalid table column values (expected "Header"|"value","value")';
  const POINTER_ERROR = (token: string) => `Invalid pointer ${JSON.stringify(token)} (expected @Entity.Field)`;

  const exampleSource = [
    "  Table",
    "    TableColumn @User.Name width=4",
    "    TableColumn @User.Email width=5",
    '    TableColumn "Manual Column"|"mock 1","mock 2","mock 3"',
    '    TableColumn "Edit"|"Edit user" width=2 link-to=edit-user',
  ].join("\n");

  it("parses the full example table into the expected AST", () => {
    expect(parseSyntax(wrap(exampleSource))).toEqual({
      ok: true,
      ast: page(
        table(
          pointerColumn("Name", 3, { width: 4 }),
          pointerColumn("Email", 4, { width: 5 }),
          column("Manual Column", { values: ["mock 1", "mock 2", "mock 3"] }),
          column("Edit", { values: ["Edit user"], width: 2, linkTo: "edit-user" }),
        ),
      ),
    });
  });

  it("parses a Table as a child of a Page, Box, Row and BoxRow", () => {
    expect(parseSyntax(wrap('  Table\n    TableColumn "A"'))).toEqual({ ok: true, ast: page(table(column("A"))) });
    for (const type of ["Box", "Text", "Row", "BoxRow"] as const) {
      expect(parseSyntax(wrap(`  ${type}\n    Table\n      TableColumn "A"`))).toEqual({
        ok: true,
        ast: page(node(type, "", [table(column("A"))])),
      });
    }
  });

  it("parses siblings after a table and several tables", () => {
    expect(parseSyntax(wrap('  Table\n    TableColumn "A"\n  Text "after"\n  Table\n    TableColumn "B"'))).toEqual({
      ok: true,
      ast: page(table(column("A")), node("Text", "after"), table(column("B"))),
    });
  });

  it("parses a literal column with no values, without a values key", () => {
    const result = parseSyntax(wrap('  Table\n    TableColumn "Name"'));
    expect(result).toEqual({ ok: true, ast: page(table(column("Name"))) });
    expect(result.ok && "values" in result.ast.pages[0]!.children[0]!.children[0]!).toBe(false);
  });

  it("parses a literal column with one value and with several values", () => {
    expect(parseSyntax(wrap('  Table\n    TableColumn "Name"|"Alice"'))).toEqual({
      ok: true,
      ast: page(table(column("Name", { values: ["Alice"] }))),
    });
    expect(parseSyntax(wrap('  Table\n    TableColumn "Name"|"a","b","c","d"'))).toEqual({
      ok: true,
      ast: page(table(column("Name", { values: ["a", "b", "c", "d"] }))),
    });
  });

  it("allows spaces, | and , in quoted headers and values, and empty strings", () => {
    expect(parseSyntax(wrap('  Table\n    TableColumn "a | b, c"|"x y","p|q","r,s",""'))).toEqual({
      ok: true,
      ast: page(table(column("a | b, c", { values: ["x y", "p|q", "r,s", ""] }))),
    });
    expect(parseSyntax(wrap('  Table\n    TableColumn ""|""'))).toEqual({
      ok: true,
      ast: page(table(column("", { values: [""] }))),
    });
    expect(parseSyntax(wrap('  Table\n    TableColumn ""'))).toEqual({ ok: true, ast: page(table(column(""))) });
  });

  it("parses a pointer column with a ref and empty text", () => {
    const result = parseSyntax(wrap("  Table\n    TableColumn @User.Name"));
    expect(result).toEqual({ ok: true, ast: page(table(pointerColumn("Name", 3))) });
  });

  it("parses width and link-to on a column in either order", () => {
    const expected = column("Edit", { values: ["Edit user"], width: 2, linkTo: "edit-user" });
    for (const attrs of ["width=2 link-to=edit-user", "link-to=edit-user width=2"]) {
      expect(parseSyntax(wrap(`  Table\n    TableColumn "Edit"|"Edit user" ${attrs}`))).toEqual({
        ok: true,
        ast: page(table(expected)),
      });
    }
    expect(parseSyntax(wrap('  Table\n    TableColumn "A" width=4'))).toEqual({
      ok: true,
      ast: page(table(column("A", { width: 4 }))),
    });
    expect(parseSyntax(wrap("  Table\n    TableColumn @User.Name link-to=x width=4"))).toEqual({
      ok: true,
      ast: page(table(pointerColumn("Name", 3, { linkTo: "x", width: 4 }))),
    });
  });

  it("treats attribute-like content in quotes as plain text", () => {
    expect(parseSyntax(wrap('  Table\n    TableColumn "a width=3"|"b link-to=x" width=2'))).toEqual({
      ok: true,
      ast: page(table(column("a width=3", { values: ["b link-to=x"], width: 2 }))),
    });
  });

  it("produces an AST that passes AstSchema", () => {
    const result = parseSyntax(wrap(exampleSource));
    expect(result.ok && AstSchema.safeParse(result.ast).success).toBe(true);
  });

  it("accepts `Table \"\"` like a Table without text", () => {
    expect(parseSyntax(wrap('  Table ""\n    TableColumn "A"'))).toEqual(
      parseSyntax(wrap('  Table\n    TableColumn "A"')),
    );
  });

  it("is case-sensitive: table and tablecolumn are unknown types", () => {
    const expected = "(expected Box or Text or Row or BoxRow or Spacer or Image or Table or TableColumn)";
    expectError(wrap("  table"), `Line 2: Unknown type "table" ${expected}`);
    expectError(wrap('  Table\n    Tablecolumn "A"'), `Line 3: Unknown type "Tablecolumn" ${expected}`);
  });

  it("rejects a TableColumn outside a Table", () => {
    expectError(wrap('  TableColumn "A"'), "Line 2: TableColumn must be inside a Table");
    expectError(wrap('  Box\n    TableColumn "A"'), "Line 3: TableColumn must be inside a Table");
    expectError(wrap('  Row\n    TableColumn "A"'), "Line 3: TableColumn must be inside a Table");
    expectError(
      wrap('  Table\n    TableColumn "A"\n      TableColumn "B"'),
      "Line 4: TableColumn must be inside a Table",
    );
  });

  it("rejects a Table child that is not a TableColumn, on the child's line", () => {
    expectError(wrap('  Table\n    TableColumn "A"\n    Box'), "Line 4: Table can only contain TableColumn");
    expectError(wrap("  Table\n    Text"), "Line 3: Table can only contain TableColumn");
    expectError(wrap("  Table\n    Table"), "Line 3: Table can only contain TableColumn");
    expectError(wrap("  Table\n    Image"), "Line 3: Table can only contain TableColumn");
  });

  it("rejects a Table without a TableColumn, on the Table's line", () => {
    expectError(wrap("  Table"), "Line 2: Table must have at least one TableColumn");
    expectError(wrap("  Table\n  Box"), "Line 2: Table must have at least one TableColumn");
    expectError(wrap('  Box\n    Table\n  Text "a"'), "Line 3: Table must have at least one TableColumn");
    expectError(`Page "a"\n  Table\nPage "b"`, "Line 2: Table must have at least one TableColumn");
    expectError(wrap("  Table\n\n\n"), "Line 2: Table must have at least one TableColumn");
    expectError(wrap('  Table\n    TableColumn "A"\n  Table'), "Line 4: Table must have at least one TableColumn");
  });

  it("rejects text and attributes on a Table", () => {
    expectError(wrap('  Table "x"\n    TableColumn "A"'), "Line 2: Table cannot have text");
    expectError(wrap("  Table @User.Name\n    TableColumn \"A\""), "Line 2: Table cannot have text");
    expectError(wrap('  Table width=3\n    TableColumn "A"'), "Line 2: Table cannot have width");
    expectError(wrap('  Table link-to=home\n    TableColumn "A"'), "Line 2: Table cannot have link-to");
    expectError(wrap('  Table font=bold\n    TableColumn "A"'), "Line 2: Table cannot have font");
    expectError(wrap('  Table id=x\n    TableColumn "A"'), "Line 2: Table cannot have id");
  });

  it("rejects children of a TableColumn, on the child's line", () => {
    expectError(wrap('  Table\n    TableColumn "A"\n      Box'), "Line 4: TableColumn cannot have children");
    expectError(wrap('  Table\n    TableColumn "A"\n      Text "x"'), "Line 4: TableColumn cannot have children");
    expectError(wrap("  Table\n    TableColumn @User.Name\n      Image"), "Line 4: TableColumn cannot have children");
  });

  it("rejects font, font-size, id and aspect-ratio on a TableColumn", () => {
    expectError(wrap('  Table\n    TableColumn "A" font=bold'), "Line 3: TableColumn cannot have font");
    expectError(wrap('  Table\n    TableColumn "A" font-size=lg'), "Line 3: TableColumn cannot have font-size");
    expectError(wrap('  Table\n    TableColumn "A" id=x'), "Line 3: TableColumn cannot have id");
    expectError(wrap('  Table\n    TableColumn "A" aspect-ratio=1:1'), "Line 3: TableColumn cannot have aspect-ratio");
  });

  it("applies the usual attribute rules to a TableColumn", () => {
    expectError(wrap('  Table\n    TableColumn "A" width=13'), 'Line 3: Attribute "width" requires a whole number from 1 to 12');
    expectError(wrap('  Table\n    TableColumn "A" width=3 width=4'), 'Line 3: Duplicate attribute "width"');
    expectError(wrap('  Table\n    TableColumn "A" foo=x'), 'Line 3: Unknown attribute "foo"');
    expectError(wrap('  Table\n    TableColumn "A"  width=3'), 'Line 3: Unexpected characters after closing quote: "  width=3"');
  });

  it("requires a header", () => {
    expectError(wrap("  Table\n    TableColumn"), "Line 3: TableColumn requires a header");
    expectError(wrap("  Table\n    TableColumn "), "Line 3: TableColumn requires a header");
    expectError(wrap("  Table\n    TableColumn width=3"), "Line 3: TableColumn requires a header");
    expectError(wrap("  Table\n    TableColumn link-to=x width=3"), "Line 3: TableColumn requires a header");
  });

  it("rejects bare and unterminated headers", () => {
    expectError(
      wrap("  Table\n    TableColumn Name"),
      'Line 3: Expected a double-quoted string after the type (e.g. Box "Some Text"), found "Name"',
    );
    expectError(wrap('  Table\n    TableColumn "Name'), "Line 3: Unterminated quoted string");
    expectError(wrap('  Table\n    TableColumn "A" extra'), 'Line 3: Unexpected characters after closing quote: " extra"');
  });

  it("rejects a bad value list", () => {
    for (const rest of [
      '"A"|',
      '"A"|a',
      '"A"|"a",',
      '"A"|"a",,"b"',
      '"A"|,"a"',
      '"A"|"a", "b"',
      '"A"|"a" ,"b"',
      '"A"| "a"',
      '"A" |"a"',
      '"A"|"a"|"b"',
      '"A"|"a" "b"',
      '"A"|"a',
      '"A"|"a","b',
      '"A"|"a",b',
      '"A"|"a"x',
    ]) {
      expectError(wrap(`  Table\n    TableColumn ${rest}`), `Line 3: ${VALUES_ERROR}`);
    }
  });

  it("rejects values on a pointer column", () => {
    expectError(wrap('  Table\n    TableColumn @User.Name|"a"'), "Line 3: A pointer column cannot have values");
    expectError(wrap("  Table\n    TableColumn @User.Name|"), "Line 3: A pointer column cannot have values");
  });

  it("rejects a malformed pointer or one with a suffix", () => {
    for (const token of [
      "@User.Name.label",
      "@User.Name.mock",
      "@User.Name.dataType",
      "@user.Name",
      "@User.name",
      "@User.",
      "@",
      "@User.Name.value",
      '@User.Name"',
      "@User.Name.label|",
    ]) {
      const written = token.replace(/\|$/, "");
      expectError(wrap(`  Table\n    TableColumn ${token}`), `Line 3: ${POINTER_ERROR(written)}`);
    }
  });

  it("rejects an entity pointer as it must name a field", () => {
    expectError(
      wrap("  Table\n    TableColumn @User"),
      'Line 3: Pointer "@User" must name a field (expected @Entity.Field)',
    );
    expectError(
      wrap("  Table\n    TableColumn @User width=3"),
      'Line 3: Pointer "@User" must name a field (expected @Entity.Field)',
    );
  });

  it("rejects text that follows a pointer column and is not an attribute", () => {
    expectError(wrap("  Table\n    TableColumn @User.Name extra"), 'Line 3: Unexpected characters after pointer: " extra"');
  });

  it("reports errors with the line number of the offending line", () => {
    expectError(
      wrap('\n  Table\n\n    TableColumn "A"\n\n    TableColumn'),
      "Line 7: TableColumn requires a header",
    );
  });
});

describe("parseSyntax: comments", () => {
  const plain = parseSyntax('Page "A"\n  Box\n    Text "x"\nPage "B"\n  Text "y"');

  it("ignores a comment between nodes, at any depth, as a blank line", () => {
    expect(plain.ok).toBe(true);
    expect(parseSyntax('Page "A"\n# note\n  Box\n# note\n    Text "x"\n# note\nPage "B"\n  Text "y"')).toEqual(plain);
  });

  it("ignores a comment before the first Page, after the last line and between pages", () => {
    expect(parseSyntax('# first\n# second\nPage "A"\n  Box\n    Text "x"\n# between\nPage "B"\n  Text "y"\n# last')).toEqual(
      plain,
    );
  });

  it("does not affect the indentation of the lines around it", () => {
    expect(parseSyntax('Page "A"\n  Box\n# a comment\n    Text "x"\n# another\n  Text "z"')).toEqual(
      parseSyntax('Page "A"\n  Box\n    Text "x"\n  Text "z"'),
    );
  });

  it("does not split a Table from its columns or hide an empty one", () => {
    expect(parseSyntax('Page "A"\n  Table\n# note\n    TableColumn "a"')).toEqual(
      parseSyntax('Page "A"\n  Table\n    TableColumn "a"'),
    );
    expectError('Page "A"\n  Table\n# note\nPage "B"', "Line 2: Table must have at least one TableColumn");
  });

  it("keeps the line numbers of errors as written", () => {
    expectError('# note\nPage "A"\n# note\n  Bogus', 'Line 4: Unknown type "Bogus" (expected Box or Text or Row or BoxRow or Spacer or Image or Table or TableColumn)');
    expectError('Page "A"\n# note\n# note\n  Box\n# note\n      Text "x"', "Line 6: Indentation skips a level (expected at most 4 spaces, found 6)");
  });

  it("reports an indented # as an unknown type with its line number", () => {
    expectError(
      'Page "A"\n# note\n  # note',
      'Line 3: Unknown type "#" (expected Box or Text or Row or BoxRow or Spacer or Image or Table or TableColumn)',
    );
  });

  it("keeps a # inside text as plain text", () => {
    const result = parseSyntax('Page "A"\n  Text "# not a comment"');
    expect(result).toEqual({ ok: true, ast: ast({ title: "A", children: [node("Text", "# not a comment")] }) });
  });

  it("parses a source made only of comments as the blank page", () => {
    expect(parseSyntax("# one\n# two\n#")).toEqual({ ok: true, ast: ast({ title: "", children: [] }) });
  });
});
