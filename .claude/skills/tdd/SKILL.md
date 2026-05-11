---
name: tdd
description: Test-driven development with red-green-refactor loop. Use when implementing any issue, feature, or bug fix — this is the default approach for building new behavior. Also triggered when the user mentions "red-green-refactor", "TDD", wants integration tests, or asks for test-first development.
argument-hint: <issue, feature, or bug description>
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash]
---

# TDD: Red-Green-Refactor

Build behavior one vertical slice at a time. One test. One implementation. Repeat.

**Task:** $ARGUMENTS

---

## The Only Rule That Matters

Tests verify **behavior through public interfaces**. Code can change entirely — tests must not care. A test that breaks on a refactor where behavior is unchanged is a broken test, not a broken refactor.

**Good test:** "user can checkout with a valid cart" — exercises a real code path through the public API, reads like a specification, survives internal restructuring.

**Bad test:** mocks internal collaborators, tests private methods, queries the database directly to verify state that should be observable through the interface, or breaks when you rename an internal function.

---

## Anti-Pattern: Do Not Do This

**Horizontal slicing** — writing all tests first, then all implementation — produces bad tests:

- Tests written in bulk test *imagined* behavior, not *actual* behavior
- You test the shape of things (data structures, signatures) instead of user-facing behavior
- Tests become insensitive to real changes: they pass when behavior breaks, fail when it's fine
- You commit to test structure before understanding the implementation

**Do not treat RED as "write all tests." Treat RED as "write the next test."**

---

## Workflow

### Phase 1: Plan

Before writing any test:

1. Read the issue, spec, or PRD. If a `.scratch/` path is available, read it.
2. Explore the existing codebase — understand conventions, entry points, existing test patterns.
3. Identify the **tracer bullet**: the thinnest end-to-end slice that proves the system can do the thing. This is your first test.
4. Decide which test layer is appropriate:
   - **Unit / integration (Vitest)** — pure logic, server-side handlers, socket event processing. Lives in `apps/server/src/__tests__/`.
   - **E2E (Playwright)** — anything a user sees or clicks in the browser: UI flows, real Socket.IO round-trips, multi-client interactions. Lives in `apps/e2e/tests/`. Use when the acceptance criteria describe visible UI behavior.
   - Both layers may be needed for a single slice — Vitest for the server logic, Playwright for the UI that surfaces it.
5. Briefly state the tracer bullet, the test layer(s) you'll use, and the sequence of subsequent slices. Ask the user to confirm before proceeding.

### Phase 2: Tracer Bullet

Write ONE test that confirms ONE thing about the system — the most fundamental behavior. It must:

- Exercise a real code path through the public interface
- Fail for the right reason (the behavior does not exist yet, not a compile error or import failure)
- Read like a specification

**For Vitest tests:** run `npm test --workspace=apps/server`.
**For Playwright E2E tests:** run `npm run test:e2e` from the repo root (this builds first, then runs Playwright). Use `--headed` variant to watch the browser during development.

Confirm the test is **RED** before writing any implementation.

### Phase 3: Incremental Loop

Repeat this cycle until the task is complete:

#### RED
- Write the next test — one test, one behavior
- The test must be for real user-facing or system-level behavior, not internal structure
- Run it. It must fail. If it passes without implementation, the test is wrong or the behavior already exists — investigate before continuing

#### GREEN
- Write only enough code to make the current test pass
- Do not anticipate future tests
- Do not abstract prematurely
- Do not make other tests pass as a side effect (if they do, note it but don't rely on it)
- Run the full test suite. Current test must pass; no previously passing test may break

#### REFACTOR
- With the suite green, clean up: remove duplication, clarify names, improve structure
- No new behavior. No new tests. Suite must stay green throughout
- If refactoring reveals a design problem, fix the design — do not paper over it with a comment

Then move to the next slice.

### Phase 4: Done

The loop ends when all planned slices have a passing test and the suite is fully green. Report:

- What was built (behaviors now verified)
- Test count before and after
- Any open questions or deferred slices

---

## Heuristics

- If you cannot write a test through the public interface, the interface is wrong — fix it, don't work around it
- If a test requires extensive setup, the design has too many dependencies — simplify before continuing
- If you are tempted to mock an internal collaborator, stop — restructure so the test can use the real thing, or push the boundary to a genuine external system
- One assertion per test is a goal, not a rule — but multiple assertions that all verify the same behavior are fine; multiple assertions that verify different behaviors are two tests
- Name tests as specifications: `<subject> <does what> <under what condition>`
