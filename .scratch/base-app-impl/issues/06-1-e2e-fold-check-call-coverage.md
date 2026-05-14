---
status: done
---

# E2E Coverage — Fold / Check / Call + Call Auto All-In Unit Test

> **Status:** `done`

## Clarification
_No open questions._

## Context
Addendum to issue 06 — the fold, check, and call actions were implemented and unit-tested in issue 06, but no e2e tests were written for actual in-game action flows. Additionally, the auto all-in edge case on `call()` (stack < call amount) is missing a unit test. This issue adds those missing tests before the codebase moves on to bet/raise/all-in (issue 07).

## Goal
Close the test gap for the three basic player actions by adding e2e tests that exercise them through the full client-server-UI stack, and add the missing unit test for the call auto all-in conversion.

## Acceptance Criteria

### E2E Tests (apps/e2e/tests/player-actions.spec.ts or a new spec)
- [ ] **Fold during a hand:** Two players start a game, the active player folds. Assert: pot is awarded to the remaining player, action buttons disappear for both players, and no player is stuck in an active-player state.
- [ ] **Check during a hand:** Host starts game, BB checks preflop (no open bet scenario where both blinds match). Assert: `roundComplete` is reflected in the UI — the host sees a button to advance the round, and no action buttons remain for the checking player.
- [ ] **Call during a hand:** SB calls the BB preflop. Assert: both players' chip counts update correctly in the UI, the pot reflects the total contribution, and the turn advances to the next player (or round completes if applicable).

### Unit Test (apps/server/src/__tests__/game.test.ts)
- [ ] **Call auto all-in conversion:** A player whose `chipCount` is less than the call amount calls. Assert: `player.isAllIn` is `true`, `player.chipCount` is `0`, pot increases by the player's entire remaining stack (not the full call amount), and `player.currentBet` reflects the actual contribution.

## Technical Notes
- E2E tests should use the existing `createAndStartGame` helper pattern (or equivalent setup) to reach the in-hand state before asserting actions.
- The call auto all-in unit test should be added to the existing `call` describe block in `game.test.ts` alongside the three existing call tests.
- All chip assertions must use integer values only.
- No implementation changes are required — only tests are added in this issue.

## Out of Scope
- Bet, raise, and all-in action e2e tests (issue 07).
- Reconnection e2e flow (separate gap, tracked independently).
- 3-player e2e scenarios (deferred until round advancement is implemented in issue 08).
