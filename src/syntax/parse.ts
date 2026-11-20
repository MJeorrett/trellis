import { AstSchema, NodeTypeSchema, type Ast } from "@/schema/ast";

/**
 * Parser for the Trellis indentation-based authoring syntax.
 * Grammar and rules: /capabilities/trellis-ast/capability.md (Syntax section).
 */

export type ParseResult = { ok: true; ast: Ast } | { ok: false; error: string };

const INDENT_SIZE = 2;

class SyntaxParseError extends Error {
  constructor(message: string, line?: number) {
    super(line === undefined ? message : `Line ${line}: ${message}`);
  }
}

type MutableNode = { type: Ast["type"]; text: string; children: MutableNode[] };

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

function build(source: string): MutableNode {
  const lines = source.split(/\r?\n/);
  let root: MutableNode | undefined;
  /** `stack[level]` is the most recent node at that indentation level. */
  const stack: MutableNode[] = [];

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
    const type = NodeTypeSchema.safeParse(typeName);
    if (!type.success) {
      throw new SyntaxParseError(
        `Unknown type ${JSON.stringify(typeName)} (expected ${NodeTypeSchema.options.join(" or ")})`,
        line,
      );
    }
    const text = parseText(spaceAt === -1 ? "" : content.slice(spaceAt), line);
    const node: MutableNode = { type: type.data, text, children: [] };

    if (root === undefined) {
      if (level !== 0) {
        throw new SyntaxParseError("The first node must not be indented", line);
      }
      root = node;
      stack[0] = node;
      return;
    }

    if (level === 0) {
      throw new SyntaxParseError("Multiple root nodes: only one node may have no indentation", line);
    }
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

  // Empty or whitespace-only source is a blank wire frame: an empty, borderless `Text` root.
  return root ?? { type: "Text", text: "", children: [] };
}

/** Parses Trellis syntax text into a validated AST. Fails fast with the first error. */
export function parseSyntax(source: string): ParseResult {
  let tree: MutableNode;
  try {
    tree = build(source);
  } catch (e) {
    if (e instanceof SyntaxParseError) return { ok: false, error: e.message };
    throw e;
  }

  const result = AstSchema.safeParse(tree);
  if (!result.success) {
    const error = result.error.issues
      .map((i) => `${i.path.length ? i.path.join(".") : "(root)"}: ${i.message}`)
      .join("\n");
    return { ok: false, error };
  }
  return { ok: true, ast: result.data };
}
