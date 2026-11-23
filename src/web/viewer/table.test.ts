import { describe, expect, it } from "vitest";
import type { AstNode } from "@/schema/ast";
import { TABLE_ROWS, tableCells, tableColumnWidths } from "./table";

const column = (width?: number): AstNode => ({
  type: "TableColumn",
  text: "",
  children: [],
  ...(width === undefined ? {} : { width }),
});

describe("TABLE_ROWS", () => {
  it("is 10", () => {
    expect(TABLE_ROWS).toBe(10);
  });
});

describe("tableCells", () => {
  it("repeats a single value on every row", () => {
    expect(tableCells(["Edit user"])).toEqual(Array.from({ length: 10 }, () => "Edit user"));
  });

  it("cycles three values from the start until there are 10 cells", () => {
    expect(tableCells(["mock 1", "mock 2", "mock 3"])).toEqual([
      "mock 1",
      "mock 2",
      "mock 3",
      "mock 1",
      "mock 2",
      "mock 3",
      "mock 1",
      "mock 2",
      "mock 3",
      "mock 1",
    ]);
  });

  it("returns exactly 10 values as they are", () => {
    const values = Array.from({ length: 10 }, (_, index) => `v${index}`);
    expect(tableCells(values)).toEqual(values);
  });

  it("shows only the first 10 of 12 values", () => {
    const values = Array.from({ length: 12 }, (_, index) => `v${index}`);
    expect(tableCells(values)).toEqual(values.slice(0, 10));
  });

  it("gives 10 empty cells when there are no values", () => {
    expect(tableCells([])).toEqual(Array.from({ length: 10 }, () => ""));
  });

  it("keeps empty-string values as cells", () => {
    expect(tableCells(["", "a"], 4)).toEqual(["", "a", "", "a"]);
  });

  it("uses the given number of rows", () => {
    expect(tableCells(["a", "b"], 3)).toEqual(["a", "b", "a"]);
    expect(tableCells([], 2)).toEqual(["", ""]);
    expect(tableCells(["a"], 0)).toEqual([]);
  });

  it("does not change the values it is given", () => {
    const values = ["a", "b"];
    tableCells(values);
    expect(values).toEqual(["a", "b"]);
  });
});

describe("tableColumnWidths", () => {
  it("returns undefined when no column has a width", () => {
    expect(tableColumnWidths([column(), column(), column()])).toBeUndefined();
  });

  it("returns every width when all columns have one", () => {
    expect(tableColumnWidths([column(4), column(5), column(2)])).toEqual([4, 5, 2]);
  });

  it("defaults columns without a width to 3 when some have one", () => {
    expect(tableColumnWidths([column(4), column(), column(2)])).toEqual([4, 3, 2]);
    expect(tableColumnWidths([column(), column(12)])).toEqual([3, 12]);
  });

  it("returns undefined for no columns", () => {
    expect(tableColumnWidths([])).toBeUndefined();
  });
});
