---
name: orchestration
description: Subagent orchestration — context isolation, file ownership, parallel vs sequential, status protocol
---

# Orchestration

Extends `~/.claude/rules/orchestration-protocol.md` with project-specific file-ownership patterns for Next.js + Payload + Vercel CI.

## Context isolation (mandatory)

Subagents receive only the context they need. Never pass full session history.

**Craft prompts explicitly:**
- Task description, relevant file paths, acceptance criteria
- Not "here's what we discussed"
- List specific files to read/modify — not "look at the codebase"
- Summarize decisions rather than replaying conversation

**Delegation template:**
```
Task: [specific task description]
Files to modify: [list]
Files to read for context: [list]
Acceptance criteria: [list]
Constraints: [any relevant constraints]
Plan reference: [phase file path if applicable]

Work context: /Users/ngotuannhan/Claude Code/projects/ech-prime-web-v2
Reports: /Users/.../plans/{plan-dir}/reports/
Plans: /Users/.../plans/
```

## File ownership (project-specific)

Parallel subagents must own disjoint file globs. Common patterns:

### Must be atomic (single agent, sequential)

- Schema changes — `src/collections/*.ts` + `scripts/db-setup.js` + `scripts/check-migrations.js` must be edited together. Never split across parallel agents.
- Seed data — `scripts/seed.ts` + the seeded collection files → one agent.
- AI gen pipeline — `src/lib/ai/**` files often share state; split only along clear module boundaries (e.g. prompt-builder vs variant-rotator OK).

### Safe to parallelize

- Feature code + its tests — agent A owns `src/app/api/v1/orders/*`, agent B owns `src/__tests__/unit/orders/*` (different globs, same feature).
- Multiple features — F01 agent owns `src/blocks/**` + `src/app/(builder)/**`; F09 agent owns `src/app/(storefront)/**`.
- Docs + code — docs-manager owns `docs/*.md`; fullstack-developer owns `src/**`.

### Rules

- Tester owns test files only; reads implementation but never edits it
- Code-reviewer is read-only
- Lead (main Claude) resolves ownership conflicts by restructuring or handling shared files directly
- If ownership violation detected: STOP and report immediately

## Parallel vs sequential

**Sequential when:**
- Output of step N is input to step N+1
- Database migration → seed → test
- Plan → research → implement → review

**Parallel when:**
- Tasks touch disjoint globs
- Research topics are independent (e.g. "research Stripe payment UX" + "research MY shipping APIs")
- Multiple features in same sprint, different code areas

**Example — Phase 02 of this plan:**
Could parallelize: `docs/CODEBASE_SUMMARY.md` (reads `src/` tree) + `docs/tracking/OPEN_BLOCKERS.md` (reads GitHub issues) + `docs/CHANGELOG.md` (reads git log) — different source data, no cross-deps.
Sequential: `docs/architecture/_OVERVIEW.md` must follow `CODEBASE_SUMMARY.md` (references it).

## Status protocol

Subagents MUST end their response with:

```
**Status:** DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
**Summary:** [1-2 sentence summary]
**Concerns/Blockers:** [if applicable]
```

| Status | Meaning | Main agent action |
|--------|---------|------------------|
| **DONE** | Task completed successfully | Proceed to next step |
| **DONE_WITH_CONCERNS** | Completed but flagged doubts | Read concerns → address if correctness/scope; proceed if observational |
| **BLOCKED** | Cannot complete | Assess blocker → provide context / break task / escalate |
| **NEEDS_CONTEXT** | Missing info | Provide missing context → re-dispatch |

## Retry + escalation rules

- Never retry same approach after BLOCKED — try more context → simpler task → more capable model → escalate
- If subagent fails 3+ times on same task → escalate to user, don't retry blindly
- DONE_WITH_CONCERNS about file growth / tech debt → note for future, proceed now
- DONE_WITH_CONCERNS about correctness → address before review

## Subagent roles (project-tuned)

| Role | When to spawn | Agent type |
|------|---------------|-----------|
| `planner` | Before non-trivial implementation | `planner` |
| `researcher` | 2+ independent research topics | `researcher` (max 2 parallel per `development-rules.md`) |
| `fullstack-developer` | Implementing a phase | `fullstack-developer` |
| `tester` | After cook, before code-reviewer | `tester` |
| `code-reviewer` | Before merge | `code-reviewer` |
| `debugger` | CI failure, staging incident, bug report | `debugger` |
| `docs-manager` | After feature merge with doc impact | `docs-manager` |
| `project-manager` | Finalize — sync phase statuses, update plan.md | `project-manager` |
| `git-manager` | Commit + push + PR | `git-manager` |

## Subagent resource limits

Per hook warning: each subagent has 200K token context. Spawn intelligently:
- Don't dump full plan.md + all phase files into a subagent — pass only the relevant phase file path + acceptance criteria
- Max 2 parallel researcher agents (per project rule)
- For large codebase exploration, use `/ck:scout` (fast, parallel internally) instead of multiple general-purpose agents

## Reports path convention

When delegating, always include:
```
Reports: /Users/ngotuannhan/Claude Code/projects/ech-prime-web-v2/plans/{plan-dir}/reports/
Plans: /Users/ngotuannhan/Claude Code/projects/ech-prime-web-v2/plans/
```

Subagents save reports as `{type}-{YYMMDD-HHMM}-{slug}.md` in the reports/ dir.
