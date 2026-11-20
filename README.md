# Trellis

A structured, opinionated tri-modal software delivery framework designed for the AI-native era. Wireframes, Diagrams and Agents are first class citizens.

## Prerequisites

- **Node.js** `^22.12.0` or `^24.0.0` (24 LTS recommended). This is the range required by Vitest 5; Vite 8 needs `^20.19.0 || >=22.12.0`.
- **pnpm** `10.x` (developed with 10.29.3). This repo uses pnpm only; do not use npm, yarn or bun.

## Setup

```sh
pnpm install
```

## Run

```sh
pnpm dev
```

Starts the Vite dev server (default http://localhost:5173). Write wire frame source in the left pane to see the wire frame on the right; syntax errors are shown with their line number.

## Syntax

Wire frames are authored in a minimal, indentation-sensitive syntax that is parsed into the JSON AST (`src/syntax/parse.ts`, validated by `AstSchema`):

```
Box
  Text "Log in"
  Box
    Text "Email"
    Box "you@example.com"
  Box
    Text "Password"
    Box "*********"
  Box "Submit"
```

- One node per line: `<Type> [text]`, where `Type` is `Box` or `Text` (`Text` has no border).
- Nesting is expressed by indentation only: exactly 2 spaces per level. Tabs, odd indentation and skipped levels are errors.
- There is exactly one root node (the first non-blank line, with no indentation). Blank lines are ignored. Empty or whitespace-only source is a blank wire frame (an empty, borderless `Text` root), not an error.
- Text is either a double-quoted string (`Box "Some Text"`) or omitted (`Box`, meaning `""`). `""` is valid. Bare unquoted text (`Box Some Text`) is an error. There are no escape sequences, so text cannot contain a `"`, and nothing may follow the closing quote.
- Nodes have no ids.
- Parsing fails fast with the first error, reported with a 1-based line number (e.g. `Line 3: Unknown type "Button" ...`).

## Test

```sh
pnpm test        # run the Vitest suite once
pnpm typecheck   # type-check with tsc
```

## Build

```sh
pnpm build       # outputs to dist/
pnpm preview     # serve the production build locally
```
