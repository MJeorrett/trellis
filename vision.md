# Trellis Vision

Trellis is an opinionated, structured, AI-native framework designed to let products grow organically while keeping their underlying architecture and logic perfectly mapped, deterministic, and agent-ready.

## The Problem

The information needed to develop a product is fragmented across tools that do not speak to each other. We draw UIs in Figma, write logic in Jira, and diagram systems in Confluence. Because these tools are unopinionated, they hold whatever you put in them in whatever shape you choose. Furthermore, traditional agile tools overload terms like "Feature" to mean both a permanent system capability and a disposable unit of work. 

The result is context that decays instantly. When wireframes, text, and code drift out of sync, the context becomes hard to find, hard to trust, and impossible for autonomous AI coding agents to use reliably.

## What Trellis Is

Trellis is an end-to-end product definition and documentation platform. It replaces execution-side backlog tools and disparate whiteboarding apps by holding everything in one home. 

Instead of a one-dimensional backlog, Trellis operates as a **two-dimensional matrix**:
1. **The Trellis (Persistent State):** The living "Capabilities" of the product, mapped via User Needs, Decision Logs, and Data Dictionaries.
2. **The Vine (Execution Backlog):** The ephemeral "Capability Iterations" and User Stories moving through the system to build or update the Trellis.

To bridge the gap between how humans think and how AI executes, every Capability in Trellis is **Tri-Modal**. It represents the same underlying data through three synchronized lenses:
1. **The Surface (Wireframes):** Native, low-fidelity, component-driven wireframes representing the Abstract Syntax Tree (AST) of the UI.
2. **The Skeleton (Diagrams):** Auto-generated sequence and ER diagrams showing how data flows.
3. **The DNA (Text):** Strict Markdown documents containing business rules, constraints, and the persistent Decision Log.

The team keeps Trellis open all day. It supports them without getting in their way, serving as an IDE for Product Owners.

## Who it is for

Cross-functional product teams building a software product, and the people they build it for. The first-class roles are:

*   Product owners, managers, and designers
*   Business analysts
*   Developers
*   Testers and QA
*   Architects and tech leads
*   Stakeholders and business reviewers, who read and comment
*   **External AI Agents (e.g., Cursor), who consume Trellis as their absolute source of truth**

## Principles

1. **Expert Led.** The team is the expert in their product. Trellis supports them without getting in their way, preventing stakeholders from bikeshedding pixels by restricting design to low-fidelity structures.
2. **Start with the User.** Everything ties back to a user, directly. Every piece of work traces to a user need. The only work allowed without one is a Spike (learning), a Technical Enabler (building), or a Chore (maintaining).
3. **Fixed Structure, Organic Product.** Trellis is opinionated about the structure of information. The structure does not grow organically; the product does, over the top of it. Capabilities are persistent assets; Capability Iterations are ephemeral work.
4. **Firm on Information, Light on Process.** Formats and traceability links are non-negotiable. How a team works, and what it does next, is up to them.
5. **One Format for Humans and AI.** Every kind of information has a predefined format that people can read (Tri-modal visuals) and that AI can consume reliably (Deterministic Markdown and JSON ASTs).
6. **AI Synchronizes, Humans Decide.** AI is tightly integrated as a continuous state synchronizer. If a human adds a button to a wireframe, the AI drafts the updated sequence diagram and text rules. It is never a gatekeeper, but it ensures all three views remain in perfect harmony.
7. **Human Attention is the Scarce Resource.** Trellis puts the most important things in front of humans first. Priority comes from how high an item sits, how much depends on it, how unsure the AI was in its synchronization, and how much has changed since approval.
8. **Trust is Earned Over Time.** Trust is measured by how much correction the AI synchronizer needed, reviewed in retrospectives.
9. **External Agents are First-Class Citizens.** Coding agents read their context natively from Trellis capabilities and propose architectural updates back into Trellis formats via Pull Requests. Those changes are reviewed like any other draft.
10. **Built with Trellis.** Trellis is developed using Trellis. We start with the thinnest useful slice (a Git repo and an AI agent) and grow from there.

## Core Concepts

*   **Capabilities (Not Features):** The permanent, living assets of the software (e.g., "User Checkout"). Capabilities own the wireframes, diagrams, and Decision Logs. 
*   **Capability Iterations:** The scoped, ephemeral sprints of work used to build or modify a Capability (e.g., "Add Apple Pay to Checkout"). Once closed, the knowledge graduates to the Capability.
*   **Semantic Native Components:** Wireframes are built using a restricted library of native Trellis blocks that map 1:1 to code-level primitives (like shadcn/ui), guaranteeing that visual intent can be compiled directly into executable code by an AI agent.

## Non-Goals

Trellis does not do:

*   Pixel-perfect UI design, vector manipulation, or replacing Figma's design system.
*   Time tracking, resourcing, or general project management.
*   Code hosting, CI/CD, or deployment.
*   Acting as a coding agent (it provides perfect context to them instead).
*   Product analytics or telemetry.