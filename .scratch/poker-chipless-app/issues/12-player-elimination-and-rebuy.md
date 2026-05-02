---
status: pending
---

# Player Elimination & Re-buy

> **Status:** `pending`

## Clarification
_No open questions._

## Context
Twelfth issue, M4 — Resilience. Builds on round advancement and showdown (08) and the host overlay UI (10). Handles the end-of-stack lifecycle: a player hitting zero chips is eliminated, and the host can bring them back in with a re-buy.

## Goal
Players at zero chips are automatically eliminated at hand end and skipped in future hands. The host can trigger a re-buy at any time to restore any player (including eliminated ones) to active status with a specified chip amount.

## Acceptance Criteria
- [ ] After pot distribution at showdown, any player with `chipCount === 0` is marked `isEliminated: true`. Log: `"Alice has been eliminated"`.
- [ ] Eliminated players are skipped in button advancement, blind assignment, and turn order.
- [ ] Eliminated players' action buttons are hidden; their entry in the player list shows an "Eliminated" badge.
- [ ] If fewer than 2 non-eliminated players remain after a hand, the session transitions to `phase: 'ended'` and all clients show a "Game Over" screen. Log: `"Game over — Bob wins!"` (last player standing).
- [ ] Host can trigger a re-buy for any player (active or eliminated) at any time via the host overlay panel.
- [ ] `host:rebuy` payload: `{ playerId: string, amount: number }` — amount must be a positive integer; server validates.
- [ ] On re-buy: `player.chipCount` increases by the re-buy amount; if the player was eliminated, `isEliminated` is set back to `false`; they re-enter the rotation from their original seat position.
- [ ] A re-bought player who was eliminated mid-hand does not participate in the current hand — they re-enter on the next hand.
- [ ] Log entry on re-buy: `"Alice re-buys for 1000 chips"`.
- [ ] `game:state` is broadcast immediately after any re-buy.

## Technical Notes
- Elimination check runs server-side after every `host:declare-winner` event, before broadcasting `game:state`.
- "Re-enters from original seat position" means their index in `GameState.players` array does not change — they are simply un-eliminated in place.
- Re-buy during an active hand: player's chips increase immediately (reflected in their stack display) but they do not join the current hand's action — `isEliminated` toggling mid-hand is safe since eliminated players are already excluded from turn advancement.
- The "Game Over" check should happen after the elimination check: if `activePlayers.length < 2`, transition to ended.

## Out of Scope
- Configurable re-buy limits (max re-buys per player).
- Automatic re-buy prompts or timers.
