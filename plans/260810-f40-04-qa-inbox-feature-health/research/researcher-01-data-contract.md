# Researcher 01 — data and server contract

## Sources

- GitHub issue #1743, `[US-F40-04] QA Inbox and Feature Health Detail`.
- `src/app/api/admin/qa/project-health/route.ts`
- `src/app/api/admin/qa/runs/route.ts`
- `src/collections/QaTestRuns.ts`, `QaTestResults.ts`
- `src/lib/admin/qa/health-calculator.ts`, `contracts.ts`

## Findings

1. `/studio/qa` currently renders a Project Health list/modal only. It has no ordered inbox or feature-detail read model.
2. Health output is limited to target state/reason/latest run. It does not expose a failed testcase, actionable next step, evidence metadata, or cursor feed.
3. `qa_test_results` stores TC-ID, status, assertion code, numeric expected/actual, and one approved expiring artifact URL. It lacks fixture reference, safe textual expected/actual, classification, evidence kind, and visual baseline/current/diff.
4. PR/SHA exists on `qa_test_runs`, but `/api/admin/qa/runs` does not return result rows.
5. Artifact contract is already safe-by-default: HTTPS allowlist, `/sanitized/` paths, expiry at most seven days. UI must only use server-returned URLs and render expiry without raw CI fallback.
6. No finding or visual-review persistence exists. Merely showing URLs cannot prove that no GitHub issue is created before tester confirmation.
7. No server-side manual retest action exists on staging. The F40-03 targeted-dispatch/lease contract is in unmerged PR #1761; F40-04 must integrate only after it lands and must never expose GitHub credentials or arbitrary commands.

## Constraints

- New Payload fields/collections require additive `scripts/db-setup.js` SQL and `COLLECTION_SLUGS` updates where applicable.
- Keep F40-05 GitHub issue sync/creation out of scope. F40-04 may persist internal tester review only.
- Unknown/missing/expired evidence cannot be rendered Healthy.

## Unresolved question

Issue AC-2 says tester can start a targeted retest, but the owning manual-dispatch story is F40-07 and its runtime dependency F40-03 is not merged. The implementation must either receive explicit scope approval for a narrow manual-dispatch endpoint or defer that CTA until the dependency is live; a disabled fake CTA is not AC-complete.
