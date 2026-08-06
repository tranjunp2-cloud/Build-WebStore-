---
title: "GH-1312 F37-04 UI-first SEO Health"
description: "Finish the unified SEO Health scorecard by closing post-scout UI, discovery, authorization, and release-evidence gaps."
status: in-progress
priority: P0
effort: 32h
issue: 1312
branch: feat/F37-04-local-seo-score-checklist
tags: [feature, frontend, backend, api, testing, critical]
blockedBy: []
blocks: []
externalBlockers:
  - authenticated-playwright-port-3000-owned-by-another-worktree
  - live-p95-canary-rollback-evidence
  - approved-story-sync-1312
executionGate: phase-3-release-evidence-pending
created: 2026-08-04
updated: 2026-08-05
---

# GH-1312 F37-04 UI-first SEO Health

## Overview

Replace the legacy Dashboard SEO presentation with one PRD §12.3 card: one score, four qualitative bucket bars, conditional metadata-only AI Fix, and every unresolved seller root cause. Phases 1–2 implemented the UI and authoritative runtime cutover after PRs #1719 and #1728 merged. Phase 3 has now closed the post-staging compact Editor, public discovery, mutation authorization/CAS, and deterministic regression gaps. Release closeout remains in progress because current-code authenticated Playwright, live p95/canary/rollback evidence, and approved Story Sync are still pending.

## Contract Decisions

- `docs/prd/F37-local-seo-search-performance.md` §5 and §12.3 is authoritative.
- Before closeout, run approved Story Sync so issue #1312 removes OG image, bad slug, and at-most-three clauses.
- Show all unresolved root causes after deduplication. Do not show completed checks, point gains, platform-only failures, or a second SEO card.
- Never render a score in loading/error states.
- UI actions are semantic and allowlisted; the API does not supply arbitrary URLs.
- Do not wire Phase 1 to the legacy score endpoint.

## Cross-Plan Dependencies

| Relationship | Plan / delivery | Status |
|---|---|---|
| Handoff available | [GH-1309 Business Data](../260727-1025-gh-1309-minimal-business-data/plan.md) | Business 20 code is on `staging`; live QC is not a #1312 blocker |
| Handoff available | [GH-1311 AI Discoverability](../260729-1133-gh-1311-f37-03-ai-discoverability/plan.md) | PR #1719 merged; consume trusted 9/5/1 facts |
| Handoff accepted | PR #1728 / branch plan `260729-1603-gh-1310-schema-rich-local-markup-v26` | Merged as `f70c0d620`; present on current staging `af0d45a28` |
| Superseded overlap | [Legacy F03/F05 SEO plan](../260407-seo-optimization/plan.md) | Its 3-bucket score/card contract is obsolete; no execution dependency |

The PR #1728 entry gate passed: merge commit `f70c0d620` is an ancestor of current staging SHA `af0d45a28`. The feature branch was fast-forwarded to that SHA before implementation. The current local `origin/staging` reference is `473bf8223`; this uncommitted branch is 0 ahead and 9 behind, so a later explicit synchronization is still required.

## Phases

| Phase | Name | Status |
|---|---|---|
| 1 | [Build the isolated UI contract and card](./phase-01-build-isolated-ui-contract-and-card.md) | Complete |
| 2 | [Integrate the authoritative score and actions](./phase-02-integrate-authoritative-score-and-actions.md) | Implementation complete; post-scout hardening moved to Phase 3 |
| 3 | [Verify, synchronize docs, and close staging](./phase-03-verify-docs-and-staging-closeout.md) | Local implementation and automated gates complete; browser/release evidence pending |

## Execution Order

`Phase 1 UI shell → PR #1728 accepted → Phase 2 runtime cutover complete → Phase 3 QA/docs/staging`

## Post-Scout Remaining Scope

| Priority | Gap | Required outcome | Status |
|---|---|---|---|
| P0 | Compact Editor deep links do not mount the Settings sheet without a selected block | Every allowlisted `global`/`seo` action opens and focuses at 375px | Implemented and component/Playwright-spec covered; current-code authenticated execution pending |
| P0 | `llmsRouteAvailable` is hardcoded and sitemap reachability is partially inferred | Score facts reuse exact pure public-route preflights for the scored site | Complete |
| P0 | `fix-all` and `apply-fixes` accept inactive tenant memberships | Both mutation routes require active membership and fail before reads/writes | Complete |
| P1 | Apply batch can issue 100 concurrent read/update pairs; route duration/revision gates are incomplete | Bound concurrency, set `maxDuration <= 60`, and reject stale revision-bound mutations | Complete, including site-scoped per-target CAS |
| P1 | Metadata detail can exceed its response schema bounds | Bound source-derived metadata labels, titles, and descriptions before response validation | Complete |
| P1 | QA/architecture/plan evidence overclaims or is stale | TC registry matches actual tests; post-sync runs have durable artifacts | In progress |
| Release | GitHub issue #1312 still has stale AC; p95/canary evidence is absent | Story Sync verified, representative p95 <2s recorded, rollback/canary documented | Pending |

## Scope

In scope: existing `/dashboard` `SeoHealth`, stable UI DTO, four buckets, loading/error/complete states, root-cause dedupe, actor/CTA/deep-link behavior, metadata-only AI Fix, exact `20/35/15/30` API score, tests, and contract synchronization.

Out of scope: new page/route, score history, Google Business Profile/activity, Search Console OAuth, crawler controls, arbitrary hrefs, database/environment changes, and unrelated F03 keyword tracking.

## Success Criteria

- The Phase 1 card remains directly tested and is mounted only through the validated Phase 2 client wrapper.
- The sole displayed score comes from the authenticated endpoint and reaches exactly 100 for complete inputs.
- Business 20 + Schema 35 + AI 15 + Technical 30 is invariant-tested.
- Every visible issue is one unresolved root cause with the PRD actor, CTA, and working destination.
- AI Fix touches title/description metadata only and is hidden when no AI-owned issue remains.
- Loading/error never shows `0`, stale data, or another invented score.
- Mobile 375px is one column with full-width action targets at least 44px high.

## Red Team Review

2026-08-04: 28 raw findings were deduplicated to 15. Accepted changes: early contract sync, explicit external gate, seven-root regression, exhaustive actions, runtime response validation, latest-request-wins/no-store, consistent snapshot, fixture recovery, deep-link readiness, and scale/latency proof.

## Validation Log

2026-08-04: PR #1728 merge `f70c0d620` was accepted on staging SHA `cb295e8ed`; 148 upstream tests passed before runtime edits. Phase 2 local implementation and focused regression are complete.

2026-08-04 pre-sync verification: the full Vitest run passed 698 files / 11,615 tests, with one skipped file / three pre-existing skipped tests (11,618 total). Lint, typecheck, and production build passed. The authenticated local Playwright run was observed passing setup plus three F37 cases (4/4), but the retained HTML report is stale and must be regenerated after the current staging sync. Local greater-than-1000-record cardinality/query-budget coverage is complete; it is not p95 evidence.

2026-08-04 staging reconciliation: the branch fast-forwarded from `cb295e8ed` to `af0d45a28`. The ten incoming F08-only commits do not overlap F37 paths; the branch then reported `0 ahead / 0 behind`. Post-sync focused/static/browser gates still needed a durable rerun.

2026-08-05 scout: UI, backend, and tests/docs scans found the compact Settings-sheet mount gap, hardcoded/inferred discovery facts, inactive-membership mutation access, incomplete dedupe/browser assertions, and stale QA/architecture claims.

2026-08-05 implementation closeout: compact settings-only Editor deep links now wait for resolved layout mode and preserve focus/scroll/close behavior; score facts reuse deterministic site-scoped public discovery preflights; mutation routes require active membership, validate revision tokens, bound concurrency/duration, scope every target to the scored site, and use per-target `updatedAt` CAS; metadata detail output is bounded before response validation. The exact final post-CAS state passed 701 test files / 11,687 tests, with one file / three tests skipped. Typecheck, lint, `git diff --check`, and the isolated production build also passed; the build completed all 112/112 static pages.

2026-08-05 browser constraint: the current-code authenticated Playwright run cannot start because the test allowlist requires `http://localhost:3000`, while that port is owned by another worktree. This is an explicit environment blocker, not passing browser evidence.

## Handoff

Continue Phase 3 release closeout in this order: execute current-code authenticated Playwright when the port/allowlist blocker is removed, run approved Story Sync, then collect representative p95/canary/rollback evidence. The current browser flow proposes metadata but does not Apply, so fixture reset/checksum is required only for any future mutation-based staging scenario. Do not stage, commit, push, or open a PR without explicit user approval.
