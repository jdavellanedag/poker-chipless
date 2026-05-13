# Bug: Host stuck on lobby screen after all-but-one players fold

> **Branch:** `bugfix/fold-win-stuck-showdown`
> **Status:** fixed

## Description

After a hand ends because all-but-one players fold, the client renders the lobby screen instead of staying on the game screen. Clicking "Start Game" on that screen returns "Game has already started." The bug does not occur when a hand ends via calls/checks, because in that path the phase remains `active` and the game screen is shown with a working "New Hand" button.

## Root Cause

`fold()` in `apps/server/src/game.ts` — when `contesting.length === 1` (only one player still in the hand), it transitioned `phase` to `'showdown'` without awarding the pot or providing any path back to `active`. The client renders `LobbyScreen` for any `phase !== 'active'`, and that screen always shows a "Start Game" button. `startGame()` rejects with "Game has already started." for any `phase` other than `'lobby'`. There was no `host:declare-winner` handler implemented to resolve the showdown, so the game was permanently stuck.

## Fix

In `fold()`, when only one contesting player remains, the pot is now automatically awarded to that player, `pot` is reset to `0`, and `phase` stays `'active'`. This mirrors the existing behavior after a normal betting round (no phase change, host clicks "New Hand" to continue).

**Files changed:** `apps/server/src/game.ts`

## Tests

### Added
- `awards pot to last remaining player, keeps phase active, and allows newHand` — `apps/server/src/__tests__/game.test.ts` — verifies phase stays `active`, pot transfers to winner, and `newHand()` succeeds immediately after
- `awards pot to last remaining player in a 3-player hand when two fold` — `apps/server/src/__tests__/game.test.ts` — same assertions for the multi-player fold scenario

### Updated (were asserting wrong behavior)
- `transitions to showdown when only one player remains after a fold` — `apps/server/src/__tests__/game.test.ts` — replaced entirely; it was asserting `phase: 'showdown'` which was the broken behavior

## Affected Files
- `apps/server/src/game.ts` — `fold()`: auto-awards pot and stays `active` instead of transitioning to `showdown` when one player remains
- `apps/server/src/__tests__/game.test.ts` — replaced old wrong-behavior test with two new correct-behavior tests
