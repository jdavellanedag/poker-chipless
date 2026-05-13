---
status: in-progress
---

# Player Elimination & Re-buy

> **Status:** `in-progress`

## Clarification
_No open questions._

## Context
Twelfth issue, M4 — Resilience. Builds on round advancement and showdown (08, 08-1) and the host overlay UI (10). Handles the end-of-stack lifecycle: a player hitting zero chips is eliminated, and the host can bring them back in with a re-buy.

**Already implemented in issue 08:**
- `isEliminated: true` marking after `declareWinner` for any player with `chipCount === 0`
- `phase: 'ended'` transition in `host:new-hand` handler when fewer than 2 non-eliminated players remain
- Game Over screen on the client

**Remaining in this issue:**
- Elimination log entry (`"Alice has been eliminated"`)
- "Eliminated" badge in the player list UI
- Re-buy mechanics (server handler + client UI in host overlay)
- Game Over log entry (`"Game over — Bob wins!"`)

## Goal
Add the missing elimination feedback (log + UI badge) and implement the full re-buy flow so the host can restore any player at any time.

## Acceptance Criteria
- [ ] After pot distribution at showdown, any player with `chipCount === 0` is marked `isEliminated: true`. _(marking already done; log entry is new)_ Log: `"Alice has been eliminated"`.
- [ ] Eliminated players are skipped in button advancement, blind assignment, and turn order. _(already enforced by existing `isEliminated` checks)_
- [ ] Eliminated players' action buttons are hidden; their entry in the player list shows an "Eliminated" badge. _(action suppression already done; badge UI is new)_
- [ ] If fewer than 2 non-eliminated players remain after a hand, the session transitions to `phase: 'ended'` and all clients show a "Game Over" screen. _(already implemented in issue 08)_ Log: `"Game over — Bob wins!"` _(log entry is new)_
- [ ] Host can trigger a re-buy for any player (active or eliminated) at any time via the host overlay panel.
- [ ] `host:rebuy` payload: `{ playerId: string, amount: number }` — amount must be a positive integer; server validates.
- [ ] On re-buy: `player.chipCount` increases by the re-buy amount; if the player was eliminated, `isEliminated` is set back to `false`; they re-enter the rotation from their original seat position.
- [ ] A re-bought player who was eliminated mid-hand does not participate in the current hand — they re-enter on the next hand.
- [ ] Log entry on re-buy: `"Alice re-buys for 1000 chips"`.
- [ ] `game:state` is broadcast immediately after any re-buy.

## Technical Notes
- Elimination check runs server-side after every `host:declare-winner` event, before broadcasting `game:state`. The `isEliminated` marking is already there — add the log entry alongside it.
- "Re-enters from original seat position" means their index in `GameState.players` array does not change — they are simply un-eliminated in place.
- Re-buy during an active hand: player's chips increase immediately (reflected in their stack display) but they do not join the current hand's action — `isEliminated` toggling mid-hand is safe since eliminated players are already excluded from turn advancement.
- The "Game Over" check (< 2 non-eliminated players → `phase: 'ended'`) already runs in the `host:new-hand` handler — add the log entry there.

## Out of Scope
- Configurable re-buy limits (max re-buys per player).
- Automatic re-buy prompts or timers.
