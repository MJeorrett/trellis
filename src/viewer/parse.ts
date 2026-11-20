import { AstSchema, type Ast } from "@/schema/ast";

export type ParseResult = { ok: true; ast: Ast } | { ok: false; error: string };

/** Parses JSON text and validates it against the Trellis AST schema. */
export function parseAstJson(source: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(source);
  } catch (e) {
    return { ok: false, error: `Invalid JSON: ${(e as Error).message}` };
  }
  const result = AstSchema.safeParse(json);
  if (!result.success) {
    const error = result.error.issues
      .map((i) => `${i.path.length ? i.path.join(".") : "(root)"}: ${i.message}`)
      .join("\n");
    return { ok: false, error };
  }
  return { ok: true, ast: result.data };
}
