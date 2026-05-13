---
status: in-progress
---

# Host Overlay UI

> **Status:** `in-progress`

## Clarification
_No open questions._

## Context
Tenth issue, M3 — Host Controls. Builds on the game engine (05–08, 08-1) and action log (09). Issue 08 already implemented inline host controls (New Hand, Advance Round, Declare Winner) directly in `GameScreen`. This issue restructures them into a proper overlay panel and adds the remaining controls: pause/resume and the action log panel.

## Goal
The host sees the same game screen as any player, plus a persistent overlay panel with all host controls in one place. Controls already built in issue 08 (New Hand, Advance Round, Declare Winner) are moved into the overlay. Pause/Resume and the log panel are new additions.

## Acceptance Criteria
- [ ] The host overlay panel is only rendered when `player.isHost === true`; non-host players never see it.
- [ ] The overlay consolidates all host controls: "New Hand" button, a single "Advance Round" button (with dynamic next-round label), "Declare Winner" panel (moved from inline `GameScreen`), re-buy section (player selector + chip amount input + confirm), and "Pause" / "Resume" toggle.
- [ ] The single "Advance Round" button label reflects the next round dynamically: "Deal Flop" (after preflop), "Deal Turn" (after flop), "Deal River" (after turn), "Go to Showdown" (after river). Only one button is shown at a time — it advances to whichever phase is next.
- [ ] "Advance Round" is hidden when `phase === 'showdown'`.
- [ ] "Declare Winner" panel is only shown when `phase === 'showdown'`; existing dual-mode logic (simplified accept vs. dropdown) from issue 08-1 is preserved.
- [ ] Re-buy chip amount input accepts only positive integers; defaults to the session's starting stack amount.
- [ ] Re-buy player selector shows all players (including eliminated ones).
- [ ] "Pause" button is visible during `phase === 'active'`; "Resume" is visible during `phase === 'paused'`.
- [ ] During `paused` phase, all player action buttons are disabled and a "Game paused by host" banner is shown to non-host players.
- [ ] The overlay does not cover the player's own chip count or action buttons — it is positioned so the host can still act as a player.

## Technical Notes
- The action log panel remains on the main `GameScreen` for all players (host and non-host). It is NOT moved into the host overlay.
- Use React `useState` for overlay UI state (open/closed, re-buy form values). No external state library — consistent with the rest of the codebase.
- Host control events (`host:advance-round`, `host:declare-winner`, `host:rebuy`, `host:pause`, `host:resume`, `host:new-hand`) are fired via Socket.IO and acknowledged; show a brief loading state on the button between click and acknowledgement.
- `game:state.phase` drives overlay control visibility: `'active'` or `'showdown'` shows pause; `'paused'` shows resume; `'showdown'` shows the Declare Winner panel.
- The overlay can be a fixed sidebar on desktop or a collapsible bottom sheet on mobile (layout polish is issue 13).

## Out of Scope
- Re-buy business logic (issue 12 handles server-side re-buy and elimination).
- Pause/resume server logic is defined here but the disconnect-triggered pause is in issue 11.
