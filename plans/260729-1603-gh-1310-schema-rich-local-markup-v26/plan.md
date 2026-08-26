---
title: "US-F37-02 Schema-Rich Local Markup v2.6"
description: "Persist a validated LocalBusiness subtype, emit strict safe schema, and expose a pure exact 35-point Schema score."
status: in_progress
priority: P0
effort: 22h
issue: 1310
branch: feat/F37-02-schema-rich-local-markup
tags: [feature, frontend, backend, database, testing, seo, critical]
blockedBy: []
blocks: []
created: 2026-07-29
---

# US-F37-02 Schema-Rich Local Markup v2.6

## Outcome

Implement PRD v2.6 FR-04..11 and AC-01..04. A checked-in versioned mapping controls Editor options, save validation, emitted `@type`, and subtype scoring. Generated nodes feed a pure `SchemaScoreResult` worth exactly `10+4+5+4+3+3+3+3=35`; FAQ is not scored.

## Non-negotiable decisions

- PRD v2.6 and merged PR #1677 are the target contract. Phase 00 must synchronize stale issue #1310 and `docs/stories/F37-local-seo-stories.md` before cook/review.
- `businessCategory` filters subtype options and may derive `priceRange`; only a compatible persisted `schemaSubtype` may emit a specific `@type`.
- Keep the scorer pure and derive it from one canonical generation artifact built from one immutable site snapshot; do not change the score API, Dashboard, or top-level engine.
- A weak legacy Contact LocalBusiness may remain render-only compatibility output, but is excluded from the canonical score artifact, earns no strict points, and may never emit an incompatible subtype.
- US-F37-02 remains independent of US-F37-01. PR #1708 has landed on staging; this branch retains its per-site revisioned/coalescing serializer and reconciles US02 rollback without importing US01 score/API scope.
- A named owner and provisioning method for a published, tenant-owned fixture are required before E2E acceptance.

## Architecture

```text
versioned category→subtype map
  ├─ Editor reconcile/filter ──┐
  ├─ Zod/Payload validation ───┼─ persisted schemaSubtype
  └─ emission revalidation ────┘          │
                                          ▼
site snapshot ── strict generator ── canonical node + validated evidence
                     ├─ safe generated nodes ── serializer
                     └─ pure scorer 0..35
```

## Phases

| Phase | Deliverable | Status |
|---|---|---|
| 00 | [Sync authoritative contract and dependencies](./phase-00-sync-authoritative-contract-and-dependencies.md) | Completed (contract artifacts; acceptance dependencies remain in Phase 03) |
| 01 | [Persist and validate schema subtype](./phase-01-persist-and-validate-schema-subtype.md) | Completed (implementation and automated verification) |
| 02 | [Emit schema and score exactly 35](./phase-02-emit-schema-and-score-35.md) | Completed (implementation and automated verification) |
| 03 | [Verify storefront and hand off](./phase-03-verify-storefront-and-handoff.md) | In progress (local automation verified; live/manual evidence pending) |

## Scope

In scope: versioned mapping, Payload group field, additive SQL migration, shared effective-state validation, dependent Editor select, safe JSON-LD, canonical generation artifact, pure Schema scorer, TC-F37-02-29..32 plus newly registered IDs after 32, read-only Playwright, Rich Results evidence, and #1312 handoff.

Out of scope: new route/page, score API response changes, page/database aggregation, overall scoring, Dashboard/issues/AI Fix All, multiple subtypes, runtime taxonomy fetch, fixture mutation, and US-F37-03 FR-12.

## Global gates

- `Sites.ts` and `scripts/db-setup.js` land together; only `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, never `DROP`.
- Every write path validates `originalDoc + incoming patch` before persistence; invalid/sparse pairs are rejected and previous valid data survives.
- All tenant strings use `serializeJsonLd()`; malformed nested values omit unsafe nodes/properties without crashing.
- Tests follow `docs/TEST_CONVENTION.md`, import source, use AAA, and reference registered TC IDs.
- PR title: `feat(F37): [US-F37-02] ...`; body uses `Relates to #1310`.

## Success

- AC-01..04 and FR-04..11 pass at the US02 boundary: the production generator emits the nodes and the pure scorer computes the earned Schema breakdown from the same artifact. #1312 later aggregates/displays it.
- Empty subtype emits generic `LocalBusiness` and scores 0/4; invalid pairs never emit or score.
- Full/empty Schema totals are 35/0; FAQ cannot affect score.
- Published fixture browser test parses real JSON-LD with no invalid/duplicate strict node; TC-F37-02-09 has manual evidence.
- #1312 receives the pure 0..35 contract and owns overall `20/35/15/30`.

## Supersession

This plan replaces the obsolete local Schema-40 draft `260729-1037-gh-1310-schema-rich-local-markup`, removed during plan cleanup on 2026-07-29.

## Red Team Review

### Session — 2026-07-29

**Findings:** 15 (13 accepted, 2 rejected); **severity:** 5 Critical, 9 High, 1 Medium. Full adjudication: [Red-team review](./reports/red-team-review.md).

| # | Finding | Severity | Disposition | Applied To |
|---|---|---|---|---|
| 1 | Old Schema-40 plan remains active | Critical | Accept | Old plan, Phase 00 |
| 2 | Public E2E in authenticated project | High | Accept | Phase 03 |
| 3 | “Points earned” runtime boundary unclear | Critical | Accept (modified) | Plan, Phase 02/03 |
| 4 | Scorer input lacks trusted provenance | Critical | Accept | Phase 02/03 |
| 5 | Taxonomy lacks annex/approver | High | Accept | Phase 00 |
| 6 | Sparse writes validate fragments | Critical | Accept | Phase 01 |
| 7 | Non-route writes can bypass pair invariant | High | Accept | Phase 01 |
| 8 | Autosave ordering is underspecified | High | Accept | Phase 01/03 |
| 9 | Add server-wide optimistic concurrency | High | Reject | Existing save ownership |
| 10 | Legacy hydration auto-select is ambiguous | High | Accept | Phase 01 |
| 11 | Persist mapping version per row | Medium | Reject; policy only | Phase 00/01 |
| 12 | Fixture is not reproducible | High | Accept | Phase 00/03 |
| 13 | Legacy nodes can create Frankenstein score | Critical | Accept | Phase 02 |
| 14 | Score predicates are vague | High | Accept | Phase 02 |
| 15 | DOM-only XSS assertion is insufficient | High | Accept | Phase 02/03 |

## Validation Log

### Session 1 — 2026-07-29

- User requested a from-scratch US-F37-02 re-plan after reviewing current docs; PRD v2.6 is therefore the technical target, with stale issue/story sync retained as a P0 gate.
- Scope validated as FR-04..11 only. US02 computes pure Schema 0..35; #1312 owns runtime aggregation/display and overall `20/35/15/30`.
- No further product choice was assumed for the exact taxonomy or acceptance fixture. Phase 00 requires a named approver/owner and concrete artifacts before implementation can pass its gate.
- Recommendation: proceed with Phase 00 only; do not start product phases until the issue/story, TC registry, mapping annex, #1708 strategy, and fixture manifest are locked.


### Session 2 — 2026-07-29 implementation and handoff

- Phase 00 contract artifacts, Phase 01 persistence/validation/UI, and Phase 02 generation/scoring are implemented and covered by automated verification.
- Focused verification: **179/179 passed**.
- Repository verification: TypeScript typecheck and `git diff --check` passed.
- Full test run: **11,174 passed**; **4 failures** are environmental database-port connection failures, not product assertion failures.
- Debugger verdict: the four full-suite failures are caused by the unavailable local PostgreSQL port; no defect was found in the Phase 00–02 implementation.
- Code review verdict: **9.6/10**, with no blocking P0 finding.
- Migration coverage now includes a drift detector for the additive `sites.local_business_schema_subtype` column.
- Phase 03 local automation now uses account-based sole-site discovery via tenantSlug with no E2E_SITE_ID. Live staging fixture execution and manual Google Rich Results evidence remain pending; #1708 is reconciled only if it lands first.
- Overall plan remains `in_progress`; no story-level completion is claimed.
### Session 3 — 2026-07-30 Phase 03 local verification

- Added read-only TC-F37-02-45 Playwright coverage to the unauthenticated storefront project. The `.github/workflows` directory remains unchanged; live execution must invoke the spec explicitly through an approved CI or manual command.
- The E2E account sole site is discovered through authenticated Editor state; the public route derives from tenantSlug, with no E2E_SITE_ID and no persisted site.domain prerequisite.
- Debugger review removed a duplicate page-level Organization/WebSite graph and made SiteRenderer the single schema owner with the resolved canonical origin.
- AC-04 rollback now restores a confirmed server snapshot and serializes LocalBusiness requests; TC-F37-02-47 covers direct rejection plus a queued matching-pair save (10/10 focused file).
- Verification passed: typecheck, git diff --check, Playwright discovery (2 tests/1 file), local no-credential explicit skip (2 skipped, no setup/server), and combined regression (9/9 files, 189/189 tests).
- Phase 03 remains in progress only for live staging fixture execution and manual Google Rich Results evidence. #1708 is not a US-F37-02 dependency.

### Session 4 — 2026-08-03 staging sync and semantic reconciliation

- Fast-forwarded the feature branch to current `origin/staging`, then reapplied the Phase 00–03 WIP with a recoverable stash retained.
- PR #1708 is now present on staging. Conflict resolution retained its per-site revisioned/coalescing LocalBusiness serializer and added US02 rollback from the last persisted snapshot.
- A confirmed HTTP rejection of the latest batch rolls back the category/subtype pair. After response loss, the editor reconciles against authoritative data; if the outcome remains unknown, it preserves the optimistic pair and blocks later full-snapshot LocalBusiness writes until reload. A failed older batch preserves and drains a newer optimistic revision.
- Verification passed: 10/10 focused files and 210/210 tests, database schema drift against local PostgreSQL, typecheck, diff check, Playwright discovery, and 2-test no-credential skip.
- Live staging fixture execution and manual Google Rich Results evidence remain open; no `E2E_SITE_ID` was introduced.

### Session 5 — 2026-08-03 final branch remediation and review

- Confirmed the production example does not set the OTP bypass while staging-only E2E configuration remains documented; no `E2E_SITE_ID` or workflow change was introduced.
- Preserved the legacy score API semantics while keeping the new pure Schema 35 scorer isolated for #1312.
- Fixed sparse effective-state validation, legacy-hours self-healing, mixed-request prevalidation, bounded geo/HTTP URL emission, FAQ compatibility semantics, and stale cross-site rollback.
- Verification passed: typecheck, lint, diff check, 163/163 remediation tests, Playwright discovery, and the explicit 2-test no-credential skip.
- Focused verification after the response-loss and generic-subtype fixes: 15 files/278 tests passed; typecheck and lint pass. TC-F37-02-45 authenticates through a temporary local loopback proxy without repository configuration changes, then stops at the read-only fixture guard because the current site is `draft`.
- Phase 03 remains open only for live staging TC-F37-02-45 and manual Google Rich Results evidence.
- Docker Compose files and `scripts/db-migrate-dev.js` remain untouched local WIP and are excluded from US-F37-02 review/commit scope.

### Session 6 — 2026-08-04 response-loss resilience closeout

- Registered TC-F37-02-48 for normalized response-loss reconciliation, Payload row-metadata tolerance, a bounded 5-second reconciliation timeout, caller-visible failure on unknown outcome, cross-mount LocalBusiness locking, queued-revision removal, i18n, and subtype a11y descriptions.
- Client queueing, comparison, and server validation now share the same LocalBusiness text canonicalization. A semantically committed save reconciles successfully; an unresolved outcome retains only the ambiguous in-flight snapshot and prevents later full-snapshot writes until reload.
- Red baseline: 6 failures across the two targeted files. Green verification: 65/65 targeted tests, TypeScript typecheck, and repository lint pass.
- Broader related verification: 245 assertions pass; the only 3 failures are database schema-drift checks blocked by unavailable `127.0.0.1:5432`. The migration suite passes 24/24.
- TC-F37-02-45 live staging execution and manual Rich Results evidence remain the only open Phase 03 acceptance items.
- `.github/workflows`, Playwright configuration, Docker Compose WIP, and `scripts/db-migrate-dev.js` were not changed by this remediation.
