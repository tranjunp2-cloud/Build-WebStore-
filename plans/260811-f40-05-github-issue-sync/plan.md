---
title: US-F40-05 — GitHub Issue Sync and Confirmed Target Mapping
issue: https://github.com/primeproduction/ech-prime-web-v2/issues/1744
branch: feat/f40-us-f40-05-github-issue-sync-target-mapping
status: implemented_with_rollout_gates
---

# Implementation Plan

## Delivery status — 2026-08-12

- [x] Phase 1 — `qa_github_issues` is registered as a super-admin-readable, server-write-only Payload mirror; its additive migration has unique/health indexes and no destructive SQL.
- [x] Phase 2 — server-only GitHub normalization/sync, retry-safe mirror upsert, protected sync route, and protected audited confirm/remap/dismiss mapping route are implemented.
- [x] Phase 3 — Project Health reads only confirmed, open, exact-P1 issue mappings and gives them explainable `Critical` precedence; unknown/suggested, closed, dismissed, and remapped records do not affect the former target.
- [x] Phase 4 — F40 `[x] AUTO` TC registry, focused API/unit coverage, fixture seed/reset scripts, and Playwright coverage were added. The E2E spec now exercises the real super-admin browser flow when resettable fixture IDs and credentials are configured.

### Deferred P1 rollout gates

1. **Live E2E execution:** `tests/f40-github-issues.spec.ts` intentionally skips outside a configured environment because it requires `ADMIN_EMAIL`, `ADMIN_PASSWORD`, a resettable database, and the F40 GitHub-issue fixture IDs. Configure these in CI/staging and run the spec without the skip before claiming live E2E evidence.
2. **Staging migration proof:** run `scripts/db-setup.js --migrate-only` against the staging database and inspect the `qa_github_issues` table/indexes. No production schema operation has been performed by this implementation.
3. **GitHub integration proof:** exercise the protected sync endpoint with approved server-side GitHub credentials against one historical open issue, then verify retry/reconciliation and close/remap behavior. Do not expose credentials to Studio or record them in validation notes.
4. **Feature fixture lifecycle:** use `db:seed-f40-github-issues` / `db:reset-f40-github-issues` only in an explicitly resettable QA environment; do not run the reset command against shared staging data.

## Scope and acceptance mapping

| Acceptance criterion | Delivery owner | Verification |
| --- | --- | --- |
| AC-1 metadata-only, idempotent GitHub mirror | collection, migration, server-only GitHub client and sync endpoint/service | unit/API coverage for upsert, pagination/retry and reconciliation |
| AC-2 unmapped historical issue is safe | nullable mapping plus explicit `unknown` status and suggestion metadata | E2E/API coverage proves suggestion never changes health |
| AC-3 confirmed open P1 issue is Critical | audited mapping action and health-calculator issue precedence | unit/E2E coverage for mapped-open, closed, and remapped issue |

## Phase 1 — Persisted contract and migration

1. Add `qa_github_issues` Payload collection, imported by `src/payload.config.ts`.
2. Persist only: issue number, URL, title, state, labels, exact derived severity, GitHub update time, sync timestamps, nullable target ID, mapping status/suggestion metadata, mapping actor and time. Do not persist body or comments.
3. Lock collection access to server-controlled writes and super-admin reads.
4. Add additive `CREATE TABLE IF NOT EXISTS`, indexes/unique issue-number constraint, and the collection slug to `scripts/db-setup.js`; do not use destructive migration SQL.

## Phase 2 — Secure synchronization and mapping

1. Extract/reuse the server-only GitHub App authentication pattern from `github-targeted-smoke.ts` for a bounded issues client; never return installation tokens to the browser.
2. Define strict schemas for GitHub payload normalization and mapping requests. Treat only exact `P1` labels as P1; all other/missing labels are non-critical.
3. Implement retry-safe upsert and reconciliation of open and closed issues. A failed GitHub response must not erase already mirrored records.
4. Add protected server routes/actions for sync and Ary’s target assignment/remap, with `withSuperAdmin`, explicit actor capture and timestamped audit metadata.
5. Reuse existing GitHub App environment variables when sufficient. If a new variable is unavoidable, add placeholders to both `.env.staging.example` and `.env.production.example`.

## Phase 3 — Project Health and Studio UX

1. Extend `calculateTargetHealth` with confirmed mapped issue input and a deterministic `Critical` precedence rule for open P1 issues, including an external GitHub explainable link.
2. Fetch the same issue evidence in both Project Health data loaders (`/api/admin/qa/project-health` and `/studio/qa`) so SSR and API output cannot diverge.
3. Ensure an unconfirmed suggestion has no health effect; a closed or remapped issue immediately stops affecting its prior target.
4. Add the minimal protected Studio assignment affordance/state so an Unknown-mapping issue is visible and Ary can select a registry target. Preserve existing Critical/link rendering.

## Phase 4 — Test and verification

1. First add only `[x] AUTO` test cases for F40 to `docs/qa/F40-qa-control-center.md` if the TC registry lacks cases for this story.
2. Add unit tests (AAA, TC-ID-labelled) for exact P1 severity classification, sync normalization/upsert/reconciliation, and health precedence.
3. Add API tests for authorization, validation, audited mapping, and safe failure handling.
4. Add a Playwright E2E spec covering Unknown mapping, mapped-open P1 Critical with GitHub link, and closed/remapped recovery.
5. Run focused Vitest/API suites, TypeScript check, and the new Playwright spec; report environmental blockers distinctly.

## Guardrails

- GitHub remains the authority for bodies/comments; no raw issue content or credentials are mirrored.
- No title-keyword inference may affect health before an explicit mapping confirmation.
- Mapping writes are tenant-safe/super-admin-only and auditable.
- Branch PR title follows `feat(F40): [US-F40-05] ...` and description uses `Relates to #1744`.
