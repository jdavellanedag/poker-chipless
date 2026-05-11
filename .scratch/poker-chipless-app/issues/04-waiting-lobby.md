---
status: in-progress
---

# Waiting Lobby

> **Status:** `in-progress`

## Clarification
_No open questions._

## Context
Fourth issue, builds on session creation and join flow (03). Completes M1 — Core Infrastructure. Once all players are in and the host has configured the game, clicking "Start Game" transitions everyone to the active game screen simultaneously.

## Goal
Host sees all connected players, can reorder them to set seating/turn order, configure starting stack and blinds, and start the game. All clients transition from lobby to game view at the same moment.

## Acceptance Criteria
- [ ] The lobby screen displays all connected players in join order with their display names.
- [ ] The host can reorder players using up/down controls (or drag-and-drop); order updates in real time for all clients.
- [ ] The host can set starting chip stack (positive integer, same for all players).
- [ ] The host can set small blind and big blind amounts (positive integers; big blind must be ≥ small blind — validated server-side).
- [ ] The host sees a "Start Game" button; non-host players see a "Waiting for host to start…" message.
- [ ] "Start Game" is disabled if fewer than 2 players are in the lobby.
- [ ] Clicking "Start Game" triggers a `game:state` broadcast with `phase: 'active'`; all connected clients navigate to the game screen simultaneously.
- [ ] Each player's `chipCount` is set to the configured starting stack when the game starts.
- [ ] A player who joins after "Start Game" has been clicked receives an error and cannot join.

## Technical Notes
- Player order in the lobby determines the seating order for the entire session — this is the source of truth for turn rotation and button advancement.
- `host:reorder-players` event payload: `{ orderedPlayerIds: string[] }` — server revalidates that the array contains the same player IDs before applying.
- `host:start-game` payload: `{ startingStack: number, smallBlind: number, bigBlind: number }` — all integers, server validates > 0 and bigBlind >= smallBlind.
- Zustand manages the lobby form state (stack input, blind inputs) locally; the host only commits values to the server on "Start Game".
- Non-host clients should display the current player order as it updates so everyone can see the seating arrangement.

## Out of Scope
- Game flow, blinds posting, or action buttons (issues 05–08).
- Mid-game player removal or adding players after game starts.
