import { describe, expect, it } from "vitest";
import type { DataDictionaryRow } from "@/data-dictionary/schema";
import { AstSchema, type Ast, type AstNode, type PointerRef } from "@/schema/ast";
import { resolveReferences } from "./resolve";

const rows: DataDictionaryRow[] = [
  { entity: "User", field: "FirstName", dataType: "string", label: "First Name", mockValues: "Jane" },
  { entity: "User", field: "Age", dataType: "int", label: "", mockValues: "" },
  { entity: "Order", field: "Total", dataType: "int", label: "Total", mockValues: "42" },
];

const ref = (entity: string, field: string, kind: PointerRef["kind"], line = 2): PointerRef => ({
  entity,
  field,
  kind,
  line,
});
const node = (type: AstNode["type"], extra: Partial<AstNode> = {}): AstNode => ({
  type,
  text: "",
  children: [],
  ...extra,
});
const astOf = (...children: AstNode[]): Ast => ({ pages: [{ title: "p", children }] });
const firstText = (result: ReturnType<typeof resolveReferences>) =>
  result.ok ? result.ast.pages[0]!.children[0]!.text : undefined;

describe("resolveReferences", () => {
  it("replaces a pointer of each kind with the matching column of the row", () => {
    const expected = {
      entity: "User",
      field: "FirstName",
      dataType: "string",
      label: "First Name",
      mock: "Jane",
    } as const;
    for (const [kind, text] of Object.entries(expected)) {
      const result = resolveReferences(
        astOf(node("Text", { ref: ref("User", "FirstName", kind as PointerRef["kind"]) })),
        rows,
      );
      expect(firstText(result)).toBe(text);
    }
  });

  it("shows only the first of several mock values for a pointer outside a table", () => {
    const several: DataDictionaryRow[] = [
      { entity: "User", field: "Role", dataType: "string", label: "Role", mockValues: " Organisation Admin;Banan" },
    ];
    for (const kind of ["mock"] as const) {
      expect(firstText(resolveReferences(astOf(node("Text", { ref: ref("User", "Role", kind) })), several))).toBe(
        "Organisation Admin",
      );
    }
    expect(firstText(resolveReferences(astOf(node("Text", { ref: ref("User", "Role", "label") })), several))).toBe("Role");
  });

  it("gives empty text for an empty label or mock value", () => {
    for (const kind of ["label", "mock"] as const) {
      const result = resolveReferences(astOf(node("Box", { ref: ref("User", "Age", kind) })), rows);
      expect(firstText(result)).toBe("");
    }
  });

  it("removes the ref and keeps the other parts of the node", () => {
    const result = resolveReferences(
      astOf(node("Text", { ref: ref("Order", "Total", "mock"), font: "bold", width: 4, linkTo: "home" })),
      rows,
    );
    expect(result).toEqual({
      ok: true,
      ast: astOf(node("Text", { text: "42", font: "bold", width: 4, linkTo: "home" })),
    });
    expect(result.ok && "ref" in result.ast.pages[0]!.children[0]!).toBe(false);
  });

  it("resolves pointers in nested nodes and in every page, in a result that passes AstSchema", () => {
    const input: Ast = {
      pages: [
        {
          title: "a",
          children: [
            node("Box", {
              children: [node("Row", { children: [node("Text", { ref: ref("User", "FirstName", "label", 4) })] })],
            }),
          ],
        },
        { title: "b", children: [node("BoxRow", { ref: ref("Order", "Total", "label", 8) })] },
      ],
    };
    const result = resolveReferences(input, rows);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ast.pages[0]!.children[0]!.children[0]!.children[0]!.text).toBe("First Name");
    expect(result.ast.pages[1]!.children[0]!.text).toBe("Total");
    expect(AstSchema.safeParse(result.ast).success).toBe(true);
  });

  it("uses the first row for a duplicate entity and field", () => {
    const duplicated: DataDictionaryRow[] = [
      { entity: "A", field: "B", dataType: "string", label: "first", mockValues: "1" },
      { entity: "A", field: "B", dataType: "int", label: "second", mockValues: "2" },
    ];
    expect(firstText(resolveReferences(astOf(node("Text", { ref: ref("A", "B", "label") })), duplicated))).toBe(
      "first",
    );
    expect(firstText(resolveReferences(astOf(node("Text", { ref: ref("A", "B", "mock") })), duplicated))).toBe("1");
  });

  it("reports an unknown entity with its line", () => {
    const result = resolveReferences(astOf(node("Text", { ref: ref("Nope", "FirstName", "mock", 5) })), rows);
    expect(result).toEqual({ ok: false, error: 'Line 5: Unknown entity "Nope"' });
  });

  it("reports an unknown field of a known entity with its line", () => {
    const result = resolveReferences(astOf(node("Text", { ref: ref("User", "Nope", "mock", 7) })), rows);
    expect(result).toEqual({ ok: false, error: 'Line 7: Unknown field "User.Nope"' });
  });

  it("is case-sensitive", () => {
    const result = resolveReferences(astOf(node("Text", { ref: ref("user", "FirstName", "mock") })), rows);
    expect(result).toEqual({ ok: false, error: 'Line 2: Unknown entity "user"' });
  });

  it("reports an unknown entity when the data dictionary is empty", () => {
    const result = resolveReferences(astOf(node("Text", { ref: ref("User", "FirstName", "mock") })), []);
    expect(result).toEqual({ ok: false, error: 'Line 2: Unknown entity "User"' });
  });

  it("fails fast on the first pointer in source order", () => {
    const result = resolveReferences(
      astOf(
        node("Box", {
          ref: ref("User", "Nope", "mock", 2),
          children: [node("Text", { ref: ref("Nope", "X", "mock", 3) })],
        }),
        node("Text", { ref: ref("Other", "X", "mock", 4) }),
      ),
      rows,
    );
    expect(result).toEqual({ ok: false, error: 'Line 2: Unknown field "User.Nope"' });
  });

  it("returns an AST without pointers unchanged", () => {
    const input = astOf(node("Box", { text: "a", children: [node("Text", { text: "b" })] }));
    const result = resolveReferences(input, rows);
    expect(result).toEqual({ ok: true, ast: input });
    expect(result.ok && result.ast).toBe(input);
    expect(resolveReferences(input, [])).toEqual({ ok: true, ast: input });
  });
});

describe("resolveReferences: table columns", () => {
  const tableOf = (...columns: AstNode[]) => astOf(node("Table", { children: columns }));
  const column = (extra: Partial<AstNode>) => node("TableColumn", extra);
  const firstColumn = (result: ReturnType<typeof resolveReferences>) =>
    result.ok ? result.ast.pages[0]!.children[0]!.children[0]! : undefined;

  it("resolves a pointer column to the label as the header and the mock value as its only value, with no ref", () => {
    const result = resolveReferences(tableOf(column({ ref: ref("User", "FirstName", "mock", 3), width: 4 })), rows);
    expect(firstColumn(result)).toEqual(column({ text: "First Name", values: ["Jane"], width: 4 }));
    expect(result.ok && "ref" in firstColumn(result)!).toBe(false);
    expect(result.ok && AstSchema.safeParse(result.ast).success).toBe(true);
  });

  it("splits the mock values on `;` into the values of a pointer column, trimming each", () => {
    const several: DataDictionaryRow[] = [
      { entity: "User", field: "Role", dataType: "string", label: "Role", mockValues: "Organisation Admin; Banan ;" },
    ];
    const result = resolveReferences(tableOf(column({ ref: ref("User", "Role", "mock", 3) })), several);
    expect(firstColumn(result)).toEqual(column({ text: "Role", values: ["Organisation Admin", "Banan", ""] }));
  });

  it("does not split on a comma or a quote", () => {
    const quoted: DataDictionaryRow[] = [
      { entity: "User", field: "Role", dataType: "string", label: "Role", mockValues: '"Organisation Admin","Banan"' },
    ];
    const result = resolveReferences(tableOf(column({ ref: ref("User", "Role", "mock", 3) })), quoted);
    expect(firstColumn(result)).toEqual(column({ text: "Role", values: ['"Organisation Admin","Banan"'] }));
  });

  it("keeps a literal column and its values as they are", () => {
    const input = tableOf(column({ text: "Manual", values: ["a", "b"] }), column({ text: "Plain" }));
    expect(resolveReferences(input, rows)).toEqual({ ok: true, ast: input });
  });

  it("resolves several pointer columns among literal ones, each from its own row", () => {
    const result = resolveReferences(
      tableOf(
        column({ ref: ref("User", "FirstName", "mock", 3) }),
        column({ text: "Manual", values: ["x"] }),
        column({ ref: ref("Order", "Total", "mock", 5), linkTo: "home" }),
      ),
      rows,
    );
    expect(result).toEqual({
      ok: true,
      ast: tableOf(
        column({ text: "First Name", values: ["Jane"] }),
        column({ text: "Manual", values: ["x"] }),
        column({ text: "Total", values: ["42"], linkTo: "home" }),
      ),
    });
  });

  it("gives an empty header and an empty value for a field with an empty label and mock value", () => {
    const result = resolveReferences(tableOf(column({ ref: ref("User", "Age", "mock", 3) })), rows);
    expect(firstColumn(result)).toEqual(column({ text: "", values: [""] }));
    expect(result.ok && AstSchema.safeParse(result.ast).success).toBe(true);
  });

  it("uses the first row for a duplicate entity and field", () => {
    const duplicated: DataDictionaryRow[] = [
      { entity: "A", field: "B", dataType: "string", label: "first", mockValues: "1" },
      { entity: "A", field: "B", dataType: "int", label: "second", mockValues: "2" },
    ];
    const result = resolveReferences(tableOf(column({ ref: ref("A", "B", "mock", 3) })), duplicated);
    expect(firstColumn(result)).toEqual(column({ text: "first", values: ["1"] }));
  });

  it("reports an unknown entity and an unknown field with the line of the column", () => {
    expect(resolveReferences(tableOf(column({ ref: ref("Nope", "Name", "mock", 6) })), rows)).toEqual({
      ok: false,
      error: 'Line 6: Unknown entity "Nope"',
    });
    expect(resolveReferences(tableOf(column({ ref: ref("User", "Nope", "mock", 7) })), rows)).toEqual({
      ok: false,
      error: 'Line 7: Unknown field "User.Nope"',
    });
  });
});
