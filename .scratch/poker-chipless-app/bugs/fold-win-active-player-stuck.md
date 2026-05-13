# Bug: Folding player sees action buttons after fold-win

> **Branch:** `bugfix/fold-win-active-player-stuck`
> **Status:** merged

## Description

When all players fold except one (fold-win), the player who cast the final fold still saw action buttons on their screen. The pot would visually drop to 0 (correctly awarded to the winner) but the game never signalled that the hand was over. Reproduced in two cases: (1) everyone folds until the small blind, and the SB also folds; (2) one player calls, then everyone folds until the big blind, and the BB also folds.

## Root Cause

`fold()` in `apps/server/src/game.ts` — the early-return path when `contesting.length === 1` returned without setting `roundComplete: true` or updating `activePlayerIndex`. The index remained pointing to the player who just folded. The client renders action buttons when `isMyTurn && !state.roundComplete`, so that player's screen kept showing Fold/Call buttons even though the hand was over.

## Fix

In the fold-win early-return path, set `roundComplete: true` and update `activePlayerIndex` to point to the winner. This suppresses action buttons for all players and is consistent with how a normal completed betting round is signalled.

**Files changed:** `apps/server/src/game.ts`, `apps/server/src/__tests__/game.test.ts`

## Tests

### Added
- `sets roundComplete when SB folds last in a 3-player hand` — `apps/server/src/__tests__/game.test.ts` — asserts `roundComplete: true` and that `activePlayerIndex` no longer points to the folding SB
- `sets roundComplete when BB folds last after a caller folds others out` — `apps/server/src/__tests__/game.test.ts` — same assertions for the caller+BB-folds case

### Updated (were asserting wrong behavior)
None

## Affected Files
- `apps/server/src/game.ts` — `fold()`: set `roundComplete: true` and `activePlayerIndex = winnerIndex` in the fold-win path
- `apps/server/src/__tests__/game.test.ts` — two new reproduction tests
