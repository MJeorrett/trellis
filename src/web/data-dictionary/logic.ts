import { PASCAL_CASE_PATTERN, type DataDictionaryRow } from "./schema";

/** The inline message for an `Entity` or `Field` value, or `undefined` when it is valid. */
export function validateRowField(label: "Entity" | "Field", value: string): string | undefined {
  if (value.trim() === "") return `${label} is required`;
  if (!PASCAL_CASE_PATTERN.test(value)) return `${label} must be Pascal case`;
  return undefined;
}

export function newRow(): DataDictionaryRow {
  return { entity: "", field: "", dataType: "string", label: "", mockValue: "" };
}

export function updateRow(
  rows: readonly DataDictionaryRow[],
  index: number,
  change: Partial<DataDictionaryRow>,
): DataDictionaryRow[] {
  return rows.map((row, i) => (i === index ? { ...row, ...change } : row));
}

export function removeRow(rows: readonly DataDictionaryRow[], index: number): DataDictionaryRow[] {
  return rows.filter((_, i) => i !== index);
}
