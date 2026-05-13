# Bug: Start Game Does Not Deal First Hand

> **Branch:** `bugfix/start-game-no-first-hand`
> **Status:** merged

## Description

After clicking "Start Game" in the lobby, the game screen appeared immediately with `pot = 0`, no dealer button placed, and action buttons (fold/check/call) visible to the player at seat 0 — before any hand had been dealt. The expected behavior is that clicking "Start Game" should automatically place the dealer button, post the small and big blinds, and set UTG as the active player. This bug occurred every time "Start Game" was clicked.

## Root Cause

`host:start-game` in `apps/server/src/index.ts` called `startGame()`, which transitions `phase` to `'active'` and assigns chip stacks, but it did not chain `newHand()` afterward. The resulting state had `dealerButtonIndex: -1` (the "no hand yet" sentinel) and `activePlayerIndex: 0` inherited from the lobby. The client received `phase === 'active'` and rendered `GameScreen` immediately, showing stale action buttons with a zero pot.

## Fix

In the `host:start-game` socket handler in `apps/server/src/index.ts`, `newHand(result.state)` is now called immediately after `startGame()` succeeds. The broadcast state is the result of `newHand`, so clients receive a fully initialized first hand — dealer button set, blinds posted, and UTG active — in the same event that transitions them out of the lobby.

## Tests

### Added
- `"Start Game immediately deals first hand — pot shows blinds without clicking New Hand"` — `apps/e2e/tests/hand-start.spec.ts` — asserts `pot = 30` on both clients immediately after clicking "Start Game", without any "New Hand" click

### Updated (were asserting wrong behavior)
- `"clicking New Hand posts blinds and both clients see updated chip counts"` — `apps/e2e/tests/hand-start.spec.ts` — renamed and rewritten; now verifies that (a) first-hand chip counts are visible right after "Start Game", and (b) clicking "New Hand" advances to the second hand with the button rotated
- `startHandWith2Players` helper — `apps/e2e/tests/player-actions.spec.ts` — removed the explicit "New Hand" click and instead waits for `pot = 30` directly after "Start Game"
- `"host starts game and all clients transition to active phase"` — `apps/e2e/tests/lobby.spec.ts` — replaced `getByText('1000')` sentinel (no longer visible after blinds are posted) with `getByTestId('pot')`
- `"joining after game starts shows an error"` — `apps/e2e/tests/lobby.spec.ts` — same `getByText('1000')` → `getByTestId('pot')` fix for the "wait for game to start" assertion

## Affected Files
- `apps/server/src/index.ts` — chained `newHand()` after `startGame()` in the `host:start-game` handler
- `apps/e2e/tests/hand-start.spec.ts` — added reproduction test; updated existing test to reflect correct two-hand sequence
- `apps/e2e/tests/player-actions.spec.ts` — removed manual "New Hand" click from `startHandWith2Players` helper
- `apps/e2e/tests/lobby.spec.ts` — fixed two "wait for game screen" assertions that relied on a `1000` chip count that is no longer present after auto-blind posting
