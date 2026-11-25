# Iteration CI-025: Trim Trailing Whitespace

**Target Capability:** `/capabilities/trellis-ast/capability.md`

## User Story
As a Trellis author, I want trailing whitespace on a source line to be ignored before the line is validated and parsed, so that a trailing space or tab does not make an otherwise valid line fail.

Read `CI-025 Trim trailing whitespace (planned)` and `CI-025 Trim before parse (planned)` in the target capability first. They amend `CI-003 Strictness details`.

## Acceptance Criteria
1. `parseSyntax` in `src/web/syntax/parse.ts` removes trailing whitespace from each line (`trimEnd`) before the blank-line check, the comment check, the tab check, the indentation check and the rest of validation. `Box "a" `, `Page "Home" `, `Box @User.FirstName ` and `Spacer ` parse to the same AST as those lines without the trailing space, and a trailing tab is removed the same way. A line that is only whitespace is still ignored. Leading spaces stay the indentation. Spaces inside quotes are kept (`Box "a "` is the text `a `). `Box  "x"` is still an error, and `Box "a"  width=3` is still `Line <n>: Unexpected characters after closing quote: "  width=3"`. `src/web/syntax/parse.test.ts` covers each of these, and the cases that currently expect an error for a single trailing space or a trailing space after a pointer are updated to expect the trimmed line's AST.
2. `expandMacros` in `src/web/syntax/macros.ts` removes trailing whitespace from a line before it validates that line (a `Def`, a body line, an `Each` and a use). A body line with a trailing space expands to text that `parseSyntax` accepts. A source with no comment, `Def` or macro use is still returned as the very same string, trailing spaces included. `src/web/syntax/macros.test.ts` covers a trailing space on a use line and on a body line.
3. `compileSyntax` keeps its signature. `src/web/syntax/compile.test.ts` covers a source whose only extra was trailing whitespace, including on a line that came from a macro, and it compiles. The editors and the stored source are not changed: nothing strips trailing spaces from the text that is saved.
4. `pnpm test` and `pnpm build` pass.
5. Update the Syntax bullet in `README.md` that says nothing may follow a closing quote, so it says trailing whitespace at the end of a line is ignored (leading spaces and spaces inside quotes are unchanged), and log the implementation decisions in the target capability's Product Decisions or Technical Decisions.
