---
status: pending
---

# Extract Session Modules

> **Status:** `pending`

## Clarification
_No open questions._

## Context
Part of the domain-architecture-refactor feature (Phase 1, Server). Independent of Issue 01 — can be picked up simultaneously. Must be complete before Issue 03 (handler split) begins. See `.scratch/domain-architecture-refactor/PRD.md`.

## Goal
Break apart session-related concerns currently spread across `apps/server/src/session.ts` and `apps/server/src/index.ts` into four focused modules: `session/create.ts`, `session/join.ts`, `session/store.ts`, and `session/disconnect.ts`. `session.ts` is deleted at the end of this issue.

## Acceptance Criteria
- [ ] `apps/server/src/session/create.ts` exports `createSession` and `generateCode`
- [ ] `apps/server/src/session/join.ts` exports `joinSession`
- [ ] `apps/server/src/session/store.ts` owns the `SessionRecord` type, the module-level `Map<code, SessionRecord>` store, and all accessors (get, set, delete, list)
- [ ] `apps/server/src/session/disconnect.ts` owns the 10-second auto-fold timer logic and all disconnect/reconnect handling currently inline in `index.ts`
- [ ] `apps/server/src/session.ts` no longer exists
- [ ] `apps/server/src/__tests__/session/create.test.ts` contains tests previously in `session.test.ts` covering session creation and code generation
- [ ] `apps/server/src/__tests__/session/join.test.ts` contains tests covering session joining
- [ ] All Vitest unit tests pass (`npm run test` from `apps/server`)
- [ ] TypeScript compiles with zero errors (`npm run build` from repo root)
- [ ] All 11 Playwright e2e specs pass (`npm run test:e2e` from repo root)

## Technical Notes
- The `Map<code, SessionRecord>` is module-level singleton state in `session/store.ts` — same pattern as the current map in `index.ts`. No dependency injection.
- `index.ts` currently imports from `./session` and holds the store + disconnect timer inline — update those imports and remove the inlined logic. `index.ts` itself is not fully restructured in this issue (that is Issue 03).
- `session/disconnect.ts` needs access to the store (to look up sessions) and the Socket.IO server instance (to broadcast auto-fold). Import from `session/store.ts`; receive the `io` instance as a parameter in the disconnect handler function rather than as module-level state.
- No barrel `index.ts` inside `session/` — consumers import directly from the specific file.

## Out of Scope
- Splitting `game.ts` (Issue 01).
- Splitting `index.ts` handlers (Issue 03).
- Any client changes.
