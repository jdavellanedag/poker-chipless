---
status: in-progress
---

# Host Round Advancement & Showdown

> **Status:** `in-progress`

## Clarification
_No open questions._

## Context
Eighth issue, completes M2 — Game Engine. Builds on all player actions (06, 07). Gives the host control over pacing: advancing betting rounds and declaring the winner at showdown.

## Goal
Host advances the game through pre-flop → flop → turn → river → showdown, then declares a winner. Server transfers the pot to the winner's stack, resets per-round state, and prepares for the next hand.

## Acceptance Criteria
- [ ] Host can click "Advance Round" at any time; server transitions `GameState.round` through: `preflop` → `flop` → `turn` → `river` → `showdown`.
- [ ] On round advance: `GameState.currentBet` resets to 0, all `player.currentBet` reset to 0, `lastRaiseSize` resets to `bigBlind`, `hasActedThisRound` resets for all active players, active player index is set to the first non-folded non-eliminated player clockwise of the button.
- [ ] A log entry is appended on each round advance: e.g. `"--- Flop ---"`.
- [ ] At `showdown`, "Advance Round" is replaced by "Declare Winner" — host selects a player from a list and clicks confirm.
- [ ] On winner declaration: the full pot is transferred to the winner's `chipCount`; pot resets to 0; a log entry is appended: `"Alice wins pot of 1200"`.
- [ ] After winner declaration, the host sees a "New Hand" button. Clicking it triggers issue 05 logic (button advance, blind post, turn init).
- [ ] If only one player remains (all others folded mid-hand), the server auto-transitions to `showdown` phase and prompts the host to declare the winner — no round advancement needed.
- [ ] A player whose `chipCount` is 0 at the end of a hand (after pot distribution) is marked `isEliminated: true` and excluded from future hands.
- [ ] `game:state` is broadcast after each host action.

## Technical Notes
- `GameState.round` type: `'preflop' | 'flop' | 'turn' | 'river' | 'showdown'` — add to `packages/types`.
- `host:advance-round` and `host:declare-winner` events are rejected if the sender is not the host.
- `host:declare-winner` payload: `{ playerId: string }`. Server validates the player is still active (not eliminated, not folded... actually folded players can win if everyone else folds — validate they are in the current hand).
- Post-hand elimination check: after pot transfer, any player with `chipCount === 0` who has no pending re-buy becomes `isEliminated: true`.
- "New Hand" should also check if fewer than 2 non-eliminated players remain and, if so, broadcast a `game:state` with `phase: 'ended'` instead of starting a new hand.

## Out of Scope
- Automatic hand evaluation or winner detection.
- Side-pot management.
- Re-buy mechanics (issue 12).
