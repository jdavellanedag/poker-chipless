---
status: in-progress
---

# Session Creation & Join Flow

> **Status:** `in-progress`

## Clarification
_No open questions._

## Context
Third issue, builds on the scaffold (01) and shared types (02). Delivers the first end-to-end vertical slice: a host can start the server, open the app, create a session, and a player on another device can join using the session code. Corresponds to M1 — Core Infrastructure.

## Goal
Server generates a 6-char session code on creation, serves the compiled React client as static files, and prints the local IP on startup. Players navigate to the host's IP in their browser, enter the code and a display name, and land in the waiting lobby.

## Acceptance Criteria
- [ ] `npm run start` (or `npm run dev` in dev mode) starts the server and prints: `Serving on http://<local-ip>:3000` to the terminal.
- [ ] Host opens `http://localhost:3000`, sees a "Create Game" screen, clicks create, and receives a 6-char session code (uppercase, no ambiguous chars: no 0, O, 1, I).
- [ ] Server serves the compiled `apps/client` build as static files from the same port (3000).
- [ ] A player on another device navigates to `http://<host-ip>:3000`, enters the session code and a display name, and connects to the session.
- [ ] The host's screen shows the player's display name appear in the lobby in real time.
- [ ] Joining with an invalid or unknown session code shows a clear error message on the client.
- [ ] Joining with an empty display name is rejected with a validation message.
- [ ] The host is automatically identified as such (first to create the session); `player.isHost` is `true` for the host and `false` for all others.
- [ ] Each joining player is issued a UUID reconnection token returned in the `session:join` acknowledgement and stored in `sessionStorage`.

## Technical Notes
- Session code generation: 6 chars from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (removes ambiguous chars).
- Session code collision: accepted risk for v1. Add a one-line note to the README: "Two simultaneous game creations could theoretically generate the same code; restart the server to generate a new one."
- Server binds on `0.0.0.0` so it's reachable on the LAN. Use Node's `os.networkInterfaces()` to find and print the first non-loopback IPv4 address on startup.
- Network discovery: no mDNS or auto-discovery. Host reads IP from terminal output and shares it verbally or via a message.
- In `dev` mode, Vite proxy config should forward `/socket.io` requests from `:5173` to `:3000` so the client dev server and Socket.IO server can run side-by-side without CORS issues.
- In `production` mode (`npm run build && npm run start`), server uses `express.static` (or equivalent) to serve the client build output directory.
- Session state is a plain in-memory `Map<sessionCode, GameState>` on the server — no database.

## Out of Scope
- Lobby player reordering and game configuration (issue 04).
- Any game logic beyond joining the lobby.
- Authentication or accounts.
