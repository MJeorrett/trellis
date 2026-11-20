# Capability: UI AST (Abstract Syntax Tree)

## User Need
As a Trellis AI Agent, I need a deterministic, strictly typed JSON schema to represent UI wireframes so I can seamlessly translate visual layout into executable code and diagrams without hallucinating.

## Product Decisions
* **[2026-11-20] Component Library:** There is no component library - initially it is just `Box` and `Text` - both the same except `Text` doesn't have a border.
* **[2026-11-20] Authoring Syntax:** The AST gets a custom, indentation-sensitive text syntax as its authoring format, kept as minimal as possible (see [Syntax](#syntax)). It is parsed into the JSON AST, which stays the canonical, Zod-validated representation. Rationale: the JSON form is noisy for humans and agents to write (ids, empty `text`, empty `children`), while the text form carries only the information that matters.
* **[2026-11-20] Syntax Structure:** One node per line: `<Type> [text]`. Nesting is expressed solely by indentation (no braces, no closing tokens). Indentation is exactly 2 spaces per level; tabs and odd or skipped levels are errors. There is exactly one root node (the first non-blank line, at indent 0), except that a source with no nodes at all is a blank wire frame (see Blank Source). Blank lines are ignored.
* **[2026-11-20] Syntax Text:** The optional text after the type is either a double-quoted string (`Box "Some Text"`) or omitted (`Box`, meaning `""`). Nothing else is allowed: bare unquoted text (`Box Some Text`) is an error. There are no escape sequences for now: the text runs from the opening `"` to the next `"`, so it cannot itself contain a double quote, and anything after the closing quote is an error. `""` is valid and equals omitted text.
* **[2026-11-20] No Ids:** Nodes have no `id`, in the syntax or in the AST. Nothing needs to reference a node yet (the only consumer was the viewer's `data-node-id` attribute and React `key`, and a child index is enough for a static tree). This supersedes the CI-001 decisions on `id` (non-empty string, uniqueness check in `AstSchema`); the schema change is made in CI-003. Ids can be reintroduced (e.g. an optional explicit id in the syntax) when a capability needs cross-references, diffing or traceability.
* **[2026-11-20] Syntax Errors:** The parser fails fast with the first error, reported with a 1-based line number (e.g. unknown type, bad indentation, multiple roots, unterminated string). The parser's output is still passed through `AstSchema`, so the schema remains the single source of truth for validity. Errors are reported clearly in the Editor UI.
* **[2026-11-20] CI-003 Blank Source:** Empty or whitespace-only source is not an error: it parses to a blank wire frame, the root `{ type: "Text", text: "", children: [] }`. `Text` is used because it renders without a border, so a blank editor shows a blank wire frame rather than an empty box; the AST keeps its single-root invariant and no nullable AST is needed. This amends the "exactly one root" rule in Syntax Structure: a source with no nodes yields this implicit root, while a source with nodes must still have exactly one explicit root. It also supersedes the CI-003 acceptance criterion that rejected empty input.
* **[2026-11-20] CI-003 Strictness details:** Tabs are rejected anywhere in a non-blank line (including inside quotes). The type must be followed by nothing or exactly one space and then a quoted string, so `Box  "x"` (two spaces) is an error. Whitespace after a closing quote counts as trailing characters. A `Box ` with only trailing whitespace is treated as omitted text. Indentation is checked (tab, then multiple of 2) before the type, and a first line with indentation is reported as "first node must not be indented"; a later unindented line is "multiple root nodes". Type names are case-sensitive.
* **[2026-11-20] CI-003 Login Form sample:** The sample in the iteration (and in the viewer) uses a 9-character `"*********"` password placeholder, as in the Syntax section below.
* **[2026-11-20] CI-004 Row:** A new `Row` component type is added. It works exactly like `Box` (bordered, optional text, may have children) except that its children are laid out on a single row, left to right, in order. Children never wrap onto a new line, even if they overflow. This extends the Component Library decision (now `Box`, `Text` and `Row`). In the syntax `Row` is a type keyword used like `Box` (`Row`, `Row "Some Text"`), type names remain case-sensitive, and `Row` follows all existing syntax rules and errors.

## Technical Decisions
* **[2026-11-20] Base Schema:** The AST will use a node-based tree structure. 
* **[2026-11-20] CI-001 Tooling:** Implemented in `src/schema/ast.ts` with Zod 4 (`zod`), TypeScript, and Vitest for tests, managed with pnpm. Types are derived via `z.infer` so schema and types cannot drift.
* **[2026-11-20] CI-001 Strictness:** Nodes use `z.strictObject` (unknown keys rejected). `id` is a non-empty string; `type` is `z.enum(["Box", "Text"])`; `text` and `children` are required (`text` may be `""`, leaf nodes use `children: []`) so payloads are deterministic with no implicit defaults.
* **[2026-11-20] CI-001 Recursion:** The recursive `children` field uses Zod 4's getter syntax rather than `z.lazy`, preserving type inference.
* **[2026-11-20] CI-001 Unique IDs:** `AstSchema` (the root schema) additionally enforces `id` uniqueness across the whole tree via `superRefine`; `AstNodeSchema` validates a single subtree without that check.
* **[2026-11-20] CI-001 Border representation:** No `border` field is added; the border difference between `Box` and `Text` is derived from `type` by renderers, since the Data Dictionary doesn't include it.
* **[2026-11-20] CI-001 Login Form fixture:** With only `Box` and `Text` available, inputs and buttons are modelled as `Box` nodes (label as `Text`, placeholder/button caption in `text`).
* **[2026-11-20] CI-003 Schema:** Removed `id` from `AstNodeSchema` (now `type`, `text`, `children`; still `z.strictObject`, so a stray `id` is rejected) and removed the duplicate-id `superRefine`. `AstSchema` is now simply an alias of the root node schema and is still exported, along with `Ast`/`AstNode`.
* **[2026-11-20] CI-003 Parser:** `parseSyntax(source)` in `src/syntax/parse.ts` is a hand-written, line-based parser (no parser-generator dependency). It returns `ParseResult` (`{ ok: true; ast } | { ok: false; error }`, moved here from the removed `src/viewer/parse.ts`). It splits on `\r?\n`, ignores whitespace-only lines, and keeps a stack of the latest node per indentation level to attach children. Tree construction throws on the first error, which is caught and returned as `Line <n>: <message>` (1-based, counting blank lines); there is no empty-input error (see Blank Source).
* **[2026-11-20] CI-003 Validation:** The parser's tree is always passed through `AstSchema.safeParse` and failures are formatted as `<path>: <message>` lines, as `parseAstJson` did.
* **[2026-11-20] CI-004 Row representation (planned):** `Row` is added to the `type` enum in `src/schema/ast.ts` (`z.enum(["Box", "Text", "Row"])`) with no new fields: the row layout is derived from `type` by renderers, as the border is (see CI-001 Border representation). The parser accepts `Row` as a known type, and the viewer's `WireframeNode` renders `Row` as a bordered row-flex container (no wrapping) while `Box` stays column-flex.
* **[2026-11-20] CI-004 Row implementation:** Implemented as planned: `NodeTypeSchema` is `z.enum(["Box", "Text", "Row"])` in `src/schema/ast.ts` (no other schema change). The parser needed no code change: it validates type names against `NodeTypeSchema`, so `Row` is accepted and `row` is still rejected with its line number and the updated "expected Box or Text or Row" message. `WireframeNode` now applies `flex-row flex-nowrap` for `Row` and `flex-col` otherwise, and the border to every type except `Text`.
* **[2026-11-20] CI-004 Row tests:** The repo has no DOM component-test setup (no jsdom / testing library) and none was added. The viewer test (`src/viewer/wireframe.test.tsx`) renders `WireframeNode` with `renderToStaticMarkup` from `react-dom/server` (already a dependency) and asserts the resulting class names (`flex-row flex-nowrap` for `Row`, `flex-col` for `Box`/`Text`, border on `Box`/`Row` only, `data-node-type="Row"`).
* **[2026-11-20] CI-004 Sample:** The viewer sample's `Box "Submit"` is replaced by a `Row` containing `Box "Cancel"` and `Box "Submit"`. The Syntax example below and the README example were updated to match. The parse tests keep the original all-`Box` Login Form source as a separate fixture and test the new sample source separately.

## Syntax

```
Box
  Text "Log in"
  Box
    Text "Email"
    Box "you@example.com"
  Box
    Text "Password"
    Box "*********"
  Row
    Box "Cancel"
    Box "Submit"
```

Grammar (informal): `line = indent Type [" " quoted]`, `indent = "  "*`, `Type = "Box" | "Text" | "Row"`, `quoted = '"' [^"]* '"'`.

## Data Dictionary
- `type`: The component primitive - `Box`, `Text` or `Row`. `Row` is like `Box` but lays its children out on a single row.
- `text`: The text content of the node - for both `Box` and `Text` nodes.
- `children`: Array of nested AST nodes.
