import { describe, expect, it } from "vitest";
import type { DataDictionaryRow } from "@/data-dictionary/schema";
import { AstSchema, type Ast, type AstNode, type PointerRef } from "@/schema/ast";
import { resolveReferences } from "./resolve";

const rows: DataDictionaryRow[] = [
  { entity: "User", field: "FirstName", dataType: "string", label: "First Name", mockValue: "Jane" },
  { entity: "User", field: "Age", dataType: "int", label: "", mockValue: "" },
  { entity: "Order", field: "Total", dataType: "int", label: "Total", mockValue: "42" },
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
      { entity: "A", field: "B", dataType: "string", label: "first", mockValue: "1" },
      { entity: "A", field: "B", dataType: "int", label: "second", mockValue: "2" },
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
