---
status: pending
---

# Split Handlers and Slim index.ts

> **Status:** `pending`

## Clarification
_No open questions._

## Context
Part of the domain-architecture-refactor feature (Phase 1, Server). Requires Issues 01 and 02 to be done first — this issue imports from the new `game/` and `session/` domain files. See `.scratch/domain-architecture-refactor/PRD.md`.

## Goal
Extract all Socket.IO event handlers out of `index.ts` into three handler files (`handlers/session.ts`, `handlers/game.ts`, `handlers/host.ts`), leaving `index.ts` as a pure HTTP + Socket.IO bootstrap that only creates the server, mounts static files, and calls each handler module to register its events.

## Acceptance Criteria
- [ ] `apps/server/src/handlers/session.ts` registers `session:create` and `session:join` handlers
- [ ] `apps/server/src/handlers/game.ts` registers `action:fold`, `action:check`, `action:call`, `action:bet`, `action:raise`, and `action:allin` handlers
- [ ] `apps/server/src/handlers/host.ts` registers all `host:*` handlers (`host:start-game`, `host:new-hand`, `host:advance-round`, `host:declare-winner`, `host:rebuy`, `host:pause`, `host:resume`, `host:reorder-players`, `host:end-session`)
- [ ] `apps/server/src/index.ts` contains only: HTTP server creation, Socket.IO server instantiation, static file serving, and calls to register each handler module — no inline event handlers, no session store, no timer logic
- [ ] `apps/server/src/index.ts` is under 60 lines
- [ ] All Vitest unit tests pass (`npm run test` from `apps/server`)
- [ ] TypeScript compiles with zero errors (`npm run build` from repo root)
- [ ] All 11 Playwright e2e specs pass (`npm run test:e2e` from repo root)

## Technical Notes
- Each handler file receives the `io` (Socket.IO server) and `socket` instances as parameters — register them via a function like `registerSessionHandlers(io, socket)` called from the `io.on('connection', ...)` callback in `index.ts`.
- Handlers import game logic from `../game/player-actions`, `../game/host-actions`, `../game/round`, `../game/state` and session logic from `../session/store`, `../session/create`, `../session/join`, `../session/disconnect`.
- The `disconnect` event handler currently in `index.ts` moves to `handlers/session.ts` (or stays in `session/disconnect.ts` and is called from there) — whichever keeps the socket wiring cleanest.
- No new abstractions — handler files are thin wiring code that call the existing pure functions and broadcast `game:state`.

## Out of Scope
- Any client changes.
- Adding new events or changing existing event names/payloads.
