# Phase 04 — Tests + QA matrix

## Context
- Gold standard: `src/__tests__/unit/actions/blog-actions.test.ts` (payload mock pattern),
  `src/__tests__/unit/builder/builder-store.test.ts` (pure logic).
- Rules: `.claude/rules/testing.md` — every test references a TC-ID; AAA; top-level `vi.mock()`; import from source.

## Overview
Priority: P1 · Status: pending · Effort: 2h
Unit-test the two pure decision points (guard logic + site-state helper). Manual QA matrix for visual/responsive
acceptance (cannot meaningfully unit-test layout SSR composition — keep tests on pure functions, KISS).

## TC-IDs (derive from issue Test Scenarios → record in `docs/qa/F03-*.md` or issue)
| TC | Scenario | Layer |
|----|----------|-------|
| TC-1392.01 | No usable site → guarded path returns guard=true | unit (guard) |
| TC-1392.02 | Has site → any path returns guard=false | unit (guard) |
| TC-1392.03 | Excluded `/help`, `/settings/profile`, `/settings/staff`, `/sites` → guard=false even w/o site | unit (guard) |
| TC-1392.04 | Dynamic route `/orders/123`, `/products/9/edit` → guard=true (prefix) | unit (guard) |
| TC-1392.05 | `/settings/profile-extra` does NOT match excluded `/settings/profile` | unit (guard) |
| TC-1392.06 | helper: `tenantId=null` → `hasUsableSite=false` | unit (helper) |
| TC-1392.07 | helper: only `generationStatus:'failed'` sites → `hasUsableSite=false` | unit (helper) |
| TC-1392.08 | helper: a `completed`/`none`/undefined-status site → `hasUsableSite=true` | unit (helper) |
| TC-1392.E2E | Manual: new account → empty state → CTA → /builder/new → create → content (matrix below) | manual |

## Related code files
- CREATE `src/__tests__/unit/dashboard/dashboard-guard-paths.test.ts` — TC-1392.01–05.
- CREATE `src/__tests__/unit/dashboard/get-tenant-site-state.test.ts` — TC-1392.06–08 (mock payload per gold standard).

## Implementation steps
1. Guard test: import `shouldShowNoWebsiteGuard` + `NO_WEBSITE_EXCLUDED_PREFIXES`. Table-driven cases for
   guarded/excluded/dynamic/boundary paths × hasWebsite true/false. Pure, no mocks.
2. Helper test: mock `payload.find` (gold-standard `mockFind` pattern), assert `hasUsableSite` for the
   filter permutations (none/completed/failed/missing-status/empty/null-tenant).
3. `npm test` → 100% pass on new files. Do NOT fake data to pass.
4. Hand off manual matrix to QC (@aryhibye).

## Manual QA matrix (pages × viewports)
- **Pages (guarded):** /dashboard, /products, /products/[id], /orders, /orders/[id], /customers, /blog,
  /discounts, /contact-leads, /media, /templates-health, /settings, /settings/payments, /settings/domains,
  /settings/email-templates, /settings/shipping.
- **Pages (excluded — must render normal):** /help, /settings/profile, /settings/staff, /sites.
- **Viewports:** 375, 768, 1920.
- **State transitions:** new account (no site) → empty; create site → content (no manual reload); delete all
  sites → empty returns; deep-link no-site → empty (not 404/500); slow network → no children→empty flicker.

## Todo
- [ ] `dashboard-guard-paths.test.ts` (TC-1392.01–05) pass
- [ ] `get-tenant-site-state.test.ts` (TC-1392.06–08) pass
- [ ] `npm test` green, no fake data
- [ ] Manual matrix executed / handed to QC
- [ ] TC-IDs recorded in `docs/qa/F03-*.md` or issue

## Success criteria
- Both unit files pass; cover all exclude prefixes + filter permutations + boundary case.
- Manual matrix: every guarded page shows empty (no site) / content (with site); every excluded page renders normal.

## Risks
| Risk | L×I | Mitigation |
|------|-----|------------|
| Layout SSR not unit-tested | M×L | Logic extracted to pure fns (tested); composition covered by manual E2E matrix. Acceptable per KISS. |
| Filter drift vs sites/page.tsx | L×M | Single `isUsableSite` source (Phase 01); test asserts it. |

## Next steps
- After green: code-reviewer → docs-manager (CODEBASE_SUMMARY if surface changed) → git-manager (PR to staging).
