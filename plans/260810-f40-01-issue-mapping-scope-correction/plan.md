# F40-01 — Issue-Mapping Scope Correction

## Status (2026-08-10)

- [x] Phase 1 implementation: the runtime health contract now accepts only persisted F40-01 run and change-impact evidence; the unconnected issue-mapping contract and precedence were removed.
- [x] Phase 1 regression coverage: invalid run timestamps remain `Unknown`, and a newer successful run clears an older change impact.
- [x] Phase 2 verification: F40 unit tests, typecheck, E2E project discovery, diff checks, and final adversarial review completed; full staging E2E remains a CI gate because local credentials/URL are unavailable.
- [ ] US-F40-05 follow-up: deliberately deferred to its own branch and PR.

## Decision

**Do not expand PR #1759 / branch `feat/f40-qa-run-data-contract` into US-F40-05.**

The open-issue mirror, synchronization/retry, persisted mapping confirmation, audit history and GitHub integration are explicitly the deliverables of **US-F40-05**. Adding them here would combine two user stories in one PR, violate the repository's `1 US = 1 branch = 1 PR` rule, and require a new Payload collection plus SQL migration unrelated to the current F40-01 change set.

The safe F40-01 correction is to make the boundary explicit and prevent the Project Health implementation from implying that it currently consumes issue mappings. Until US-F40-05 lands, health must be calculated from persisted run and change-impact evidence only; targets without valid evidence remain `Unknown`, never `Healthy`.

## Evidence

- `src/lib/admin/qa/health-calculator.ts` previously exposed `QaIssueMappingInput` and issue precedence in its pure-function contract.
- Both runtime callers — `src/app/studio/qa/page.tsx` and `src/app/api/admin/qa/project-health/route.ts` — load only `qa_test_runs` and `qa_change_snapshots`; neither can provide confirmed mappings.
- No persisted QA issue-mirror/mapping collection or migration exists.
- `docs/stories/F40-qa-control-center-stories.md` assigns the mirror, historical mapping, confirmation audit, and health updates to US-F40-05.

## Phase 1 — Make the F40-01 Boundary Honest

Files:

- `src/lib/admin/qa/health-calculator.ts`
- `src/app/studio/qa/page.tsx`
- `src/app/api/admin/qa/project-health/route.ts`
- `src/__tests__/unit/qa/f40-project-health.test.ts`

1. Retain only F40-01 evidence inputs in the exported runtime calculation path: valid test runs and change-impact snapshots.
2. Remove or isolate the unconnected issue-mapping input and its `Critical`/open-issue precedence from the F40-01 implementation, so tests and production runtime represent the same contract.
3. Preserve safe precedence for the data that F40-01 owns: failed run → Needs attention; blocked/impact/stale pass → Watch; absent/invalid evidence → Unknown; recent pass → Healthy.
4. Add/adjust unit cases proving no run, malformed timestamp, an unconfirmed hypothetical mapping, and no supplied mapping cannot produce Healthy. Do not fabricate issue data in the page/API.
5. Update concise code comments to name US-F40-05 as the owner of mapped-GitHub-issue precedence; no UI promise or fake GitHub link is introduced.

## Phase 2 — Verify the Current PR

Files/tests:

- `src/__tests__/unit/qa/f40-project-health.test.ts`
- `tests/f40-project-health.spec.ts`
- `playwright.config.ts`

1. Run the F40 unit suite and the project typecheck.
2. Confirm Playwright discovers the F40 spec in the staging project; run it when the required staging credentials/environment are available.
3. Run `git diff --check` and inspect the final diff against `staging` for accidental schema, migration, secret, or cross-story changes.
4. Re-run the three-stage review: F40-01 acceptance-criteria compliance, code-quality review, then adversarial review focused on false-green state transitions and authorization of the health API.

## Deferred Follow-up — US-F40-05 (Separate Branch/PR)

This is deliberately **not** part of PR #1759. Its implementation plan must include:

1. A tenant-safe/additive Payload collection (for issue mirror and target mappings) with collection registration and matching `scripts/db-setup.js` `CREATE TABLE IF NOT EXISTS` migration/indexes; never use `DROP TABLE`.
2. Idempotent GitHub synchronization storing only number, URL, title, state, labels, severity, update time, mapping metadata and confirmation audit actor/time; GitHub body/comments remain remote source of truth.
3. Super-admin-only mapping confirmation/remapping API/UI, validation, audit trail, retries/reconciliation, and no browser-side GitHub credential.
4. Runtime loading of confirmed open mappings into `calculateTargetHealth`, with deterministic refresh for map/close/remap and a safe GitHub issue link.
5. Unit/API/E2E coverage for unknown historical issue, confirmed mapped P1/open issue → Critical, close/remap → deterministic update, idempotent sync, authorization, and retry behavior. Map only `[x] AUTO` cases after reading `docs/TEST_CONVENTION.md` and F40 QA cases.

## Completion Criteria for This PR

- The F40-01 runtime and tests no longer claim an issue-mapping capability it does not load.
- No false-green path is introduced while mapping is unavailable.
- No new collection, migration, GitHub credential, or F40-05 UI/API is added.
- Review output explicitly records US-F40-05 as a separate follow-up rather than a defect silently left in the current implementation.
