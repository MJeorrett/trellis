# Iteration CI-010: Add Spacer Element

**Target Capability:** `/capabilities/trellis-ast/capability.md`

## User Story
As a Trellis user or AI agent, I want a `Spacer` element that can only be used in a `Row` and expands to fill all the remaining space in it, so that I can push elements apart (e.g. a `Row` of `Text "A"`, `Spacer`, `Text "B"` has A at the left and B at the right) or push an element to the right by putting a `Spacer` before it.

Read the `CI-010` entries in the Product and Technical Decisions of the target capability, and the `CI-010 Spacer (planned)` entry in `/capabilities/wire-frame-viewer/capability.md`, before starting. They define the behaviour (invisible, fills the remaining space, shared equally between several spacers), the syntax and its exact errors, and the representation.

## Acceptance Criteria
1. `NodeTypeSchema` in `src/schema/ast.ts` is `z.enum(["Box", "Text", "Row", "Spacer"])`, with no new fields. `AstSchema` rejects (via `superRefine`) a `Spacer` that is not a direct child of a `Row` (including directly in a page, in a `Box` or `Text`, and in another `Spacer`), and a `Spacer` with non-empty `text`, any `children` or a `linkTo`. `src/schema/ast.test.ts` covers a valid `Row` with `Spacer` children (one and several, at any position) and each rejection.
2. `parseSyntax` in `src/syntax/parse.ts` accepts `Spacer` (case-sensitive; `spacer` is still an unknown type error with its line number) as a direct child of a `Row`, and produces `{ type: "Spacer", text: "", children: [] }`.
3. `parseSyntax` reports these fail-fast errors with the 1-based line number: `Line <n>: Spacer must be inside a Row` (in a page, a `Box`, a `Text`, a nested `Spacer`, etc.), `Line <n>: Spacer cannot have text` (`Spacer "x"`), `Line <n>: Spacer cannot have link-to` (and the same `cannot have <key>` message for `id`) and `Line <n>: Spacer cannot have children`.
4. `src/syntax/parse.test.ts` covers: a `Row` with `Text "A"`, `Spacer`, `Text "B"` (full AST and order), a `Spacer` first and last in a `Row`, several `Spacer`s in a `Row`, a `Row` nested in a `Box` with a `Spacer`, a `Spacer` in a `Row` inside a `Row`, and every error above with its exact message.
5. `WireframeNode` in `src/viewer/wireframe.tsx` renders `Spacer` as an empty `div` with `flex-1`, `data-node-type="Spacer"`, no border and no sketchy font, tilt or radius styles, and no link attributes. Other types render as before.
6. `src/viewer/wireframe.test.tsx` verifies (with `renderToStaticMarkup`, as in the existing tests) that a `Row` containing `Text "A"`, `Spacer`, `Text "B"` renders the three children in order with the `Spacer` carrying `flex-1`, and that the `Spacer` has no border class or inline sketch style.
7. The Login Form sample in `src/features/wireframes/wire-frame-editor.ts` has a `Spacer` between `Box "Cancel"` and `Box "Submit"`, and the sample still parses to an AST that passes `AstSchema` (the sample-parse test is updated).
8. `pnpm test` passes and `pnpm build` succeeds.
9. Updates `README.md` (syntax section: `Type` is `Box`, `Text`, `Row` or `Spacer`, describing `Spacer` and its rules, and `Spacer` in the example syntax) and the Syntax and Data Dictionary sections of the target capability, and logs the implementation decisions in the target capability's Product Decisions or Technical Decisions (and a note in `/capabilities/wire-frame-viewer/capability.md` if the rendering differs from the plan).
