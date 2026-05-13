# Poker Chipless — Claude Code Guide

## What This Project Is

A real-time chipless poker manager for casual home games. Each player uses their own device; the host runs a local Node.js server. All chip management (blinds, bets, raises, folds, pot tracking) is handled by the app. Texas Hold'em only. No physical chips needed.

Full spec, issues, and bug reports: `.scratch/<feature-slug>/` — see [Development Workflow](#development-workflow) below.

---

## Development Workflow

Work is organized as features. Each feature has a PRD, a set of issues, and a bugs folder:

```
.scratch/
└── <feature-slug>/
    ├── PRD.md           # Full spec for this feature
    ├── issues/
    │   ├── 01-<slug>.md
    │   ├── 02-<slug>.md
    │   └── ...
    └── bugs/
        └── <bug-slug>.md
```

### Implementing an Issue

Follow these steps in order for every issue:

1. **Create a branch** — branch off `main` using the pattern `issue/<NN>-<slug>` (e.g. `issue/03-session-creation`). Never commit implementation work directly to `main`.
2. **Mark in-progress** — update the issue frontmatter `status` to `in-progress` and the inline `> **Status:**` badge to match. Commit this change to the issue branch.
3. **Invoke `/tdd`** — pass the issue title and acceptance criteria as the argument. Do not write a single line of implementation until the skill has been invoked and the tracer bullet has been confirmed.
4. **Implement** — follow the red-green-refactor loop on the issue branch until all acceptance criteria are met.
5. **Mark done** — update both status fields to `done` and commit.
6. **Do not merge** — leave the branch open for the user to review and merge. Never merge or rebase into `main` yourself.

### Fixing a Bug

Follow these steps in order for every bug fix:

1. **Invoke `/bugfix`** — the skill will interview you to fully understand the bug before any code is written. Do not create a branch or write any code before invoking it.
2. **Create a branch** — `/bugfix` will create a branch off `main` using the pattern `bugfix/<bug-slug>` (e.g. `bugfix/fold-win-active-player-stuck`). Never commit bug-fix work directly to `main`.
3. **Write the reproduction test first** — `/bugfix` writes a failing test that reproduces the bug before touching implementation. This is the red step of the red-green-refactor loop.
4. **Fix the bug** — follow the red-green-refactor loop: make the reproduction test pass, then refactor. Do not write implementation code before the failing test exists.
5. **Create the bug report file** — write `.scratch/<feature-slug>/bugs/<bug-slug>.md` documenting the description, root cause, fix, and tests (see format below). Set `status: merged` only after the branch is merged.
6. **Invoke `/review`** — before merging, run `/review` on the bugfix branch. The skill reads the bug report, runs tests, audits the diff for gaps, and asks for merge confirmation.
7. **Do not merge** — leave the branch open for the user to review and merge. Never merge or rebase into `main` yourself.

#### Bug Report File Format

```markdown
# Bug: <Short title>

> **Branch:** `bugfix/<bug-slug>`
> **Status:** open | in-progress | merged

## Description
<What the user observes. When does it happen? Reproduction steps if known.>

## Root Cause
<What in the code caused it, once identified.>

## Fix
<What was changed and why.>

**Files changed:** <list files>

## Tests
### Added
- `<test name>` — `<file path>` — <what it asserts>

### Updated (were asserting wrong behavior)
<list or "None">

## Affected Files
- `<file>` — `<function/section>`: <what changed>
```

### Issue Status

Every issue file has a `status` field in its frontmatter:

```
status: pending | in-progress | done
```

**Rules:**
- **Only pick up `pending` issues.** Never start an issue that is `in-progress` (already being worked) or `done`.
- If you are asked to work on a feature without a specific issue, read the PRD first, then find the next `pending` issue in sequence.

---

## Monorepo Structure

```
poker-chipless/
├── apps/
│   ├── client/       # React + Vite + TypeScript + Tailwind
│   ├── server/       # Node.js + TypeScript + Socket.IO
│   └── e2e/          # Playwright end-to-end tests
├── packages/
│   └── types/        # Shared Socket.IO event types and game state interfaces
├── turbo.json
└── package.json      # npm workspaces root
```

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Monorepo | Turborepo + npm workspaces |
| Client | React, Vite, TypeScript, Tailwind CSS v3 |
| Client state | React `useState` — component-local only |
| Server | Node.js, TypeScript, Socket.IO |
| Shared types | `packages/types` — consumed by both apps |
| Mobile (v2) | Capacitor (not in v1) |

---

## Dev Commands

```bash
npm install               # install all workspace deps from repo root
npm run dev               # start client dev server + server in watch mode (via Turborepo)
npm run build             # build all packages and apps
npm run start             # serve production build on port 3000
npm run test:e2e          # build then run Playwright E2E suite (headless)
npm run test:e2e:headed   # same but shows the browser window
# from apps/server:
npm run test              # run Vitest unit tests once
npm run test:watch        # run Vitest in watch mode
```

---

## Core Rules — Read These First

### 1. Integer-only chip math
All chip values are plain integers everywhere — in `GameState`, in Socket.IO payloads, in the UI. **No floats, ever.** No `/ 2`, no `* 0.5`, no `parseFloat`. If division is unavoidable (e.g. odd-chip splits), the host resolves it manually.

### 2. Server is the single source of truth
All game state mutations happen server-side. Clients are read-only consumers. The client never computes a new game state — it only sends action events and renders what the server broadcasts.

### 3. Full state broadcast, no diffs
After every mutation the server broadcasts the complete `GameState` object via `game:state`. No partial updates, no patch events. Simple and correct at home-game scale.

### 4. No stringly-typed Socket.IO events
All event names and payload types are defined in `packages/types` (`ServerToClientEvents`, `ClientToServerEvents`). Never use a raw string event name outside of that package. Both client and server import from `packages/types`.

### 5. UI state is component-local only
Use React `useState` for form inputs, loading flags, overlay open/closed, and other UI-only state. Game state (the `GameState` object from the server) lives in `App`-level `useState` and is passed down as props — it is never derived or duplicated in component-local state.

### 6. Server validates everything
Client-side validation (e.g. minimum raise check before sending) is a UX courtesy only. The server re-validates every incoming action and returns `{ ok: false, error: string }` on rejection. Never trust the client.

### 7. Cloud-ready isolation
All network/transport code lives in an isolated layer. No LAN-specific code outside of the startup IP-detection utility. Swapping local hosting for a cloud deployment must require only a config/env change, not a code change.

---

## Socket.IO Event Reference

### Server → Client
| Event | Payload | When |
|-------|---------|------|
| `game:state` | `GameState` | After every mutation |
| `game:log` | `LogEntry` | Each new log entry (also included in `game:state`) |

### Client → Server
| Event | Payload |
|-------|---------|
| `session:create` | `{ displayName: string }` |
| `session:join` | `{ code: string, displayName: string, token?: string }` |
| `action:fold` | `{}` |
| `action:check` | `{}` |
| `action:call` | `{}` |
| `action:bet` | `{ amount: number }` |
| `action:raise` | `{ amount: number }` |
| `action:allin` | `{}` |
| `host:new-hand` | `{}` |
| `host:advance-round` | `{}` |
| `host:declare-winner` | `{ playerId: string }` |
| `host:rebuy` | `{ playerId: string, amount: number }` |
| `host:pause` | `{}` |
| `host:resume` | `{}` |
| `host:reorder-players` | `{ orderedPlayerIds: string[] }` |
| `host:start-game` | `{ startingStack: number, smallBlind: number, bigBlind: number }` |
| `host:end-session` | `{}` |

Most client→server events return `{ ok: true }` or `{ ok: false, error: string }`. The session events return richer acks:
- `session:create` → `{ ok: true; code: string; token: string; playerId: string }` or `{ ok: false; error: string }`
- `session:join` → `{ ok: true; token: string; playerId: string }` or `{ ok: false; error: string }`

Canonical definitions are in `packages/types` (`CreateAckResponse`, `JoinAckResponse`, `AckResponse`).

---

## Key Data Shapes (summary — canonical definitions in `packages/types`)

```typescript
GameState {
  code: string                  // 6-char session code
  phase: 'lobby' | 'active' | 'paused' | 'showdown' | 'ended'
  round: 'preflop' | 'flop' | 'turn' | 'river' | 'showdown'
  players: Player[]             // ordered by seat
  dealerButtonIndex: number
  activePlayerIndex: number
  pot: number                   // integer
  currentBet: number            // integer — highest bet open this round
  lastRaiseSize: number         // integer — for minimum re-raise enforcement
  smallBlind: number            // integer
  bigBlind: number              // integer
  roundComplete: boolean        // true when all active players have acted and bets are equal
  log: LogEntry[]
}

Player {
  id: string                    // UUID
  displayName: string
  chipCount: number             // integer — never negative
  currentBet: number            // integer — contribution this round
  isHost: boolean
  isEliminated: boolean
  isConnected: boolean
  isAllIn: boolean
  isFolded: boolean
  hasActedThisRound: boolean
  validActions: ValidAction[]   // computed server-side, sent with every game:state
}

LogEntry {
  timestamp: string             // ISO 8601
  message: string
}

ValidAction = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin'
```

---

## Game Flow Summary

```
Lobby → (host clicks Start Game) →
  New Hand: button advances, blinds posted, UTG is active →
  Betting round (preflop) →
  (host advances) → Flop betting round →
  (host advances) → Turn betting round →
  (host advances) → River betting round →
  (host advances) → Showdown →
  Host declares winner → pot transferred →
  Elimination check → (host clicks New Hand) → repeat
```

- Host controls pacing: round advancement, winner declaration, new hand trigger.
- Server controls correctness: turn order, valid actions, chip math, blind posting, all-in detection.
- Players have no host controls, even if they could send the events (server checks `isHost`).

---

## Session Code

- 6 uppercase alphanumeric characters, no ambiguous chars (`0 O 1 I` excluded).
- Charset: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`
- Generated server-side on `session:create`.
- Used as the Socket.IO room name.
- Collision risk accepted for v1 — document in README.

## Reconnection

- Server issues a `crypto.randomUUID()` token on join, returned in the `session:join` ack alongside `playerId`.
- Client stores `session_code`, `session_token`, `display_name`, and `player_id` in `sessionStorage`. On reload, sends token with `session:join`.
- Server maps `token → playerId` and restores seat.
- Host disconnect → `phase` transitions to `'paused'` → un-pauses on host reconnect.
- Non-host disconnect mid-turn → 10-second server-side timer → auto-fold if still disconnected.

---

## What Is Out of Scope for v1

Do not implement these, and do not design abstractions in anticipation of them:

- Internet/cloud multiplayer
- Tournament blind schedules
- Per-player sit-out
- Automatic side-pot calculation
- Hand evaluation or automatic winner detection
- Post-session persistence or export
- Omaha, Stud, or other variants
- Capacitor mobile packaging
- In-app chat
- Host promotion on host disconnect
- Spectator mode
- User accounts or authentication

---

## Adding a New Game Action

When adding a new player or host action to the game engine, touch all of these:

1. `packages/types` — add event to `ClientToServerEvents`, add payload interface if needed
2. `apps/server/src/game.ts` — add a pure function `(state, payload) => GameState | error`
3. `apps/server/src/index.ts` — add a socket handler that calls the pure function and broadcasts `game:state`
4. `apps/client` — add the corresponding UI control, fire the event, handle the ack
5. Update this CLAUDE.md event reference table if the event is new

---

## Coding Conventions

- TypeScript strict mode on all packages.
- No `any` types — use `unknown` and narrow, or fix the type properly.
- No `console.log` in client code — use a dev-only logger utility or remove before merging.
- Tailwind only for styling — no inline `style` props, no CSS modules, no styled-components.
- All server-side game state mutations are pure functions where possible: `(state: GameState, payload) => GameState`. Makes logic easy to test without Socket.IO. These live in `apps/server/src/game.ts`; socket handlers in `index.ts` call them and then broadcast the result.
- No floating point. If you find yourself writing `/`, ask whether the host should resolve it instead.
