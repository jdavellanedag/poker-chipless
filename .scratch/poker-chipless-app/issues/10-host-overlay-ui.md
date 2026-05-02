---
status: pending
---

# Host Overlay UI

> **Status:** `pending`

## Clarification
_No open questions._

## Context
Tenth issue, M3 — Host Controls. Builds on the game engine (05–08) and action log (09). The host already has functional game control via server events; this issue delivers the combined player+host UI so the host can do everything from one screen.

## Goal
The host sees the same game screen as any player, plus a persistent overlay panel with all host controls: new hand, round advancement, winner declaration, re-buy trigger, pause/resume, and the action log.

## Acceptance Criteria
- [ ] The host overlay panel is only rendered when `player.isHost === true`; non-host players never see it.
- [ ] The overlay contains: "New Hand" button, "Advance Round" button (with current round label), "Declare Winner" (player selector + confirm), re-buy section (player selector + chip amount input + confirm), "Pause" / "Resume" toggle, and the action log panel.
- [ ] "Advance Round" button label updates to reflect the next round: e.g. "Deal Flop", "Deal Turn", "Deal River", "Go to Showdown".
- [ ] "Advance Round" is disabled when the round is `showdown`.
- [ ] "Declare Winner" is only enabled during `showdown` phase; shows a dropdown of non-folded players in the current hand.
- [ ] Re-buy chip amount input accepts only positive integers; defaults to the session's starting stack amount.
- [ ] Re-buy player selector shows all players (including eliminated ones).
- [ ] "Pause" button is visible during `active` phase; "Resume" is visible during `paused` phase.
- [ ] During `paused` phase, all player action buttons are disabled and a "Game paused by host" banner is shown to non-host players.
- [ ] The overlay does not cover the player's own chip count or action buttons — it is positioned so the host can still act as a player.

## Technical Notes
- Zustand manages overlay UI state: which panel section is expanded, re-buy form values, winner selection.
- Host control events (`host:advance-round`, `host:declare-winner`, `host:rebuy`, `host:pause`, `host:resume`, `host:new-hand`) are fired via Socket.IO and acknowledged; show a brief loading state on the button between click and acknowledgement.
- `game:state.phase` drives overlay control visibility: `'active'` shows pause; `'paused'` shows resume; `'showdown'` enables winner declaration.
- The overlay can be a fixed sidebar on desktop or a collapsible bottom sheet on mobile.

## Out of Scope
- Re-buy business logic (issue 12 handles server-side re-buy and elimination).
- Pause/resume server logic is defined here but the disconnect-triggered pause is in issue 11.
