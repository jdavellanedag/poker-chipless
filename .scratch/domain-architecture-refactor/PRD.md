# PRD: Domain-Based Architecture Refactor

## Status
Approved

## Problem Statement
Both the server and client have grown into large single files that are hard to navigate and reason about. `apps/server/src/game.ts` is 536 lines, `apps/server/src/index.ts` is 374 lines, and `apps/client/src/App.tsx` is 897 lines. A developer making any change — adding a player action, tweaking a host control, fixing a UI bug — must read most of a file to find the relevant code and risks accidentally touching unrelated logic. This hurts velocity and increases the chance of regressions.

## Goals
- Any single feature change or bug fix touches at most 1–2 files.
- The full Playwright e2e suite passes green after every refactor issue.
- The full Vitest unit test suite passes green after every refactor issue.
- Unit test files live alongside their source files after the migration.

## Non-Goals
- No change to function signatures, calling conventions, or external behavior.
- No migration from pure functions to classes or services.
- No changes to `packages/types` — it stays as a flat single `index.ts`.
- No new features or bug fixes bundled with this refactor.
- No changes to the Socket.IO event names or payload shapes.
- No changes to the Playwright e2e test files themselves (they are the safety net, not the subject).

## Background & Context
The project is a real-time chipless poker manager. The server is the single source of truth; all game state mutations are pure functions in `game.ts`; clients are read-only consumers that render `GameState` from the server. The existing architecture is sound — the refactor is purely a file-splitting exercise to improve navigability, not a re-architecture.

The e2e suite (11 Playwright specs) exercises the full stack through a real browser and is the authoritative correctness signal. Vitest unit tests cover the server game logic and are the fast inner feedback loop. Both must stay green throughout.

## User Stories
- As a developer adding a new player action, I want to open one file (`game/player-actions.ts`) and add my function without scrolling past unrelated host and round logic.
- As a developer wiring a new Socket.IO handler, I want to open `handlers/game.ts` and add my handler without reading session or host handler code.
- As a developer fixing a UI bug in the HostPanel, I want to open `components/HostPanel.tsx` directly rather than scrolling through 897 lines of `App.tsx`.
- As a developer adding a new screen, I want to drop a file in `screens/` and import it in `App.tsx` without touching any other component.

## Functional Requirements

### Server
1. `apps/server/src/index.ts` shall contain only HTTP server setup, Socket.IO server instantiation, and handler registration — no game logic, no session store, no timer logic.
2. `apps/server/src/session/store.ts` shall own the `SessionRecord` type, the `Map<code, SessionRecord>` store, and all accessors (get, set, delete, list).
3. `apps/server/src/session/disconnect.ts` shall own the 10-second auto-fold timer and all disconnect/reconnect handling logic.
4. `apps/server/src/session/create.ts` shall export `createSession()` and `generateCode()`.
5. `apps/server/src/session/join.ts` shall export `joinSession()`.
6. `apps/server/src/handlers/session.ts` shall register the `session:create` and `session:join` Socket.IO handlers.
7. `apps/server/src/handlers/game.ts` shall register the `action:fold`, `action:check`, `action:call`, `action:bet`, `action:raise`, and `action:allin` Socket.IO handlers.
8. `apps/server/src/handlers/host.ts` shall register all `host:*` Socket.IO handlers.
9. `apps/server/src/game/player-actions.ts` shall export `fold()`, `check()`, `call()`, `bet()`, `raise()`, and `allin()`.
10. `apps/server/src/game/host-actions.ts` shall export `startGame()`, `newHand()`, `declareWinner()`, `rebuy()`, `pause()`, `resume()`, `reorderPlayers()`, and `endGame()`.
11. `apps/server/src/game/round.ts` shall export `advanceRound()` and `detectRoundComplete()`.
12. `apps/server/src/game/state.ts` shall export `withValidActions()`, `appendLog()`, and any shared helper utilities.
13. All Vitest unit tests shall move to `__tests__/<domain>/` mirroring the source structure.

### Client
14. `apps/client/src/App.tsx` shall be an orchestrator only: it imports hooks, screens, and passes props — no inline component definitions, no socket subscription code, no session-restore logic.
15. `apps/client/src/hooks/useGameState.ts` shall subscribe to `game:state` and return the current `GameState` and `myPlayerId`.
16. `apps/client/src/hooks/useSession.ts` shall handle session creation, joining, and `sessionStorage` restore on reload.
17. `apps/client/src/screens/HomeScreen.tsx` shall render the create-session form.
18. `apps/client/src/screens/JoinScreen.tsx` shall render the join-session form.
19. `apps/client/src/screens/LobbyScreen.tsx` shall render the pre-game lobby (player list, reorder controls, game settings, start button).
20. `apps/client/src/screens/GameScreen.tsx` shall render the active game view (player list, pot/round info, action buttons, action log).
21. `apps/client/src/components/HostPanel.tsx` shall render the collapsible host controls sidebar.
22. `apps/client/src/components/ActionLog.tsx` shall render the scrollable game log.
23. `apps/client/src/components/PlayerList.tsx` shall render the player list (reusable between lobby and game screens).
24. `apps/client/src/components/DeclareWinnerPanel.tsx` shall render the winner-selection panel at showdown.

## Non-Functional Requirements
- No runtime performance regression — this is a file split with identical logic.
- TypeScript strict mode must remain satisfied in all new files (no `any`, no suppressions).
- No new `console.log` in client code.
- Tailwind only for styling — no inline `style` props introduced.

## Technical Design Notes
- Pure functions keep their exact signatures: `(state: GameState, payload) => GameState | error`. No wrappers, no adapters.
- Each domain file re-exports only what its consumers need — no barrel `index.ts` files unless there are 3+ imports from the same domain in a single consumer.
- The session store is module-level singleton state in `session/store.ts` (same as the current `Map` in `index.ts`) — no dependency injection needed at this stage.
- Handlers receive the store and disconnect module as imports, not as constructor arguments.
- `socket.ts` on the client is unchanged.

## Out of Scope
- Changing function signatures or return types.
- Introducing dependency injection or inversion-of-control containers.
- Splitting `packages/types/src/index.ts`.
- Adding new game features or fixing bugs.
- Migrating to a class-based or service-object pattern.
- Adding integration tests (beyond what already exists).

## Open Questions
None — all decisions resolved in the design interview.

## Success Criteria
- All 11 Playwright e2e specs pass green on both the server-refactor PR and the client-refactor PR.
- All Vitest unit tests pass green on the server-refactor PR.
- TypeScript compiles with zero errors across all workspaces after each PR.
- No file in `apps/server/src/` or `apps/client/src/` exceeds ~200 lines (excluding generated or config files).

## Milestones

### Phase 1 — Server Refactor (one PR: `issue/refactor-server-domains`)
1. Split `game.ts` into `game/player-actions.ts`, `game/host-actions.ts`, `game/round.ts`, `game/state.ts`.
2. Split `session.ts` into `session/create.ts` and `session/join.ts`.
3. Extract session store to `session/store.ts`.
4. Extract disconnect timer to `session/disconnect.ts`.
5. Split `index.ts` handlers into `handlers/session.ts`, `handlers/game.ts`, `handlers/host.ts`.
6. Move unit tests to `__tests__/<domain>/` mirroring source structure.
7. `index.ts` becomes pure bootstrap.

### Phase 2 — Client Refactor (one PR: `issue/refactor-client-domains`)
1. Extract `useGameState` and `useSession` hooks.
2. Extract `HomeScreen`, `JoinScreen`, `LobbyScreen`, `GameScreen` screens.
3. Extract `HostPanel`, `ActionLog`, `PlayerList`, `DeclareWinnerPanel` components.
4. `App.tsx` becomes pure orchestrator.
