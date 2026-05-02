---
status: pending
---

# Player Actions — Bet / Raise / All-In

> **Status:** `pending`

## Clarification
_No open questions._

## Context
Seventh issue, M2 — Game Engine. Builds on fold/check/call (06). Adds the aggressive actions and the all-in edge case. Completes the full set of player actions for Texas Hold'em.

## Goal
Server enforces minimum raise rules, applies bet and raise mutations correctly, and automatically handles all-in scenarios — including when a player cannot cover a call. All chip math stays integer-only.

## Acceptance Criteria
- [ ] **Bet:** Valid only when `GameState.currentBet === 0` (no open bet in this round). Minimum bet = big blind. `GameState.currentBet` is set to the bet amount; player's `chipCount` decreases; pot increases. Log: `"Alice bets 400"`.
- [ ] **Raise:** Valid only when `GameState.currentBet > 0`. Minimum raise = last raise size (or big blind if no raise yet this round). Total raise amount (not just the increment) must satisfy: `raiseTotal >= GameState.currentBet + minRaiseIncrement`. Server rejects raises below minimum. Log: `"Alice raises to 800"`.
- [ ] **All-In:** Always valid. Player puts all remaining chips into the pot regardless of current bet. `player.chipCount` becomes 0; player is marked `isAllIn: true`. Log: `"Alice goes all-in for 350"`.
- [ ] **Auto all-in on call:** If `player.chipCount <= (GameState.currentBet - player.currentBet)`, the player's valid actions are `['allin', 'fold']` only — call is replaced by all-in. If the player submits `action:call`, server automatically converts it to an all-in.
- [ ] Server tracks `lastRaiseSize` on `GameState` for the current round to enforce the minimum re-raise rule.
- [ ] After a raise, the betting round re-opens — players who already acted may act again (except all-in players).
- [ ] Client UI: bet/raise input accepts only positive integers; client enforces minimum raise before sending (server re-validates).
- [ ] Client UI: "All-In (X)" button shows the player's full stack amount.
- [ ] `game:state` broadcast after every action with all updated fields.

## Technical Notes
- `GameState` needs two additional fields: `lastRaiseSize: number` (reset to `bigBlind` at start of each round) and `isAllIn: boolean` on `Player`.
- Add `isAllIn` to `Player` in `packages/types` as part of this issue.
- Re-open betting round after a raise: reset `hasActedThisRound` flag for all non-folded, non-all-in players except the raiser. This flag is per-round, not persisted between rounds.
- An all-in player who is covered (bet > their all-in amount) creates an implicit side pot — host manages distribution at showdown manually. The app does not split the pot.
- Minimum raise increment: the *amount* of the raise above the previous bet, not the total. E.g. if current bet is 200 and last raise was 100, minimum raise total is 300 (raise by at least 100 more).
- Guard: server must ensure no `chipCount` ever goes below 0.

## Out of Scope
- Automatic side-pot calculation (deferred to v2).
- Round advancement (issue 08).
