import type { AstNode } from "@/schema/ast";

/** The width, in twelfths of the row, of a child without a `width` in a row that has widths. */
export const DEFAULT_WIDTH = 3;

/**
 * Resolves the width (in twelfths) of each child of a `Row`.
 * Returns `undefined` for every child when no child has a `width` (the row is laid out as
 * before); otherwise each child's `width`, or `DEFAULT_WIDTH` when it has none. A `Spacer`
 * without a `width` stays `undefined` so that it fills the remaining space of the row.
 * The default is only used for layout: it is never written back to the AST.
 */
export function rowWidths(children: readonly AstNode[]): (number | undefined)[] {
  const hasWidths = children.some((child) => child.width !== undefined);
  return children.map((child) => {
    if (!hasWidths) return undefined;
    if (child.type === "Spacer") return child.width;
    return child.width ?? DEFAULT_WIDTH;
  });
}
