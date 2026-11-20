# Trellis Bootstrap

A structured, tri-modal software delivery framework designed for the AI-native era.

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

Starts the Vite dev server (default http://localhost:5173). Paste AST JSON into the left pane to see the wire frame on the right.

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
