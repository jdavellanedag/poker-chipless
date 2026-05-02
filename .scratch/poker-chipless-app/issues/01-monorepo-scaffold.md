---
status: done
---

# Monorepo Scaffold

> **Status:** `done`

## Clarification
_No open questions._

## Context
First issue in the poker-chipless-app project. Establishes the entire project skeleton that every subsequent issue builds on. Corresponds to M1 — Core Infrastructure.

## Goal
Initialize a Turborepo workspace with `apps/client` (React + Vite + TypeScript + Tailwind), `apps/server` (Node.js + TypeScript), and `packages/types`. All `dev` and `build` scripts run from the repo root via a single command.

## Acceptance Criteria
- [x] `npm install` from the repo root installs all workspace dependencies.
- [x] `npm run dev` from the repo root starts both the client Vite dev server and the server in watch mode concurrently.
- [x] `npm run build` from the repo root builds both `apps/client` and `apps/server` via Turborepo task pipeline.
- [x] `apps/client` renders a blank React page with Tailwind CSS applied (verify with a utility class e.g. `bg-slate-900`).
- [x] `apps/server` starts and logs a confirmation message without errors.
- [x] `packages/types` is importable from both `apps/client` and `apps/server` with a placeholder export (e.g. `export const VERSION = '0.1.0'`).
- [x] TypeScript compiles with zero errors across all three packages.

## Technical Notes
- Use Turborepo (`turbo.json`) for task orchestration. Define `build` and `dev` pipelines.
- `packages/types` must be a proper workspace package with its own `tsconfig.json` and listed as a dependency in both app `package.json` files.
- Tailwind v3 config in `apps/client`; use `@tailwindcss/vite` plugin or PostCSS — whichever is compatible with the chosen Vite version.
- `apps/server` TypeScript target: `ES2022`, module: `NodeNext`.
- No environment-specific config files yet — those come in issue 03.

## Out of Scope
- Socket.IO installation and wiring (issue 03).
- Any game logic or UI beyond a blank shell.
- Serving the client from the server (issue 03).
- `.env` handling or port configuration.
