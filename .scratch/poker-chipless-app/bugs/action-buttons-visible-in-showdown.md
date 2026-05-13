# Bug: Action buttons visible on player screen during showdown

> **Branch:** `bugfix/action-buttons-visible-in-showdown`
> **Status:** merged

## Description

After the river betting round completes and the host clicks "Advance Round" to enter showdown, the player who last acted (called or checked) sees their action buttons (Fold, Check, Call, Bet, Raise) reappear on their screen. The buttons were correctly hidden after their action but become visible again once showdown begins. The host screen may exhibit the same issue if the host is the active player. Happens every time the host advances from river to showdown.

## Root Cause

`withValidActions` in `apps/server/src/game.ts` did not check `state.phase === 'showdown'`. When `advanceRound` transitions river → showdown, it resets `hasActedThisRound: false` and `roundComplete: false` on all players before calling `detectRoundComplete`. Because all players have `hasActedThisRound: false`, `detectRoundComplete` finds `allActed = false` and returns without setting `roundComplete: true`. `withValidActions` then sees the active player as eligible and assigns them `['bet', 'check', 'fold', 'allin']`. The client rendered action buttons based on `isMyTurn && !state.roundComplete` without also checking `state.phase !== 'showdown'`, so the buttons appeared.

## Fix

Two-line fix:

1. **Server** (`apps/server/src/game.ts`, `withValidActions`): Added `state.phase === 'showdown'` to the condition that clears a player's `validActions`, so no player ever receives valid actions during showdown.

2. **Client** (`apps/client/src/App.tsx`): Added `state.phase !== 'showdown'` to the action button render guard (`isMyTurn && !state.roundComplete && state.phase !== 'showdown'`) as a defensive layer.

## Tests

### Added
- `all players have empty validActions after river → showdown via advanceRound` — `apps/server/src/__tests__/game.test.ts` — asserts all players have empty validActions after a direct advanceRound call
- `all players have empty validActions after last player checks on the river and host advances to showdown` — `apps/server/src/__tests__/game.test.ts` — reproduces the exact user-reported check scenario
- `all players have empty validActions after last player calls on the river and host advances to showdown` — `apps/server/src/__tests__/game.test.ts` — reproduces the call variant
- `all players have empty validActions in fold-win showdown` — `apps/server/src/__tests__/game.test.ts` — confirms fold-win path was already correct and remains so

### Updated (were asserting wrong behavior)
None

## Affected Files
- `apps/server/src/game.ts` — `withValidActions`: added `state.phase === 'showdown'` guard to prevent assigning valid actions during showdown
- `apps/client/src/App.tsx` — action button render condition: added `state.phase !== 'showdown'` guard
