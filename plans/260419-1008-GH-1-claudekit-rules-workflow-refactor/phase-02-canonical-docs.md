# Phase 02 — Canonical `docs/` skeleton

## Context Links

- Parent: [plan.md](plan.md)
- Depends on: [phase-01](phase-01-split-claude-md-and-rules.md) (rule files exist so docs can link them)
- Research: `research/researcher-02-current-state-audit.md` §4 (gap table)
- Existing domain docs: `docs/architecture/F*.md`, `docs/prd/`, `docs/PROJECT_ALIGNMENT.md`, `docs/TEST_CONVENTION.md`

## Overview

- **Date:** 2026-04-19
- **Priority:** P1 (closes ClaudeKit canonical-doc gap)
- **Status:** pending
- **Review status:** —
- **Description:** Create 6 canonical docs ClaudeKit expects. Link to existing per-feature docs (don't duplicate). Real content, not placeholders.

## Key Insights

- Project has rich per-feature docs but no unified entry points — new devs and AI agents can't get oriented.
- Existing `PROJECT_ALIGNMENT.md`, `SPRINT0_DETAIL.md`, `.github/DEPLOY.md`, `docs/architecture/F*.md` supply 60%+ content — aggregate, don't rewrite.
- `development-roadmap.md` duplicates GitHub Milestones; treat roadmap as narrative + links, not ticket mirror.

## Requirements

**Functional**
- Each of 6 canonical files has sections real enough for a new dev to orient in ≤30 min.
- Every canonical doc links back to source-of-truth detail files.
- `system-architecture.md` has at least one diagram (Mermaid OK) showing Next.js ↔ Payload ↔ Postgres ↔ Vercel flow.

**Non-functional**
- No doc >400 lines (split if exceeded).
- Every doc has "Last updated: YYYY-MM-DD" and owner.
- Works offline (no external-only links for critical info).

## Architecture

```
docs/
├── codebase-summary.md        ← src/ map, entry points
├── code-standards.md          ← lint/format/TS/imports/modularization
├── system-architecture.md     ← unified diagram, links → architecture/F*.md
├── project-overview-pdr.md    ← vision, KPIs (wraps PROJECT_ALIGNMENT.md + prd/)
├── development-roadmap.md     ← v1.0 / v1.1 / v2.0 phases
├── project-changelog.md       ← curated per-release notes
└── (existing) architecture/, prd/, qa/, design/, standards/  ← unchanged
```

Source aggregation:
- `codebase-summary.md` ← `tree src/` + `README.md` + key module notes
- `code-standards.md` ← workspace CLAUDE.md §5 + `TEST_CONVENTION.md` + `eslint.config.mjs` + `tsconfig.json`
- `system-architecture.md` ← `docs/architecture/F*.md` index + `docs/DB-LIFECYCLE.md` + `.claude/rules/vercel-deploy.md`
- `project-overview-pdr.md` ← `docs/PROJECT_ALIGNMENT.md` + `docs/prd/` index
- `development-roadmap.md` ← `docs/SPRINT0_DETAIL.md` + GitHub Milestones (v1.0, v1.1)
- `project-changelog.md` ← recent `docs/journals/*.md` + merged PR list since v1.0 start

## Related Code Files

**Create**
- `docs/codebase-summary.md`
- `docs/code-standards.md`
- `docs/system-architecture.md`
- `docs/project-overview-pdr.md`
- `docs/development-roadmap.md`
- `docs/project-changelog.md`

**Modify**
- `README.md` (add "See `docs/codebase-summary.md` for layout" line)
- `CLAUDE.md` (ensure pointer index from phase-01 lists all 6)

**Delete:** none

## Implementation Steps

1. Run `tree -L 3 src/ -I 'node_modules|__tests__'` → seed `codebase-summary.md` directory tree.
2. For each src/ top-level dir, write 1–3 lines: purpose, key exports, entry files.
3. `code-standards.md`: grep `eslint.config.mjs`, `tsconfig.json`, `package.json` (lint scripts); aggregate into one doc with sections: TypeScript strict, import order, naming, modularization ≤200 lines, error handling, security rules.
4. `system-architecture.md`: write Mermaid diagram (use `/ck:mermaidjs-v11` syntax). Layers: Client (Next.js app router) → Server (API routes + Payload) → DB (Neon Postgres) → External (Vercel edge, S3, Stripe, Lark). List `docs/architecture/F*.md` as sub-pages.
5. `project-overview-pdr.md`: copy vision/KPI/persona sections from `PROJECT_ALIGNMENT.md`; table-link each F-feature to its `docs/prd/F*.md`.
6. `development-roadmap.md`: `gh api repos/primeproduction/ech-prime-web-v2/milestones` → table rows (v1.0 deadline 15/04, v1.1 deadline 30/04). Add "Open blockers" section from pending-task items in memory.
7. `project-changelog.md`: seed with last 30 days: `git log --since="2026-03-19" --merges --oneline` + grouped by feature area. Add header "Generated 2026-04-19; maintained per-release going forward".
8. Each doc: add frontmatter `owner: {PM|Dev|QC}` per ownership split (decision 2026-04-19):
   - `project-overview-pdr.md` → `owner: PM`
   - `development-roadmap.md` → `owner: PM`
   - `codebase-summary.md` → `owner: Dev`
   - `code-standards.md` → `owner: Dev` (QC co-owns §QA)
   - `system-architecture.md` → `owner: Dev`
   - `project-changelog.md` → `owner: Dev`
   - Plus `last_updated: 2026-04-19` on all.
9. Cross-link pass: each doc has ≥1 link to related canonical doc.

## Todo List

- [ ] Generate `src/` tree snapshot
- [ ] Write `codebase-summary.md`
- [ ] Write `code-standards.md` (aggregate lint + TS + naming + modularization)
- [ ] Write `system-architecture.md` + Mermaid diagram
- [ ] Write `project-overview-pdr.md` (wraps alignment + PRD index)
- [ ] Write `development-roadmap.md` (milestones + blockers)
- [ ] Seed `project-changelog.md` from git log
- [ ] Add owner + last_updated frontmatter to all 6
- [ ] Cross-link pass
- [ ] Update `README.md` pointer
- [ ] Verify CLAUDE.md pointer index includes all 6

## Success Criteria

- 6 files exist in `docs/` root, each ≥80 lines.
- `system-architecture.md` renders Mermaid diagram correctly.
- New dev reads `codebase-summary.md` + `system-architecture.md` in <30 min → can locate any feature area.
- No duplicate facts (pre-PR grep audit of 3 anchors: `git.deploymentEnabled`, `commitlint`, `VERCEL_TOKEN`).

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Docs drift from code | High | Medium | `last_updated` visible in frontmatter; owner re-reviews quarterly |
| Duplicate content with architecture/F*.md | Medium | Low | Link-only, don't restate |
| Roadmap dates stale | High | Low | PM re-generates from `gh api milestones` monthly |
| Changelog seed too verbose | Medium | Low | Group by feature area, max 5 bullets per group |

## Security Considerations

- No secrets in docs (changelog may reference env var names, never values).
- PRD/vision docs may include business-sensitive roadmap — keep repo-internal (private repo already).

## Next Steps

Feeds phase-03 (workflow doc references these as "update after feature" targets). Owner matrix lives in frontmatter of each doc (see Implementation Steps §8).
