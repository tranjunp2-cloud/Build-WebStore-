---
title: "ClaudeKit rules + workflow refactor"
description: "Split CLAUDE.md, create canonical docs, add workflow rules per ClaudeKit best practices"
status: completed
priority: P2
effort: 10h
branch: docs/phase-1-release-showcase
tags: [rules, workflow, docs, ai-workflow]
created: 2026-04-19
completed: 2026-04-19
---

## Purpose

Right-size project `CLAUDE.md` (400→≤200 lines), introduce `.claude/rules/*.md` path-scoped domain rules, fill canonical `docs/` set (codebase-summary, code-standards, system-architecture, PDR, roadmap, changelog), document primary workflow (planner → cook → tester → reviewer → docs-manager). Preserves Vercel CI deploy, `plans/` convention, staging-first git flow.

## Constraints (non-goals)

- No new skills (reuse global + project skills).
- No migration of existing 30+ plans.
- No rewrite of `docs/architecture/F*.md`, `docs/prd/`, `docs/qa/`, `docs/design/` — link instead.
- No change to Vercel CI architecture or branch strategy.
- No CI gate hardening, docs cadence automation, or formal rollout ceremony (out of scope per user decision 2026-04-19).

## Phases

| # | Phase | File | Effort | Status |
|---|-------|------|--------|--------|
| 01 | Split CLAUDE.md + create `.claude/rules/` | [phase-01](phase-01-split-claude-md-and-rules.md) | 4h | ✅ completed |
| 02 | Canonical `docs/` — 6 files | [phase-02](phase-02-canonical-docs.md) | 4h | ✅ completed |
| 03 | Workflow + orchestration docs | [phase-03](phase-03-workflow-orchestration-docs.md) | 2h | ✅ completed |

## Dependency Graph

```
01 ─┬─> 02
    └─> 03
```

Phase 01 is the keystone (rule files referenced by 02/03). 02 and 03 can run in parallel after 01. All 3 phases ship as **1 PR to staging**.

## File Ownership

- Phase 01: `CLAUDE.md`, `.claude/rules/*.md` (new)
- Phase 02: `docs/codebase-summary.md`, `docs/code-standards.md`, `docs/system-architecture.md`, `docs/project-overview-pdr.md`, `docs/development-roadmap.md`, `docs/project-changelog.md` (all new)
- Phase 03: `.claude/rules/workflow.md`, `.claude/rules/orchestration.md` (new)

## Decisions (locked 2026-04-19)

1. **`.claude/rules/*.md` → commit to git** (shared team context; phase-01)
2. **CLAUDE.md → strict ≤200 lines** (phase-01 non-negotiable; overflow → rules/ or docs/)
3. **Docs ownership split** (phase-02 frontmatter):
   - PM → `project-overview-pdr.md`, `development-roadmap.md`
   - Dev → `codebase-summary.md`, `code-standards.md`, `system-architecture.md`, `project-changelog.md`
   - QC co-owns test-convention + §QA of `code-standards.md`
4. **Changelog seed window → since v1.0 start** — auto-detect: `git log main --reverse --since=2026-01-01 | head -1`
5. **Rollout → 1 PR to staging** (no CI gate hardening, no cadence automation in this plan)
6. **Timing → finish this week** (≤2026-04-26, ~10h total)

## Success Criteria

- Project `CLAUDE.md` ≤ 200 lines (verify via `wc -l`).
- 6 canonical `docs/*.md` exist, each ≥80 lines of real content.
- `.claude/rules/` has ≥7 rule files (6 from phase-01 + workflow + orchestration from phase-03).
- New dev + AI agent can orient to project in <30 min from `codebase-summary.md` + `system-architecture.md`.
- No fact from current `CLAUDE.md` lost (mapping table in PR description).

## Rollback Plan

Single PR = single revert target. `git revert <merge-sha>` if needed. No runtime code, no schema changes — non-destructive rollback.

## Unresolved Questions

None — all decisions locked via `/ckm:plan:validate` interview 2026-04-19.
