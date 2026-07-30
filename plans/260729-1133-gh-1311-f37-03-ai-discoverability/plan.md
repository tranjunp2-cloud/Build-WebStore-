---
title: "GH-1311 F37-03 Platform-managed AI Discoverability"
description: "Close US-F37-03 against the merged PRD v2.6 contract without duplicating the #1312 score cutover."
status: in-progress
priority: P0
effort: 10h
issue: 1311
branch: feat/F37-03-1311-ai-discoverability
tags: [feature, frontend, backend, api, testing, critical]
blockedBy: []
blocks: []
created: 2026-07-29
---

# GH-1311 F37-03 Platform-managed AI Discoverability

## Objective

Align the already-shipped F37-03 discovery routes with the platform-managed PRD v2.6 contract merged through PR #1677: approved AI assistants are always allowed, published storefronts expose valid sitemap/`llms.txt` endpoints, and sellers no longer see obsolete SEO action controls.

## Execution Gate

PR #1677 merged to `origin/staging` at `38d5868e` on 2026-07-29, so the local PRD v2.6 is now the implementation source of truth. Phase 01–02 and Phase 03 local implementation/review are complete; external acceptance closeout remains pending.

| Dependency | Status | Owner | Required outcome |
|---|---|---|---|
| PR #1677 | Resolved | Product/docs | PRD v2.6 merged at `38d5868e` |
| Issue #1311 wording | Resolved | Product/docs | Route/UI AC synchronized; score ownership handed to #1312 |
| PR #1708 | Coordinate | US-F37-01 | Rebase/coordinate; this plan does not edit its score helper |
| Issue #1312 | External closeout | US-F37-04 | Own runtime score/API/Dashboard cutover and verify 9/5/1 |
| Staging fixtures | Resolved | QA | Published/unpublished repository-variable paths configured |

No relevant unfinished F37 plan exists in the current `plans/` tree; these are external delivery dependencies, not `blockedBy` plan directories.

## Scope Challenge

PR #1559 already delivered `robots.txt`, `sitemap.xml`, `llms.txt`, the seller toggle, and unit coverage. The minimum viable change is therefore a contract cutover, removal of the now-obsolete cross-layer seller surface, route regressions, and executable E2E coverage—not a route rewrite or a new service. The file count exceeds eight only because one obsolete capability spans UI, API, types, localization, persistence compatibility, and tests.

## Ownership Boundaries

- This plan owns crawler policy, seller-control retirement, route behavior, F37-03 tests, and QA traceability.
- Issue #1312 owns `src/lib/seo/local-seo-score.ts`, the local-score API, unified SEO Health UI, and the 9/5/1 calculation.
- Retain `sites.ai_crawlers_enabled` as inert legacy data; never add a destructive migration.
- Do not remove unrelated auto-meta or sitemap APIs unless their removal is separately approved; remove only their seller-facing SEO Tools surface under v2.6.

## Phases

| Phase | Name | Status | Effort | Depends on |
|---|---|---|---:|---|
| 01 | [Freeze contract and retire seller controls](./phase-01-freeze-contract-and-retire-seller-controls.md) | Completed | 4h | PR #1677 contract |
| 02 | [Stabilize public discovery routes](./phase-02-stabilize-public-discovery-routes.md) | Completed | 3h | Phase 01 |
| 03 | [Automate QA and staging closeout](./phase-03-automate-qa-and-stage-closeout.md) | In Progress — external closeout pending | 3h | Phases 01–02, QA fixtures |

## Dependency Flow

`PR #1677 merged → Phase 01 complete → Phase 02 complete → Phase 03 docs/QA/E2E → QC #1311`; separately, `#1312 consumes route facts → integrates 9/5/1 into total 100`

## AC Traceability

| Issue #1311 route/UI AC | Implementation owner | Validation |
|---|---|---|
| AC-01: published routes expose crawler, sitemap, and llms signals | Phases 01–02 | Route unit/E2E |
| AC-02: unpublished routes keep crawler access and return sitemap/llms 404 | Phase 02 | Route matrix + staging E2E |
| AC-03: endpoint behavior is independent; no resubmit control | Phases 01–03 | Dashboard/route tests |

Seller-control retirement is required by FR-12 plus the PRD UI/refactor contract; it is not AC-02.

## Phase 03 Documentation Reconciliation

- Rewrite stale opt-out wording in `docs/stories/F37-local-seo-stories.md` to PRD v2.6 AC-01..03 and FR-12..14.
- Reconcile `docs/qa/F37-local-seo.md` with actual tests through `TC-F37-03-48`; remove stale `AC-6`, `BR-09`, and fabricated `>=5 URL` requirements.
- Update obsolete F37-03 entries in `docs/tracking/OPEN_BLOCKERS.md`; preserve the deferred multi-site ambiguity.
- Correct the PRD Definition-of-Done self-reference from v2.5 to v2.6.

## Success Criteria

- Five approved AI assistants are allowed even when a legacy site value is `false`; known scraper policy and `/api/`/`/admin/` restrictions remain intact.
- No crawler toggle, sitemap resubmit action, or SEO Action Tools section is seller-visible under the v2.6 contract. The separate Dashboard SEO-page auto-meta control remains outside F37-03.
- Published storefronts expose tenant-safe sitemap and Markdown `llms.txt`; unpublished/missing storefront behavior is explicit and tested.
- Playwright discovers and runs the F37-03 public-route scenarios against stable staging data; no permanent `test.skip()`.
- #1312 can consume unambiguous crawler/sitemap/`llms.txt` facts and independently implement 9/5/1 within the 100-point scorecard without reopening #1311 route code.
- PR uses `feat(F37): [US-F37-03] platform-managed AI discoverability` and `Relates to #1311`, never `Closes #1311`.

## Out of Scope

Full 100-point scoring, the unified SEO Health card, LocalBusiness subtype/schema, GBP/NAP features, physical removal of the legacy DB column, unrelated mutation API cleanup, and broader multi-site domain redesign.
