import type { DataDictionaryRow } from "@/data-dictionary/schema";
import { AstSchema, type Ast, type AstNode } from "@/schema/ast";
import { POINTER_COLUMNS } from "@/syntax/pointer";

/**
 * Symbol resolver: replaces each data reference of a parsed AST with the text of the data dictionary field it names.
 * Rules: /capabilities/data-references/capability.md.
 */

export type ResolveResult = { ok: true; ast: Ast } | { ok: false; error: string };

class ResolveError extends Error {
  constructor(message: string, line: number) {
    super(`Line ${line}: ${message}`);
  }
}

const hasReferences = (nodes: readonly AstNode[]): boolean =>
  nodes.some((node) => node.ref !== undefined || hasReferences(node.children));

/** The first row of each entity and field, so a duplicate row never overrides the one above it. */
function indexRows(rows: readonly DataDictionaryRow[]): Map<string, Map<string, DataDictionaryRow>> {
  const index = new Map<string, Map<string, DataDictionaryRow>>();
  for (const row of rows) {
    const fields = index.get(row.entity) ?? new Map<string, DataDictionaryRow>();
    if (!fields.has(row.field)) fields.set(row.field, row);
    index.set(row.entity, fields);
  }
  return index;
}

/** Resolves every reference of `ast` against `rows`, failing fast on the first one that names nothing. */
export function resolveReferences(ast: Ast, rows: readonly DataDictionaryRow[]): ResolveResult {
  if (!ast.pages.some((page) => hasReferences(page.children))) return { ok: true, ast };

  const index = indexRows(rows);
  const resolveNode = (node: AstNode): AstNode => {
    const { ref, ...rest } = node;
    let text = rest.text;
    if (ref !== undefined) {
      const fields = index.get(ref.entity);
      if (fields === undefined) throw new ResolveError(`Unknown entity "${ref.entity}"`, ref.line);
      const row = fields.get(ref.field);
      if (row === undefined) throw new ResolveError(`Unknown field "${ref.entity}.${ref.field}"`, ref.line);
      text = row[POINTER_COLUMNS[ref.kind]];
    }
    return { ...rest, text, children: rest.children.map(resolveNode) };
  };

  let resolved: Ast;
  try {
    resolved = { pages: ast.pages.map((page) => ({ ...page, children: page.children.map(resolveNode) })) };
  } catch (e) {
    if (e instanceof ResolveError) return { ok: false, error: e.message };
    throw e;
  }

  const result = AstSchema.safeParse(resolved);
  if (!result.success) {
    const error = result.error.issues
      .map((i) => `${i.path.length ? i.path.join(".") : "(root)"}: ${i.message}`)
      .join("\n");
    return { ok: false, error };
  }
  return { ok: true, ast: result.data };
}
