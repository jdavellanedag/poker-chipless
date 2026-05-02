---
status: pending
---

# UI Polish & Responsive Layout

> **Status:** `pending`

## Clarification
_No open questions._

## Context
Thirteenth issue, M5 — Polish. Builds on all previous issues. At this point every feature works; this issue makes the app feel good to use on the devices players actually hold during a game — primarily phones in portrait mode.

## Goal
A focused Tailwind styling pass across all screens, ensuring the layout works on phone-sized screens in portrait orientation, and a Capacitor compatibility audit confirming no browser-only APIs are used.

## Acceptance Criteria
- [ ] All screens (join, lobby, game, game over) are usable on a 375px-wide viewport in portrait orientation without horizontal scrolling.
- [ ] The player game screen prioritises: own chip count, action buttons, and pot size — these are always visible without scrolling.
- [ ] Other players' chip counts are visible in a compact list (name + stack, no extra decoration needed).
- [ ] Action buttons are large enough to tap comfortably on a phone (minimum 44×44px touch target).
- [ ] The host overlay is a collapsible bottom sheet on mobile (≤768px) and a fixed sidebar on desktop (>768px).
- [ ] `isConnected: false` players show a visual indicator (e.g. dimmed name, dot indicator).
- [ ] Eliminated players show a clear "Eliminated" state in the player list.
- [ ] The "Waiting for host to reconnect" banner is prominently displayed and not dismissible by players.
- [ ] The action log panel is scrollable and does not push action buttons off screen.
- [ ] Capacitor audit: no `window.location` reloads, no `navigator` APIs beyond standard ones, no Web Bluetooth/NFC/Serial. Document any findings.

## Technical Notes
- Use Tailwind responsive prefixes (`sm:`, `md:`) for layout breakpoints — no custom CSS media queries.
- Zustand can manage the host overlay collapsed/expanded state on mobile.
- Test on Chrome DevTools device simulation at minimum: iPhone SE (375×667), iPhone 14 (390×844), iPad (768×1024).
- Capacitor wrapping is not done in this issue — only the audit. Flag any API that would need a Capacitor plugin in a comment or a short note in the README.
- Dark theme using Tailwind's slate/zinc palette is recommended for a poker-appropriate aesthetic, but the specific color choices are at the implementer's discretion.

## Out of Scope
- Actual Capacitor build or mobile app packaging (deferred to v2).
- Animations or transitions beyond basic Tailwind utilities.
- Custom icon set or branding assets.
