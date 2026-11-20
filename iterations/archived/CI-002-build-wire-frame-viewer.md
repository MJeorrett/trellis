# Iteration CI-002: Build the Wire Frame Viewer

**Target Capability:** `/capabilities/wire-frame-viewer/capability.md`

## User Story
As a user, I want to view a wire frame of a UI component tree, so that I can see the structure of the UI. The viewer is a minimal React app (Vite, shadcn and Tailwind CSS) that takes a Trellis AST as JSON, validates it with the schema from CI-001 and renders it as a wire frame.

## Acceptance Criteria
1. Scaffolds a minimal React app using Vite, Tailwind CSS and shadcn, managed with pnpm.
2. `pnpm dev` starts the app and `pnpm build` produces a production build.
3. Accepts AST JSON in a text area and validates it against `AstSchema` (`src/schema/ast.ts`), showing validation errors (invalid JSON, schema violations with their path) inline.
4. Renders a valid AST as a wire frame by recursively rendering the node tree; `Box` nodes render with a border and `Text` nodes render without one.
5. Loads the Login Form sample (Email input, Password input, Submit button) by default.
6. Includes tests for the JSON parsing and validation (`src/viewer/parse.test.ts`).
7. Includes a `README.md` with prerequisites and how to run, test and build.
