---
name: write-prd
description: Synthesizes the current conversation context and codebase understanding into a structured PRD. Does not interview the user. Writes the PRD to .scratch/<feature-slug>/PRD.md.
argument-hint: [feature-slug]
allowed-tools: [Read, Write, Glob, Grep, Bash]
---

# Write PRD

Synthesize everything already known — from the current conversation, prior interview output, and any codebase exploration — into a complete, structured PRD. **Do not ask questions. Do not interview. Write.**

## Output Location

- Derive the feature slug from `$ARGUMENTS` if provided, otherwise derive it from the feature name in context (lowercase, hyphen-separated, no special characters).
- Write the PRD to: `.scratch/<feature-slug>/PRD.md`
- Create the directory if it does not exist.

## PRD Structure

Write the PRD using exactly this structure:

```markdown
# PRD: <Feature Name>

## Status
Draft | In Review | Approved

## Problem Statement
What problem does this solve, for whom, and why it matters now.

## Goals
- Measurable goal 1
- Measurable goal 2

## Non-Goals
What this explicitly does not do.

## Background & Context
Relevant history, constraints, or prior decisions that shaped this PRD.

## User Stories
- As a <role>, I want <capability> so that <outcome>.

## Functional Requirements
Numbered list of concrete, testable requirements.

1. The system shall...
2. The system shall...

## Non-Functional Requirements
Performance, security, reliability, scalability, and other quality constraints.

## Technical Design Notes
Key architectural decisions, integration points, data models, or constraints already resolved.

## Out of Scope
Explicit list of things deferred to a later phase.

## Open Questions
Unresolved decisions that still need an owner or answer before implementation begins.

## Success Criteria
How we will know this feature shipped successfully.

## Milestones
High-level sequencing if the work spans multiple phases.
```

## Instructions

1. Determine the feature slug and resolve the output path.
2. Read relevant files from the codebase if needed to fill technical context — do not ask the user for information you can derive.
3. Write the PRD in full. Do not leave placeholder sections blank — if something is genuinely unknown, note it explicitly under Open Questions.
4. Create the directory `.scratch/<feature-slug>/` and write `PRD.md` there.
5. Report the path of the written file to the user.
