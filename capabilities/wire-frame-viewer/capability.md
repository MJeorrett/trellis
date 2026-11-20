# Capability: Wire Frame Viewer

## User Need
As a user, I want to be able to view a wire frame of a UI component tree so that I can see the structure of the UI.

## Decision Log
* **[2026-11-20] CI-002 Tooling:** Implemented in a minimal Minimal React App using Vite, shadcn and Tailwind CSS.
* **[2026-11-20] CI-002 Setup:** Vite 8 + React 19 + Tailwind CSS v4 (`@tailwindcss/vite`) + shadcn (initialised with `--defaults`; `button`, `card`, `textarea` added). Alias `@` -> `src`. Run with `pnpm dev`; build with `pnpm build`. The app lives alongside the schema in `src/` (`main.tsx`, `App.tsx`, `viewer/`).
* **[2026-11-20] CI-002 Rendering:** `WireframeNode` (`src/viewer/wireframe.tsx`) recursively renders nodes as column-flex `div`s. `Box` has a border; `Text` is identical without one, derived from `type` per the `trellis-ast` decision. Empty `text` renders nothing. Nodes expose `data-node-id` / `data-node-type` attributes.

## Data Dictionary
n/a