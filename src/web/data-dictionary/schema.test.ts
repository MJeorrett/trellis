import { describe, expect, it } from "vitest";
import { DATA_TYPES, DataDictionaryRowSchema, DataTypeSchema, PASCAL_CASE_PATTERN } from "./schema";

describe("DATA_TYPES", () => {
  it("lists the four types in order", () => {
    expect([...DATA_TYPES]).toEqual(["int", "bool", "datetime", "string"]);
  });
});

describe("DataTypeSchema", () => {
  it.each(DATA_TYPES)("accepts %s", (type) => {
    expect(DataTypeSchema.safeParse(type).success).toBe(true);
  });

  it("rejects an unknown type", () => {
    expect(DataTypeSchema.safeParse("float").success).toBe(false);
  });
});

describe("DataDictionaryRowSchema", () => {
  it.each(DATA_TYPES)("accepts a row with data type %s", (dataType) => {
    expect(DataDictionaryRowSchema.safeParse({ entity: "Customer", field: "Name", dataType, label: "", mockValue: "" }).success).toBe(
      true,
    );
  });

  it("accepts an incomplete row", () => {
    expect(DataDictionaryRowSchema.safeParse({ entity: "", field: "bad name", dataType: "string" }).success).toBe(true);
  });

  it("rejects an unknown data type", () => {
    expect(DataDictionaryRowSchema.safeParse({ entity: "A", field: "B", dataType: "float" }).success).toBe(false);
  });

  it("rejects an extra key", () => {
    expect(DataDictionaryRowSchema.safeParse({ entity: "A", field: "B", dataType: "int", extra: 1 }).success).toBe(false);
  });

  it("rejects a missing key", () => {
    expect(DataDictionaryRowSchema.safeParse({ entity: "A", dataType: "int" }).success).toBe(false);
  });

  it("fills in an empty label and mockValue when they are missing", () => {
    expect(DataDictionaryRowSchema.parse({ entity: "A", field: "B", dataType: "int" })).toEqual({
      entity: "A",
      field: "B",
      dataType: "int",
      label: "",
      mockValue: "",
    });
  });

  it("keeps a given label and mockValue, including blank and free text", () => {
    const row = { entity: "A", field: "B", dataType: "int", label: "Customer name", mockValue: "42" };
    expect(DataDictionaryRowSchema.parse(row)).toEqual(row);
    expect(DataDictionaryRowSchema.parse({ ...row, label: "  ", mockValue: "" })).toMatchObject({ label: "  ", mockValue: "" });
  });

  it.each(["label", "mockValue"])("rejects a non-string %s", (key) => {
    const row = { entity: "A", field: "B", dataType: "int", [key]: 1 };
    expect(DataDictionaryRowSchema.safeParse(row).success).toBe(false);
  });
});

describe("PASCAL_CASE_PATTERN", () => {
  it.each(["Customer", "OrderLine2", "A", "ABC"])("matches %j", (value) => {
    expect(PASCAL_CASE_PATTERN.test(value)).toBe(true);
  });

  it.each(["customer", "order_line", "Order Line", "2Order", ""])("does not match %j", (value) => {
    expect(PASCAL_CASE_PATTERN.test(value)).toBe(false);
  });
});
