import { z } from "zod";

export const DATA_TYPES = ["int", "bool", "datetime", "string"] as const;

export const DataTypeSchema = z.enum(DATA_TYPES);

// An incomplete or invalid name can be stored while a row is being typed; `PASCAL_CASE_PATTERN` is checked by the UI.
const CurrentRowSchema = z.strictObject({
  entity: z.string(),
  field: z.string(),
  dataType: DataTypeSchema,
  label: z.string().default(""),
  mockValues: z.string().default(""),
});

/** Rows saved before `mockValue` was renamed `mockValues` still have the old key: it is read as the new one. */
const renameLegacyMockValue = (raw: unknown): unknown => {
  if (typeof raw !== "object" || raw === null || !("mockValue" in raw)) return raw;
  const { mockValue, ...rest } = raw as Record<string, unknown>;
  return "mockValues" in rest ? rest : { ...rest, mockValues: mockValue };
};

export const DataDictionaryRowSchema = z.preprocess(renameLegacyMockValue, CurrentRowSchema);

export const PASCAL_CASE_PATTERN = /^[A-Z][A-Za-z0-9]*$/;

export type DataType = z.infer<typeof DataTypeSchema>;
export type DataDictionaryRow = z.infer<typeof CurrentRowSchema>;
