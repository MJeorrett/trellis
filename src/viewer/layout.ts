import type { AstNode } from "@/schema/ast";

/** The width, in twelfths of the row, of a child without a `width` in a row that has widths. */
export const DEFAULT_WIDTH = 3;

/**
 * Resolves the width (in twelfths) of each child of a `Row`.
 * Returns `undefined` for every child when no child has a `width` (the row is laid out as
 * before); otherwise each child's `width`, or `DEFAULT_WIDTH` when it has none (a `Spacer` included).
 * The default is only used for layout: it is never written back to the AST.
 */
export function rowWidths(children: readonly AstNode[]): (number | undefined)[] {
  const hasWidths = children.some((child) => child.width !== undefined);
  return children.map((child) => (hasWidths ? (child.width ?? DEFAULT_WIDTH) : undefined));
}
