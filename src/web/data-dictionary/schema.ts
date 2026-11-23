import { z } from "zod";

export const DATA_TYPES = ["int", "bool", "datetime", "string"] as const;

export const DataTypeSchema = z.enum(DATA_TYPES);

// An incomplete or invalid name can be stored while a row is being typed; `PASCAL_CASE_PATTERN` is checked by the UI.
export const DataDictionaryRowSchema = z.strictObject({
  entity: z.string(),
  field: z.string(),
  dataType: DataTypeSchema,
});

export const PASCAL_CASE_PATTERN = /^[A-Z][A-Za-z0-9]*$/;

export type DataType = z.infer<typeof DataTypeSchema>;
export type DataDictionaryRow = z.infer<typeof DataDictionaryRowSchema>;
