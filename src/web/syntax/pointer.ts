import type { DataDictionaryRow } from "@/data-dictionary/schema";
import { POINTER_KINDS, type PointerKind } from "@/schema/ast";

/**
 * Shape of a data reference (`@User.FirstName`, `@User.FirstName.label`), shared by the core parser and the macro
 * preprocessor. Rules: /capabilities/data-references/capability.md.
 */

export const POINTER_PATTERN = new RegExp(
  `^@([A-Z][A-Za-z0-9]*)\\.([A-Z][A-Za-z0-9]*)(?:\\.(${POINTER_KINDS.join("|")}))?$`,
);
const ENTITY_POINTER_PATTERN = /^@[A-Z][A-Za-z0-9]*$/;

/** The data dictionary column each kind of pointer shows. */
export const POINTER_COLUMNS: Readonly<Record<PointerKind, keyof DataDictionaryRow>> = {
  entity: "entity",
  field: "field",
  dataType: "dataType",
  label: "label",
  mock: "mockValue",
};

export type PointerParts = {
  entity: string;
  field: string;
  kind: PointerKind;
  /** Whether the token spelled the kind out (`@User.FirstName.mock`) rather than leaving it to default to `mock`. */
  written: boolean;
};

export const mustNameFieldError = (token: string) =>
  `Pointer ${JSON.stringify(token)} must name a field (expected @Entity.Field)`;

/** Reads a token that starts with `@`, or gives the message (without a line) for why it is not a pointer. */
export function parsePointer(token: string): ({ ok: true } & PointerParts) | { ok: false; error: string } {
  const match = POINTER_PATTERN.exec(token);
  if (match !== null) {
    const written = match[3] !== undefined;
    return { ok: true, entity: match[1]!, field: match[2]!, kind: (match[3] ?? "mock") as PointerKind, written };
  }
  if (ENTITY_POINTER_PATTERN.test(token)) return { ok: false, error: mustNameFieldError(token) };
  return {
    ok: false,
    error: `Invalid pointer ${JSON.stringify(token)} (expected @Entity.Field or @Entity.Field.<${POINTER_KINDS.join("|")}>)`,
  };
}
