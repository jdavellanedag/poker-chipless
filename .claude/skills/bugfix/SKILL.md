---
name: bugfix
description: Interrogates the user to fully understand a bug report, then creates a branch, writes a failing reproduction test, and fixes the bug using the red-green-refactor loop with that test as the starting point.
argument-hint: <brief bug description or symptom>
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash]
---

# Bugfix

Fix a bug by first proving it exists with a test, then making that test pass.

**Bug report:** $ARGUMENTS

---

## Phase 1: Interrogate

Before writing a single line of code, reach a complete, unambiguous understanding of the bug. Read any relevant issue files in `.scratch/*/issues/` and explore the codebase to understand the affected area. Then interview the user — **one question at a time** — until every dimension below is resolved:

- **Symptom** — What exactly goes wrong? What does the user see vs. what they expect?
- **Reproduction steps** — What is the minimal sequence of actions that triggers the bug?
- **Scope** — Is this server logic, a Socket.IO event, client UI, or a data shape problem?
- **Frequency** — Always, sometimes, or only under specific conditions?
- **Regression** — Did this ever work? What changed?

Rules for interrogation:
- Ask **one question per turn**. Never stack questions.
- Provide your **best current hypothesis** alongside each question so the user can confirm or correct it.
- Stop asking when you can state the bug in a single sentence that the user agrees with.
- If $ARGUMENTS already answers a dimension fully, skip that question — do not ask for information you already have.

Once the user confirms your summary, state it clearly:

> **Bug confirmed:** `<one-sentence precise description>`

Then proceed to Phase 2.

---

## Phase 2: Branch

Create a branch for the fix:

```
git checkout main
git checkout -b bugfix/<kebab-case-slug>
```

The slug must be short (3–5 words max) and describe the broken behavior, not the symptom. Example: `heads-up-utg-order`, not `wrong-active-player-index-after-new-hand`.

Tell the user the branch name before continuing.

---

## Phase 3: Reproduce

Write a single failing test that proves the bug exists. This test is the specification of the correct behavior.

**Choose the right layer:**
- **Vitest** (`apps/server/src/__tests__/`) — server-side logic bugs: wrong game state, bad calculations, incorrect turn order, rejected valid actions, accepted invalid actions.
- **Playwright E2E** (`apps/e2e/tests/`) — UI/browser bugs: wrong element visible, wrong text displayed, click has no effect, state not reflected in the UI.
- When the bug spans both layers, write the Vitest test first — it runs faster and pinpoints the root cause.

**The reproduction test must:**
1. Set up exactly the state that triggers the bug (no more, no less)
2. Exercise the behavior through the public interface — no internal mocking
3. Assert the **correct** behavior (what should happen), not the current broken behavior
4. Fail for the right reason: the bug, not a compile error or missing import

Run the suite and confirm RED:
- Vitest: `npm test --workspace=apps/server`
- E2E: `npm run test:e2e`

If the test passes without any code change, the bug does not exist at this layer — re-examine the scope and either adjust the test or move to a different layer.

State clearly: **"Test is RED — reproduces the bug."** Then proceed.

---

## Phase 4: Fix

Apply the red-green-refactor loop, using the reproduction test as the anchor:

### GREEN
- Write the minimum code change that makes the reproduction test pass
- Do not add unrelated changes, refactors, or new features
- Run the **full** test suite — the reproduction test must pass AND no previously passing test may break
- If fixing the bug breaks an existing test, that test was asserting the wrong behavior — update it with a comment explaining why

### REFACTOR
- With the suite green, clean up if the fix introduced any duplication or awkward code
- No new behavior. Suite must stay green throughout.

### Verify
Run both suites one final time and confirm all green:
- `npm test --workspace=apps/server`
- `npm run test:e2e` (only if UI was touched)

---

## Phase 5: Done

Report to the user:

```
## Bugfix: <slug>

**Bug:** <one-sentence confirmed description>
**Root cause:** <what in the code was wrong>
**Fix:** <what was changed and why>
**Reproduction test:** <test name and file>

### Tests
- Before: <N> passing
- After: <N> passing
- Updated (behavior was wrong): <list or "none">
```

Leave the branch open — do not merge. The user will run `/review` when ready.

---

## Phase 6: Write Bug Report

Persist the bugfix context for future review. Determine the active feature slug by listing `.scratch/*/` directories and picking the one that matches the current work. Then write the report:

**Path:** `.scratch/<feature-slug>/bugs/<branch-slug>.md`

The file must use this structure exactly:

```markdown
# Bug: <human-readable title>

> **Branch:** `bugfix/<slug>`
> **Status:** fixed

## Description

<2–4 sentences describing what the user observed, what was expected, and under what conditions the bug occurred.>

## Root Cause

<Precise description of what in the code was wrong — file name, function/handler, and the specific incorrect behavior. One short paragraph.>

## Fix

<What was changed and why. Include file names. One short paragraph.>

## Tests

### Added
- `<test name>` — `<file path>` — <one-line description of what it asserts>

### Updated (were asserting wrong behavior)
- `<test name>` — `<file path>` — <one-line description of what changed and why>
  *(or "None" if no existing tests needed updating)*

## Affected Files
- `<file path>` — <what changed>
```

After writing the file, tell the user the path.
