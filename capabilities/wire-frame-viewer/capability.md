# Capability: Wire Frame Viewer

## User Need
As a user, I want to be able to view a wire frame of a UI component tree so that I can see the structure of the UI.

## Product Decisions
* **[2026-11-20] CI-003 Input:** The viewer's input is now the custom indentation-based syntax defined in `/capabilities/trellis-ast/capability.md`, not JSON. `App.tsx` parses the text area with `parseSyntax` (`src/syntax/parse.ts`) and shows parse errors inline, with their line number, under the text area. The JSON input and `parseAstJson` were removed; the default sample (`src/viewer/sample.ts`, `sampleSource`) is the Login Form in the new syntax.
* **[2026-11-20] CI-005 Pages (planned):** The wire frame source can now describe several pages (see the `Page` decisions in `/capabilities/trellis-ast/capability.md`). The preview shows one tab per page, in source order, labelled with the page's title, and only the selected page's content is rendered. Tabs are always shown, even for a single page. A page with an empty title is labelled `Page N` (its 1-based position). The first page is selected initially. When the source is edited, the selected tab is kept by position and falls back to the last page if that position no longer exists; if the source has a syntax error, the previous preview behaviour applies (the error is shown under the text area).
* **[2026-11-20] CI-005 Pages implementation:** The `CI-005 Pages (planned)` decision is confirmed as implemented. Clarifications: the page's content is its children stacked in a column (the `Page` itself has no border or title text); selection is kept by position and resolved when rendering, so the stored position is not overwritten when it falls back (if the source later regains pages, the earlier tab is selected again), and a syntax error leaves the selection untouched. The blank source shows one tab labelled `Page 1` with no content. The default sample shows a `Log in` tab and a `Forgot password` tab.

## Technical Decisions
* **[2026-11-20] CI-002 Tooling:** Implemented in a minimal Minimal React App using Vite, shadcn and Tailwind CSS.
* **[2026-11-20] CI-002 Setup:** Vite 8 + React 19 + Tailwind CSS v4 (`@tailwindcss/vite`) + shadcn (initialised with `--defaults`; `button`, `card`, `textarea` added). Alias `@` -> `src`. Run with `pnpm dev`; build with `pnpm build`. The app lives alongside the schema in `src/` (`main.tsx`, `App.tsx`, `viewer/`).
* **[2026-11-20] CI-002 Rendering:** `WireframeNode` (`src/viewer/wireframe.tsx`) recursively renders nodes as column-flex `div`s. `Box` has a border; `Text` is identical without one, derived from `type` per the `trellis-ast` decision. Empty `text` renders nothing. Nodes expose a `data-node-type` attribute (`data-node-id` was removed in CI-003 as nodes no longer have ids); children are keyed by index.
* **[2026-11-20] CI-004 Row rendering:** `WireframeNode` renders `Row` as a bordered container with `flex-row flex-nowrap`, so its children sit on one row and never wrap; `Box` stays column-flex with a border and `Text` column-flex without one. `data-node-type="Row"` is exposed like the other types. The default sample now ends with a `Row` holding Cancel and Submit buttons.

## Data Dictionary
n/a
