import { describe, expect, it } from "vitest";
import { AstSchema, type Ast, type AstNode } from "@/schema/ast";
import { sampleSource } from "@/viewer/sample";
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

  it("parses the viewer's sample source (Log in page and Forgot password page)", () => {
    const loginWithRow: AstNode = {
      ...loginBox,
      children: [
        ...loginBox.children.slice(0, -1),
        { ...node("Text", "Forgot password?"), linkTo: "forgot" },
        node("Row", "", [node("Box", "Cancel"), node("Box", "Submit")]),
      ],
    };
    const sampleAst = ast(
      { id: "login", title: "Log in", children: [loginWithRow] },
      {
        id: "forgot",
        title: "Forgot password",
        children: [
          node("Box", "", [
            node("Text", "Forgot password"),
            node("Box", "", [node("Text", "Enter your email"), node("Box", "you@example.com")]),
            node("Box", "Send reset link"),
            { ...node("Text", "Back to log in"), linkTo: "login" },
          ]),
        ],
      },
    );
    const result = parseSyntax(sampleSource);
    expect(result).toEqual({ ok: true, ast: sampleAst });
    expect(result.ok && AstSchema.safeParse(result.ast).success).toBe(true);
  });

  it("is deterministic", () => {
    expect(parseSyntax(loginSource)).toEqual(parseSyntax(loginSource));
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
    expectError('Page "a"\n  page "b"', 'Line 2: Unknown type "page" (expected Box or Text or Row)');
  });

  it("rejects bare unquoted and malformed titles", () => {
    expectError("Page Home", 'Line 1: Expected a double-quoted string after the type (e.g. Box "Some Text"), found "Home"');
    expectError('Page "Home', "Line 1: Unterminated quoted string");
    expectError('Page "Home" x', 'Line 1: Unexpected characters after closing quote: " x"');
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

  it("rejects a lowercase `row`", () => {
    expectError(wrap("  row"), 'Line 2: Unknown type "row" (expected Box or Text or Row)');
    expectError(wrap("  Box\n    row"), 'Line 3: Unknown type "row" (expected Box or Text or Row)');
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
    expectError(wrap("  Box\n    Button"), 'Line 3: Unknown type "Button" (expected Box or Text or Row)');
  });

  it("rejects a lowercase type", () => {
    expectError(wrap("  box"), 'Line 2: Unknown type "box" (expected Box or Text or Row)');
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
    expectError(wrap('  Box "a" '), 'Line 2: Unexpected characters after closing quote: " "');
  });

  it("counts blank lines when reporting line numbers", () => {
    expectError('Page "p"\n\n\n  Nope', 'Line 4: Unknown type "Nope" (expected Box or Text or Row)');
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
