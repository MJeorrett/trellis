# Capability: UI AST (Abstract Syntax Tree)

## User Need
As a Trellis AI Agent, I need a deterministic, strictly typed JSON schema to represent UI wireframes so I can seamlessly translate visual layout into executable code and diagrams without hallucinating.

## Decision Log
* **[2026-11-20] Base Schema:** The AST will use a node-based tree structure. 
* **[2026-11-20] Component Library:** There is no component library - initially it is just `Box` and `Text` - both the same except `Text` doesn't have a border.
* **[2026-11-20] CI-001 Tooling:** Implemented in `src/schema/ast.ts` with Zod 4 (`zod`), TypeScript, and Vitest for tests, managed with pnpm. Types are derived via `z.infer` so schema and types cannot drift.
* **[2026-11-20] CI-001 Strictness:** Nodes use `z.strictObject` (unknown keys rejected). `id` is a non-empty string; `type` is `z.enum(["Box", "Text"])`; `text` and `children` are required (`text` may be `""`, leaf nodes use `children: []`) so payloads are deterministic with no implicit defaults.
* **[2026-11-20] CI-001 Recursion:** The recursive `children` field uses Zod 4's getter syntax rather than `z.lazy`, preserving type inference.
* **[2026-11-20] CI-001 Unique IDs:** `AstSchema` (the root schema) additionally enforces `id` uniqueness across the whole tree via `superRefine`; `AstNodeSchema` validates a single subtree without that check.
* **[2026-11-20] CI-001 Border representation:** No `border` field is added; the border difference between `Box` and `Text` is derived from `type` by renderers, since the Data Dictionary doesn't include it.
* **[2026-11-20] CI-001 Login Form fixture:** With only `Box` and `Text` available, inputs and buttons are modelled as `Box` nodes (label as `Text`, placeholder/button caption in `text`).

## Data Dictionary
- `id`: Unique identifier for the node.
- `type`: The component primitive - just `Box` or `Text` for now
- `text`: The text content of the node - for both `Box` and `Text` nodes.
- `children`: Array of nested AST nodes.