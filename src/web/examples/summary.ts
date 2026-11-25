import { z } from "zod";

/**
 * The written summary at the top of the text `Copy for agents` copies (it is not shown on the page). It covers what the
 * examples do not say on their own, in the order of `CI-027 Syntax summary (planned)` in
 * /capabilities/examples/capability.md. Update it when the syntax changes; `summary.test.ts` checks it names every type
 * and attribute.
 */

export const SyntaxSummarySchema = z.strictObject({
  heading: z.string().min(1),
  rules: z.array(z.string().min(1)).min(1),
});
export type SyntaxSummary = z.infer<typeof SyntaxSummarySchema>;

export const syntaxSummary: SyntaxSummary = SyntaxSummarySchema.parse({
  heading: "How Trellis syntax works",
  rules: [
    "A wire frame source goes through four steps: `Def` macros are expanded, then the core syntax is parsed, then `@` pointers are resolved against the data dictionary, then the wire frame is drawn. The wire frame source and the data dictionary are two separate texts.",
    'Write one node per line as `Type "text" attributes`, nested by exactly 2 spaces per level (no tabs, no skipped levels). A source is one or more `Page "Title" id=...` lines at indent 0, and nothing else may be at indent 0 except `Def` lines and comments. A `Page` is never nested; its children are `Box`, `Text`, `Row`, `BoxRow`, `Image` or `Table` nodes.',
    'Text is always in double quotes with no escapes, so it cannot contain `"`; it is optional on `Box`, `Text`, `Row` and `BoxRow`, and not allowed on `Spacer`, `Image` or `Table`. Tokens are separated by exactly one space. Attributes come after the text in any order, each at most once: `id` (only `Page`, unique), `link-to=<page id>` (`Box`, `Text`, `Image`, `TableColumn`), `width=1..12` (everything except `Page` and `Table`), `font=bold` and `font-size=sm|md|lg` (`Box`, `Text`, `Row`, `BoxRow`), `aspect-ratio=W:H` (`Image` only). Type names and values are case-sensitive.',
    "`Box` has a border and `Text` has none. `Row` and `BoxRow` (a `Row` with a border) lay their children on one non-wrapping line, and `width` is a number of twelfths of that row. `Spacer` takes the free space of a row and is only valid directly inside a `Row` or `BoxRow`. `Image` is a placeholder picture. `Table` holds only `TableColumn`s, and a `TableColumn` is only valid directly inside a `Table`.",
    'A macro is defined at indent 0, above its first use, as `Def Name $param` with an indented body of core syntax in which `$param` can appear anywhere on a line (the body writes its own quotes: `Text "$label"`). A use is `Name param=value` with a value for every parameter, and `$1` in the body is one unlabeled argument written right after the name (`Name "value"`). An object parameter `$item=title|text` is used as `$item.title`, and a list argument (`"a","b"`) is repeated with `Each $items as=item`.',
    'Note for agents: you cannot use data dictionary references yet, so do not write pointers; write every label and value out long hand as quoted text. For reference, a bare `@Entity.Field` (no quotes) is a pointer: it shows the data dictionary field\'s first mock value, or `.label` shows its label (`@User.FirstName.label`). Quotes always make a literal, so `"@User.FirstName"` is just that text. A pointer works wherever text does, except on `Page`, and `TableColumn @Entity.Field` fills a whole table column from the field.',
    "A comment is a line that starts with `#` in column 0, and is allowed anywhere a blank line is. An indented `#` is an error.",
    "The parser stops at the first error and reports `Line <n>:` counted in the source as written, so fix the first error and check again.",
    "To write a wire frame, find the closest example below, copy its source and change it, rather than writing from memory.",
  ],
});