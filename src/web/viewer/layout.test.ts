import { describe, expect, it } from "vitest";
import type { AstNode } from "@/schema/ast";
import { rowWidths } from "./layout";

const box = (width?: number): AstNode => ({ type: "Box", text: "", children: [], ...(width === undefined ? {} : { width }) });
const spacer = (width?: number): AstNode => ({ type: "Spacer", text: "", children: [], ...(width === undefined ? {} : { width }) });

describe("rowWidths", () => {
  it("returns undefined for every child when no child has a width", () => {
    expect(rowWidths([box(), box(), box()])).toEqual([undefined, undefined, undefined]);
  });

  it("returns every child's width when all have one", () => {
    expect(rowWidths([box(3), box(9)])).toEqual([3, 9]);
    expect(rowWidths([box(1), box(12), box(5)])).toEqual([1, 12, 5]);
  });

  it("defaults children without a width to 3 when some have one", () => {
    expect(rowWidths([box(9), box(), box(2)])).toEqual([9, 3, 2]);
  });

  it("gives a Spacer with a width that width, and leaves one without undefined, in a row with widths", () => {
    expect(rowWidths([box(4), spacer(2), box()])).toEqual([4, 2, 3]);
    expect(rowWidths([box(4), spacer(), box(5)])).toEqual([4, undefined, 5]);
  });

  it("leaves a Spacer undefined in a row without widths", () => {
    expect(rowWidths([box(), spacer(), box()])).toEqual([undefined, undefined, undefined]);
  });

  it("counts a Spacer's width as a width in the row", () => {
    expect(rowWidths([box(), spacer(2)])).toEqual([3, 2]);
  });

  it("returns an empty array for an empty row", () => {
    expect(rowWidths([])).toEqual([]);
  });
});
