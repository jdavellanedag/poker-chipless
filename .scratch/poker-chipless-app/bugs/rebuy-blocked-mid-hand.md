# Bug: Rebuy accepted during active hand, re-entering eliminated player into current rotation

> **Branch:** `bugfix/rebuy-blocked-mid-hand`
> **Status:** fixed

## Description

When the host issued a `host:rebuy` during an active hand (after `newHand` was called, `pot > 0`), the server accepted it and cleared `isEliminated` on the player. Because `advanceRound()` and `detectRoundComplete()` filter players solely by `!isEliminated && !isFolded`, the re-entered player would be picked up in subsequent rounds of the current hand — violating the spec requirement that a re-bought player re-enters only on the next hand. The rebuy button in the host overlay was also visually enabled in this state, giving no indication the action would be problematic.

## Root Cause

`rebuy()` in `apps/server/src/game.ts` had no guard against being called while a hand was in progress. Any `pot > 0` state (blinds posted through end of showdown) is "mid-hand", but the function accepted the request unconditionally and set `isEliminated: false`, which immediately made the player visible to all turn-advancement and round-completion logic.

## Fix

Added an early return in `rebuy()` that rejects the call when `state.pot > 0`:

```typescript
if (state.pot > 0) {
  return { ok: false, error: 'Rebuy is only allowed between hands.' };
}
```

Also updated `HostPanel` in `apps/client/src/App.tsx` to include `state.pot === 0` in the `rebuyValid` guard, so the button is disabled while a hand is in progress. The E2E test that previously asserted the button was enabled mid-hand was corrected to assert it is disabled, and a new test asserts it is enabled once the pot returns to 0 after a winner is declared.

## Tests

### Added
- `'rejects rebuy when a hand is in progress (pot > 0)'` — `apps/server/src/__tests__/game.test.ts` — asserts `rebuy()` returns `{ ok: false }` when called on a state produced by `makeHand()` (pot > 0)
- `'allows rebuy between hands when pot is 0'` — `apps/server/src/__tests__/game.test.ts` — asserts `rebuy()` returns `{ ok: true }` when called on a between-hands state (pot === 0)
- `'rebuy button is enabled between hands (pot === 0) when amount is valid'` — `apps/e2e/tests/host-overlay.spec.ts` — plays a full all-in hand, declares winner (pot → 0), confirms button is enabled

### Updated (were asserting wrong behavior)
- `'host sees rebuy section with player dropdown, amount input, and enabled button'` → renamed to `'rebuy button is disabled while a hand is in progress (pot > 0)'`, assertion changed from `toBeEnabled()` to `toBeDisabled()` — `apps/e2e/tests/host-overlay.spec.ts` — the previous assertion was written when the button was a non-functional stub; now it correctly reflects that mid-hand rebuy is blocked

## Affected Files
- `apps/server/src/game.ts` — `rebuy()`: added `pot > 0` guard
- `apps/client/src/App.tsx` — `HostPanel`: added `state.pot === 0` to `rebuyValid`
- `apps/server/src/__tests__/game.test.ts` — added two new unit tests for the guard
- `apps/e2e/tests/host-overlay.spec.ts` — updated existing test + added between-hands enabled test
