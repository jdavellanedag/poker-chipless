---
status: done
---

# Handler Integration Tests

> **Status:** `done`

## Clarification
_No open questions._

## Context
Part of the domain-architecture-refactor feature (Phase 1, Server). Requires Issue 03 to be done first — the handler files under test (`handlers/session.ts`, `handlers/game.ts`, `handlers/host.ts`) must already exist. See `.scratch/domain-architecture-refactor/PRD.md`.

Issue 03 split all Socket.IO event handlers out of `index.ts` into three handler files. The only existing test for those files is `__tests__/handlers/structure.test.ts`, which checks file size and that register functions are exported — no behavioral coverage. This issue closes that gap by adding an integration test layer that wires up a real Socket.IO server and connects typed `socket.io-client` instances to exercise each handler end-to-end.

## Goal
Add an integration test suite for all three handler modules. Tests spin up a real HTTP + Socket.IO server on an ephemeral port, connect typed clients, fire events, and assert on acks and `game:state` broadcasts — covering the wiring path that pure-function unit tests cannot reach.

## Acceptance Criteria

### Infrastructure
- [ ] `socket.io-client` is added as a `devDependency` in `apps/server/package.json`
- [ ] `apps/server/src/__tests__/helpers/server.ts` exports `startServer()`, `stopServer()`, and a typed `createClient()` factory; the server registers all three handler modules and listens on port `0`
- [ ] `apps/server/src/session/store.ts` exports a `clearStore()` function that empties the session map; used by `beforeEach` in integration tests to prevent state bleed between tests

### Session handler tests (`__tests__/handlers/session.integration.test.ts`)
- [ ] `session:create` happy path: ack returns `{ ok: true, code, token, playerId }` and the server emits `game:state` with one lobby-phase player
- [ ] `session:create` with empty display name: ack returns `{ ok: false, error }` and no `game:state` is emitted
- [ ] `session:join` new player: a second client joins an existing session; both clients receive a `game:state` broadcast with two players
- [ ] `session:join` with valid reconnect token: a client that disconnects and reconnects with its token receives `{ ok: true }` and `game:state` reflects `isConnected: true` for that player
- [ ] `session:join` with unknown session code: ack returns `{ ok: false, error }`

### Game handler tests (`__tests__/handlers/game.integration.test.ts`)
- [ ] `action:fold` happy path: active player folds; ack returns `{ ok: true }` and `game:state` reflects `isFolded: true`
- [ ] `action:check` happy path: active player checks; ack returns `{ ok: true }` and `game:state` reflects `hasActedThisRound: true`
- [ ] `action:call` happy path: player calls the big blind; ack returns `{ ok: true }` and pot increases
- [ ] `action:bet` happy path: player bets a valid amount; ack returns `{ ok: true }` and `currentBet` is updated
- [ ] `action:raise` happy path: player raises; ack returns `{ ok: true }` and `currentBet` is updated
- [ ] `action:allin` happy path: player goes all-in; ack returns `{ ok: true }` and `isAllIn: true`
- [ ] Any action sent without a valid session on the socket returns `{ ok: false, error: 'Session not found.' }`

### Host handler tests (`__tests__/handlers/host.integration.test.ts`)
- [ ] `host:start-game` happy path: host starts the game; ack returns `{ ok: true }` and `game:state` phase is `active`
- [ ] `host:new-hand` happy path: host starts a new hand; ack returns `{ ok: true }` and `game:state` round is `preflop`
- [ ] `host:advance-round` happy path: host advances from preflop; ack returns `{ ok: true }` and `game:state` round advances
- [ ] `host:declare-winner` happy path: host declares a winner; ack returns `{ ok: true }` and winner's chip count increases by the pot
- [ ] `host:rebuy` happy path: host adds chips to a player; ack returns `{ ok: true }` and `chipCount` increases
- [ ] `host:pause` and `host:resume`: phase transitions to `paused` then back to `active`
- [ ] `host:end-session`: ack returns `{ ok: true }` and `game:state` phase is `ended`
- [ ] Any `host:*` event sent by a non-host player returns `{ ok: false, error }` (checked with one representative event)

### General
- [ ] All Vitest unit tests pass (`npm run test` from `apps/server`)
- [ ] TypeScript compiles with zero errors (`npm run build` from repo root)
- [ ] All 11 Playwright e2e specs pass (`npm run test:e2e` from repo root)

## Technical Notes
- Use `http.createServer()` + `new Server(httpServer)` in the test helper; call `httpServer.listen(0)` and resolve the port via `(httpServer.address() as AddressInfo).port`. This avoids port conflicts across test runs.
- `createClient()` in the helper returns a `Socket<ServerToClientEvents, ClientToServerEvents>` from `socket.io-client`. Each test that needs a connected client calls `createClient()` and disconnects it in `afterEach`.
- Game and host action tests require a started game. Build a shared `setupStartedGame()` helper inside each test file (or the server helper) that: creates a session, adds 2–3 players, and calls `host:start-game`. This avoids repeating boilerplate across every test case.
- `clearStore()` must be called in `beforeEach`, not `afterEach`, so that a failing test doesn't leave state that corrupts the next run even when cleanup is skipped.
- The `disconnect` event on the socket triggers a 10-second auto-fold timer in `session/disconnect.ts`. In integration tests, use `socket.disconnect()` followed by an immediate reconnect or simply avoid scenarios that trigger the timer. Do not fake timers unless the auto-fold behavior itself is under test.
- No mocking of game logic — tests go through the full stack (handler → pure function → store). This is intentional: these tests guard against handler wiring regressions, not game logic regressions.

## Out of Scope
- Testing the 10-second auto-fold disconnect timer.
- `host:reorder-players` handler (mechanical, follows same pattern — add later if desired).
- Any client changes.
- E2E test additions.
