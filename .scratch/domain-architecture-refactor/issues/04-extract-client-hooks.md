---
status: in-progress
---

# Extract Client Hooks

> **Status:** `in-progress`

## Clarification
_No open questions._

## Context
Part of the domain-architecture-refactor feature (Phase 2, Client). Independent of all server issues — can be picked up at any time. Must be complete before Issue 05 (screens and components) begins, since screens will consume these hooks. See `.scratch/domain-architecture-refactor/PRD.md`.

## Goal
Extract the socket subscription logic and session lifecycle logic currently inline in `App.tsx` into two custom hooks: `useGameState.ts` and `useSession.ts`. `App.tsx` should no longer contain any socket event listeners or `sessionStorage` access after this issue.

## Acceptance Criteria
- [ ] `apps/client/src/hooks/useGameState.ts` subscribes to the `game:state` Socket.IO event and returns `{ gameState: GameState | null, myPlayerId: string | null }`
- [ ] `apps/client/src/hooks/useSession.ts` handles session creation, joining, and `sessionStorage` restore on page reload; exposes the necessary state and action callbacks to `App.tsx`
- [ ] `App.tsx` contains no direct `socket.on` calls — all socket subscriptions go through `useGameState`
- [ ] `App.tsx` contains no direct `sessionStorage` reads or writes — all session persistence goes through `useSession`
- [ ] `App.tsx` still renders the correct UI and all existing behavior is preserved
- [ ] TypeScript compiles with zero errors (`npm run build` from repo root)
- [ ] All 11 Playwright e2e specs pass (`npm run test:e2e` from repo root)

## Technical Notes
- `useGameState` should call `socket.connect()` on mount (currently done in `App`) and clean up with `socket.disconnect()` on unmount if appropriate.
- `useSession` manages the `screen` state (`'home' | 'join' | 'game'`) since screen transitions are driven by session events (create success → lobby, join success → lobby, etc.) — or pass a `onSessionEstablished` callback; choose whichever keeps `App.tsx` cleaner.
- The `myPlayerId` returned by `useSession` (stored in `sessionStorage` as `player_id`) should be threaded through `useGameState` or returned separately — keep them in the same hook if that simplifies the interface, split only if the concerns are truly independent.
- `socket.ts` is unchanged.

## Out of Scope
- Extracting screens or components (Issue 05).
- Any server changes.
