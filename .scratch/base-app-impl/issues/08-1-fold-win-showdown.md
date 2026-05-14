---
status: done
---

# Fold-Win Showdown Confirmation

> **Status:** `done`

## Clarification
_No open questions. Fully designed via interview after issue 08 review._

## Context
Follow-up to issue 08. When all players but one fold mid-hand, the current `fold()` function auto-awards the pot immediately (`phase` stays `'active'`, `pot` goes to 0). The design intent is that the host always explicitly confirms the winner before chips move — both for the controlled pause and to make the outcome visible to everyone at the table. This issue brings the fold-win path into alignment with the river showdown path so both are governed by `phase: 'showdown'`.

## Goal
When the last fold leaves one player standing, the server enters `phase: 'showdown'` with the pot intact. The host sees a simplified "Accept — Alice wins N" button (no dropdown needed — winner is unambiguous). Clicking it transfers the pot and returns to `phase: 'active'`, where the host can start the next hand.

## Acceptance Criteria
- [ ] When the last fold leaves one non-folded player, `fold()` sets `phase: 'showdown'`, `round: 'showdown'`, and leaves `pot` intact. The pot is **not** transferred on the fold itself.
- [ ] `advanceRound()` also sets `phase: 'showdown'` (in addition to `round: 'showdown'`) when transitioning from river to showdown. Both paths produce identical state: `phase: 'showdown'`, `round: 'showdown'`, `pot > 0`.
- [ ] `declareWinner()` guards on `phase === 'showdown'` (replacing the current `phase === 'active'` guard). Calling it outside of showdown phase returns an error.
- [ ] `GameScreen` renders for both `phase === 'active'` and `phase === 'showdown'`. Non-host players see the game screen with pot visible and no action buttons (already suppressed by `roundComplete: true`).
- [ ] `DeclareWinnerPanel` renders in two modes based on the number of eligible (non-eliminated, non-folded) players:
  - **One eligible player**: simplified "Accept — [Name] wins [pot]" button, no dropdown.
  - **Multiple eligible players**: existing dropdown + "Declare Winner" button (unchanged from issue 08).
- [ ] After the host clicks Accept/Declare Winner: pot transfers to winner, eliminated players marked (`chipCount === 0` → `isEliminated: true`), `phase` returns to `'active'`, host sees "New Hand" button.
- [ ] `host:new-hand` handler resets `phase` to `'active'` before calling `newHand()` so the `newHand()` guard (`phase !== 'active'`) is not tripped.
- [ ] Log entry on fold-win showdown entry: `"Alice wins [pot] (everyone else folded)"` — appended when `phase` transitions to `'showdown'`, not when the pot transfers.
- [ ] Existing unit tests for `fold()` (last-player-standing cases) updated to assert `phase: 'showdown'`, `round: 'showdown'`, `pot > 0`, and the log entry — instead of the old `pot: 0`, `phase: 'active'`.
- [ ] Existing E2E tests that fold a player and immediately assert `pot: 0` updated to include the Accept step before asserting the cleared pot.
- [ ] `game:state` is broadcast after the fold transitions to showdown and again after the host confirms.

## Technical Notes
- Changes are confined to: `apps/server/src/game.ts` (`fold`, `advanceRound`, `declareWinner`), `apps/server/src/index.ts` (`host:new-hand` handler), `apps/client/src/App.tsx` (`GameScreen` phase guard, `DeclareWinnerPanel` dual-mode).
- `DeclareWinnerPanel` one-eligible-player mode: render a single button, fire `onDeclareWinner(eligible[0].id)` on click. No `useState` needed for selection in this mode.
- The `roundComplete` flag will be `true` when `phase: 'showdown'` is entered via fold — `fold()` sets it alongside the phase change. This suppresses action buttons for all players without extra logic.
- Implementation order: server pure functions + unit tests → socket handler update → client UI → E2E test updates.

## Files to Touch
1. `apps/server/src/game.ts` — `fold()`, `advanceRound()`, `declareWinner()`
2. `apps/server/src/__tests__/game.test.ts` — update last-player-standing tests; add showdown-via-fold unit tests
3. `apps/server/src/index.ts` — `host:new-hand` handler: reset `phase → 'active'`
4. `apps/client/src/App.tsx` — `GameScreen` phase guard; `DeclareWinnerPanel` dual-mode
5. `apps/e2e/tests/player-actions.spec.ts` — add Accept step to fold-win tests
6. `apps/e2e/tests/hand-start.spec.ts` — add Accept step to tests that fold to clear the pot
7. `apps/e2e/tests/round-advancement.spec.ts` — verify `phase: 'showdown'` via fold-win path

## Out of Scope
- Any pause/resume logic.
- Re-buy mechanics.
- Changing the log message format for non-fold-win showdowns.
