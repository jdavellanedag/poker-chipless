---
status: done
---

# Shared Types Package

> **Status:** `done`

## Clarification
_No open questions._

## Context
Second issue, builds on the monorepo scaffold (issue 01). Defines the contract between client and server before any real logic is written. All subsequent issues import from this package — getting it right here prevents stringly-typed drift later. Corresponds to M1 — Core Infrastructure.

## Goal
Define all Socket.IO event names, payload shapes, and core game state interfaces in `packages/types`. Both `apps/client` and `apps/server` import exclusively from this package — no inline type definitions for shared concepts.

## Acceptance Criteria
- [ ] `packages/types` exports a `ServerToClientEvents` interface covering: `game:state` and `game:log`.
- [ ] `packages/types` exports a `ClientToServerEvents` interface covering: `session:create`, `session:join`, `action:fold`, `action:check`, `action:call`, `action:bet`, `action:raise`, `action:allin`, `host:advance-round`, `host:declare-winner`, `host:rebuy`, `host:pause`, `host:resume`, `host:reorder-players`, `host:start-game`, `host:end-session`.
- [ ] `packages/types` exports a `GameState` interface with fields for: session code, phase (`lobby` | `active` | `paused` | `ended`), player list, dealer button index, pot (integer), current bet (integer), active player index, small blind (integer), big blind (integer), and action log entries.
- [ ] `packages/types` exports a `Player` interface with fields for: id (UUID), displayName, chipCount (integer), currentBet (integer), isHost (boolean), isEliminated (boolean), isConnected (boolean), validActions array.
- [ ] `packages/types` exports a `LogEntry` interface with: timestamp (ISO string), message (string).
- [ ] `packages/types` exports a `ValidAction` union type: `'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin'`.
- [ ] All chip-related fields are typed as `number` with a JSDoc `@remarks integer only` note.
- [ ] TypeScript compiles with zero errors across the workspace after these additions.

## Technical Notes
- Use `interface` over `type` for all object shapes — easier to extend later.
- Socket.IO generic typing: `Socket<ClientToServerEvents, ServerToClientEvents>` on the server; `Socket<ServerToClientEvents, ClientToServerEvents>` on the client.
- `ValidAction` array on `Player` is computed server-side and sent with every `game:state` broadcast — clients never compute valid actions themselves.
- Keep payload types as flat as possible; avoid deep nesting to make serialization transparent.

## Out of Scope
- Any runtime validation (zod, io-ts) — plain TypeScript interfaces only for v1.
- Action payload details beyond what's needed for the types (exact bet amounts etc. are just `number`).
