import { useEffect, useRef, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataDictionaryTable, type DataDictionaryColumn } from "./data-dictionary-table";
import { newRow, removeRow, updateRow, validateRowField } from "./logic";
import { DATA_TYPES, DataTypeSchema, type DataDictionaryRow } from "./schema";

export const VISIBLE_ROWS = 4;
/** Minimum height of a data row, in px. A row showing an inline message is taller. */
export const ROW_HEIGHT = 36;
export const HEADER_HEIGHT = 28;
export const SCROLL_AREA_HEIGHT = HEADER_HEIGHT + VISIBLE_ROWS * ROW_HEIGHT;

function FieldInput({
  label,
  name,
  rowNumber,
  value,
  onChange,
}: {
  label: "Entity" | "Field";
  name: "entity" | "field";
  rowNumber: number;
  value: string;
  onChange: (value: string) => void;
}) {
  const message = validateRowField(label, value);
  return (
    <>
      <Input
        aria-label={`Row ${rowNumber} ${name}`}
        aria-invalid={message !== undefined ? true : undefined}
        className="h-7!"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {message !== undefined && <p className="mt-1 text-xs text-destructive">{message}</p>}
    </>
  );
}

export function DataDictionaryPane({
  rows,
  onRowsChange,
  className,
}: {
  rows: DataDictionaryRow[];
  onRowsChange: (rows: DataDictionaryRow[]) => void;
  className?: string;
}) {
  const section = useRef<HTMLElement>(null);
  const focusEntityOfRow = useRef<number | undefined>(undefined);

  // The new row only exists after the parent has re-rendered with it, so its input is focused here.
  useEffect(() => {
    const index = focusEntityOfRow.current;
    if (index === undefined || index >= rows.length) return;
    focusEntityOfRow.current = undefined;
    section.current?.querySelector<HTMLInputElement>(`input[aria-label="Row ${index + 1} entity"]`)?.focus();
  }, [rows]);

  const addField = () => {
    focusEntityOfRow.current = rows.length;
    onRowsChange([...rows, newRow()]);
  };

  const renderCell = (column: DataDictionaryColumn, row: DataDictionaryRow, index: number): ReactNode => {
    const n = index + 1;
    switch (column) {
      case "entity":
        return (
          <FieldInput
            label="Entity"
            name="entity"
            rowNumber={n}
            value={row.entity}
            onChange={(entity) => onRowsChange(updateRow(rows, index, { entity }))}
          />
        );
      case "field":
        return (
          <FieldInput
            label="Field"
            name="field"
            rowNumber={n}
            value={row.field}
            onChange={(field) => onRowsChange(updateRow(rows, index, { field }))}
          />
        );
      case "dataType":
        return (
          <select
            aria-label={`Row ${n} data type`}
            className="h-7 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            value={row.dataType}
            onChange={(e) => onRowsChange(updateRow(rows, index, { dataType: DataTypeSchema.parse(e.target.value) }))}
          >
            {DATA_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        );
      case "label":
        return (
          <Input
            aria-label={`Row ${n} label`}
            className="h-7!"
            value={row.label}
            onChange={(e) => onRowsChange(updateRow(rows, index, { label: e.target.value }))}
          />
        );
      case "mockValues":
        return (
          <Input
            aria-label={`Row ${n} mock values`}
            className="h-7!"
            value={row.mockValues}
            onChange={(e) => onRowsChange(updateRow(rows, index, { mockValues: e.target.value }))}
          />
        );
    }
  };

  return (
    <section ref={section} className={cn("flex flex-none flex-col gap-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-medium">Data dictionary</h2>
        <Button type="button" variant="outline" size="sm" onClick={addField}>
          Add field
        </Button>
      </div>
      <DataDictionaryTable
        rows={rows}
        layout={{ headerHeight: HEADER_HEIGHT, rowHeight: ROW_HEIGHT }}
        scrollClassName="overflow-y-auto"
        scrollStyle={{ height: SCROLL_AREA_HEIGHT }}
        emptyMessage="No fields yet"
        renderCell={renderCell}
        renderActions={(_, index) => (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Delete row ${index + 1}`}
            onClick={() => onRowsChange(removeRow(rows, index))}
          >
            <Trash2 />
          </Button>
        )}
      />
    </section>
  );
}
