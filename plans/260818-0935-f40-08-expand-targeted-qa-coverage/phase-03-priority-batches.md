# Phase 03 — Certify Critical, Checkout, Payments and Orders batches

## Context

- [Ticket #1772](https://github.com/primeproduction/ech-prime-web-v2/issues/1772)
- `tests/targeted-smoke/fixture.ts`
- `src/app/api/e2e/targeted-smoke-fixture/route.ts`
- `docs/qa/F09-storefront-commerce.md`, `docs/qa/F10-orders-management.md`, `docs/qa/F13-payment-gateway.md`

## Outcome

Expand priority coverage target-by-target after a documented admission review.
Existing four packs remain the reference proof; no unready target is registered
just to improve a count. This phase must leave each Critical, Checkout,
Payments and Orders target either certified or with a target-specific recovery
record; Phase 04 completes the remaining domains so the parent ticket reaches
67/67 certified rows.

## Current Batch-1 evidence

- Candidate: `order-refund-cancel-retry` (Orders).
- Local pre-certification proof: the exact API selector `\\[TC-F10-03-01\\]|\\[TC-F10-03-03\\]` passed its three intended assertions on 2026-08-18 and excluded `TC-F10-03-01b` plus the remaining 35 tests. A separate provider-neutral browser-fixture candidate remains available for manual validation; it must not be used to activate deployment dispatch until its own proof is approved.
- Boundary: this is not a staging approval or an execution-registry entry. The target remains blocked until a QA owner records approval and a signed Staging (QC) PR/SHA proof is captured.

## Admission checklist (repeat for every target)

1. QA lead assigns Critical/Checkout/Payments/Orders priority and owner in the matrix.
2. Select existing `[x] AUTO` TC IDs; create/update source test only when the assertion is a real business flow.
3. Provision an isolated, resettable staging fixture/test account. Fixture endpoints remain staging-only, server-secret gated, dedicated-tenant scoped and per-target allow-listed; they reject cross-tenant/customer-data/live-provider mutation. For payment flows use provider-neutral seeded states or approved callbacks, never a live charge.
4. Add a target-scoped `tests/targeted-smoke/<target>.smoke.spec.ts`, test setup/cleanup and bounded observation result.
5. Add the most-specific `qa/coverage-map.yml` source mapping and change-impact tests: a changed path selects only this certified Smoke contract; unknown/uncertified paths create coverage gaps; Regression never deploy-dispatches.
6. Add matching registry + workflow branch + fixture capacity; run preflight, capacity collision, signed terminal ingest and one staged PR/SHA proof.
7. QA signs the matrix row `certified_executable`; otherwise retain its coverage gap with recovery owner/note.

## Batch order

| Batch | Start point | Gate |
| --- | --- | --- |
| Critical / Checkout | Preserve certified checkout as baseline; choose next critical target only after owner approves actual flow. | No current extra candidate is automatically approved. |
| Orders | `order-refund-cancel-retry` is the first evidence candidate, not a commitment. | Needs resettable provider-neutral fixture and browser test for cancel/restock/no external refund. |
| Payments | Start with deterministic manual-payment settings if seeded admin fixture exists. | Stripe/Xendit skipped/live specs are explicitly excluded until a safe test tenant exists. |

## Required proof per target

| Evidence | Required before enabling deploy dispatch |
| --- | --- |
| Exact execution contract | Static runner, source spec, exact `[x] AUTO` TC IDs, duration and profile are checked in. No glob or full-suite fallback. |
| Change mapping | A most-specific path maps a Staging PR only to this target's Smoke/unit/API contract; unmapped changes record a gap. |
| Test state | Stateless unit/logic tests need no fixture. Stateful API/Smoke tests use a dedicated resettable tenant/account and no live provider/customer data. |
| QA approval | Named owner approves the selected contract and the expected result. |
| Staging proof | A signed terminal record binds target, pack/version, PR, immutable SHA and safe summary. |

Do not change a matrix row to `certified_executable` until all five are
present. User/QA approval of TC selection is evidence for the fourth row only;
it is not a substitute for the Staging proof.

## Files per admitted target

- `src/lib/admin/qa/targeted-qa-coverage.ts`
- `src/lib/admin/qa/targeted-smoke-registry.ts`
- `.github/workflows/targeted-smoke.yml`
- `qa/coverage-map.yml`, `src/__tests__/unit/qa/f40-change-impact.test.ts`, `src/__tests__/unit/qa/f40-targeted-dispatch-route.test.ts`
- `src/app/api/e2e/targeted-smoke-fixture/route.ts` and/or `tests/targeted-smoke/fixture.ts`
- `tests/targeted-smoke/<target>.smoke.spec.ts`
- owning `docs/qa/F*.md`, `docs/qa/F40-qa-control-center.md`
- targeted registry/dispatch/API/Playwright tests.

## Success criteria

- A mapped staging PR dispatches exactly the one approved Smoke pack per affected certified target.
- A missing fixture, unapproved TC or capacity conflict returns blocked/recovery and opens no browser session.
