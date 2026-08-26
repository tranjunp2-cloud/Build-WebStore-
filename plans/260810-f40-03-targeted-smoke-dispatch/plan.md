---
title: "F40-03 — targeted critical-flow Smoke dispatch after staging deploy (GH-1742)"
status: rollout_pending
priority: P1
effort: 4 phases / L
branch: feat/f40-us-1742-targeted-smoke
issue: 1742
tags: [F40, qa, playwright, staging, github-actions, payload]
created: 2026-08-10
---

# GH-1742 — Targeted critical-flow Smoke dispatch

## Delivery status (2026-08-10)

- [x] Phase 01 — registry and isolated critical-flow coverage implemented and verified.
- [x] Phase 02 — immutable dispatch ledger, fixture leases, Payload registration, and additive migration implemented and verified.
- [x] Phase 03 — authenticated server dispatch, constrained Actions workflow, and bound terminal ingestion implemented and verified.
- [x] Phase 04 automated checks and final code/adversarial reviews completed with no unresolved P0/P1 findings.
- [ ] Phase 04 manual staging gate remains pending: the required staging secrets/feature-flag configuration and dedicated fixture evidence are external prerequisites. Do not enable the deploy trigger or claim rollout completion before it is performed.

## Problem and goal

Today `.github/workflows/e2e-staging.yml` runs a fixed allow-list after every staging deployment, then publishes one generic `cms.staging.e2e` sentinel. It does not prove that the changed feature's defined critical behavior was exercised.

After a staging deployment, this story will resolve changed paths to target IDs and dispatch only the active Smoke packs for those targets. A pack is a versioned contract:

`target ID → named fixture → Playwright spec/project → named critical TC-IDs → expected assertions`

**A successful HTTP 200 alone is never a passing Smoke result.** Every pilot pack must execute browser/API behavior assertions from existing `[x] AUTO` feature test cases and report each declared TC-ID terminally.

## Scope lock

- Pilot targets only: `products-variants-inventory`, `order-payment-verification`, and `storefront-discount-checkout` (checkout payment flow).
- Reuse US-F40-02 primitives already shipped: signed bounded ingest, immutable change snapshot, `qa_test_runs`, `qa_test_results`, and `coverage-map.yml` resolver.
- Add an internal, server-side dispatcher, immutable dispatch ledger, DB-backed fixture lease/capacity, one targeted Actions workflow, and signed terminal ingestion.
- No F40-04 Studio/Inbox/Feature Health UI, F40-05 GitHub issue mapping/sync, or F40-07 manual-run UI/queue.
- Do not replace scheduled/pre-release full regression. This story removes only the current fixed suite from the post-deploy *targeted* path; release regression remains separately governed.

## Architecture and non-negotiable behavior

```text
staging deploy (exact SHA live)
  → resolve changed paths using qa/coverage-map.yml
  → POST server-side dispatch request (HMAC authenticated)
      → resolve active registry packs; no active pack means recorded coverage gap, never a broad fallback
      → DB transaction: idempotently create immutable dispatch + atomically claim fixture capacity lease
      → queued dispatch invokes GitHub App workflow_dispatch with only validated pack/ref/dispatch ID
      → blocked dispatch is terminal with machine recovery code; no browser test executes
  → targeted workflow executes the registered spec/project and declared TC IDs only
  → workflow posts signed terminal run/result evidence; server verifies dispatch/lease/contract
```

### Locked policies

1. Target resolver must use the existing most-specific `coverage-map.yml` semantics; changed/unmapped paths are still stored once as an immutable US-F40-02 snapshot.
2. Registry is checked-in, versioned and allow-listed. It contains no shell command, URL, secret, or dynamic expression. Only its approved spec paths/projects/TC IDs can reach Actions.
3. The dispatcher is server-only. Browser clients never receive GitHub App credentials. GitHub App private key, app ID, installation ID, dispatch HMAC, and ingest HMAC receive placeholders in both env examples only.
4. One immutable dispatch identity is `(pullRequest, commitSha, environment, targetId, packVersion)`. Retry returns the existing record; a mismatch is conflict. A new SHA creates a new dispatch.
5. Fixture capacity is transactionally claimed before workflow dispatch. Leases are scoped `(environment, fixtureKey)`, expire conservatively, and are released only by verified terminal ingestion or expiry reclamation. Capacity exhaustion yields `blocked` plus recovery code/instructions; it must not run a destructive browser flow.
6. Only a queued dispatch may ingest. Ingest must bind workflow run/attempt, dispatch ID, target, suite/profile, declared TC set, SHA and environment; reject unsolicited, duplicate-different, incomplete, or extra test results.
7. Evidence remains US-F40-02 safe: TC status/duration/assertion code/counts and optional approved sanitized artifact URL only. No traces, screenshots, videos, headers, cookies, raw response bodies, or source diffs.

## Pilot packs (implementation must validate exact source test compatibility)

| Target | Fixture key/capacity | Critical behavior—not a 200 check | Candidate declared `[x] AUTO` TC IDs |
|---|---|---|---|
| `products-variants-inventory` | `smoke-product-variants`, 1 | A product variant selection changes displayed price/stock; add-to-cart preserves selected variant; invalid/no selection is rejected where applicable. | Verify existing F08/F09 test docs and use only marked AUTO cases, initially TC-F09.64 plus relevant variant inventory case(s). |
| `order-payment-verification` | `smoke-order-payment-verification`, 1 | Authenticated staff opens fixture order, verifies payment transition, and confirms persisted payment status/audit-safe UI outcome. | Select only `[x] AUTO` F10 cases after doc audit; record final IDs in registry and corresponding spec headers. |
| `storefront-discount-checkout` | `smoke-checkout-payment`, 1 | Guest cart/checkout uses fixture product; COD/QR payment branch enforces proof rule and produces expected order/payment state without external live payment. | TC-F09.32, TC-F09.33 and TC-F09.161/162 only if their test fixtures can run independently and are `[x] AUTO`; otherwise add narrowly-scoped browser tests and mark the QA cases AUTO in the owning doc. |

The implementer must not invent TC IDs. Phase 1 audits `docs/qa/F08-product-crud.md`, `F10-orders-management.md`, and `F09-storefront-commerce.md`, then records exact approved IDs and assertions in the registry. If a candidate case is not `[x] AUTO`, it is excluded or the QA doc/test is updated in the same PR before being declared runnable.

## Phases

| Phase | Outcome | Migration | Depends on |
|---|---|---|---|
| [01](phase-01-pack-registry-and-critical-flows.md) | Versioned three-pack registry and isolated critical-flow specs | No | US-F40-02 resolver |
| [02](phase-02-dispatch-ledger-and-fixture-leases.md) | Immutable dispatch ledger and transaction-safe leases | Yes | 01 |
| [03](phase-03-server-dispatch-and-targeted-workflow.md) | Authenticated server dispatcher + targeted Actions execution + terminal binding | Env placeholders only | 01, 02 |
| [04](phase-04-verification-rollout-and-review.md) | Full automated verification and staging rollout gate | No | 01–03 |

## Expected production files

**Modify:**

- `qa/coverage-map.yml` — bump version only if pilot path mappings need correction; preserve precedence/governance.
- `src/lib/admin/qa/contracts.ts` — strict registry/dispatch/terminal contract schemas and safe validation helpers.
- `src/app/api/admin/qa/ingest/route.ts` — bind targeted terminal payload to a queued ledger record, atomically persist results and release lease.
- `src/payload.config.ts` — register new QA collections.
- `scripts/db-setup.js` — additive idempotent migration entries only.
- `.github/workflows/e2e-staging.yml` — resolve + call dispatcher after exact deploy check; remove fixed-suite targeted execution only after targeted workflow is operational.
- `.env.staging.example`, `.env.production.example` — placeholders for all new `process.env` keys.

**New:**

- `qa/targeted-smoke-packs.yml`
- `src/lib/admin/qa/targeted-smoke-registry.ts`
- `src/lib/admin/qa/targeted-smoke-dispatch.ts`
- `src/lib/payload/qa-targeted-dispatch-transaction.ts`
- `src/collections/QaSmokeDispatches.ts`
- `src/collections/QaFixtureLeases.ts`
- `src/app/api/internal/qa/targeted-dispatch/route.ts`
- `.github/workflows/targeted-smoke.yml`
- narrowly scoped pilot Playwright files under `tests/targeted-smoke/` (or extract existing specs only when their fixture setup is demonstrably isolated)
- unit/API/workflow structural tests under `src/__tests__/unit/qa/`, `src/__tests__/api/`, and `tests/` as applicable.

## Migration contract (P0)

No existing QA table is dropped or rewritten. `scripts/db-setup.js` must use named, idempotent `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE UNIQUE INDEX IF NOT EXISTS`, and `CREATE INDEX IF NOT EXISTS` entries.

- `qa_smoke_dispatches`: `id serial PRIMARY KEY`; immutable identity columns, registry version, target/pack/fixture identifiers, queued/blocked/terminal state, workflow reference, safe block code/recovery hint, timestamps and digest. Add unique identity index and indexes for workflow binding and state/created time.
- `qa_fixture_leases`: `id serial PRIMARY KEY`; `environment`, `fixture_key`, `dispatch_id` FK, status, capacity slot, acquired/expires/released timestamps. Add unique active-slot enforcement designed for PostgreSQL transaction semantics (partial unique index where status is active, or an equivalent capacity-counter lock row); document why it cannot permit two active claims for capacity 1.
- These collections use scalar/group fields only. If implementation introduces a Payload `array`, its child table must use `id varchar`, `_order integer`, `_parent_id integer`, `_uuid varchar` exactly per repository migration convention.
- Add both collection slugs to `COLLECTION_SLUGS[]` if they are new Payload collections.

## Acceptance criteria / success evidence

1. A staging commit mapping to one pilot target produces exactly that pack's declared TC-ID runs; every result represents a critical assertion, not an HTTP-only check.
2. A commit mapping to multiple active pilot targets queues one dispatch per target; deterministic ordering and no duplicate re-dispatch on retry.
3. No map / no active pack creates a durable coverage-gap/blocked record with action, and does **not** launch an unbounded full suite.
4. Simultaneous dispatches that require the same capacity-1 fixture: one claims it; the other is durably `blocked` with recovery instructions; blocked flow opens no browser session.
5. Expired lease can be reclaimed safely; late/forged/unbound terminal ingestion is rejected and cannot release/overwrite another lease.
6. Terminal failed/blocked TC result carries machine assertion code; successful pack cannot be marked passed if any declared TC is missing.
7. Existing F40-02 signed ingest/snapshot idempotency and safe-evidence guarantees still pass.

## Rollout gates (manual staging — pending external configuration)

1. Deploy migration with dispatch feature flag default disabled; inspect schema/indexes using `scripts/db-setup.js --migrate-only` in staging build.
2. Manually dispatch each pilot pack against the dedicated staging fixtures. Capture run URL, dispatch ID, individual TC statuses, and sanitized evidence links in PR validation notes.
3. Exercise blocked capacity-1 case with two dispatch calls and expiry/recovery case before enabling deploy trigger.
4. Enable only `F40_TARGETED_SMOKE_ENABLED=true` in staging. Observe 3 staging deployments (one per pilot mapping) without generic/full fallback.
5. Roll back by setting flag false; dispatcher stops issuing Actions dispatches while immutable historical records remain readable. Do not delete records or schema.

## PR quality checklist

- Title: `feat(F40): [US-F40-03] dispatch targeted critical-flow smoke packs`
- Description: `Relates to #1742` (never `Closes`).
- Include migration evidence, test matrix, required CI/Vercel secrets checklist without values, and staging manual evidence.
- Run `ck:code-review` after implementation; explicitly red-team HMAC replay, forged dispatch IDs, registry injection, lease races, terminal-result substitution, and unsafe artifact persistence.
