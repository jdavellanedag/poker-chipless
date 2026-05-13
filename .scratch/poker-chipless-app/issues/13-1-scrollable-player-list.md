---
status: in-progress
---

# Scrollable Player List in Game Screen

> **Status:** `in-progress`

## Clarification

Depends on `bugfix/host-panel-not-fixed-sidebar` being merged into `main` first — both touch `GameScreen` layout. Do not start until that bugfix is on `main`.

## Context

Sub-issue of issue 13 (UI Polish). Issue 13 criterion 2 was not fully met: with 6+ players on a phone the player list pushes the pot display and action buttons off the bottom of the screen. This issue restructures `GameScreen` into a fixed-height viewport layout so key elements are always visible.

## Goal

Restructure the game screen into an `h-screen flex-col` layout: fixed sections at the top and bottom bracket a scrollable player list in the middle. The pot, own chip count, and action buttons are always visible without any page-level scrolling, regardless of how many players are in the game.

## Acceptance Criteria

- [ ] The game screen never produces a vertical page scroll — the outer container is `h-screen`.
- [ ] The pot header and round label are always visible at the top of the screen.
- [ ] The player list rows are in a scrollable region (`flex-1 overflow-y-auto`) that takes all remaining vertical space between the top and bottom fixed sections.
- [ ] The active player's row is automatically scrolled into view whenever `activePlayerIndex` changes (same `scrollIntoView` pattern as the action log).
- [ ] The fixed bottom section contains, in order: action buttons (when it's the player's turn) → mobile host-controls toggle button → action log. Each of these is always accessible without scrolling the page.
- [ ] The action log retains its current `h-40 overflow-y-auto` height — no change to its size.
- [ ] The pause banner sits inside the flex column at the very top (above the pot header), so it compresses the player list slightly rather than causing a page overflow.
- [ ] Layout is applied unconditionally — not gated on player count.
- [ ] On iPhone SE (375×667), with 8 active players, the pot and action buttons are fully visible without scrolling.
- [ ] No horizontal scroll is introduced at 375px.
- [ ] All existing E2E tests continue to pass.

## Technical Notes

- Touch only `GameScreen` in `apps/client/src/App.tsx`. Lobby screen is out of scope.
- Use Tailwind only — no custom CSS or inline `style` props.
- The auto-scroll ref pattern for the active player row mirrors the existing `bottomRef` in `ActionLog`: attach a `ref` to the active player `<li>` and call `scrollIntoView({ behavior: 'smooth', block: 'nearest' })` in a `useEffect` keyed on `state.activePlayerIndex`.
- The `h-screen` container must account for the pause banner height: put the banner as the first child of the flex column so it compresses `flex-1` rather than overflowing.
- Target device for manual verification: iPhone SE (375×667), iPhone 14 (390×844).

## Out of Scope

- Lobby screen layout changes.
- Visual scroll indicator (fade/gradient) on the player list.
- Any server-side changes.
- Changing action log height.
