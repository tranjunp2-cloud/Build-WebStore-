# GH-1312 / US-F37-04 — Phase 3 local verification

**Date:** 2026-08-06  
**Branch:** `feat/F37-04-local-seo-score-checklist`  
**Scope:** Verify the unified SEO Health score/checklist locally and record the remaining live closeout gates.

## Delivered locally

- One authoritative Dashboard score using Business 20 + Schema 35 + AI Discoverability 15 + Technical Health 30.
- One unified SEO Health card with all deduplicated seller-owned issues, semantic allowlisted actions, and 375px responsive behavior.
- Metadata-only AI proposal/apply flow with field-specific pagination and a maximum batch size of 100.
- Active-membership authorization on the score/detail endpoint.
- Deterministic 100-row Payload pagination, stable double-read fingerprints, explicit field projections, and a 10,000-record safety ceiling.
- Editor/Search Verification deep links, accessible labels, and stale-request protection.

## Phase 3 regression coverage

- Added four real-browser Playwright scenarios for the score/action flow, bounded AI proposal flow, 375px layout/action sizing, and Local Business fieldset/overflow behavior.
- Added a 1,001-page evaluator test covering 100-row pagination, stable snapshots, explicit projections, and the expected query budget.
- Added coverage for field-filtered detail pagination beyond 100 records and pending/suspended membership denial.
- Covered authoritative apply eligibility, signed five-minute Undo tokens, and rejection of unsigned, tampered, or expired tokens.
- Covered request-abort and reader-cancel propagation through the Fix All SSE stream and metadata generation.
- Covered multi-page Content Quality issue counts and the platform-managed no-seller-action state.
- Kept the canonical address in Contact Info, removed duplicate Street Address/Country controls from Local Business, and treated Malaysia as implicit.

## Local evidence

- Exact final Vitest: 701 files passed, one file skipped; 11,687 tests passed and three tests skipped (11,690 total).
- TypeScript typecheck: passed.
- ESLint: passed with existing baseline warnings only.
- Production build: passed in an isolated `/tmp` copy to avoid the active local dev server's shared `.next`; 112/112 pages generated.
- Playwright discovery: authentication setup plus four F37 scenarios discovered.
- The earlier authenticated local Playwright 4/4 report is stale. Current-code execution was not claimed because the credential guard accepts only exact `http://localhost:3000`, while that port belongs to another worktree.
- Pre-scout code review found no P0/P1 blocker in its reviewed scope; the 2026-08-05 scout later reopened Phase 3 with the gaps below.

## Remaining live closeout

- Provide an account-owned fixture manifest with serial lock, reset, and checksum recovery.
- Run live browser acceptance, including score 100/all-clear, seven-or-more issues, all action destinations, keyboard/race/browser-error checks, AI Apply persistence, and proof that Local Business data is unchanged.
- Measure representative staging API p95 below two seconds.
- Record canary and rollback evidence.
- Perform approved Story Sync for issue #1312.
- Rerun the affected gates against the current synchronized staging base.

## Addendum — 2026-08-05

- The branch was fast-forwarded to `af0d45a28` and was `0 ahead / 0 behind` at that checkpoint. The current local `origin/staging` later advanced to `473bf8223`, leaving this uncommitted branch 0 ahead and 9 behind; no synchronization was attempted with the dirty worktree.
- Three scouts reopened Phase 3 around four evidence gaps: compact Editor deep-link focus, discovery reachability, inactive-membership mutation authorization, and test/document evidence accuracy.
- Decision: keep the existing three-phase plan. Run workstreams A/B first, then complete verification, approved Story Sync, and representative staging p95 evidence; do not create a new plan.
- Workstream A closed the compact settings-only Editor sheet and responsive deep-link hydration race.
- Workstream B replaced inferred discovery facts with exact-site public-route preflights, bounded metadata outputs, enforced active membership and exact-site mutation scope, and added per-target `updatedAt` CAS plus revision-bound Undo.
- Final hardening made apply eligibility authoritative and field-specific, replaced client-declared Undo intent with a signed five-minute token, and propagated cancellation through the Fix All SSE/OpenAI path.
- Final review hardening removed request-contract drift from Fix All, added a user-wide proposal limit (20/minute, 100/hour) plus per-site limit (2/minute, 10/hour), and made partial Undo return a newly signed continuation for only the remaining failed targets.
- The evaluator now reports every affected Content Quality page, while the UI explicitly identifies platform-managed score gaps that require no seller action.
- Local Business no longer duplicates Street Address or Country, and regression coverage guards against the fieldset border and layout overflow that previously produced a white gap.
- PRD, QA, and architecture documentation were synchronized with the implemented Contact Info, scoring, apply/Undo, and UI contracts.
- Final automated gates passed: 701 Vitest files and 11,687 tests, typecheck, lint with existing warnings, diff-check, and a 112/112-page isolated build. Playwright discovered setup plus four F37 tests; current-code authenticated browser execution, live p95, canary/rollback, and approved Story Sync remain open.

## Git safety

The authorized staging update fast-forwarded the branch to `af0d45a28`. The fixes and journal update documented here did not stage, commit, push, reset, restore, or stash any file.
