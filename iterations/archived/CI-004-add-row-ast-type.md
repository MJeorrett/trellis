# Iteration CI-004: Add Row AST Type

**Target Capability:** `/capabilities/trellis-ast/capability.md`

## User Story
As a Trellis user or AI agent, I want a `Row` component that works like `Box` but keeps all its children on the same row, so that I can describe horizontal layouts (e.g. a label next to an input, or a button bar) in a wire frame.

Read the `CI-004 Row` entries in the Product and Technical Decisions of the target capability before starting; they define the behaviour (bordered like `Box`, children laid out left to right, never wrapping) and the representation (a new `type` value, no new fields).

## Acceptance Criteria
1. `AstNodeSchema` in `src/schema/ast.ts` accepts `type: "Row"` (`z.enum(["Box", "Text", "Row"])`), with no other schema changes. `src/schema/ast.test.ts` gains tests that a `Row` node (with and without children, with and without text) validates, and that an unknown type is still rejected.
2. `parseSyntax` in `src/syntax/parse.ts` accepts `Row` as a type (case-sensitive; `row` is still an unknown type error with its line number). `Row`, `Row "Some Text"` and `Row` containing nested children parse to the expected AST.
3. `src/syntax/parse.test.ts` covers: `Row`, `Row "Some Text"`, a `Row` with several children (asserting the full resulting AST and child order), a `Row` nested inside a `Box` and vice versa, and `row` (lowercase) being rejected.
4. `WireframeNode` in `src/viewer/wireframe.tsx` renders `Row` as a bordered container (same border as `Box`) whose children are laid out in a single row (row-flex, no wrapping), while `Box` and `Text` keep their column layout. The node keeps its `data-node-type` attribute (`data-node-type="Row"`).
5. A viewer test (or a component test alongside existing viewer tests) verifies a `Row` renders its children in a single row layout and a `Box` does not. If the repo has no component test setup, verify through the rendering logic and note it in the capability's Technical Decisions.
6. The sample in `src/viewer/sample.ts` is updated to use a `Row` for a cancel and submit buttons, and still parses to an AST that passes `AstSchema`.
7. `pnpm test` passes and `pnpm build` succeeds.
8. Updates `README.md` (syntax section: `Type` is `Box`, `Text` or `Row`, describing `Row`) and adding Row to the example syntax, and logs the implementation decisions in the target capability's Product Decisions or Technical Decisions (and, if the viewer's rendering changed in a way worth recording, a note in `/capabilities/wire-frame-viewer/capability.md`).
