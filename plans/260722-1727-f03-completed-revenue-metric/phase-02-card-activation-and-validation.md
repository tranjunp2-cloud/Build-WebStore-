# Phase 02 — Card activation, QA, and documentation

## Context

- Plan: [plan.md](./plan.md)
- Depends on: [Phase 01](./phase-01-revenue-aggregation-and-period-contract.md)
- Component: `src/components/dashboard/revamp/at-a-glance.tsx`
- Locales: `src/i18n/locales/en.json`, `src/i18n/locales/ms.json`
- Test convention: `docs/TEST_CONVENTION.md`
- QA matrix: `docs/qa/F03-dashboard.md`
- Architecture: `docs/architecture/F03-dashboard.md`

## Overview

- **Status:** Completed with operational handoff
- **Priority:** P1 release gate
- **Effort:** 3h
- Display the verified metric, remove stale Coming Soon copy, add direct UI coverage, and align F03 documentation.

## Related Files

| Action | File | Change |
|---|---|---|
| Modify | `src/components/dashboard/revamp/at-a-glance.tsx` | Activate Revenue and format MYR with two decimals. |
| Modify | `src/i18n/locales/en.json` | Remove stale Revenue Soon tooltip if unused. |
| Modify | `src/i18n/locales/ms.json` | Remove matching stale tooltip if unused. |
| Inspect/modify if unused | Dashboard CSS containing `.stat-card-soon` | Remove only selectors proven unused. |
| Create or modify | `src/__tests__/unit/dashboard/at-a-glance.test.tsx` | Revenue display, delta, sparkline, and localization. |
| Modify | `docs/qa/F03-dashboard.md` | Map tests to the created-date Revenue contract. |
| Modify | `docs/architecture/F03-dashboard.md` | Document the active loader and legacy duplicate paths. |

## Implementation Steps

1. Read `docs/TEST_CONVENTION.md`; use source imports, top-level `vi.mock`, AAA sections, and real F03 TC IDs.
2. Remove Revenue's `comingSoon`, label, and tooltip props. Remove now-dead generic branches/import/CSS only after repository-wide usage checks.
3. Format MYR via `Intl.NumberFormat` with exactly two fraction digits, such as `RM 1,234.56`; keep non-currency formatting unchanged.
4. Verify Revenue renders the existing delta, comparison note, and sparkline without changing responsive layout or other cards.
5. Add component tests for no Coming Soon, `RM 0.00`, grouped/fractional values, positive/negative/zero delta, sparkline/note, and EN/MS labels.
6. Update QA/architecture docs to state clearly that Revenue is based on current completed status but attributed to `createdAt`, not completion/payment date.
7. Run credentialed/manual fixtures for completed MYR online/COD inclusion, refund removal, null currency, tenant visibility/isolation, late completion attributed to its UTC creation day, UTC midnight behavior for all four cards, and 375/768/1280 layouts.
8. Run focused/dashboard tests, typecheck, lint, build, and diff checks. Report the known root-owned `.next/diagnostics` EACCES honestly if it prevents compilation.

## Validation Commands

```bash
npm test -- src/__tests__/unit/dashboard/dashboard-period.test.ts src/__tests__/unit/dashboard/glance-data.test.ts src/__tests__/unit/dashboard/at-a-glance.test.tsx
npm test -- src/__tests__/unit/dashboard
npm run typecheck
npm run lint
npm run build
git diff --check
rg -n "revenueSoonTip|comingSoon.*revenue|status IN \('paid', 'completed'\)" src docs/architecture/F03-dashboard.md docs/qa/F03-dashboard.md
```

No new page/route is added, so AGENTS.md does not mandate a new E2E test. Browser validation remains an explicit credentialed/manual release gate.

## Success Criteria

- Revenue shows real RM data without Coming Soon in EN/MS.
- Output uses two decimals and matches the aggregate total/sparkline.
- Tests and docs explicitly lock created-date attribution and current-status refund behavior.
- No schema/migration, permission-system, route, or legacy implementation cleanup is mixed in.

## Todo

- [x] Activate Revenue UI and formatter.
- [x] Remove proven-dead Revenue Soon copy/styles.
- [x] Add direct component coverage using the real EN/MS locale provider.
- [x] Update QA/architecture docs and complete automated release gates.
- [ ] Operational handoff: credentialed responsive browser QA at 375/768/1280 and representative-data `EXPLAIN ANALYZE`.

## Completion Evidence

| Gate | Result |
|---|---|
| Focused Revenue unit tests | 9/9 passed |
| PostgreSQL production-query regression | 2/2 passed against session-local TEMP tables (enum-schema guard and production aggregate) |
| Dashboard regression suite | Passed |
| TypeScript and diff integrity | `npm run typecheck` and `git diff --check` passed |
| Lint | Passed with repository-existing warnings only |
| Production build | Isolated Docker BuildKit builder exited 0, compiled successfully, and generated 113/113 pages; a local PostgreSQL `ECONNREFUSED` log during page generation was non-fatal |
| Locale fidelity | Component test now renders through the real `I18nProvider` and EN/MS JSON bundles |
| CI protection | PostgreSQL 16 service runs the production-query regression on pull requests |

The automated contract covers completed-status, tenant isolation, MYR/null currency, COD/payment-status neutrality, UTC creation-date boundaries, current/comparison totals, sparkline zero-fill, RM formatting, and EN/MS labels. Credentialed browser fixtures and representative performance measurement remain release operations rather than claimed automated evidence.
