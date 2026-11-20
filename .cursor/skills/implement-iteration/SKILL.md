---
name: implement-iteration
description: Implement the active Trellis iteration. Reads the iteration and its target capability, works through the acceptance criteria, logs decisions in the capability, then archives the iteration. Use when the user wants to implement, build, execute or finish the active iteration.
---

# Implement Iteration

Deliver the single active iteration against its acceptance criteria. Keep it lightweight: do what the criteria ask, no more.

Before starting, read [capabilities-and-iterations.md](../../../capabilities-and-iterations.md) in the repo root. It defines the formats, decision log rules and lifecycle.

Do not read `IDEAS.md` unless the user explicitly asks.

## Steps

### 1. Find the active iteration

List the files in `iterations/active/` (ignore `.gitkeep`).

- None: **stop**. Tell the user there is nothing to implement and suggest the `plan-iteration` skill.
- More than one: **stop**. Tell the user the rule is at most one active iteration and ask which to keep.

### 2. Read the context

1. Read the iteration file.
2. Read its **Target Capability** in full (User Need, Product Decisions, Technical Decisions, Syntax, Data Dictionary). Honour the existing decisions; do not contradict them silently.
3. Read `README.md` and only the source files relevant to the criteria.

### 3. Clarify

Check for **major** ambiguities: a criterion that could reasonably be built in materially different ways, or one that conflicts with a capability decision. If there are any, ask the user (use `AskQuestion`) before writing code, and keep it to the few questions that matter. Do not ask about minor details; make a sensible choice and log it in step 5. If there is nothing major, move on without asking.

### 4. Implement

- Work through the acceptance criteria in order. Stay within scope; do not add features the criteria do not mention.
- Follow the repo conventions: use `pnpm` only, TypeScript, Zod for schema validation, JSON for the AST.
- Write the tests the criteria call for.
- If a major ambiguity only surfaces mid-way, pause and ask rather than guessing.

### 5. Log decisions

Append a dated entry to the target capability's **Product Decisions** or **Technical Decisions** for each meaningful decision made while implementing, prefixed with the iteration id (e.g. `**[2026-11-20] CI-004 Parser:**`). Never rewrite or delete existing entries; supersede with a new one. Update the capability's Syntax or Data Dictionary if the implementation changed them.

### 6. Verify

Run the checks the criteria name (typically `pnpm test` and `pnpm build`). Fix failures. Then go through each acceptance criterion and confirm it is met, including the `README.md` update if behaviour changed.

### 7. Archive

Only when every criterion is met and you have checked with the user, move the iteration file from `iterations/active/` to `iterations/archived/` with the same name. Do not edit its contents. If any criterion is unmet, leave it in `active/` and say why. Note that it won't be under version control so don't try to `git mv` it!

### 8. Report

Summarise: criteria met (and any not), capability entries added, and the archived path. Do not start planning the next iteration.
