# Bug: Host panel not fixed as sidebar on desktop

> **Branch:** `bugfix/host-panel-not-fixed-sidebar`
> **Status:** fixed

## Description

On desktop viewports (>768px), the host panel appeared inline in the page's scrolling column — below the action buttons and above the action log — instead of as a fixed sidebar anchored to the right edge of the viewport. This meant the host had to scroll to reach controls (New Hand, Declare Winner, Rebuy) on longer pages, and the layout looked identical to mobile. The issue was identified during the issue 13 review as an unmet acceptance criterion.

## Root Cause

The issue 13 implementation rendered `HostPanel` twice: once in a mobile `<div data-testid="host-panel">` (hidden on desktop via `md:hidden`) and once in a desktop `<aside data-testid="host-panel-sidebar">` (hidden on mobile via `hidden md:flex`). The desktop aside used `hidden md:flex` correctly, but the element had no `position: fixed` — it was in normal document flow inside the scrolling column. This caused two problems: (1) the sidebar scrolled with the content, and (2) Playwright strict mode violations because test IDs like `advance-round-btn` resolved to two DOM elements.

## Fix

Collapsed the two `HostPanel` instances into a single `<aside data-testid="host-panel-sidebar">` rendered once. The element uses `position: fixed right-0 top-0 h-screen` always, with `w-full md:w-72` for width (full-width overlay on mobile, 288px sidebar on desktop). Visibility is controlled by combining React state (`hostPanelOpen`) with Tailwind's responsive prefix: class `${hostPanelOpen ? 'flex' : 'hidden'} md:flex` — hidden on mobile by default, shown when toggled, always shown on desktop. The main content wrapper gained `md:mr-72` to prevent content from sliding under the fixed sidebar. A close button (`data-testid="host-panel-close"`) is shown inside the panel on mobile only (`md:hidden`).

**Files changed:** `apps/client/src/App.tsx`, `apps/e2e/tests/ui-polish.spec.ts`

## Tests

### Added
- `host panel is anchored to the right edge of the viewport on desktop` — `apps/e2e/tests/ui-polish.spec.ts` — asserts `host-panel-sidebar` right edge equals viewport width (1024px), top is 0, height equals full viewport

- `host panel sidebar is not visible on mobile viewport` — `apps/e2e/tests/ui-polish.spec.ts` — asserts `host-panel-sidebar` is not visible at 375px viewport

### Updated (were asserting wrong behavior)
- `host panel is hidden by default on mobile and shown when toggled` → renamed to `host panel is hidden by default on mobile, opened by toggle, closed by X button` — `apps/e2e/tests/ui-polish.spec.ts` — updated to use `host-panel-sidebar` testid (unified panel) and `host-panel-close` button to dismiss; the old testid `host-panel` no longer exists

## Affected Files
- `apps/client/src/App.tsx` — `GameScreen`: replaced dual HostPanel rendering with single `<aside data-testid="host-panel-sidebar">` using fixed positioning; added `md:mr-72` to main content wrapper; replaced toggle-toggle button with open-only toggle + close button inside panel
- `apps/e2e/tests/ui-polish.spec.ts` — added two desktop sidebar tests; updated mobile toggle test to match new testid and close-button UX
