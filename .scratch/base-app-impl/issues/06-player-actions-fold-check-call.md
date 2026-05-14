---
status: done
---

# Player Actions — Fold / Check / Call

> **Status:** `done`

## Clarification
_No open questions._

## Context
Sixth issue, M2 — Game Engine. Builds on hand start (05). Delivers the three passive actions: fold, check, and call. These are the most common actions and establish the server-side action validation pattern that bet/raise/all-in (issue 07) will extend.

## Goal
Server validates and applies fold, check, and call actions in strict turn order and broadcasts the updated game state to all clients. The active player's action buttons are enabled only on their turn.

## Acceptance Criteria
- [ ] Only the active player can submit actions; the server rejects any action from a non-active player with an error acknowledgement.
- [ ] **Fold:** Active player is marked as folded, their `currentBet` is not returned, they are skipped for the rest of the hand. Log: `"Alice folds"`.
- [ ] **Check:** Only valid when `currentBet` equals the player's `currentBet` (no open bet). Server rejects check when a bet is open. Log: `"Alice checks"`.
- [ ] **Call:** Player's `chipCount` is reduced by `(GameState.currentBet - player.currentBet)`; pot increases by the same amount. Log: `"Alice calls 200"`.
- [ ] After each action, the turn advances to the next active (non-folded, non-eliminated) player clockwise.
- [ ] When all active players have matched the current bet (or folded), the betting round is considered complete — the server marks the round as ready to advance and notifies the host.
- [ ] If only one player remains (all others folded), the server marks the hand as ended and awaits the host's winner declaration.
- [ ] Client UI: action buttons (`fold`, `check`, `call`) are rendered for the active player only; all other players see a disabled/inactive state.
- [ ] Client UI: "Call X" button shows the exact amount the player must put in.
- [ ] `game:state` is broadcast after every action with updated chip counts, pot, active player index, and player states.

## Technical Notes
- All chip arithmetic is integer-only — no floats.
- Call amount = `GameState.currentBet - player.currentBet`. Never negative (guard against this server-side).
- Turn advancement: iterate clockwise from current active index, skip folded and eliminated players, wrap around.
- "Round complete" detection: all non-folded, non-eliminated players have `player.currentBet === GameState.currentBet` (or are all-in). Server sets a `roundComplete: true` flag on `GameState` and appends a log entry prompting the host to advance.
- Socket.IO acknowledgement callbacks should return `{ ok: true }` on success or `{ ok: false, error: string }` on rejection so the client can handle errors.

## Out of Scope
- Bet, raise, and all-in actions (issue 07).
- Round advancement and showdown (issue 08).
- All-in detection for call (issue 07 handles the all-in case explicitly).
