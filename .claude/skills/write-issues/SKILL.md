---
name: write-issues
description: Breaks a plan, spec, or PRD into independently-grabbable issues using vertical slices (tracer bullets). Proposes the breakdown as a numbered list, iterates with the user until approved, then publishes one file per issue to .scratch/<feature-slug>/issues/<NN>-<slug>.md.
argument-hint: <feature-slug or path to PRD>
allowed-tools: [Read, Write, Glob, Grep, Bash]
---

# Write Issues

Break a plan, spec, or PRD into a set of independently-grabbable issues using vertical slices. Each slice is a tracer bullet — it cuts through every layer needed to deliver one thin, working capability end-to-end.

**Input:** $ARGUMENTS — a feature slug, a path to a PRD, or context already in the conversation.

## Phase 1: Read the Source

1. If a path is provided, read the file. If a feature slug is provided, look for `.scratch/<feature-slug>/PRD.md` and read it. If neither, synthesize from conversation context.
2. Identify the full scope: goals, functional requirements, user stories, technical notes.

## Phase 2: Propose the Breakdown

Apply these slicing rules:

- **Vertical slices only** — each issue must touch all layers it needs (data, logic, UI, API) and deliver something demonstrably working.
- **Independently grabbable** — any issue can be picked up without requiring another to be in progress.
- **Tracer-bullet order** — sequence slices so the earliest issues establish the skeleton; later ones flesh it out. The first slice should produce something end-to-end, even if thin.
- **Right-sized** — an issue should be completable in a single focused session. If a slice is too large, split it. If two slices always land together, merge them.
- **No horizontal slices** — "set up the database" or "build all the models" are not valid issues on their own unless they are the tracer bullet foundation.

Present the proposed breakdown as a **numbered list** in this format:

```
Proposed issue breakdown for <feature-name>:

1. <issue title> — <one-sentence description of what this slice delivers>
2. <issue title> — <one-sentence description>
...
```

Then ask: **"Does this breakdown look right, or would you like to adjust any slices?"**

## Phase 3: Iterate

- If the user requests changes (split, merge, reorder, rename, add, remove), apply them and re-present the full numbered list.
- Repeat until the user explicitly approves. Approval signals: "looks good", "approved", "yes", "ship it", "publish", or equivalent.
- Do not publish anything until approval is explicit.

## Phase 4: Publish

Once approved:

1. Determine the feature slug from the argument or conversation context.
2. Create the directory `.scratch/<feature-slug>/issues/` if it does not exist.
3. Check for existing files in that directory and continue numbering from the next available `NN` (pad to two digits: 01, 02, ...).
4. For each approved slice, write one file: `.scratch/<feature-slug>/issues/<NN>-<slug>.md`
   - `NN` = zero-padded sequence number starting at 01
   - `slug` = lowercase, hyphen-separated title of the issue

### Issue File Structure

```markdown
---
status: pending
---

# <Issue Title>

> **Status:** `pending` | `in-progress` | `done`

## Clarification
Open questions or decisions that need to be resolved before or during implementation. Remove entries as they are answered.
- [ ] Question or ambiguity (if any)

## Context
Which feature/PRD this belongs to, and where it fits in the sequence.

## Goal
What this slice delivers — the thin working capability it adds.

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Technical Notes
Key implementation details, constraints, or pointers to relevant code.

## Out of Scope
What is explicitly deferred to a later issue.
```

**Status field rules:**
- Default on creation: `pending`
- Values: `pending` (not started) | `in-progress` (actively being worked) | `done` (all acceptance criteria met)
- The frontmatter `status` field is the canonical value; the inline `> **Status:**` line is a human-readable mirror — update both together.

**Clarification section rules:**
- Include only if there are genuine open questions. If none, write `_No open questions._` rather than leaving it empty.
- Each item is a checkbox so answered questions can be checked off without deleting them.

5. After writing all files, report the full list of created paths to the user.
