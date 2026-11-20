# Capabilities and Iterations

How Trellis organises planned and delivered work. Read this before creating or editing a capability or an iteration.

## Overview

- A **Capability** is the persistent, living description of one area of the product: why it exists, what was decided about it, and the data/syntax it defines. It is the single source of truth.
- An **Iteration** is one small, time-boxed unit of work that changes a capability. It is a throwaway instruction set: once delivered it is archived, and anything worth keeping lives on in the capability.

```
capabilities/
  <capability-name>/
    capability.md
iterations/
  active/        # at most one iteration at a time
    CI-NNN-<kebab-title>.md
  archived/      # delivered iterations
    CI-NNN-<kebab-title>.md
```

## Rules

1. Capabilities are the source of truth. Before writing code for an iteration, read its Target Capability.
2. Every decision made while planning or implementing is logged in the target capability, under Product Decisions or Technical Decisions.
3. There is at most one iteration in `iterations/active/` at a time. Finish and archive it before planning the next.
4. Iterations are never edited after archiving. If something changes later, record it in the capability and plan a new iteration.

## Capabilities

### Location and naming

`capabilities/<kebab-name>/capability.md`. One folder per capability.

### Format

```markdown
# Capability: <Name>

## User Need
As a <role>, I want <goal> so that <benefit>.

## Product Decisions
* **[YYYY-MM-DD] <Title>:** <decision and rationale>

## Technical Decisions
* **[YYYY-MM-DD] <Title>:** <decision and rationale>

## Syntax            <!-- optional: only if the capability defines one -->

## Data Dictionary
n/a
```

- **User Need:** a single user story describing why the capability exists. Change it only if the need itself changes.
- **Product Decisions:** what the capability does and how it behaves for its users: scope, behaviour, user-facing rules, syntax and error behaviour, and anything a user or product owner would care about.
- **Technical Decisions:** how it is built: tooling, libraries, architecture, file layout, data representation, and implementation details that users would not notice.
- Both decision sections follow the same rules: append-only, one bullet per decision, dated. Entries made during an iteration are prefixed with the iteration id (e.g. `**[2026-11-20] CI-003 Parser:**`). Never rewrite or delete an entry. If a decision is superseded, add a new entry that says what it supersedes and why (the old entry stays as history). A superseding entry goes in the section matching its own type, which may differ from the original's.
- When unsure which section a decision belongs in, ask: would a user notice if it changed? If yes, it is a product decision. If no, it is a technical decision. Keep a decision in one section only. If it has both aspects, split it into two entries.
- Keep both headings even if a section is empty (write `n/a`).
- **Syntax:** optional. Include only when the capability defines a text syntax or grammar.
- **Data Dictionary:** the fields/types the capability defines, or `n/a`.

### Updating vs creating

- Update an existing capability when the idea extends, changes or refines something it already covers.
- Create a new capability when the idea is a distinct area with its own user need that no existing capability covers.

## Iterations

### Location and naming

`iterations/active/CI-NNN-<kebab-title>.md` while in progress, then moved to `iterations/archived/` with the same name.

- `NNN` is a zero-padded, sequential number, never reused. The next number is the highest `CI-NNN` in `iterations/archived/` plus 1 (`001` if there are none).
- `<kebab-title>` is a short, lowercase, hyphenated description.

### Format

```markdown
# Iteration CI-NNN: <Title>

**Target Capability:** `/capabilities/<name>/capability.md`

## User Story
As a <role>, I want <goal>, so that <benefit>. <Optional pointers, e.g. which capability sections to read first.>

## Acceptance Criteria
1. <Specific, testable criterion.>
2. ...
```

- **Target Capability:** exactly one capability the iteration changes.
- **User Story:** the user-facing change. Point to the capability sections that define details instead of repeating them.
- **Acceptance Criteria:** numbered, specific and verifiable. Name files, exports and commands where known (e.g. `pnpm test` passes, `pnpm build` succeeds). State the expected tests. End with a criterion to update the `README.md` if behaviour changes and to log decisions in the target capability's Product Decisions or Technical Decisions.

### Lifecycle

1. **Plan:** create the iteration in `iterations/active/` (see the `plan-iteration` skill), after updating or creating its capability.
2. **Implement:** read the target capability, then work through the acceptance criteria. Log decisions in the capability's Product Decisions or Technical Decisions.
3. **Archive:** when all criteria are met, move the file to `iterations/archived/`.
