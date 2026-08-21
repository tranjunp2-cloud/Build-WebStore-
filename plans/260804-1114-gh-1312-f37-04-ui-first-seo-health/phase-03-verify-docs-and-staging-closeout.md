# Phase 03: Verify, Synchronize Docs, and Close Staging

## Context Links

- Plan: [GH-1312 F37-04 UI-first SEO Health](./plan.md)
- QA registry: `docs/qa/F37-local-seo.md`
- Test conventions: `docs/TEST_CONVENTION.md`
- Story source: `docs/stories/F37-local-seo-stories.md`
- PRD: `docs/prd/F37-local-seo-search-performance.md`

## Overview

- **Priority:** P0
- **Status:** local implementation and automated gates complete; browser and release evidence pending
- **Effort:** 14h
- **Description:** Compact deep-link, discovery-fact, mutation-authorization/CAS, and metadata-bound gaps are closed locally; finish exact-final-state verification, synchronize issue wording, and collect release proof.

<!-- Updated: Red Team Session 1 -->

## 2026-08-05 Reopened Scope — Authoritative

The earlier local-closeout statements below are historical. This section controls the remaining execution order.

### Workstream A — Compact UI correctness (P0)

1. Generalize `CompactEditorLayout` so allowlisted `global` and `seo` deep links mount a settings-only sheet without a selected block.
2. Hide block move/delete controls in settings-only mode; preserve focus, close, and scroll-lock behavior.
3. Preserve `seo.ogImage` beside `googleVerificationToken` in the Editor site type.
4. Add compact component coverage and extend the 375px browser case to click a real Dashboard issue and assert the Editor control is visible and focused.

### Workstream B — Discovery and mutation correctness (P0/P1)

1. Replace `llmsRouteAvailable: true` and partial sitemap inference with shared pure, site-scoped preflights that match public-route resolution and serialization.
2. Prove sitemap and llms failures independently deduct only 5 or 1; prevent multi-site tenant selection drift.
3. Require active membership in `fix-all` and `apply-fixes` before protected reads or writes.
4. Set `maxDuration <= 60`, bound apply read/update concurrency, and validate the score revision server-side before mutation.
5. Add tenantless, pending/suspended, stale-revision, phone/schema-telephone dedupe, and unpublished sitemap/llms dedupe regressions.

### Workstream C — Evidence and release

1. Rerun focused F37, full Vitest, typecheck, lint, build, `git diff --check`, and authenticated Playwright from baseline `af0d45a28`; retain the exact report artifact.
2. Correct TC-F37-04-14/15/17 and the legacy-score contradictions in QA/architecture.
3. Run approved Story Sync and verify live #1312 contains PRD AC-01..07 and FR-15..21.
4. Measure representative score API p95 below 2s and document volume, query count, canary thresholds, and rollback.
5. Use fixture reset/checksum only if a staging scenario performs Apply; proposal-only acceptance is read-only.
6. Do not stage, commit, push, or open a PR without explicit user approval.

### Dependency Order

`A + B may run in parallel → C verification → Story Sync → p95/canary/rollback → review/QC`

### 2026-08-05 Implementation Result

- **Workstream A complete in code and automated specs:** compact `global`/`seo` deep links mount a settings-only sheet after layout mode resolves; block-only controls stay hidden while focus, close, scroll lock, and existing settings behavior are preserved.
- **Workstream B complete in code and focused regressions:** score facts use deterministic site-scoped public discovery preflights; inactive memberships fail closed; proposal/apply require revision tokens; apply is duration/concurrency bounded, scopes products/blogs and other records to the exact site, and uses per-target `updatedAt` CAS.
- **Response contract hardened:** source-derived metadata labels, titles, and descriptions are bounded before response validation so oversized stored values do not turn detail requests into 500 responses.
- **Current verified gates:** the exact final post-CAS state passed 701 test files / 11,687 tests (one file / three tests skipped), typecheck, lint, `git diff --check`, and an isolated 112/112-page production build.
- **Still pending:** current-code authenticated Playwright, live p95, canary/rollback evidence, and approved Story Sync of #1312.

## Requirements

### Functional

- Map automated tests only to `[x] AUTO` TC-IDs after reading `docs/TEST_CONVENTION.md`.
- Cover 100, partial, loading, error/retry, all-clear, actor/CTA, every enabled destination, dedupe, and conditional AI strip.
- Prove unauthorized/cross-tenant requests and internal failures never display a score.
- Prove AI Fix changes title/description metadata only.
- Verify 375px no-overflow and minimum action target size.
- Verify Story Sync still matches PRD AC-01..07 and FR-15..21; never restore OG/bad-slug or three-action clauses.

### Non-functional

- Use real Playwright browser flows, not mocked E2E.
- Preserve PR #1708/#1719/#1728 regressions.
- PR title follows `feat(F37): [US-F37-04] ...`; body uses `Relates to #1312`.

## Related Code Files

- **Create:** `/home/liam/data/worktrees/ech-prime-web-v2-worktree-1/tests/f37-local-seo-score-checklist.spec.ts` — browser acceptance for existing Dashboard/API/Editor routes.
- **Modify:** `/home/liam/data/worktrees/ech-prime-web-v2-worktree-1/docs/qa/F37-local-seo.md` — TC mapping and evidence after resolving upstream edits.
- **Modify:** `/home/liam/data/worktrees/ech-prime-web-v2-worktree-1/docs/architecture/F37-local-seo.md` — final data flow and exported contracts.
- **Modify:** `/home/liam/data/worktrees/ech-prime-web-v2-worktree-1/docs/stories/F37-local-seo-stories.md` — PRD-aligned AC/DoD.
- **Modify:** `/home/liam/data/worktrees/ech-prime-web-v2-worktree-1/docs/design/F37-local-seo-wireframes.md` — mark/remove stale dual-card target in favor of F03 unified design.
- **Modify:** `/home/liam/data/worktrees/ech-prime-web-v2-worktree-1/docs/CHANGELOG.md`.
- **Modify if still open:** `/home/liam/data/worktrees/ech-prime-web-v2-worktree-1/docs/tracking/OPEN_BLOCKERS.md`.

## Test Matrix

| Area | Evidence |
|---|---|
| Formula | Pure boundaries for every criterion, bucket max, total 100, empty 0 |
| API | 200 contract; 401, 403 including missing tenant, 404, 429, sanitized 500 |
| UI states | Loading/error no number; retry; partial; 100/all-clear |
| Issues | All unresolved; stable sort; root dedupe; no platform rows; no points |
| Actions | AI/You badge, CTA label, allowlisted route, Editor expand/scroll/focus |
| AI Fix | Title/description filtering, unique records, Local Business unchanged |
| Responsive/a11y | 375px layout, no overflow, 44px targets, keyboard/focus |
| Upstream | Business 20, Schema 35 artifact, AI 9/5/1 focused regressions |
| Cardinality | At least seven root-cause groups visible and actionable |
| Scale/performance | More than 1000 eligible records, fixed query budget, API p95 below 2s |
| Races | Site switch/retry, mutation/refetch, concurrent content change |
| Compact deep link | 375px Dashboard action opens the settings-only sheet and focuses its real control |
| Discovery facts | Independent sitemap/llms failures deduct only their own 5/1 points for the scored site |
| Mutation security | Pending/suspended/cross-tenant/stale-revision requests perform zero protected reads/writes |

## Implementation Steps

The ordered implementation is the authoritative Workstream A/B/C sequence above. Do not execute the historical closeout order from the pre-scout plan.

1. Complete Workstreams A and B, including deterministic regressions.
2. Complete Workstream C local gates and durable browser artifacts.
3. Synchronize docs and GitHub issue only from verified evidence.
4. Finish p95, canary, rollback, and review/QC.

## Verification Status

| Gate | Status | Evidence / remaining work |
|---|---|---|
| Unit/API/component regression | Complete locally | Exact final post-CAS full run passed 701 files / 11,687 tests, with one file / three tests skipped |
| Local scale/query budget | Complete locally | Greater-than-1000-record deterministic coverage is green with the updated fixed query budget |
| Static/build gates | Complete locally | Typecheck, lint, `git diff --check`, and the isolated production build pass; build completed 112/112 static pages |
| Local browser acceptance | Blocked on current-code execution | The spec covers compact click-through/focus, but its allowlist requires `http://localhost:3000`; that port is owned by another worktree. Earlier 4/4 evidence is stale |
| Live browser acceptance | Pending | Run only against an allowed, tenant-owned non-production origin after local gaps close |
| Fixture recovery | Conditional | Required only if a staging scenario mutates via Apply; current proposal-only flow is read-only |
| Performance evidence | Pending | Live API p95 below 2s is not yet measured; local scale coverage is not a substitute |
| Release evidence | Pending | Canary, rollback, approved Story Sync, and issue-body verification remain open |
| Staging reconciliation | Needs refresh | Work started from `af0d45a28`; current local `origin/staging` is `473bf8223`, leaving the uncommitted branch 0 ahead and 9 behind |

## Todo

- [x] Read test conventions and register/reconcile TC-IDs.
- [x] Complete pure/API/client/Editor coverage.
- [x] Add fail-fast real-browser acceptance specs and verify Playwright discovery.
- [x] Complete local greater-than-1000-record cardinality/query-budget coverage.
- [x] Run full local Vitest, lint, typecheck, and production build gates.
- [x] Fast-forward to current `origin/staging` and audit the non-overlapping delta.
- [x] Fix compact Editor settings deep-link behavior and add 375px click-through coverage in the spec.
- [x] Replace hardcoded/inferred discovery facts and prove independent 5/1 deductions.
- [x] Harden AI proposal/apply authorization, site scope, per-target CAS, revision, duration, and concurrency behavior.
- [x] Bound metadata detail output to its validated response contract.
- [x] Align the address contract: Contact Info Address is canonical, legacy Local Business street remains fallback-only, Country is implicit `MY`, and `business-address` focuses Contact Info Address.
- [x] Pass final-state focused suites (94/94), typecheck, and `git diff --check`.
- [x] Correct missing/overclaimed TC-F37-04-14/15/17 coverage.
- [x] Rerun exact-final-state full Vitest, lint, and production build and retain durable artifacts (701 files / 11,687 tests; 112/112 pages).
- [ ] Execute the current-code authenticated Playwright suite after the localhost:3000 ownership/allowlist blocker is removed.
- [ ] Execute the browser specs against a stable staging fixture.
- [ ] Prove fixture lock/reset/checksum recovery only if a staging scenario performs Apply.
- [ ] Capture live score, action, error, AI-only, race, and 375px browser evidence.
- [x] Reconcile local documentation after post-scout fixes and verified reruns.
- [ ] Measure live API p95 below 2s and attach canary/rollback evidence.
- [ ] Run approved Story Sync and verify GitHub issue #1312.
- [ ] Synchronize current `origin/staging` after explicit user approval; local ref is 9 commits ahead of this dirty worktree.
- [x] Complete independent P0/P1 code review for Workstreams A/B (approved).
- [ ] Request release QC after authenticated browser, performance, Story Sync, canary, and rollback gates pass.

## Success Criteria

- Every PRD AC-01..07 and FR-15..21 is traceable to code and evidence.
- A complete site displays exactly 100 and `All clear`.
- Partial sites display all deduplicated seller root causes with no platform-only rows.
- Browser evidence renders at least seven issue groups without truncation.
- All enabled CTAs work in a real browser.
- AI Fix remains metadata-only.
- CI and relevant F37 regression are green; environment-only failures are explicitly documented, never silently skipped.
- Issue #1312 no longer contradicts the PRD.

## Risk Assessment

| Risk | Impact | Mitigation |
|---|---|---|
| Fixture lacks full Schema/custom-domain inputs | Cannot prove 100 | Assign fixture owner and manifest before staging run |
| Docs conflict with PR #1728 | Lost acceptance history | Update after merge and reconcile both histories |
| Story Sync restores stale issue text | QA reviews wrong AC | Fix story source first, then run sync and verify body |
| E2E silently skips | False confidence | Fail-fast fixture guards and explicit test discovery |
| Shared fixture remains mutated | Later false evidence | Run mutation acceptance only with serial lock, reset, and checksum |
| Compact settings request has no selected block | Dead mobile CTA | Add settings-only sheet mode and a real 375px focus assertion |
| Hardcoded route fact inflates score | False 5/1 points | Reuse exact pure route preflights for the scored site |
| Inactive membership reaches mutation routes | Unauthorized AI reads/writes | Filter active memberships before protected record access |
| Apply batch saturates Payload/DB | Timeout or resource spike | Bound concurrency and enforce duration/revision gates |

## Security Considerations

- Use tenant-owned non-production fixtures and never record credentials.
- Evidence must not expose tenant IDs, emails, tokens, or internal errors.
- Confirm cross-tenant and tenantless-site denial remains fail-closed.

## Next Steps

- Treat Workstreams A and B as implementation-complete; do not claim release closeout until all remaining evidence gates pass.
- Retain the exact current-code Playwright report after the localhost:3000 blocker is removed before claiming browser acceptance.
- Complete measured p95, responsive/browser, canary, rollback, and approved Story Sync evidence.
- Submit the PR with `Relates to #1312` only after explicit user approval.
- Keep issue closure behind the project QA gate.
