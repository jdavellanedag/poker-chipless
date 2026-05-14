---
status: done
---

# Hand Start — Button & Blinds

> **Status:** `done`

## Clarification
_No open questions._

## Context
Fifth issue, first issue of M2 — Game Engine. Builds on the waiting lobby (04). Delivers the automated start-of-hand mechanics: button advancement, blind posting, and turn order initialization.

## Goal
When a new hand begins, the dealer button advances to the next eligible player, small and big blinds are automatically deducted from the appropriate players' stacks, and the turn is set to the player after the big blind (UTG). All clients receive the updated `game:state`.

## Acceptance Criteria
- [ ] On game start (first hand), the dealer button is placed on the first player in the seating order.
- [ ] On each subsequent hand, the button advances clockwise to the next non-eliminated player.
- [ ] Small blind is automatically deducted from the player immediately clockwise of the button; big blind from the next player clockwise.
- [ ] If the small blind player cannot cover the full small blind amount, they are treated as all-in for that amount.
- [ ] If the big blind player cannot cover the full big blind amount, they are treated as all-in for that amount.
- [ ] The active player after blinds are posted is the player clockwise of the big blind (UTG); in a 2-player game the button/small blind acts first post-flop but last pre-flop (heads-up rules).
- [ ] `game:state` broadcast after hand start includes: updated button index, updated chip counts, updated pot, current bet equal to big blind, and active player index.
- [ ] A log entry is appended for each blind posted: e.g. `"Alice posts small blind: 50"`.
- [ ] Eliminated players are skipped when advancing the button and assigning blinds.
- [ ] The host triggers "New Hand" explicitly — the server does not auto-start the next hand.

## Technical Notes
- Button advancement: iterate clockwise from current button index, skip eliminated players, wrap around.
- Blind posting is a server-side mutation — clients never compute or apply blind deductions.
- With only 2 active players: button = small blind, other player = big blind. Pre-flop action starts with the button (small blind). Post-flop action starts with the non-button player. Encode this as a special case in the turn-order logic.
- `currentBet` on `GameState` after blind posting = `bigBlind` amount.
- `Player.currentBet` tracks each player's contribution to the pot in the current round (used for call amount calculation).

## Out of Scope
- Player action handling (issues 06, 07).
- Round advancement beyond the start of the hand (issue 08).
- Ante posting.
