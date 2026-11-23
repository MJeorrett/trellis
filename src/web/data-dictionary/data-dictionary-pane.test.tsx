import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DataDictionaryPane, ROW_HEIGHT, SCROLL_AREA_HEIGHT, VISIBLE_ROWS } from "./data-dictionary-pane";
import type { DataDictionaryRow } from "./schema";

const render = (rows: DataDictionaryRow[], className?: string) =>
  renderToStaticMarkup(<DataDictionaryPane rows={rows} onRowsChange={() => {}} className={className} />);

const valid = (n: number): DataDictionaryRow[] =>
  Array.from({ length: n }, (_, i) => ({ entity: `Entity${i}`, field: `Field${i}`, dataType: "string", label: "", mockValues: "" }));

const rows: DataDictionaryRow[] = [
  { entity: "Customer", field: "Name", dataType: "string", label: "Customer name", mockValues: "Ada" },
  { entity: "Order", field: "Placed", dataType: "datetime", label: "", mockValues: "" },
];

const control = (html: string, label: string) =>
  new RegExp(`<(?:input|select|button)[^>]*aria-label="${label}"[^>]*>`).exec(html);

describe("DataDictionaryPane", () => {
  it("shows the heading and the five column headers, then the hidden Actions header", () => {
    const html = render(rows);
    expect(html).toMatch(/<h2[^>]*>Data dictionary<\/h2>/);
    const headers = [...html.matchAll(/<th [^>]*>(.*?)<\/th>/g)].map((m) => m[1]);
    expect(headers.slice(0, 5)).toEqual(["Entity", "Field", "DataType", "Label", "MockValues"]);
    expect(headers).toHaveLength(6);
    expect(headers[5]).toBe('<span class="sr-only">Actions</span>');
  });

  it("shows the label and mock value inputs with their values, between the data type and the delete button", () => {
    const html = render(rows);
    expect(control(html, "Row 1 label")![0]).toContain('value="Customer name"');
    expect(control(html, "Row 1 mock values")![0]).toContain('value="Ada"');
    expect(control(html, "Row 2 label")![0]).toContain('value=""');
    expect(control(html, "Row 2 mock values")![0]).toContain('value=""');
    expect(control(html, "Row 3 label")).toBeNull();
    const row1 = ["Row 1 data type", "Row 1 label", "Row 1 mock values", "Delete row 1"].map((l) => html.indexOf(l));
    expect(row1).toEqual([...row1].sort((a, b) => a - b));
    expect(row1.every((i) => i >= 0)).toBe(true);
  });

  it.each(["", "Customer name", "42", "  spaced  ", "not_Pascal case!"])(
    "accepts free text %j in label and mock value with no message and no aria-invalid",
    (text) => {
      const html = render([{ entity: "Customer", field: "Name", dataType: "int", label: text, mockValues: text }]);
      expect(html).not.toMatch(/must be Pascal case|is required/);
      expect(html).not.toContain('aria-invalid="true"');
      expect(control(html, "Row 1 label")![0]).toContain(`value="${text}"`);
      expect(control(html, "Row 1 mock values")![0]).toContain(`value="${text}"`);
    },
  );

  it("shows one row per entry, in order, with its values", () => {
    const html = render(rows);
    expect(control(html, "Row 1 entity")![0]).toContain('value="Customer"');
    expect(control(html, "Row 1 field")![0]).toContain('value="Name"');
    expect(control(html, "Row 2 entity")![0]).toContain('value="Order"');
    expect(control(html, "Row 2 field")![0]).toContain('value="Placed"');
    expect(control(html, "Row 3 entity")).toBeNull();
    expect(html.indexOf("Row 1 entity")).toBeLessThan(html.indexOf("Row 2 entity"));
    expect(html.match(/aria-label="Delete row \d"/g)).toHaveLength(2);
    expect(control(html, "Delete row 1")).not.toBeNull();
    expect(control(html, "Delete row 2")).not.toBeNull();
  });

  it("offers int, bool, datetime and string in order and selects the row's type", () => {
    const html = render(rows);
    const select = new RegExp('<select[^>]*aria-label="Row 2 data type"[^>]*>(.*?)</select>').exec(html)!;
    const options = [...select[1]!.matchAll(/<option([^>]*)>(.*?)<\/option>/g)];
    expect(options.map((m) => m[2])).toEqual(["int", "bool", "datetime", "string"]);
    expect(options.filter((m) => m[1]!.includes("selected")).map((m) => m[2])).toEqual(["datetime"]);
  });

  it("shows No fields yet with no rows, and no data row", () => {
    const html = render([]);
    expect(html).toContain("No fields yet");
    expect(html).not.toContain("Row 1 entity");
    expect(render(rows)).not.toContain("No fields yet");
  });

  it("always shows the Add field button on the heading row, before the table", () => {
    for (const list of [[], rows, valid(8)]) {
      const html = render(list);
      expect(html).toMatch(/<button[^>]*>Add field<\/button>/);
      expect(html.indexOf("Data dictionary")).toBeLessThan(html.indexOf("Add field"));
      expect(html.indexOf("Add field")).toBeLessThan(html.indexOf("<table"));
      expect(html).toMatch(/<div class="[^"]*flex[^"]*"><h2[^>]*>Data dictionary<\/h2><button[^>]*>Add field<\/button><\/div>/);
    }
  });

  it("shows an inline message and aria-invalid only for invalid cells", () => {
    const html = render([
      { entity: "customer", field: "Name", dataType: "string", label: "", mockValues: "" },
      { entity: "", field: "order_line", dataType: "int", label: "", mockValues: "" },
      { entity: "Order", field: "Placed", dataType: "int", label: "", mockValues: "" },
    ]);
    expect(html).toContain("Entity must be Pascal case");
    expect(html).toContain("Entity is required");
    expect(html).toContain("Field must be Pascal case");
    expect(html).not.toContain("Field is required");
    expect(control(html, "Row 1 entity")![0]).toContain('aria-invalid="true"');
    expect(control(html, "Row 1 field")![0]).not.toContain('aria-invalid="true"');
    expect(control(html, "Row 2 entity")![0]).toContain('aria-invalid="true"');
    expect(control(html, "Row 2 field")![0]).toContain('aria-invalid="true"');
    expect(control(html, "Row 3 entity")![0]).not.toContain('aria-invalid="true"');
    expect(control(html, "Row 3 field")![0]).not.toContain('aria-invalid="true"');
  });

  it("shows no message for valid rows", () => {
    expect(render(rows)).not.toMatch(/must be Pascal case|is required/);
  });

  it("has a fixed scroll area of the header and VISIBLE_ROWS rows, the same for any number of rows", () => {
    expect(VISIBLE_ROWS).toBe(4);
    expect(SCROLL_AREA_HEIGHT).toBe(172);
    expect(SCROLL_AREA_HEIGHT).toBeGreaterThanOrEqual(VISIBLE_ROWS * ROW_HEIGHT);
    const scrollArea = (html: string) => /<div class="[^"]*overflow-y-auto[^"]*" style="([^"]*)"/.exec(html)![1];
    const expected = `height:${SCROLL_AREA_HEIGHT}px`;
    for (const n of [0, 3, 8]) expect(scrollArea(render(valid(n)))).toBe(expected);
  });

  it("makes the column headers sticky and gives data rows a minimum height from ROW_HEIGHT", () => {
    const html = render(valid(3));
    expect(html.match(/<th[^>]*class="[^"]*sticky top-0/g)).toHaveLength(6);
    expect(html.match(new RegExp(`<tr style="height:${ROW_HEIGHT}px"`, "g"))).toHaveLength(3);
  });

  it("accepts a className", () => {
    expect(render(rows, "custom-class")).toMatch(/<section class="[^"]*custom-class/);
  });
});
