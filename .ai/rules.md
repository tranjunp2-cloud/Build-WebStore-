# BMAD AI Rules — PrimeWeb

> Claude Code / Cursor PHẢI đọc file này trước khi làm bất kỳ feature nào.

## Before Coding ANY New Feature

```
1. Read SPEC.md (source of truth)
2. Read relevant docs in /docs (PRD, architecture, stories)
3. Identify impacted modules (collections, routes, components)
4. Run Readiness Gate 4/4 (SPEC.md §2.3)
5. Break work into stories/tasks (GIVEN/WHEN/THEN)
6. Implement ONLY approved scope — do NOT add extras
7. Apply 9-Point Done Checklist (SPEC.md §13)
8. Update docs after implementation
```

## Agent Roles

| Agent | File | Khi nào dùng |
|-------|------|-------------|
| PO Agent | `.ai/prompts/po-agent.md` | Tạo PRD, refine requirements, prioritize features |
| Architect Agent | `.ai/prompts/architect-agent.md` | System design, API contracts, data models |
| Dev Agent | `.ai/prompts/dev-agent.md` | Implement code, follow SPEC + rules |
| QA Agent | `.ai/prompts/qa-agent.md` | Write tests, verify 9-Point, E2E flows |

## BMAD Flow in This Repo

```
SPEC.md (§1 Product) → idea/requirement
    ↓
PO Agent → PRD in docs/prd/
    ↓
Architect Agent → Architecture note in docs/architecture/
    ↓
Readiness Gate (4/4 PASS) → SPEC.md §2.3
    ↓
Dev Agent → Code in src/
    ↓
QA Agent → Tests + 9-Point Checklist
    ↓
docs/ updated → commit → deploy
```

## File Hierarchy

```
SPEC.md          ← Source of Truth (19 sections, BMAD)
.ai/rules.md     ← THIS FILE (AI behavior rules)
.ai/prompts/     ← Agent-specific prompts
docs/            ← Feature docs (PRD, stories, architecture, QA)
.cursor/rules/   ← Cursor-specific coding rules
src/             ← Code
```

## Non-negotiable Rules

1. **Docker only** — KHÔNG `npm install` / `npm run dev` trực tiếp
2. **SPEC.md is truth** — code phải match SPEC, không ngược lại
3. **Soft delete everywhere** — `deletedAt`, KHÔNG hard delete
4. **Tenant scope** — MỌI query phải WHERE tenant = X
5. **No code without Gate** — Feature mới phải qua Readiness Gate
