# Iteration CI-001: Build the Zod Schema for the Trellis AST

**Target Capability:** `/capabilities/trellis-ast/capability.md`

## User Story
Generate the strict TypeScript types and Zod validation schemas that represent the Trellis Wireframe AST defined in the target capability. 

## Acceptance Criteria
1. Creates a `src/schema/ast.ts` file.
2. Exports a complete Zod schema capable of validating a nested UI component tree.
3. Includes a sample valid JSON payload in a test file (`src/schema/ast.test.ts`) representing a simple Login Form (Email input, Password input, Submit button).