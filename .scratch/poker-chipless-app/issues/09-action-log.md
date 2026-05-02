---
status: pending
---

# Action Log

> **Status:** `pending`

## Clarification
_No open questions._

## Context
Ninth issue, spans M2 and M3. Builds on the game engine (05–08). The log entries themselves are produced by the game engine issues; this issue wires up the server-side append mechanism and delivers the client-side live log panel.

## Goal
Server appends a timestamped entry to the session action log for every game event. All connected clients display a live-updating log panel that auto-scrolls to the latest entry.

## Acceptance Criteria
- [ ] Server appends a `LogEntry` (timestamp + message) to `GameState.log` for every event: join, leave, blind post, bet, raise, call, fold, check, all-in, pot award, re-buy, round advance, pause, resume, game start, game end.
- [ ] `game:state` broadcast includes the full `log` array so all clients stay in sync on reconnect.
- [ ] Client renders the log as a scrollable list, newest entries at the bottom, auto-scrolling on new entries.
- [ ] Timestamps are displayed in a human-readable relative format (e.g. "just now", "2m ago") or as `HH:MM:SS` — pick one and apply consistently.
- [ ] Log panel is visible on both the player screen and the host overlay panel.
- [ ] Log entries use clear, natural language: `"Alice bets 400"`, `"Bob raises to 800"`, `"Carol folds"`, `"Dave calls 800"`, `"Eve goes all-in for 350"`, `"Frank wins pot of 2400"`, `"--- Flop ---"`, `"Game paused by host"`.

## Technical Notes
- `LogEntry` is already defined in `packages/types` (issue 02). This issue implements the server-side `appendLog(state, message)` helper and calls it from every action handler.
- The log lives entirely in memory as part of `GameState.log: LogEntry[]` — no separate event stream or database.
- On the client, render the log in a fixed-height scrollable `div`. Use a `useEffect` with a ref to auto-scroll to bottom when new entries arrive.
- Keep the log append as a pure function `(state: GameState, message: string) => GameState` for easy testing.

## Out of Scope
- Log persistence after session ends.
- Log export or download.
- Filtering or searching the log.
