import { describe, expect, it } from "vitest";
import { newRow, removeRow, updateRow, validateRowField } from "./logic";
import type { DataDictionaryRow } from "./schema";

const rows: DataDictionaryRow[] = [
  { entity: "Customer", field: "Name", dataType: "string" },
  { entity: "Customer", field: "Age", dataType: "int" },
  { entity: "Order", field: "Placed", dataType: "datetime" },
];

describe("validateRowField", () => {
  it("asks for a blank value", () => {
    expect(validateRowField("Entity", "")).toBe("Entity is required");
    expect(validateRowField("Field", "")).toBe("Field is required");
    expect(validateRowField("Field", "   ")).toBe("Field is required");
  });

  it("asks for Pascal case", () => {
    expect(validateRowField("Entity", "customer")).toBe("Entity must be Pascal case");
    expect(validateRowField("Field", "order_line")).toBe("Field must be Pascal case");
    expect(validateRowField("Field", "Order Line")).toBe("Field must be Pascal case");
    expect(validateRowField("Entity", "2Order")).toBe("Entity must be Pascal case");
    expect(validateRowField("Entity", " Customer")).toBe("Entity must be Pascal case");
  });

  it("accepts a valid value", () => {
    expect(validateRowField("Entity", "Customer")).toBeUndefined();
    expect(validateRowField("Field", "OrderLine2")).toBeUndefined();
  });
});

describe("newRow", () => {
  it("is empty with the string type", () => {
    expect(newRow()).toEqual({ entity: "", field: "", dataType: "string" });
  });

  it("gives a new object each time", () => {
    expect(newRow()).not.toBe(newRow());
  });
});

describe("updateRow", () => {
  it("changes only the given row and keeps the rest of it", () => {
    expect(updateRow(rows, 1, { dataType: "bool" })).toEqual([
      rows[0],
      { entity: "Customer", field: "Age", dataType: "bool" },
      rows[2],
    ]);
  });

  it("does not change its input", () => {
    const before = structuredClone(rows);
    const result = updateRow(rows, 0, { entity: "Changed" });
    expect(result).not.toBe(rows);
    expect(rows).toEqual(before);
  });

  it("keeps typed values as they are", () => {
    expect(updateRow(rows, 0, { field: "  x " })[0]!.field).toBe("  x ");
  });
});

describe("removeRow", () => {
  it("removes the given row", () => {
    expect(removeRow(rows, 1)).toEqual([rows[0], rows[2]]);
  });

  it("does not change its input", () => {
    const before = structuredClone(rows);
    const result = removeRow(rows, 0);
    expect(result).not.toBe(rows);
    expect(rows).toEqual(before);
  });

  it("ignores an index that does not exist", () => {
    expect(removeRow(rows, 9)).toEqual(rows);
  });
});
