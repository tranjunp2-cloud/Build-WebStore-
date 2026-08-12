# F40 — QA Control Center

## US-F40-04: QA Inbox and Feature Health Detail

### [x] AUTO TC-F40-04-02 — Editor Product Grid variant evidence and retest

**Preconditions:** Staging has the isolated `QA-Tshirt-SML` fixture and a super-admin E2E account. The target is `editor-productgrid-variants`; its selected pack is `editor-product-grid-variants-smoke` only.

```gherkin
GIVEN a tester opens the Editor Product Grid using QA-Tshirt-SML
WHEN the Product Grid binds the fixture variants
THEN the visible variant list contains S, M and L exactly once
AND the terminal run records target editor-productgrid-variants, fixture QA-Tshirt-SML,
  expected count 3, actual count 3 and the approved safe evidence metadata
```

**Failure evidence contract:** a missing/duplicate variant records `VISUAL_THRESHOLD_EXCEEDED` only for an approved visual comparison whose measured difference is greater than its threshold; functional count mismatch uses `VARIANT_COUNT_MISMATCH`.

**Safety:** the pack is staging-only, uses the registered fixture lease, runs no arbitrary command and never creates a GitHub issue.

> Source: `docs/prd/qa-control-center.md`, `docs/design/qa-control-center-ux.md`, and `docs/stories/F40-qa-control-center-stories.md`.

## US-F40-05 — GitHub Issue Sync and Confirmed Target Mapping

| TC-ID | Type | Priority | Scenario | Status | Automated by |
| --- | --- | --- | --- | --- | --- |
| TC-F40-05-01 | Unit | Critical | Normalize metadata only; classify only exact `P1` as P1. | [x] AUTO | `src/__tests__/unit/qa/f40-github-issues.test.ts` |
| TC-F40-05-02 | Unit | High | Upsert is idempotent and preserves mapping; concurrent create reconciles safely. | [x] AUTO | `src/__tests__/unit/qa/f40-github-issues.test.ts` |
| TC-F40-05-03 | API | Critical | Sync route rejects unauthorized callers and safely handles GitHub failures. | [x] AUTO | `src/__tests__/api/f40-github-issues.test.ts` |
| TC-F40-05-04 | API | Critical | Mapping validates input and records actor/time/history on confirmation. | [x] AUTO | `src/__tests__/api/f40-github-issues.test.ts` |
| TC-F40-05-05 | Unit/E2E | Critical | Unknown mapping has no health effect; confirmed open P1 is Critical with a GitHub link; closed/remapped issue clears the old target. | [x] AUTO | `src/__tests__/unit/qa/f40-project-health.test.ts`, `tests/f40-github-issues.spec.ts` |

## QC browser verification runbook

`tests/f40-github-issues.spec.ts` has a public authorization-boundary check and a stateful browser/API flow. Run the stateful flow only against the isolated QC database: the seed and reset commands refuse any environment other than `APP_ENV=qc-test` (or `NEXT_PUBLIC_APP_ENV=qc-test`) and reject known staging/production hosts.

1. Load the uncommitted QC environment and start the application against the same database. Set `BASE_URL` to that running application (defaults to `http://localhost:3000`).
2. Set a temporary, non-production `F40_E2E_ADMIN_PASSWORD` of at least 12 characters. Do not put it in a committed env file.
3. Seed the two reserved fixtures and export the emitted IDs for the Playwright process:

   ```bash
   set -a && . .env.qc-test && set +a
   export F40_E2E_ADMIN_PASSWORD='replace-with-a-temporary-qc-password'
   eval "$(npm run --silent db:seed-f40-github-issues | rg '^F40_')"
   BASE_URL=http://localhost:3000 npx playwright test --project=f40-github-issues
   npm run db:reset-f40-github-issues
   unset F40_E2E_ADMIN_PASSWORD F40_E2E_ADMIN_EMAIL F40_GITHUB_MAPPING_ISSUE_ID F40_GITHUB_MAPPING_ISSUE_NUMBER F40_GITHUB_MAPPING_TARGET_ID F40_GITHUB_CLEARED_ISSUE_ID F40_GITHUB_CLEARED_ISSUE_NUMBER F40_GITHUB_CLEARED_TARGET_ID F40_GITHUB_REMAPPED_TARGET_ID
   ```

The fixture never calls GitHub. It creates one `unknown` open `P1` issue and one already-confirmed open `P1` issue. The test proves: the unknown issue does not affect health; confirming it makes the selected target `Critical` with its GitHub link; remapping the second issue removes it from its old target; and dismissing the first issue removes its health effect. Reset deletes only the two reserved issue numbers and the explicitly marked `f40-e2e-admin@primeweb.local` account.

### CI/release follow-up

The stateful test intentionally skips when its fixture variables are absent. Before making it a required CI gate, provision the QC-only password, run the seed command before the `f40-github-issues` Playwright project, and always run reset in an `always()` cleanup step. Never run this fixture on staging or production.
