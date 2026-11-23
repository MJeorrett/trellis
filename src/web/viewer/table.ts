import type { AstNode } from "@/schema/ast";
import { DEFAULT_WIDTH } from "./layout";

/** The number of data rows a `Table` shows below its header row. */
export const TABLE_ROWS = 10;

/**
 * The cells of one column: its values cycled to `rows` cells and cut to `rows`, or `rows` empty strings when it has none.
 * Only for display: the AST keeps the values as written.
 */
export function tableCells(values: readonly string[], rows = TABLE_ROWS): string[] {
  if (values.length === 0) return Array.from({ length: rows }, () => "");
  return Array.from({ length: rows }, (_, row) => values[row % values.length]!);
}

/**
 * The width, in twelfths of the table, of each `TableColumn`: its `width`, or `DEFAULT_WIDTH` when it has none, if at
 * least one column has a `width`. `undefined` when none does, meaning the columns share the table equally.
 * The default is only used for layout: it is never written back to the AST.
 */
export function tableColumnWidths(columns: readonly AstNode[]): number[] | undefined {
  if (!columns.some((column) => column.width !== undefined)) return undefined;
  return columns.map((column) => column.width ?? DEFAULT_WIDTH);
}
