import type { DataDictionaryRow } from "@/data-dictionary/schema";
import { expandMacros, type LineOrigin } from "@/syntax/macros";
import { parseSyntax, type ParseResult } from "@/syntax/parse";
import { resolveReferences } from "@/syntax/resolve";

/** Rewrites the `Line <n>:` of a core parser error, counted in the expanded text, to the line of the source as written. */
function mapErrorLine(error: string, origins: readonly LineOrigin[]): string {
  const match = /^Line (\d+): ([\s\S]*)$/.exec(error);
  const origin = match ? origins[Number(match[1]) - 1] : undefined;
  if (!match || origin === undefined) return error;
  const suffix = origin.macro === undefined ? "" : ` (in macro "${origin.macro}")`;
  return `Line ${origin.line}: ${match[2]}${suffix}`;
}

/**
 * Expands the macros of a wire frame source, parses the result into the AST and resolves its data references.
 * `sharedMacros` is the text of the global macros, whose `Def`s every source may use; `dataDictionary` holds the
 * fields that `@Entity.Field` references name.
 */
export function compileSyntax(
  source: string,
  sharedMacros?: string,
  dataDictionary: readonly DataDictionaryRow[] = [],
): ParseResult {
  const expanded = expandMacros(source, sharedMacros);
  if (!expanded.ok) return expanded;
  const parsed = parseSyntax(expanded.source);
  if (!parsed.ok) return { ok: false, error: mapErrorLine(parsed.error, expanded.origins) };
  const resolved = resolveReferences(parsed.ast, dataDictionary);
  return resolved.ok ? resolved : { ok: false, error: mapErrorLine(resolved.error, expanded.origins) };
}
