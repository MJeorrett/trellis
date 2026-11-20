import { AstSchema, NodeTypeSchema, type Ast, type AstNode, type Page } from "@/schema/ast";

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

type MutableNode = { type: AstNode["type"]; text: string; children: MutableNode[] };
type MutablePage = { title: string; children: MutableNode[] };

/** Parses the text part of a line (everything after the type) into the node text. */
function parseText(after: string, line: number): string {
  if (after.trim() === "") return "";
  if (!after.startsWith(' "')) {
    throw new SyntaxParseError(
      `Expected a double-quoted string after the type (e.g. Box "Some Text"), found ${JSON.stringify(after.trim())}`,
      line,
    );
  }
  const closing = after.indexOf('"', 2);
  if (closing === -1) {
    throw new SyntaxParseError("Unterminated quoted string", line);
  }
  if (closing !== after.length - 1) {
    throw new SyntaxParseError(
      `Unexpected characters after closing quote: ${JSON.stringify(after.slice(closing + 1))}`,
      line,
    );
  }
  return after.slice(2, closing);
}

function build(source: string): Page[] {
  const lines = source.split(/\r?\n/);
  const pages: MutablePage[] = [];
  /** `stack[level]` is the most recent page (level 0) or node at that indentation level. */
  const stack: { children: MutableNode[] }[] = [];

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
      if (after.trim() === "") {
        throw new SyntaxParseError("Page requires a title", line);
      }
      const page: MutablePage = { title: parseText(after, line), children: [] };
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
    const node: MutableNode = { type: type.data, text: parseText(after, line), children: [] };

    if (level > stack.length) {
      throw new SyntaxParseError(
        `Indentation skips a level (expected at most ${stack.length * INDENT_SIZE} spaces, found ${indent})`,
        line,
      );
    }
    stack.length = level;
    stack[level - 1]!.children.push(node);
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
