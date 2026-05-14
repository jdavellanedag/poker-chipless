---
status: in-progress
---

# Split Game Logic Into Domain Files

> **Status:** `in-progress`

## Clarification
_No open questions._

## Context
Part of the domain-architecture-refactor feature (Phase 1, Server). This is the first server issue and is independent — it can be picked up without any other issue in progress. See `.scratch/domain-architecture-refactor/PRD.md`.

## Goal
Move all pure game functions out of the monolithic `apps/server/src/game.ts` into four focused domain files, and migrate unit tests to mirror the new structure. `game.ts` is deleted at the end of this issue.

## Acceptance Criteria
- [ ] `apps/server/src/game/player-actions.ts` exports `fold`, `check`, `call`, `bet`, `raise`, `allin`
- [ ] `apps/server/src/game/host-actions.ts` exports `startGame`, `newHand`, `declareWinner`, `rebuy`, `pause`, `resume`, `reorderPlayers`, `endGame`
- [ ] `apps/server/src/game/round.ts` exports `advanceRound`, `detectRoundComplete`
- [ ] `apps/server/src/game/state.ts` exports `withValidActions`, `appendLog`, and any shared helper utilities
- [ ] All function signatures are identical to those in the original `game.ts` — no changes to inputs or return types
- [ ] `apps/server/src/game.ts` no longer exists
- [ ] `apps/server/src/__tests__/game/player-actions.test.ts` contains tests previously in `game.test.ts` covering player actions
- [ ] `apps/server/src/__tests__/game/host-actions.test.ts` contains tests covering host actions
- [ ] `apps/server/src/__tests__/game/round.test.ts` contains tests covering round advancement
- [ ] All Vitest unit tests pass (`npm run test` from `apps/server`)
- [ ] TypeScript compiles with zero errors (`npm run build` from repo root)
- [ ] All 11 Playwright e2e specs pass (`npm run test:e2e` from repo root)

## Technical Notes
- `apps/server/src/index.ts` currently imports from `./game` — update those imports to point to the new domain files. `index.ts` itself is not restructured in this issue.
- Any helpers shared across domain files (e.g. small utilities used by both player and host actions) go in `game/state.ts`.
- No barrel `index.ts` inside `game/` — consumers import directly from the specific file.
- Keep the `__tests__/` directory flat for now; subdirectory `__tests__/game/` is introduced here and mirrors `game/`.

## Out of Scope
- Splitting `session.ts` or moving store/disconnect logic (Issue 02).
- Splitting `index.ts` handlers (Issue 03).
- Any client changes.
