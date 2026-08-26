# Phase 03 — Workflow + orchestration docs

## Context Links

- Parent: [plan.md](plan.md)
- Depends on: [phase-01](phase-01-split-claude-md-and-rules.md)
- Research: `research/researcher-01-claudekit-guide-extraction.md` §3, §4, §8
- Global refs: `~/.claude/rules/primary-workflow.md`, `~/.claude/rules/orchestration-protocol.md`, `~/.claude/rules/skill-workflow-routing.md`

## Overview

- **Date:** 2026-04-19
- **Priority:** P2
- **Status:** pending
- **Review status:** —
- **Description:** Two new `.claude/rules/` files documenting the primary AI workflow and subagent orchestration protocol, tailored to ech-prime-web-v2 (Next.js + Payload specifics). Supplement, not duplicate, global workflow rules.

## Key Insights

- Global `~/.claude/rules/primary-workflow.md` already defines planner → cook → tester → reviewer flow generically. Project version adds: when to skip plan (typo/one-liner), which `/ck:*` skill for Next.js/Payload/Tailwind work.
- Devs need a decision matrix, not philosophy. Keep concrete: "bug on staging → `/ck:fix --auto`".
- `/clear` discipline missing from current CLAUDE.md — call it out explicitly.

## Requirements

**Functional**
- `workflow.md` states: feature path, bug path, investigation path, with gate agents per stage.
- `orchestration.md` states: context isolation, file-ownership rules, parallel vs sequential, skill routing decision tree.
- Both files include worked examples using real ECH feature names (F01, F05, F08, F13).

**Non-functional**
- Each file ≤150 lines (KISS).
- No contradiction with global rules — extend, don't override.

## Architecture

```
.claude/rules/workflow.md
  ├─ Feature flow: planner → cook → tester → reviewer → docs-manager
  ├─ Bug flow: debugger → fix → tester → reviewer
  ├─ Investigation flow: scout → debug → brainstorm → plan
  ├─ Decision matrix: skip plan when…, skip reviewer when…
  ├─ /clear protocol
  └─ Skill routing: Next.js / Payload / Tailwind / CI

.claude/rules/orchestration.md
  ├─ Subagent context isolation (paths, no history dump)
  ├─ File ownership (parallel agents → disjoint globs)
  ├─ Parallel vs sequential patterns
  ├─ Status protocol (DONE / DONE_WITH_CONCERNS / BLOCKED / NEEDS_CONTEXT)
  └─ Escalation when agent fails 3x
```

## Related Code Files

**Create**
- `.claude/rules/workflow.md`
- `.claude/rules/orchestration.md`

**Modify**
- `CLAUDE.md` (add pointer to both)
- `docs/code-standards.md` (phase-02 output; add "When working with AI: see `.claude/rules/workflow.md`")

**Delete:** none

## Implementation Steps

1. Read `~/.claude/rules/primary-workflow.md` and `~/.claude/rules/orchestration-protocol.md` — extract sections NOT covered by project-specific concerns.
2. Draft `workflow.md`:
   - Section A: flows with ASCII arrows + agent names.
   - Section B: decision matrix table ("I want to…" → "Use…").
   - Section C: skill routing for this stack (Next.js App Router → `/ck:web-frameworks`; Payload schema → `/ck:databases`; Tailwind styling → `/ck:ui-styling`; Vercel deploy → `/ck:deploy`).
   - Section D: `/clear` triggers (between bug + feature, between F01 work and F05 work, after long research sessions).
3. Draft `orchestration.md`:
   - Copy context-isolation + file-ownership principles.
   - Add project-specific: DB migration agent ownership (schema + db-setup.js + check-migrations.js must be edited atomically).
   - Parallel example: F01 block generator + F01 test file → two agents OK (different files).
   - Sequential example: migration + seed + test → must be sequential.
4. Worked examples:
   - "Implement F15 admin dashboard" → full planner→cook→tester→reviewer flow
   - "Staging 500 on /api/ai-generate" → debugger → fix → tester flow
   - "Explore moving to tRPC" → brainstorm → plan (stop here — no implementation)
5. Cross-link phase-02 docs (e.g., `docs/code-standards.md` for TS rules enforced during cook).

## Todo List

- [ ] Read global rules, identify gaps
- [ ] Draft `workflow.md` sections A–D
- [ ] Draft `orchestration.md` with project-specific file ownership
- [ ] Write 3 worked examples using real F-IDs
- [ ] Add pointers to `CLAUDE.md`
- [ ] Verify no contradictions with global rules (diff-read)
- [ ] Peer-review with 1 dev (does the decision matrix match their intuition?)

## Success Criteria

- Both files exist, ≤150 lines each.
- Decision matrix table covers ≥6 common scenarios.
- 3 worked examples present, using real F-IDs.
- Review dev confirms they'd follow the matrix for their next task.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Contradicts global rules, confuses AI | Low | High | Diff-read + "extends, not overrides" note at top |
| Too abstract — devs don't use | Medium | Medium | Worked examples with real F-IDs |
| Stale as skills evolve | Medium | Low | Dev lead reviews quarterly |
| Orchestration file-ownership ambiguous for multi-file features | Medium | Medium | Examples for F01-style feature (spans 10+ files) |

## Security Considerations

- None (documentation only).

## Next Steps

Workflow rules guide future AI/dev sessions. Quarterly re-review by Dev lead keeps skill routing current as `/ck:*` commands evolve.
