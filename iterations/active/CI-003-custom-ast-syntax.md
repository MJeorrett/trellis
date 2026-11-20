# Iteration CI-003: Custom Indentation-Based Syntax for the Trellis AST

**Target Capability:** `/capabilities/trellis-ast/capability.md`

## User Story
As a Trellis user or AI agent, I want to write wireframes in a minimal, indentation-sensitive syntax instead of verbose JSON, so that the UI structure is quick to author and easy to read. The syntax is parsed into the JSON AST (`AstSchema`), and the wire frame viewer takes the new syntax as its input. Nodes no longer have ids.

Read the `Syntax` section and the Decision Log of the target capability before starting; they define the grammar, text quoting, the removal of ids and the error rules.

## Acceptance Criteria
1. Removes `id` from the AST: `AstNodeSchema` in `src/schema/ast.ts` has only `type`, `text` and `children`, the duplicate-id check is removed (`AstSchema` is simply the root node schema, still exported), and `src/schema/ast.test.ts` is updated (fixtures drop `id`; the empty-id and duplicate-id tests are removed; all other schema tests remain).
2. Creates `src/syntax/parse.ts` exporting `parseSyntax(source: string)`, returning `{ ok: true; ast: Ast } | { ok: false; error: string }` (same shape as the existing `ParseResult`). The sample below parses into an AST that passes `AstSchema`.
   ```
   Box
     Text "Log in"
     Box
       Text "Email"
       Box "you@example.com"
     Box
       Text "Password"
       Box "*********"
     Box "Submit"
   ```
3. Supports exactly two text forms: quoted text (`Box "Some Text"`, no escape sequences; `""` is valid and equals empty text) and omitted text (`Box`, giving `""`).
4. Rejects, with a 1-based line number in the error message: unknown type, bare unquoted text (e.g. `Box Some Text`), tab characters, indentation that is not a multiple of 2 spaces, indentation that skips a level, multiple root nodes (or a non-zero-indent first line), unterminated quoted string, and trailing characters after a closing quote. Empty or whitespace-only input is not an error: it parses to a blank wire frame, the root `{ type: "Text", text: "", children: [] }`. Blank lines are ignored.
5. The parser's output is validated through `AstSchema`; schema failures are reported like in `parseAstJson`.
6. Includes tests in `src/syntax/parse.test.ts` covering the sample (asserting the full resulting AST), each text form, each error case above, and determinism (same source gives an equal AST).
7. Tests include basic cases including:
  a) Empty source file (parses to the blank `Text` root)
  b) Box
  c) Text
  d) Box "Some Text"
  e) Text "Some Text"
7. Replaces the sample in `src/viewer/sample.ts` with the Login Form in the new syntax (as a source string) and makes the viewer's text area take the new syntax, showing parse errors inline with their line number. The JSON input and `parseAstJson` are removed from the viewer. `WireframeNode` no longer renders `data-node-id` and keys children by index (`data-node-type` stays).
8. Updates `src/viewer/parse.test.ts` (or replaces it with the new parser tests) so `pnpm test` passes, and `pnpm build` still succeeds.
9. Updates the `README.md` to describe the syntax, and logs the implementation decisions in the target capability's Decision Log (and a note in `/capabilities/wire-frame-viewer/capability.md` that its input is now the custom syntax).
