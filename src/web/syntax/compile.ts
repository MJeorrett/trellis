import { expandMacros, type LineOrigin } from "@/syntax/macros";
import { parseSyntax, type ParseResult } from "@/syntax/parse";

/** Rewrites the `Line <n>:` of a core parser error, counted in the expanded text, to the line of the source as written. */
function mapErrorLine(error: string, origins: readonly LineOrigin[]): string {
  const match = /^Line (\d+): ([\s\S]*)$/.exec(error);
  const origin = match ? origins[Number(match[1]) - 1] : undefined;
  if (!match || origin === undefined) return error;
  const suffix = origin.macro === undefined ? "" : ` (in macro "${origin.macro}")`;
  return `Line ${origin.line}: ${match[2]}${suffix}`;
}

/**
 * Expands the macros of a wire frame source, then parses the result into the AST. `sharedMacros` is the text of
 * the global macros, whose `Def`s every source may use.
 */
export function compileSyntax(source: string, sharedMacros?: string): ParseResult {
  const expanded = expandMacros(source, sharedMacros);
  if (!expanded.ok) return expanded;
  const result = parseSyntax(expanded.source);
  return result.ok ? result : { ok: false, error: mapErrorLine(result.error, expanded.origins) };
}
