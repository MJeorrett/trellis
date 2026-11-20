# Capability: Wire Frame Viewer

## User Need
As a user, I want to be able to view a wire frame of a UI component tree so that I can see the structure of the UI.

## Product Decisions
* **[2026-11-20] CI-003 Input:** The viewer's input is now the custom indentation-based syntax defined in `/capabilities/trellis-ast/capability.md`, not JSON. `App.tsx` parses the text area with `parseSyntax` (`src/syntax/parse.ts`) and shows parse errors inline, with their line number, under the text area. The JSON input and `parseAstJson` were removed; the default sample (`src/viewer/sample.ts`, `sampleSource`) is the Login Form in the new syntax.

## Technical Decisions
* **[2026-11-20] CI-002 Tooling:** Implemented in a minimal Minimal React App using Vite, shadcn and Tailwind CSS.
* **[2026-11-20] CI-002 Setup:** Vite 8 + React 19 + Tailwind CSS v4 (`@tailwindcss/vite`) + shadcn (initialised with `--defaults`; `button`, `card`, `textarea` added). Alias `@` -> `src`. Run with `pnpm dev`; build with `pnpm build`. The app lives alongside the schema in `src/` (`main.tsx`, `App.tsx`, `viewer/`).
* **[2026-11-20] CI-002 Rendering:** `WireframeNode` (`src/viewer/wireframe.tsx`) recursively renders nodes as column-flex `div`s. `Box` has a border; `Text` is identical without one, derived from `type` per the `trellis-ast` decision. Empty `text` renders nothing. Nodes expose a `data-node-type` attribute (`data-node-id` was removed in CI-003 as nodes no longer have ids); children are keyed by index.
* **[2026-11-20] CI-004 Row rendering:** `WireframeNode` renders `Row` as a bordered container with `flex-row flex-nowrap`, so its children sit on one row and never wrap; `Box` stays column-flex with a border and `Text` column-flex without one. `data-node-type="Row"` is exposed like the other types. The default sample now ends with a `Row` holding Cancel and Submit buttons.

## Data Dictionary
n/a
