# Iteration CI-009: Sketchy Wireframe Render

**Target Capability:** `/capabilities/wire-frame-viewer/capability.md`

## User Story
As a Trellis user, I want the wire frame preview to look hand-drawn, so that it reads as a rough sketch rather than a finished design.

Read the `CI-009` entries in the Product Decisions and Technical Decisions of the target capability before starting. They define the look, what is and is not affected, and how it is built.

## Acceptance Criteria
1. `src/viewer/sketch.ts` exports a pure function `sketchStyle(seed: number): { borderRadius: string; transform: string }`. It picks from a fixed set of variants, is deterministic (the same seed always gives the same result), works for any non-negative integer seed (including a large one), gives at least 3 distinct results across seeds, and every `transform` is a `rotate(...)` of less than 1 degree in either direction. `borderRadius` uses the eight-value `a b c d / e f g h` form.
2. `WireframeNode` (`src/viewer/wireframe.tsx`) gets an optional path prop (default: empty) holding the node's child-index path from the page root, extends it for its children, and derives its seed from it. `PageTabs` (`src/viewer/pages.tsx`) passes each top-level child's index so the path starts from the page root. The seed does not depend on the node's text, so editing text does not change any node's look.
3. `WireframeNode` applies `sketchStyle` inline on its `div`. `Box` and `Row` get both the `borderRadius` and the `transform`; `Text` gets only the `transform` (no border radius, as it has no border). Existing classes, `data-node-type`, link attributes (`role`, `tabIndex`, `data-link-to`, `cursor-pointer`) and click and Enter handlers are unchanged, as is the layout (`flex-row flex-nowrap` for `Row`, `flex-col` otherwise).
4. The `Caveat` font is added with `pnpm add @fontsource-variable/caveat`, imported in `src/main.tsx` and applied (via a Tailwind font utility or inline `fontFamily` with a sans-serif fallback) only to wire frame nodes. The page tabs, the editor, the top nav and the rest of the app keep their current font and look.
5. Tests (`pnpm test`, DOM-free as before): a new `src/viewer/sketch.test.ts` covers criterion 1. `src/viewer/wireframe.test.tsx` (using `renderToStaticMarkup`) verifies that `Box` and `Row` markup contains a `border-radius` and a `rotate(` transform, that `Text` markup contains a `rotate(` transform but no `border-radius`, that the same node and path render identical markup twice, that nodes with different paths can render differently, that changing a node's text keeps its style, and that the existing class, link and layout assertions still hold. `pages.test.tsx` still passes.
6. `pnpm test`, `pnpm typecheck` and `pnpm build` pass.
7. Updates `README.md` if it describes how the preview looks (including the screenshot caption, if any), and logs the implementation decisions in the Product Decisions or Technical Decisions of `/capabilities/wire-frame-viewer/capability.md` (the `(planned)` entries are confirmed or amended by `CI-009 ... implementation` entries; old entries stay as history).
