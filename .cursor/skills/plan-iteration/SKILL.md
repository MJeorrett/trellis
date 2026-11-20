---
name: plan-iteration
description: Plan the next Trellis iteration from an idea or user story. Updates an existing capability or creates a new one, then creates a new numbered iteration in iterations/active. Use when the user wants to plan, scope or start a new iteration, or gives a new idea or user story.
---

# Plan Iteration

Turn an idea or user story into a Capability update and a new Iteration. Keep it lightweight: no code, only planning documents.

Before starting, read [capabilities-and-iterations.md](../../../capabilities-and-iterations.md) in the repo root. It defines the capability and iteration formats, naming and numbering.

Do not read `IDEAS.md` unless the user explicitly asks.

## Steps

### 1. Check for an active iteration

List the files in `iterations/active/` (ignore `.gitkeep`).

If any iteration file exists, **stop**. Tell the user which iteration is active and ask them to finish it first (implement it, then move it to `iterations/archived/`). Do not continue planning.

### 2. Get the idea or user story

If the user has not given one, ask for it. If it is vague, ask at most a couple of short clarifying questions.

### 3. Choose the capability and confirm

1. Read each `capabilities/*/capability.md` (User Need, Product Decisions, Technical Decisions, Data Dictionary).
2. Decide whether the idea belongs in an **existing capability** (update it) or needs a **new capability** (create `capabilities/<kebab-name>/capability.md`).
3. **Confirm with the user before changing any file** (use `AskQuestion`). State:
   - the approach: update `<capability>` or create `<new-capability>`
   - the capability changes you plan to make (e.g. User Need, Product or Technical Decisions entries, Syntax or Data Dictionary edits)
   - a short iteration title
4. Do not continue until the user confirms. If they disagree, adjust and confirm again.

### 4. Update or create the capability

Edit or create `capabilities/<name>/capability.md` following the Capabilities section of [capabilities-and-iterations.md](../../../capabilities-and-iterations.md) (format, decision log rules). Add dated entries under Product Decisions or Technical Decisions for the planning decisions made.

### 5. Create the iteration

Create `iterations/active/CI-NNN-<kebab-title>.md` following the Iterations section of [capabilities-and-iterations.md](../../../capabilities-and-iterations.md) (numbering, format, acceptance criteria rules).

### 6. Report

Give the user the capability file changed or created and the new iteration path. Do not start implementing.
