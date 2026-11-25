import type { CSSProperties, ReactNode } from "react";
import { cn } from "cn";
import type { DataDictionaryRow } from "./schema";

const COLUMNS = [
  { key: "entity", header: "Entity" },
  { key: "field", header: "Field" },
  { key: "dataType", header: "DataType", fixedClassName: "w-32" },
  { key: "label", header: "Label" },
  { key: "mockValues", header: "MockValues" },
] as const;

export type DataDictionaryColumn = (typeof COLUMNS)[number]["key"];

/** Fixed row heights (px) for a table that keeps its header in view while the rows scroll. */
export type FixedLayout = { headerHeight: number; rowHeight: number };

/**
 * The data dictionary rows as a table in a scroll area. By default it is read-only text that scrolls past a maximum
 * height. `renderCell` and `renderActions` make the cells editable, and `layout` gives the compact fixed-height rows
 * with a sticky header.
 */
export function DataDictionaryTable({
  rows,
  renderCell,
  renderActions,
  emptyMessage,
  layout,
  scrollClassName = "max-h-52 overflow-auto",
  scrollStyle,
}: {
  rows: readonly DataDictionaryRow[];
  renderCell?: (column: DataDictionaryColumn, row: DataDictionaryRow, index: number) => ReactNode;
  /** Adds a last column, with a visually hidden `Actions` header, holding this for each row. */
  renderActions?: (row: DataDictionaryRow, index: number) => ReactNode;
  /** Shown in place of the rows when there are none. */
  emptyMessage?: ReactNode;
  layout?: FixedLayout;
  scrollClassName?: string;
  scrollStyle?: CSSProperties;
}) {
  const headerCell = layout
    ? "sticky top-0 z-10 bg-card px-2 text-left text-sm font-medium"
    : "px-2 py-1 text-left font-medium";
  const cell = layout ? "px-2 py-0.5 align-top" : "px-2 py-1 align-top";
  const rowStyle = layout ? { height: layout.rowHeight } : undefined;
  const columnCount = COLUMNS.length + (renderActions ? 1 : 0);

  return (
    <div className={cn(scrollClassName, "rounded-lg bg-card ring-1 ring-foreground/10")} style={scrollStyle}>
      <table className={cn("w-full border-collapse text-sm", layout && "table-fixed")}>
        <thead>
          <tr style={layout ? { height: layout.headerHeight } : undefined}>
            {COLUMNS.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={layout && "fixedClassName" in column ? cn(headerCell, column.fixedClassName) : headerCell}
              >
                {column.header}
              </th>
            ))}
            {renderActions && (
              <th scope="col" className={cn(headerCell, layout && "w-12")}>
                <span className="sr-only">Actions</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && emptyMessage !== undefined && (
            <tr style={rowStyle}>
              <td colSpan={columnCount} className="px-2 text-muted-foreground">
                {emptyMessage}
              </td>
            </tr>
          )}
          {rows.map((row, index) => (
            <tr key={index} style={rowStyle}>
              {COLUMNS.map((column) => (
                <td key={column.key} className={cell}>
                  {renderCell ? renderCell(column.key, row, index) : row[column.key]}
                </td>
              ))}
              {renderActions && <td className={cell}>{renderActions(row, index)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
