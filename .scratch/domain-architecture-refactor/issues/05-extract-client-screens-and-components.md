---
status: in-progress
---

# Extract Client Screens and Components

> **Status:** `in-progress`

## Clarification
_No open questions._

## Context
Part of the domain-architecture-refactor feature (Phase 2, Client). Requires Issue 04 to be done first — screens consume the `useGameState` and `useSession` hooks. This is the final issue in the refactor. See `.scratch/domain-architecture-refactor/PRD.md`.

## Goal
Move all inline screen and component definitions out of `App.tsx` into dedicated files under `screens/` and `components/`. After this issue, `App.tsx` is a pure orchestrator: it imports hooks, screens, and components, and wires them together — no JSX component definitions of its own.

## Acceptance Criteria
- [ ] `apps/client/src/screens/HomeScreen.tsx` renders the create-session form
- [ ] `apps/client/src/screens/JoinScreen.tsx` renders the join-session form
- [ ] `apps/client/src/screens/LobbyScreen.tsx` renders the pre-game lobby (player list, reorder controls, game settings input, start button)
- [ ] `apps/client/src/screens/GameScreen.tsx` renders the active game view (player list, pot/round display, action buttons, action log)
- [ ] `apps/client/src/components/HostPanel.tsx` renders the collapsible host controls sidebar
- [ ] `apps/client/src/components/ActionLog.tsx` renders the scrollable game log
- [ ] `apps/client/src/components/PlayerList.tsx` renders the player list (usable in both `LobbyScreen` and `GameScreen`)
- [ ] `apps/client/src/components/DeclareWinnerPanel.tsx` renders the winner-selection panel at showdown
- [ ] `apps/client/src/App.tsx` contains no inline component or screen definitions — only imports, hook calls, and a single return with conditional screen rendering
- [ ] `apps/client/src/App.tsx` is under 80 lines
- [ ] No file in `apps/client/src/` exceeds ~200 lines
- [ ] All existing UI behavior is visually and functionally identical to before (golden path: create session → lobby → start game → play a hand → declare winner)
- [ ] TypeScript compiles with zero errors (`npm run build` from repo root)
- [ ] All 11 Playwright e2e specs pass (`npm run test:e2e` from repo root)

## Technical Notes
- Extract components bottom-up: smallest leaf components first (`ActionLog`, `DeclareWinnerPanel`, `PlayerList`), then `HostPanel`, then screens. This minimises the blast radius of any single extraction.
- Props for each component should be typed explicitly — no passing the entire `GameState` object to a component that only needs two fields.
- `CenteredCard` (the centered modal wrapper currently in `App.tsx`) can live in `components/CenteredCard.tsx` or be inlined into the screens that use it — whichever keeps the screen files readable.
- No new state introduced — all state originates in `App.tsx` via hooks and flows down as props. Components are stateless where possible (exception: `HostPanel` toggle open/closed is UI-only state and may live locally).

## Out of Scope
- Any server changes.
- Adding new UI features or changing visual design.
- Introducing a state management library.
