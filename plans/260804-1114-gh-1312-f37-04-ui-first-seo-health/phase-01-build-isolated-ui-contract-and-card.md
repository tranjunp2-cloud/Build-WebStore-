# Phase 01: Build the Isolated UI Contract and Card

## Context Links

- Plan: [GH-1312 F37-04 UI-first SEO Health](./plan.md)
- Research: [UI source audit](./research/ui-source-audit.md)
- Product contract: `docs/prd/F37-local-seo-search-performance.md` §12.3
- Dashboard design: `docs/design/F03-dashboard-design.md` §3.1
- QA targets: `docs/qa/F37-local-seo.md` TC-F37-04-10/12/16

## Overview

- **Priority:** P0
- **Status:** complete; Story Sync moved to Phase 3 release closeout
- **Effort:** 6h
- **Description:** Build a directly testable presentational SEO Health card without changing the runtime Dashboard or importing PR #1728 code.

<!-- Updated: Red Team Session 1 -->

## Entry Gate

> Historical Phase 1 gate. Story Sync was deferred and is now tracked only in reopened Phase 3.

- Read `docs/TEST_CONVENTION.md`; register/reconcile Phase 1 `[x] AUTO` TC-IDs before tests.
- Rewrite US-F37-04 story/QA clauses to PRD AC-01..07 and FR-15..21.
- Run approved Story Sync and verify live #1312 requires all deduplicated root causes, not three.
- Record the future staging fixture owner, dedicated tenant/site/domain, seed/reset method, baseline checksum, mutation lock, and #1728 preflight. Fixture readiness blocks Phase 2, not this UI shell.

## Key Insights

- Current `SeoHealth` renders three legacy buckets plus a non-functional Score History placeholder.
- Current AI strip appears for any issue, and issue rows lack `AI`/`You` ownership.
- The current endpoint still returns the legacy formula. Connecting it now would ship a polished but false score.
- The old F37 dual-card wireframe is stale. Reuse the current F03 card shell and PRD §12.3 layout.
- PR #1728 overlaps Editor files, locales, F37 story/QA/architecture, and Local Business tests. Keep Phase 1 isolated and audit those paths after rebase.

## Requirements

### Functional

- Render `loading`, `error`, and `ready` as a discriminated state.
- Ready state renders one gauge, four ordered bucket bars, a conditional AI strip, all deduplicated unresolved issues, and `All clear` at 100.
- Bucket bars show progress plus qualitative status only; never show bucket points.
- Issue rows receive semantic actions and callbacks, not arbitrary `href`.
- Loading/error do not mount `Gauge` or render any numeric score.
- Mobile order: gauge → buckets → optional AI strip → one-column issues.
- Render a finite catalog of aggregated root-cause groups. Record-level failures contribute counts, not one DOM row each.

### Non-functional

- Keep the card file near 200 LOC by extracting only genuinely reusable types/subparts.
- Reuse existing `Gauge`, card shell, design tokens, and `AIFixModal` interaction shape.
- English and Malay remain complete.
- Buttons/links are keyboard reachable; mobile targets are at least 44px.

## Architecture

```text
typed fixture / future client state
        │
        ▼
SeoHealthCard(load state)
 ├─ loading skeleton (no Gauge)
 ├─ error + Retry (no Gauge)
 └─ ready
     ├─ Gauge + 4 qualitative bars
     ├─ conditional AI strip
     └─ issue rows → onIssueAction(semantic action)
```

The UI view model contains `progress: 0..100` and mapper-provided `good | needsWork`; one mapper locks `good` at 80% or above. The component does not infer thresholds or expose bucket points.

### Exhaustive Issue Action Catalog

| Issue codes | Owner / CTA | Semantic destination |
|---|---|---|
| `store-name`, `business-address`, `phone` | You / Edit | Editor Brand, Local Business/address, Contact/phone |
| `schema-subtype`, `opening-hours`, `map-location`, `price-range` | You / Edit | Matching Local Business control |
| `primary-domain` | You / Set up | Domain settings |
| `store-unpublished` | You / Publish | Editor publish |
| `meta-title`, `meta-description` | AI / Fix | Existing filtered metadata modal |
| `content-quality`, `image-alt` | You / Edit | Affected page canvas or product |
| `search-verification` | You / Set up | Editor SEO/search verification |

Organization, crawler access, and indexability never become seller rows. The action union has no default route, encodes identifiers, and later uses `assertNever`. Query params select UI state only; they never authorize access.

## Related Code Files

- **Create:** `/home/liam/data/worktrees/ech-prime-web-v2-worktree-1/src/components/dashboard/revamp/seo-health-card.tsx` — pure card and state rendering.
- **Modify:** `/home/liam/data/worktrees/ech-prime-web-v2-worktree-1/src/lib/dashboard/dashboard-types.ts` — additive target view model; preserve legacy `SeoData` until Phase 2.
- **Create:** `/home/liam/data/worktrees/ech-prime-web-v2-worktree-1/src/lib/dashboard/seo-health-view-model.ts` — clamped progress and the sole tested `good >= 80` mapper.
- **Modify:** `/home/liam/data/worktrees/ech-prime-web-v2-worktree-1/src/app/(dashboard)/dashboard/dashboard-revamp.css` — four-bar grid, ownership badge, skeleton/error, responsive actions.
- **Modify:** `/home/liam/data/worktrees/ech-prime-web-v2-worktree-1/src/i18n/locales/en.json` — target labels/states.
- **Modify:** `/home/liam/data/worktrees/ech-prime-web-v2-worktree-1/src/i18n/locales/ms.json` — Malay parity.
- **Create:** `/home/liam/data/worktrees/ech-prime-web-v2-worktree-1/src/__tests__/unit/dashboard/seo-health-card.test.tsx` — direct component contract tests.
- **Modify before code:** `/home/liam/data/worktrees/ech-prime-web-v2-worktree-1/docs/stories/F37-local-seo-stories.md` and `docs/qa/F37-local-seo.md` — canonical story and Phase 1 TC mapping.

## Runtime Exclusion

Do not modify or import the new card from:

- `src/components/dashboard/revamp/seo-health.tsx`
- `src/lib/dashboard/seo-data.ts`
- `src/app/(dashboard)/dashboard/page.tsx`
- `src/app/api/sites/[siteId]/local-seo-score/route.ts`
- `src/lib/seo/local-seo-score.ts`

## Implementation Steps

1. Complete the contract/test/fixture entry gate in an isolated commit.
2. Add exact bucket, issue-code, semantic-action, ready-data, and load-state types without changing legacy `SeoData`.
3. Build loading/error branches and assert neither renders Gauge or a number.
4. Build fixed Business, Schema, AI Discoverability, and Technical bars.
5. Render every supplied issue group; never slice to three.
6. Define one AI invariant: strip visibility and count equal the unique title/description affected-item count.
7. Keep the card out of production runtime; use fixtures for review.
8. Add EN/MS copy and scoped desktop/mobile CSS.
9. Test at least seven distinct root causes and assert all rows, stable order, actions, and callbacks.
10. Run focused test, typecheck, lint, and `git diff --check`.

## Todo

- [x] Add additive target DTO and semantic action union.
- [x] Implement loading/error/ready card states.
- [x] Implement four bucket bars and qualitative labels.
- [x] Implement actor badges and conditional AI strip.
- [x] Implement all-clear and mobile behavior.
- [x] Add EN/MS copy.
- [x] Add direct component coverage.
- [x] Prove at least seven root causes render with no three-row truncation.
- [x] Verify no production import or PR #1728 dependency.

## Verification Evidence

- Focused Vitest: 1 file, 8/8 tests passed, no skip/todo.
- Focused lint: no warnings or errors; repository lint exits 0 with pre-existing warnings only.
- `git diff --check`: passed.
- Full typecheck has no Phase 1 errors; it remains non-zero on pre-existing `pdf-label-preview.tsx` dependency/type errors.
- Code review: 9.5/10, approved with zero critical findings.

## Success Criteria

- Fixture states cover loading, error/retry, partial, and complete 100.
- Partial fixture renders all supplied root causes once.
- A fixture with at least seven root causes renders exactly seven rows and seven callbacks.
- Complete fixture shows four full bars and `All clear`, with no AI strip or issue rows.
- Non-AI issues never expose AI Fix behavior.
- No Score History UI exists in the new card.
- Phase diff is behavior-neutral in production.

## Risk Assessment

| Risk | Impact | Mitigation |
|---|---|---|
| UI accidentally mounts with legacy data | False seller score | No production import; add an import-boundary test or review check |
| DTO preempts PR #1728 types | Merge churn | Keep view model schema-agnostic; no artifact/scorer import |
| Backend/UI status thresholds drift | Wrong label | One tested view-model mapper supplies qualitative status; component only renders it |
| Arbitrary URL enters UI contract | Open redirect or route drift | Semantic action union plus callback-only card |
| i18n JSON conflicts with PR #1728 | Merge conflict | Changes are confined to `dashboard.revamp.seo`; rebase before Phase 2 |
| Story Sync restores stale wording | Wrong review contract | Update source first; verify the live issue before code |

## Security Considerations

- Treat all labels/counts as data rendered by React; no HTML injection.
- Never accept or render a backend-provided arbitrary URL.
- Do not expose tenant/site details in error copy.

## Next Steps

- Phase 1 is complete and its UI contract is active through the Phase 2 client wrapper.
- Track Story Sync and all remaining release evidence only in Phase 3.
- Do not create a commit without explicit user approval.
