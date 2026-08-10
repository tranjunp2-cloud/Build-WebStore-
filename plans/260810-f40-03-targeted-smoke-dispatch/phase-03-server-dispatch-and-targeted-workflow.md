# Phase 03 — Authenticated server dispatcher, Actions workflow and terminal binding

**Status:** completed · **Migration:** no additional schema beyond Phase 02 · **Depends on:** Phases 01–02

## Objective

Connect exact staging deploy evidence to the registry/ledger and run only the claimed pack. The server authenticates dispatch calls and uses GitHub App credentials to invoke Actions; CI is a constrained executor, not an authority that may choose arbitrary tests.

## Files

- Add `src/app/api/internal/qa/targeted-dispatch/route.ts`, `.github/workflows/targeted-smoke.yml`.
- Modify `.github/workflows/e2e-staging.yml`, `src/app/api/admin/qa/ingest/route.ts`, `src/lib/admin/qa/contracts.ts`.
- Add API contract tests and workflow structural tests; update `tests/f40-qa-ingest.spec.ts` only for a real terminal contract path.

## Steps

1. Keep `e2e-staging.yml` exact-SHA deployment wait, source-PR resolution and change-impact snapshot generation. Once flag enabled, it POSTs only validated PR/SHA/impact context to the internal dispatcher; do not include GitHub App credentials in the workflow/browser.
2. Internal route requires a bounded signed request/replay timestamp distinct from normal user auth, validates SHA/PR/environment/paths and resolves packs server-side. Add `dynamic = 'force-dynamic'`, `maxDuration <= 60`, explicit error handling and rate/size limits.
3. Use GitHub App JWT/installation token server-side to `workflow_dispatch` `.github/workflows/targeted-smoke.yml` on the deployed SHA. Inputs are constrained to dispatch ID and immutable identifiers; workflow re-fetches/validates server-approved declaration (or signed immutable payload) rather than evaluating a user-provided command.
4. Targeted workflow checks out the requested immutable ref, provisions only the declared fixture, invokes only registry spec/project/TC filter, produces one safe result per declared TC, and posts signed terminal payload. It must upload raw Playwright artifacts separately with retention but persist only approved sanitized URLs.
5. Extend ingest schema/route: terminal request supplies `dispatchId`; look up queued/dispatched ledger; exact-match target/pack/ref/TC set/workflow run identity; atomically create US-F40-02 run/results, set dispatch terminal, and release its lease. Reject missing declared TC, extra TC, wrong target/SHA, wrong workflow, late duplicate-different payload, and terminal state overwrite.
6. If GitHub dispatch call fails, mark dispatch blocked/cancelled with `GITHUB_DISPATCH_FAILED` safe recovery text and release lease. No retry can accidentally launch a second workflow.

## Required env placeholders

Add names and comments—not values—to both environment examples: `F40_TARGETED_SMOKE_ENABLED`, `QA_TARGETED_DISPATCH_SECRET`, `GITHUB_APP_ID`, `GITHUB_APP_INSTALLATION_ID`, `GITHUB_APP_PRIVATE_KEY`, and any explicitly selected GitHub API base/repository setting. CI secrets use matching names. Do not use broad `GITHUB_TOKEN` for server dispatch unless the team explicitly rejects GitHub App policy and documents a least-privilege alternative.

## Tests

- API: unsigned/stale/oversized request rejected; valid mapped request queues; no-pack records gap; HMAC replay is idempotent; GitHub client is never exposed to response.
- Ingest: only bound queued dispatch accepts exact terminal TCs; missing/extra/wrong workflow/SHA rejected; failed/blocked result has assertion code; lease releases exactly once.
- Workflow structural: correct `workflow_dispatch` inputs, checkout ref, no broad `npx playwright test` / full fallback, declared TC filter, safe signing, permissions least privilege.

## Done when

- Staging deployment can trigger each pilot pack without running unrelated specs.
- CI cannot turn a route input into shell execution or choose a different pack.
