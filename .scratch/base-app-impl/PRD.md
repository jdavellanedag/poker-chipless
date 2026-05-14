# PRD: Poker Chipless App

## Status
Approved

## Problem Statement
Groups of friends playing casual home poker games must manage physical chips — buying sets, counting stacks, tracking bets, moving the dealer button, and resolving disputes about pot amounts. This is slow, error-prone, and requires someone to act as a dedicated dealer. The Poker Chipless App eliminates all physical chip management by replacing it with a real-time digital system each player runs on their own device, hosted locally by one player (the host).

## Goals
- A group of 2+ players can start a full Texas Hold'em session in under 2 minutes from first launch.
- Every chip movement (bet, call, raise, fold, blind post) is reflected on all connected devices within 1 second on a local network.
- The host can manage an entire game session — blinds, button, pot, re-buys, pausing — without leaving their combined player/host view.
- The app survives accidental browser reloads without losing session state.

## Non-Goals
- No user accounts, authentication, or persistent profiles.
- No hand evaluation or automatic winner detection (host declares winner manually).
- No chat or in-app messaging.
- No per-player sit-out (host pause only in v1).
- No tournament blind scheduling (fixed blinds only in v1).
- No side-pot auto-calculation (host manages pot distribution at showdown).
- No internet/cloud multiplayer in v1.
- No mobile app packaging in v1 (Capacitor integration deferred).
- No post-session data persistence (session history is discarded when host ends the game).

## Background & Context
- The app is designed for in-person casual home games where all players are on the same WiFi network.
- The architecture must be designed from day one for cloud migration in v2 (server abstraction, no LAN-specific code outside of discovery/connection layer).
- The host is assumed to be the most technically comfortable player and will start the server via a terminal command.
- All chip math must use integers only to avoid floating-point precision bugs.
- The session join flow uses a short human-readable code generated when the host creates a game, avoiding the need for players to know the host's IP address.

## User Stories

**Host:**
- As a host, I want to start a server with a single terminal command so that I can set up a game without technical friction.
- As a host, I want to create a game session that generates a join code so that other players can connect easily.
- As a host, I want to set starting chip stacks and fixed blind amounts in a lobby so that the game is configured before play begins.
- As a host, I want to reorder players in the lobby so that seating and turn order are correct.
- As a host, I want to start the game once all players have joined so that no one joins mid-configuration.
- As a host, I want to advance the betting round (pre-flop → flop → turn → river → showdown) so that I control the game pace.
- As a host, I want to declare a pot winner and transfer chips to them so that hand resolution is fast.
- As a host, I want to trigger a re-buy for any player so that eliminated players can return.
- As a host, I want to pause the game so that the session can be interrupted (bathroom break, dispute) without everyone disconnecting.
- As a host, I want to see a live action log so that I can review what happened during a hand.
- As a host, I want my host controls overlaid on the same screen as my player view so that I don't need to switch between screens.

**Player:**
- As a player, I want to join a session by entering a code and a display name so that setup is instant.
- As a player, I want to see my chip count, current bet, the total pot, and all other players' stacks so that I have full table context.
- As a player, I want clear action buttons (fold / check / call / bet / raise / all-in) that are only active on my turn so that I cannot act out of turn.
- As a player, I want the app to prevent me from raising below the minimum so that I don't make illegal raises.
- As a player, I want the app to automatically go all-in if I can't cover the bet so that the rules are enforced correctly.
- As a player, I want my session state to survive a browser reload so that an accidental refresh doesn't knock me out.
- As a player, I want to see a live action log so that I can follow what happened without asking others.

## Functional Requirements

### Session Management
1. The server shall generate a unique, human-readable session code (e.g., 6 alphanumeric characters) when the host creates a game.
2. Players shall join a session by entering the session code and a display name; no account or password is required.
3. The host shall be able to reorder players in the lobby before the game starts.
4. The host shall set starting chip stack (integer, same for all players) and fixed small blind / big blind amounts before starting.
5. The host shall click "Start Game" to transition all connected clients from lobby to active game simultaneously.
6. The server shall persist full session state in memory so that any player (including the host) can reload their browser and rejoin without losing state.
7. Session state shall be discarded when the host explicitly ends the session; no data is written to disk.

### Game Flow
8. The dealer button shall advance automatically to the next eligible player at the start of each new hand.
9. The server shall automatically post small blind and big blind from the respective players' stacks at the start of each hand.
10. The server shall enforce strict turn order; only the active player's action buttons shall be enabled.
11. Valid actions per turn shall be computed server-side and sent to the client: fold is always valid; check is valid when no bet is open; call is valid when a bet/raise is open; raise/bet is valid when the player has chips above the minimum raise threshold; all-in is always valid.
12. The minimum raise amount shall equal the size of the last raise in the current round, or the big blind if no raise has occurred.
13. If a player's stack is less than or equal to the amount needed to call, their only valid actions shall be all-in or fold; the app shall automatically mark them all-in if they select call.
14. The host shall manually advance the betting round (pre-flop → flop → turn → river → showdown).
15. The host shall declare the winner at showdown; the server shall transfer the pot to that player's stack.
16. The host shall be able to pause the game at any time, freezing all player action buttons until the host resumes.
17. A player whose stack reaches zero and is not re-bought before the next hand begins shall be marked as eliminated and excluded from future hands.
18. The host shall be able to trigger a re-buy for any player at any time, adding a configurable chip amount to their stack.

### Re-connection & Disconnection
19. If a non-host player disconnects, the game shall continue; their turn shall be automatically folded if they remain disconnected when it is their turn.
20. If the host disconnects, all player action buttons shall be frozen and a "Waiting for host to reconnect" message shall be shown.
21. The host's session shall resume automatically upon reconnection with full game state restored.

### Action Log
22. The server shall append a timestamped entry to the session action log for every game event: join, leave, blind post, bet, raise, call, fold, check, all-in, pot award, re-buy, round advance, pause, resume.
23. All connected clients shall display the live action log, updated in real time.

### Player UI
24. Each player's screen shall display: their display name, chip count, current round bet, total pot, all other players' names and chip counts, whose turn it is, and (when it is their turn) their valid action buttons.
25. Raise and bet inputs shall accept only positive integers; the UI shall enforce the minimum raise rule client-side before sending to server (server re-validates).

### Host UI
26. The host screen shall display everything in requirement 24, plus an overlay panel containing: round advancement controls, winner declaration, re-buy trigger, pause/resume button, and the action log.

## Non-Functional Requirements

- **Latency:** Game state updates shall propagate to all clients within 1 second on a local WiFi network under normal conditions.
- **Correctness:** All chip arithmetic shall use integers only; no floating-point chip values anywhere in the codebase.
- **Reliability:** The server shall validate all incoming actions server-side regardless of client-side validation.
- **Scalability (v1):** The server shall support at least 10 concurrent players without performance degradation on a standard consumer laptop.
- **Portability:** The client shall be a standard web app with no browser-specific APIs that would block Capacitor wrapping in v2.
- **Maintainability:** All Socket.IO event names and payload shapes shall be defined in a shared TypeScript types package consumed by both client and server; no stringly-typed events.
- **Cloud-readiness:** The server shall use no LAN-specific discovery or binding code outside of a single configuration layer so that swapping local hosting for a cloud deployment requires only a config change.

## Technical Design Notes

### Monorepo Structure
```
poker-chipless/
├── packages/
│   └── types/          # Shared TypeScript types: events, game state, payloads
├── apps/
│   ├── client/         # React + Vite + TypeScript + Tailwind + Zustand
│   └── server/         # Node.js + TypeScript + Socket.IO
├── package.json        # Workspace root
└── turbo.json          # Or nx.json for monorepo task orchestration
```

### State Management
- **Server:** Single authoritative in-memory game state object per session. All mutations happen server-side; clients are read-only consumers.
- **Client (Zustand):** UI-only state (modal open/closed, input values, loading flags). Game state is received via Socket.IO and stored separately from Zustand — in a React context or a dedicated socket state store — to keep the separation clear.

### Socket.IO Event Model
- Server → Client: `game:state` (full state broadcast after every mutation), `game:log` (new log entry appended).
- Client → Server: `action:bet`, `action:call`, `action:raise`, `action:fold`, `action:check`, `action:allin`, `host:advance-round`, `host:declare-winner`, `host:rebuy`, `host:pause`, `host:resume`.
- Full state broadcast (not diffs) after every mutation — simpler to reason about at home-game scale.

### Session Code
- 6-character alphanumeric code (uppercase, no ambiguous chars like 0/O/1/I).
- Generated server-side on session creation.
- Used as the Socket.IO room name.

### Reconnection
- Each player is issued a UUID token on join, stored in `sessionStorage`. On reconnect, the client sends the token and the server restores their seat.

### Integer Chip Math
- All chip values stored and transmitted as plain integers (cents or chip units).
- No division except for ante splitting, which shall be resolved by host action.

## Out of Scope (Deferred to Later Phases)

- **v2:** Internet/cloud multiplayer (move server to hosted environment, update connection config).
- **v2:** Tournament blind escalation schedules.
- **v2:** Per-player sit-out.
- **v2:** Automatic side-pot calculation.
- **v2:** Hand history export or post-session summary.
- **v2:** Multiple poker variants (Omaha, Stud, etc.).
- **v2:** Capacitor mobile app packaging (iOS/Android).
- **v2:** In-app chat.
- **v2:** Host promotion on host disconnect.
- **v2:** Spectator mode.

## Open Questions

- **Session code collision:** If two hosts on the same network generate the same 6-char code simultaneously, sessions could mix. Acceptable risk for v1 given the tiny probability, but worth a note in the README.
- **Network discovery:** Players must manually enter the host's server URL (e.g., `http://192.168.1.x:3000`) plus the session code, or the server URL is baked in. Decision needed: should the client default to `localhost` for the host and require a configurable server URL for other players, or should there be a simple DNS/mDNS discovery step?
- **Monorepo tooling:** Turborepo vs. Nx vs. plain npm workspaces. No strong constraint either way; recommend Turborepo for its simplicity.

## Success Criteria

- A 6-player group can go from zero to first hand dealt in under 2 minutes.
- No chip count discrepancies observed across 10 consecutive hands in a test session.
- An accidental browser reload by any player (including host) does not interrupt the game for other players.
- The host pause/resume cycle works correctly and freezes/unfreezes all player UIs.
- A player going all-in is correctly handled with no negative chip values anywhere.

## Milestones

| Phase | Scope |
|-------|-------|
| M1 — Core Infrastructure | Monorepo setup, shared types package, Socket.IO server skeleton, React client shell, session creation and join flow, lobby with player ordering |
| M2 — Game Engine | Full hand flow (blinds → betting rounds → showdown), all player actions with server-side validation, button advancement, action log |
| M3 — Host Controls | Round advancement, winner declaration, re-buy, pause/resume, host overlay UI |
| M4 — Resilience | Reconnection via token, host disconnect pause, player disconnect auto-fold, session state persistence in memory |
| M5 — Polish | Tailwind UI polish, mobile-responsive layout, README with single-command setup, Capacitor readiness audit |
