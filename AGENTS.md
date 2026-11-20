# Trellis Agent Rules

You are operating inside a Trellis repository. Trellis is a structured, tri-modal software delivery framework. 
Always adhere to the following principles:

1. **Persistent State First:** The `/capabilities` directory is the single source of truth. It contains the Decision Log, constraints, and architecture for a feature.
2. **Execution Context:** When working on an item in `/iterations`, always read the associated Capability markdown file before writing code.
3. **Traceability:** Every technical decision you make must be logged in the target Capability's `Decision Log` section.
4. **Technology Stack:** 
   - TypeScript
   - Zod (for strict schema validation)
   - JSON (for the AST)

## Ideas

Ignore [IDEAS.md](IDEAS.md) at all times unless explicitly instructed to do so.