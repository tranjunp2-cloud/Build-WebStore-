---
title: "Phase 03 — Automate QA and Stage Closeout"
status: in-progress
effort: 3h
---

# Phase 03 — Automate QA and Stage Closeout

## Context Links

- `docs/TEST_CONVENTION.md`
- `docs/qa/F37-local-seo.md`
- PRD v2.6 US-F37-03 acceptance criteria (canonical)
- Issue #1311 — synchronize if stale opt-out wording remains
- Issue #1312 score integration
- Parent plan: [plan.md](./plan.md)

## Overview

Reconcile the docs left inconsistent after PR #1677 merged, turn the approved v2.6 scenarios into discoverable acceptance coverage, and require honest staging evidence before #1311 is marked done.

## Key Insights

- Repository Playwright root tests live under `e2e/`; the `storefront-regression` project currently matches only `cart-drawer.spec.ts`, so a new `tests/*.spec.ts` file is otherwise invisible.
- A skipped test or a file absent from `--list` is not acceptance coverage.
- #1311 closes on route/UI acceptance; #1312 separately owns 9/5/1 attribution and the complete 100-point scorecard.
- PRD v2.6 is canonical. Stories still describe seller opt-out; QA references stale `AC-6`/`BR-09`, requires `>=5` URLs, and registers only `TC-F37-03-01..09` while implementation uses IDs through `TC-F37-03-48`.

## Requirements

- Follow `docs/TEST_CONVENTION.md`, AAA, source imports, top-level `vi.mock()`, and a reconciled one-to-one TC-ID registry.
- Add narrowly scoped real-browser acceptance hardening for published public routes and seller-control absence.
- Use stable QA fixtures for published, unpublished, and legacy-false storefront states.
- Configure Playwright so the new spec is listed and executed in CI/staging.
- Do not silently skip when required staging data or origin is absent; fail setup or report the run as not executed.
- Align Stories, QA, and blocker tracking to the merged PRD v2.6 before acceptance closeout.

## Architecture

Unit tests own branch-level route and serialization behavior. Playwright owns deployed public responses and authenticated Dashboard visibility. #1312 integration tests own score totals and independent 9/5/1 failure deductions.

## Related Code Files

### Add

- `tests/f37-ai-discoverability.spec.ts`

### Modify

- `playwright.config.ts`
- `e2e/dashboard.spec.ts` or the existing authenticated Dashboard spec
- `src/__tests__/unit/seo/ai-crawlers-robots.test.ts`
- `src/__tests__/unit/seo/llms-txt.test.ts`
- Existing/new sitemap unit test
- `src/__tests__/unit/dashboard/dashboard-blocks.test.ts`
- `docs/qa/F37-local-seo.md`
- `docs/stories/F37-local-seo-stories.md`
- `docs/tracking/OPEN_BLOCKERS.md`
- `docs/prd/F37-local-seo-search-performance.md` (Definition-of-Done v2.5→v2.6 typo only)
- `docs/CHANGELOG.md`

### Read-only architecture contract

- `docs/architecture/F37-local-seo.md`

## Implementation Steps

1. Treat the merged PRD v2.6 as the product contract while recording delivery ownership: #1311 covers FR-12..14 route/UI outcomes; #1312 covers point attribution and total-score integration.
2. Reconcile the QA registry with actual coverage through `TC-F37-03-48`: remove collisions, stale `AC-6`/`BR-09` references, the `>=5 URL` rule, and obsolete `[NOT-BUILT]` statuses. Mark `[x] AUTO` only where executable evidence exists.
3. Update `OPEN_BLOCKERS`: replace the stale “create QA registry” premise, remove/rescope the deleted crawler-toggle guard item, and retain multi-site disambiguation as deferred. Correct the PRD DoD v2.5 self-reference to v2.6.
4. Add a public Playwright spec against a stable storefront origin: robots 200 and approved assistants allowed; scraper blocked; sitemap 200 with storefront URLs; `llms.txt` 200 with UTF-8 Markdown, H1, and only real public links.
5. Cover unpublished and legacy-false states with dedicated fixtures; if staging cannot seed them, record the run as not executed and preserve route-import evidence rather than creating a permanent skip or fake green.
6. Add an authenticated Dashboard assertion that the retired SEO Action Tools controls/actions are absent; do not assert removal of the separate SEO-page auto-meta control.
7. Expand `storefront-regression.testMatch` (or create a narrowly scoped F37 project), prove discovery with `--list`, then run focused unit tests, typecheck, lint, migration validation, Playwright staging checks, and the full unit suite.
8. Update QA evidence/changelog and request #1312 integration evidence for independent 9/5/1 scoring.

## Todo

- [x] Align Stories US-F37-03 with canonical PRD v2.6.
- [x] Reconcile unique F37-03 TC IDs as official `TC-F37-03-01..51` coverage.
- [x] Remove stale QA/Open Blockers wording and update implementation evidence.
- [x] Provision stable staging origin and repository-variable fixture paths (`/sites/kedai-demo`, `/sites/e2e-test`).
- [x] Add public-route Playwright spec and verify storefront discovery includes TC-28/29 (4 project tests across 2 specs including cart regressions).
- [x] Run published/unpublished public-route scenarios on staging (TC-28/29): 2/2 passed on 2026-07-30.
- [x] Add authenticated Dashboard absence assertion and verify `chromium` discovery includes TC-30.
- [ ] Run authenticated Dashboard absence scenario on staging (TC-30).
- [x] Synchronize QA implementation evidence and changelog.
- [x] Complete Stage 2 code-quality and Stage 3 adversarial review; accepted findings fixed and re-reviewed.
- [x] Re-run final local validation after review fixes.
- [x] Synchronize external issue #1311 with canonical PRD v2.6 wording (2026-07-30).
- [x] Document the trusted route-fact handoff; #1312 owns separate 9/5/1 and 100-point evidence.

## Local Validation and Review Evidence

- Pre-review focused suite: 6 files, 62/62 tests passed; pre-review full suite: 661 files, 11,111/11,111 tests passed.
- Stage 1 fixes: custom-domain request-header forwarding and safe public slug serialization; targeted 4 files, 41/41 passed.
- Stage 2 fix: deterministic bounded `llms.txt` Key Pages contract; focused 22/22 passed and re-review PASS.
- Stage 3 fix: narrow Payload projections for sitemap/`llms.txt`; focused 27/27 passed and re-review PASS.
- Final post-review validation: focused 6 files 62/62; full Vitest 661 files 11,111/11,111; typecheck 0 errors; lint 0 errors/139 warnings; migration and `git diff --check` passed. Storefront discovery listed 4 tests in 2 specs including TC-28/29; authenticated Dashboard discovery listed 7 tests in 2 files including setup and TC-30.
- Live public staging Playwright TC-28/29 passed 2/2 on 2026-07-30 against `/sites/kedai-demo` and `/sites/e2e-test`; authenticated TC-30 remains pending because local staging credentials are unavailable, while CI receives approved secrets.
- Finding-closeout validation: focused F37/config 7 files 65/65; full Vitest 662 files 11,114/11,114; flaky unrelated AI timeout rerun 75/75 then full suite green; typecheck 0 errors; lint 0 errors/139 baseline warnings; migration guard passed; TC-28/29 live staging 2/2; TC-30 discovered and awaiting authenticated staging execution.
- #1312 exact crawler 9 / sitemap 5 / `llms.txt` 1 integration evidence remains external.

## Validation Commands

```bash
npm test -- ai-crawlers-robots llms-txt sitemap dashboard-blocks
npm run typecheck
npm run lint
node scripts/check-migrations.js origin/staging
npx playwright test --project=storefront-regression --list
npx playwright test tests/f37-ai-discoverability.spec.ts --project=storefront-regression
npm test
git diff --check
```

## Success Criteria

- Focused and full unit suites, typecheck, lint, and migration validation pass.
- `--list` includes every new F37-03 Playwright scenario and the staging run passes without permanent skips.
- QA IDs map one-to-one to executable coverage; Stories, QA, PRD DoD, and Open Blockers no longer describe stale seller-toggle or fabricated minimum-URL contracts.
- #1311 route/UI acceptance is independently reviewable; #1312 receives a documented crawler/sitemap/`llms.txt` fact contract for later 9/5/1 integration.
- PR title is `feat(F37): [US-F37-03] platform-managed AI discoverability`; body says `Relates to #1311`.

## Risk Assessment

- CI may report green while omitting the spec; retain the `--list` check as explicit evidence.
- Shared F37 docs remain conflict-prone; start from latest staging and coordinate any overlap with #1708 before editing.
- Staging instability can create false negatives; use seeded fixtures and record exact URLs/build SHA.

## Security Considerations

- E2E credentials must come from approved environment variables and never appear in logs or fixtures.
- Public assertions must check absence of private/customer content as well as expected SEO content.
- Do not add real secrets to `.env.staging.example` or `.env.production.example`; if a new variable is unavoidable, add placeholder entries to both.

## Next Steps

Attach validation evidence to the PR and request QC for #1311. Continue the separate #1312 score integration using the documented route facts without reopening this route/UI scope.
