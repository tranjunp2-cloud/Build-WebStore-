---
date: 2026-07-29
session: F37-01 scope correction
---

# Journal: 2026-07-29 — F37-01 Scope Correction

## Context

US-F37-01 needed focused browser evidence for minimal business-data persistence, invalid-phone rollback, and the 375px editor flow.

## What Happened

- Review found scope had expanded into F37-02/03/04 runtime SEO work and shared CI/E2E infrastructure.
- Those unrelated changes were restored; the remaining implementation is limited to stable editor selectors, TC-F37-01-26/27, fail-closed discovery of the test account's sole tenant-owned site, and scoped QA notes.
- A later review found two gaps: F37-01's 7/8/5 score contract was not exposed from persisted runtime data, and teardown could not losslessly handle Payload array-row IDs in non-empty `openingHours`.
- The score API now adds `minimalBusinessData`, calculated from persisted name, address, and phone values with the 7/8/5 contract. The legacy total and legacy `breakdown.businessData` remain unchanged; #1312 owns the global score cutover and dashboard/UI integration.
- API regression tests started with the expected red baseline of 2 failing/2 passing, then passed 19/19 together with the helper contract tests.
- `npm run typecheck` passed; targeted editor/geo tests passed 47/47.
- Scoped ESLint passed for the changed route/API/E2E files (ESLintRC deprecation warning only); a full build was not rerun for this narrow follow-up.
- Playwright discovery passed with setup plus exactly TC-F37-01-26/27; the spec remains intentionally manual and outside the default staging workflow. `git diff --check` also passed.
- Teardown explicitly restores and raw-verifies every touched field, writing `null` when the original phone/address/header value was absent.
- Review findings were fixed within the F37-01 test boundary: teardown now compares the current raw site with the run-owned expected state before restore and fails safely on drift; the manual run still requires an exclusive fixture account with exactly one tenant-owned site.
- Preflight now fails before any mutation unless that sole reserved fixture has empty `openingHours`, avoiding unrelated Payload row-ID churn. TC-F37-01-27 also asserts the persisted runtime `minimalBusinessData.score` is 20.
- The invalid-phone case keeps a bounded no-site-save-PATCH observation active from blur through the network quiet window, then reloads to prove the last valid phone remained persisted.
- The stale plan instruction to expand Playwright discovery into another test directory was removed; the established `e2e/` location remains unchanged.
- No schema, save-API, CI, Playwright config, site-ID environment variable, migration, or global score behavior changed, and no live staging E2E result is claimed.
- The final local tenant-isolation evidence gap is covered by TC-F37-01-28: with both single-tier and two-tier rate limiters mocked to prevent configured Upstash or in-memory shared state, a complete F37 payload for another tenant returns 403 before subscription lookup or persistence. The targeted assertion failed before the mock and passed after; the full scoped gate passes 33/33, with typecheck, scoped ESLint, and diff-check passing. Live staging TC-26/27 remains pending.

## Reflection

The issue boundary should have stayed anchored to its acceptance criteria; treating adjacent SEO stories and CI hardening as prerequisites created avoidable risk and review noise.

## Decisions Made

| Decision | Rationale | Impact |
|---|---|---|
| Keep only TC-26/27 browser coverage | Directly proves the remaining F37-01 flows | Small, reviewable diff |
| Expose only the additive F37-01 score contract | F37-01 owns 7/8/5 persistence evidence; #1312 owns the legacy-total cutover and UI | Runtime AC is testable without broad score changes |
| Compare before fixture restore | Refuse to overwrite state changed outside this test run | Fail-safe cleanup without shared-infrastructure changes |
| Require empty fixture `openingHours` | F37-01 must not rewrite unrelated Payload array metadata | Fails before mutation when fixture scope is unsafe |
| Test the existing save-route tenant guard | The DoD requires tenant isolation, but production behavior was already correct | Adds IDOR regression evidence without changing the route |

## Next Steps

- Reserve an exclusive staging test account with exactly one schema-valid site and empty `openingHours`, then invoke both scenarios manually. Complete the global score formula and dashboard/UI integration under #1312.

## Final Fix Cycle — Transport Ambiguity and Safe Default

The last review found two narrow correctness gaps. A contact PATCH transport exception was treated as a definite rejection even when the server may already have persisted the change, so the editor could show the old value while storage held the new one. Separately, placing the mutating F37 spec in the established `e2e/` root made it discoverable by default runs despite its reserved-fixture requirement.

The editor now reconciles only asynchronous contact transport failures through a no-cache authenticated `editor-data` read. If every submitted contact field matches authoritative storage, the save returns success and adopts the server state. If persistence remains unknown, the editor keeps the submitted value visible, locks contact inputs, and requires reload instead of claiming rollback; synchronous fetch setup errors and HTTP error responses remain definitive failures. This does not introduce a generic retry, timeout, or save-queue redesign. The Playwright spec allows only the exact local and live-staging origins; malformed, production, and lookalike origins fail closed.

Red evidence: the focused response-lost-after-persistence case failed before the reconciliation branch (1 failed, 13 skipped). Green evidence: the full publish-flow suite passes 14/14 and covers both confirmed persistence and the locked unknown state.

A later adversarial review found the suite-level origin skip was evaluated only after Playwright's authenticated `setup` dependency, so it could not protect credentials from a misconfigured target. The exact allowlist now lives in a shared helper and is asserted at the first line of auth setup, before navigation or reading credentials; the F37 suite retains its skip as defense-in-depth. TC-F37-01-29 covers allowed, malformed, production, and lookalike targets without expanding CI or Playwright configuration.

Live staging TC-F37-01-26/27 remains pending with the exclusive one-site account and empty-`openingHours` fixture. No live browser pass is claimed.
