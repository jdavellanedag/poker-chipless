---
status: done
---

# Reconnection & Disconnect Handling

> **Status:** `done`

## Clarification
_No open questions._

## Context
Eleventh issue, M4 — Resilience. Builds on session creation (03) and the game engine (05–08). Ensures accidental browser reloads and network hiccups don't break an ongoing game for anyone.

## Goal
Any player (including the host) who reloads their browser or briefly loses connection is seamlessly restored to their seat. A disconnected non-host player is auto-folded on their turn; a disconnected host freezes the game until they return.

## Acceptance Criteria
- [x] On initial join, server returns a UUID reconnection token in the `session:join` acknowledgement; client stores it in `sessionStorage`.
- [x] On page reload, client reads the token from `sessionStorage` and sends it with the `session:join` event; server recognises it and restores the player's seat instead of creating a new one.
- [x] Reconnected player immediately receives the full current `game:state` broadcast.
- [x] If a non-host player disconnects mid-hand and it becomes their turn, the server waits 10 seconds then auto-folds them and advances the turn. Log: `"Alice auto-folded (disconnected)"`.
- [x] If a non-host player disconnects during someone else's turn, the game continues uninterrupted; the disconnected player is marked `isConnected: false` on `GameState`.
- [x] If the host disconnects, `GameState.phase` transitions to `'paused'`; all player action buttons are disabled; a "Waiting for host to reconnect…" banner is shown to all players.
- [x] When the host reconnects, `GameState.phase` returns to its previous value (`'active'` or `'showdown'`); the banner is removed.
- [x] A player whose token is not found (e.g. joined on a different device) is treated as a new join attempt and rejected if the game has already started.

## Technical Notes
- Reconnection token: a `crypto.randomUUID()` generated server-side on first join, stored in `Map<token, playerId>` on the server alongside the session.
- `Player.isConnected` is updated on Socket.IO `connect` / `disconnect` events and included in every `game:state` broadcast so clients can show a visual indicator for disconnected players.
- The 10-second auto-fold timer: use `setTimeout` on the server. Cancel it immediately if the player reconnects before it fires. Store the timer handle on the player object (not in `GameState` — it's runtime state, not serialisable game state).
- Host reconnection detection: server tracks which socket ID belongs to the host. On any `session:join` with the host's token, restore `isHost: true` and un-pause.
- Session state survives host disconnect entirely in memory — no disk writes needed.

## Out of Scope
- Host promotion to another player (deferred to v2).
- Persistent session state across server restarts.
