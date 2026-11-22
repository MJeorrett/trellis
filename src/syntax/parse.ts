import {
  ASPECT_RATIO_PATTERN,
  AstSchema,
  FontSchema,
  FontSizeSchema,
  ID_PATTERN,
  NodeTypeSchema,
  type Ast,
  type AstNode,
  type Page,
} from "@/schema/ast";

/**
 * Parser for the Trellis indentation-based authoring syntax.
 * Grammar and rules: /capabilities/trellis-ast/capability.md (Syntax section).
 */

export type ParseResult = { ok: true; ast: Ast } | { ok: false; error: string };

const INDENT_SIZE = 2;
const PAGE_TYPE = "Page";

class SyntaxParseError extends Error {
  constructor(message: string, line?: number) {
    super(line === undefined ? message : `Line ${line}: ${message}`);
  }
}

type MutableNode = {
  type: AstNode["type"];
  font?: AstNode["font"];
  fontSize?: AstNode["fontSize"];
  linkTo?: string;
  width?: number;
  aspectRatio?: string;
  text: string;
  children: MutableNode[];
};
type MutablePage = { id?: string; title: string; children: MutableNode[] };

/**
 * The attributes a component kind accepts: `id` on `Page`, `link-to` on `Box`, `Text` and `Image`,
 * `width` on `Box`, `Text`, `Row`, `BoxRow`, `Spacer` and `Image`, `aspect-ratio` on `Image`, and `font` and `font-size` on
 * `Box`, `Text`, `Row` and `BoxRow`.
 */
const ATTRIBUTES = {
  id: { kinds: ["Page"] },
  "link-to": { kinds: ["Box", "Text", "Image"] },
  width: { kinds: ["Box", "Text", "Row", "BoxRow", "Spacer", "Image"] },
  "aspect-ratio": { kinds: ["Image"] },
  font: { kinds: ["Box", "Text", "Row", "BoxRow"] },
  "font-size": { kinds: ["Box", "Text", "Row", "BoxRow"] },
} as const;
type AttributeName = keyof typeof ATTRIBUTES;

type Attributes = {
  id?: string;
  linkTo?: string;
  width?: number;
  aspectRatio?: string;
  font?: AstNode["font"];
  fontSize?: AstNode["fontSize"];
};

/** A `width` value: a whole number from 1 to 12 with no sign, decimal point or leading zero. */
const WIDTH_PATTERN = /^(?:[1-9]|1[0-2])$/;

/** An attribute written after the type or the quoted text: ` key=value`. */
const ATTRIBUTE_START = /^ [^\s"=]+=/;

/** Parses one `key=value` token for a component of the given kind. */
function parseAttribute(token: string, kind: string, found: Set<string>, line: number): [AttributeName, string] {
  const eq = token.indexOf("=");
  if (eq === -1) {
    throw new SyntaxParseError(`Invalid attribute ${JSON.stringify(token)} (expected key=value)`, line);
  }
  const key = token.slice(0, eq);
  const value = token.slice(eq + 1);
  if (!Object.hasOwn(ATTRIBUTES, key)) {
    throw new SyntaxParseError(`Unknown attribute ${JSON.stringify(key)}`, line);
  }
  const name = key as AttributeName;
  if (found.has(name)) {
    throw new SyntaxParseError(`Duplicate attribute ${JSON.stringify(name)}`, line);
  }
  if (!(ATTRIBUTES[name].kinds as readonly string[]).includes(kind)) {
    throw new SyntaxParseError(`${kind} cannot have ${name}`, line);
  }
  if (name === "width") {
    if (!WIDTH_PATTERN.test(value)) {
      throw new SyntaxParseError(`Attribute "width" requires a whole number from 1 to 12`, line);
    }
  } else if (name === "aspect-ratio") {
    if (!ASPECT_RATIO_PATTERN.test(value)) {
      throw new SyntaxParseError(
        `Attribute "aspect-ratio" requires a ratio such as 16:9 (whole numbers from 1 to 99)`,
        line,
      );
    }
  } else if (name === "font") {
    if (!FontSchema.safeParse(value).success) {
      throw new SyntaxParseError(`Attribute "font" requires the value bold`, line);
    }
  } else if (name === "font-size") {
    if (!FontSizeSchema.safeParse(value).success) {
      throw new SyntaxParseError(`Attribute "font-size" requires one of sm, md or lg`, line);
    }
  } else if (!ID_PATTERN.test(value)) {
    throw new SyntaxParseError(`Attribute "${name}" requires a value of letters, digits, "-" or "_"`, line);
  }
  found.add(name);
  return [name, value];
}

/**
 * Parses everything after the type: the optional quoted text, then optional
 * `key=value` attributes. `hasText` is false when the text is omitted.
 */
function parseRest(after: string, kind: string, line: number): { text: string; hasText: boolean; attributes: Attributes } {
  const attributes: Attributes = {};
  let text = "";
  let hasText = false;
  let attrs = "";

  if (after.trim() === "") {
    return { text, hasText, attributes };
  }

  if (after.startsWith(' "')) {
    const closing = after.indexOf('"', 2);
    if (closing === -1) {
      throw new SyntaxParseError("Unterminated quoted string", line);
    }
    text = after.slice(2, closing);
    hasText = true;
    const rest = after.slice(closing + 1);
    if (rest !== "") {
      if (!ATTRIBUTE_START.test(rest)) {
        throw new SyntaxParseError(`Unexpected characters after closing quote: ${JSON.stringify(rest)}`, line);
      }
      attrs = rest.slice(1);
    }
  } else if (ATTRIBUTE_START.test(after)) {
    attrs = after.slice(1);
  } else {
    throw new SyntaxParseError(
      `Expected a double-quoted string after the type (e.g. Box "Some Text"), found ${JSON.stringify(after.trim())}`,
      line,
    );
  }

  if (attrs !== "") {
    const found = new Set<string>();
    for (const token of attrs.split(" ")) {
      const [name, value] = parseAttribute(token, kind, found, line);
      if (name === "id") attributes.id = value;
      else if (name === "width") attributes.width = Number(value);
      else if (name === "aspect-ratio") attributes.aspectRatio = value;
      else if (name === "font") attributes.font = FontSchema.parse(value);
      else if (name === "font-size") attributes.fontSize = FontSizeSchema.parse(value);
      else attributes.linkTo = value;
    }
  }
  return { text, hasText, attributes };
}

function build(source: string): Page[] {
  const lines = source.split(/\r?\n/);
  const pages: MutablePage[] = [];
  const pageIds = new Set<string>();
  /** `stack[level]` is the most recent page (level 0) or node at that indentation level. */
  const stack: (MutablePage | MutableNode)[] = [];

  lines.forEach((raw, index) => {
    const line = index + 1;
    if (raw.trim() === "") return; // blank lines are ignored

    if (raw.includes("\t")) {
      throw new SyntaxParseError("Tab characters are not allowed; indent with 2 spaces per level", line);
    }

    const indent = raw.length - raw.trimStart().length;
    if (indent % INDENT_SIZE !== 0) {
      throw new SyntaxParseError(
        `Indentation must be a multiple of ${INDENT_SIZE} spaces, found ${indent}`,
        line,
      );
    }
    const level = indent / INDENT_SIZE;

    const content = raw.slice(indent);
    const spaceAt = content.indexOf(" ");
    const typeName = spaceAt === -1 ? content : content.slice(0, spaceAt);
    const after = spaceAt === -1 ? "" : content.slice(spaceAt);

    if (typeName === PAGE_TYPE) {
      if (level > 0) {
        throw new SyntaxParseError("Page cannot be nested", line);
      }
      if (after.trim() === "" || ATTRIBUTE_START.test(after)) {
        throw new SyntaxParseError("Page requires a title", line);
      }
      const { text: title, attributes } = parseRest(after, PAGE_TYPE, line);
      const page: MutablePage = { title, children: [] };
      if (attributes.id !== undefined) {
        if (pageIds.has(attributes.id)) {
          throw new SyntaxParseError(`Duplicate page id ${JSON.stringify(attributes.id)}`, line);
        }
        pageIds.add(attributes.id);
        page.id = attributes.id;
      }
      pages.push(page);
      stack.length = 0;
      stack[0] = page;
      return;
    }

    if (level === 0) {
      throw new SyntaxParseError(`root node must be ${PAGE_TYPE}`, line);
    }
    if (pages.length === 0) {
      throw new SyntaxParseError("The first node must not be indented", line);
    }

    const type = NodeTypeSchema.safeParse(typeName);
    if (!type.success) {
      throw new SyntaxParseError(
        `Unknown type ${JSON.stringify(typeName)} (expected ${NodeTypeSchema.options.join(" or ")})`,
        line,
      );
    }
    const { text, attributes } = parseRest(after, type.data, line);
    const node: MutableNode = { type: type.data, text, children: [] };
    if (attributes.linkTo !== undefined) node.linkTo = attributes.linkTo;
    if (attributes.width !== undefined) node.width = attributes.width;
    if (attributes.aspectRatio !== undefined) node.aspectRatio = attributes.aspectRatio;
    if (attributes.font !== undefined) node.font = attributes.font;
    if (attributes.fontSize !== undefined) node.fontSize = attributes.fontSize;

    if (level > stack.length) {
      throw new SyntaxParseError(
        `Indentation skips a level (expected at most ${stack.length * INDENT_SIZE} spaces, found ${indent})`,
        line,
      );
    }

    // The parent is the stack entry one level up; a page has no `type`.
    const parent = stack[level - 1]!;
    const parentType = "type" in parent ? parent.type : undefined;
    if (type.data === "Spacer") {
      if (parentType !== "Row" && parentType !== "BoxRow") {
        throw new SyntaxParseError("Spacer must be inside a Row or BoxRow", line);
      }
      if (text !== "") throw new SyntaxParseError("Spacer cannot have text", line);
    }
    if (type.data === "Image" && text !== "") throw new SyntaxParseError("Image cannot have text", line);
    if (parentType === "Spacer") throw new SyntaxParseError("Spacer cannot have children", line);
    if (parentType === "Image") throw new SyntaxParseError("Image cannot have children", line);
    stack.length = level;
    parent.children.push(node);
    stack[level] = node;
  });

  // Empty or whitespace-only source is a blank wire frame: one blank page.
  return pages.length > 0 ? pages : [{ title: "", children: [] }];
}

/** Parses Trellis syntax text into a validated AST. Fails fast with the first error. */
export function parseSyntax(source: string): ParseResult {
  let pages: Page[];
  try {
    pages = build(source);
  } catch (e) {
    if (e instanceof SyntaxParseError) return { ok: false, error: e.message };
    throw e;
  }

  const result = AstSchema.safeParse({ pages });
  if (!result.success) {
    const error = result.error.issues
      .map((i) => `${i.path.length ? i.path.join(".") : "(root)"}: ${i.message}`)
      .join("\n");
    return { ok: false, error };
  }
  return { ok: true, ast: result.data };
}
