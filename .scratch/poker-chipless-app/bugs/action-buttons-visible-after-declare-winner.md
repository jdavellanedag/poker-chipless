# Bug: Action buttons visible on player screen after winner is declared at showdown

> **Branch:** `main` (fixed inline per user request)
> **Status:** merged

## Description

After the host declares the winner at showdown, the "New Hand" button correctly appears for the host. However, the next active player's action buttons (Fold, Check, Call, Bet, Raise) also become visible simultaneously. The host can click "New Hand" at the same time the player could submit an action, leading to unexpected behavior.

The bug only affects the normal showdown path (preflop → flop → turn → river → host advances to showdown → host declares winner). The fold-win path was not affected.

## Root Cause

`declareWinner` transitions `phase` from `'showdown'` back to `'active'` so the host can trigger a new hand. However, it did not set `roundComplete: true` in the resulting state. When `withValidActions` ran on this post-winner state it saw:
- `state.phase === 'showdown'` → `false` (phase is now `'active'`)
- `state.roundComplete` → `false` (was never set to `true` during the normal showdown path; `advanceRound` resets it to `false` when entering showdown)

Neither guard fired, so the active player received valid actions and the client rendered action buttons.

The fold-win path was unaffected because `fold()` explicitly sets `roundComplete: true` before entering showdown, and `declareWinner`'s spread (`{ ...state, ... }`) preserved that value.

## Fix

**Server** (`apps/server/src/game.ts`, `declareWinner`): Added `roundComplete: true` to the state object passed to `withValidActions`. This ensures `withValidActions` clears all valid actions regardless of phase, and the existing `!state.roundComplete` guard on the client's action button render condition hides the buttons.

## Tests

### Added
- `all players have empty validActions after declareWinner via normal showdown path` — `apps/server/src/__tests__/game.test.ts` — reproduces the exact scenario: advanceRound → showdown → declareWinner → assert all validActions empty
- `all players have empty validActions after declareWinner via fold-win showdown` — `apps/server/src/__tests__/game.test.ts` — confirms fold-win path remains correct after the fix
- `action buttons are hidden for all players after winner is declared at showdown` — `apps/e2e/tests/round-advancement.spec.ts` — E2E: declares winner, asserts action-buttons not visible on either page and new-hand-btn visible only to host

### Updated (were asserting wrong behavior)
None

## Affected Files
- `apps/server/src/game.ts` — `declareWinner`: added `roundComplete: true` to prevent valid actions being assigned after pot transfer
- `apps/server/src/__tests__/game.test.ts` — added 2 unit tests to `validActions during showdown` describe
- `apps/e2e/tests/round-advancement.spec.ts` — added 1 E2E test to `Declare Winner at showdown` describe
