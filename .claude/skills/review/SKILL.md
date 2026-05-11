---
name: review
description: Review the current in-progress issue branch — reads acceptance criteria, runs tests, audits the diff for gaps, fixes small issues, then asks the user to confirm a merge into main.
argument-hint: (optional) path to issue file
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash]
---

# Issue Review

Review the active issue branch end-to-end, fix small gaps, then gate on user confirmation before merging to main.

---

## Phase 1: Orient

1. Identify the current branch: `git branch --show-current`.
2. Confirm it follows the `issue/<NN>-<slug>` pattern. If not, stop and tell the user — this skill only runs on issue branches.
3. Locate the matching issue file in `.scratch/*/issues/` by matching the slug. If `$ARGUMENTS` was provided, treat it as the path directly.
4. Read the issue file in full. Extract:
   - The **goal**
   - Every **acceptance criterion** (checkbox list)
   - Any **out-of-scope** items (do not flag these as gaps)

---

## Phase 2: Diff Audit

1. Run `git diff main...HEAD` to get the full changeset on this branch.
2. Map each acceptance criterion to the diff:
   - **Covered** — criterion is clearly satisfied by the changes.
   - **Partially covered** — implementation exists but is incomplete or incorrect.
   - **Missing** — no change in the diff addresses this criterion.
3. Also check for things that should NOT be present:
   - Out-of-scope features snuck in
   - Violations of CLAUDE.md core rules (floats in chip math, stringly-typed events, `any` types, inline styles, `console.log` in client code, etc.)
4. Produce a concise audit table: criterion → status → notes.

---

## Phase 3: Run Tests

1. Run the unit/integration suite: `npm test --workspace=apps/server`.
2. Check whether the diff touches any UI behavior (new screens, new interactions, changed flows). If yes, also run the E2E suite: `npm run test:e2e` from the repo root. This builds the project first, so it is the authoritative signal for browser-visible behavior.
3. If no test command exists, run `npm run build` as a minimum signal and note the absence of tests.
4. Record for each suite: total tests, passing, failing, any skipped.
5. If any test fails, move to Phase 4 before continuing.

---

## Phase 4: Fix Small Issues

For each gap found in Phase 2 or failing test from Phase 3, classify it:

- **Small** — a missing export, a wrong type, an off-by-one, a forgotten status update, a lint violation, a skipped edge case already covered by existing scaffolding. Fix it directly without asking.
- **Large** — new files, new logic paths, new Socket.IO handlers, significant UI work. Do NOT fix. List it for the user.

Apply all small fixes, then re-run the test suite to confirm green. If a fix causes unexpected failures, revert it and classify the item as large.

After fixes, re-audit the acceptance criteria against the updated diff.

---

## Phase 5: Report

Present a structured summary to the user:

```
## Review: issue/<NN>-<slug>

### Acceptance Criteria
| # | Criterion | Status |
|---|-----------|--------|
| 1 | ...       | ✅ / ⚠️ partial / ❌ missing |

### Tests
- Unit suite: <pass>/<total> passing
- E2E suite: <pass>/<total> passing (or "not run — no UI changes in diff")
- Fixes applied: <list or "none">

### Outstanding (needs your attention)
- <item> — reason it was not auto-fixed
  (or "None — all criteria met")

### Rule Violations
- <item> — rule from CLAUDE.md
  (or "None found")
```

If there are outstanding large gaps or rule violations, stop here and ask the user how to proceed. Do not offer to merge.

---

## Phase 6: Merge Confirmation

Only reach this phase when:
- All acceptance criteria are **Covered**
- The test suite is fully green
- No rule violations remain
- No large gaps are outstanding

Ask the user exactly:

> All acceptance criteria are met and tests are green. Ready to merge `issue/<NN>-<slug>` into `main`? (yes / no)

If the user says **yes**:
1. `git checkout main`
2. `git merge --no-ff issue/<NN>-<slug>` — always use `--no-ff` to preserve branch history.
3. Confirm the merge succeeded and report the resulting commit hash.
4. Update the issue file `status` to `done` if it is not already, and commit that change to `main`.

If the user says **no**: stop. Do not merge, do not rebase, do not delete the branch.
