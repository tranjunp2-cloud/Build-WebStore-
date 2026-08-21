# Phase 02 — Immutable ledger and transactional fixture capacity

**Status:** completed · **Migration:** yes · **Depends on:** Phase 01 registry

## Objective

Persist every target decision and prevent conflicting tests from operating on the same fixture. This must be a Postgres transaction, not GitHub Actions `concurrency` alone, because blocked state/recovery evidence is a product requirement.

## Files

- Add `src/collections/QaSmokeDispatches.ts`, `src/collections/QaFixtureLeases.ts`, `src/lib/payload/qa-targeted-dispatch-transaction.ts`, `src/lib/admin/qa/targeted-smoke-dispatch.ts`.
- Modify `src/payload.config.ts`, `scripts/db-setup.js`, `.env.staging.example`, `.env.production.example`.
- Add unit/API transaction tests under `src/__tests__/unit/qa/` / `src/__tests__/api/`.

## Data model and state machine

`qa_smoke_dispatches` status is append/transition controlled by server code: `queued → dispatched → terminal`, or `blocked`; it is immutable in identity/pack declaration after creation. Store safe `blockCode` and bounded `recoveryHint`, never exception/secret text.

`qa_fixture_leases` records active/released/expired lifecycle. Acquisition algorithm locks the fixture-capacity row (or uses a correct equivalent) and counts active, unexpired slots inside one DB transaction. It creates dispatch + lease together. Dispatch failure after claim must mark a safe terminal dispatch and release lease in a compensating transaction.

## Steps

1. Define collection access: no client create/update/delete; read only super-admin (or no UI read until F40-04), server `overrideAccess` transaction only.
2. Add additive migration entries and new slugs to `COLLECTION_SLUGS[]`; verify every field/group/table/index has a matching entry. Never `DROP TABLE`.
3. Implement canonical request digest and immutable identity. Same canonical request returns existing dispatch; different declaration for same identity returns conflict, not overwrite.
4. Implement lease expiry/reclaim with an injected clock for tests. Ensure capacity, environment, fixture key and slot are all part of lock decision. Validate capacity 1 and future extensibility without relying on runner-level concurrency.
5. Represent unresolvable target/no active pack separately from fixture exhaustion: both non-executing durable outcomes but distinct machine codes and recovery instructions.

## Tests

- TC allocation under F40-03 after QA doc update: first claim queues; duplicate retries no-op; same fixture concurrent claim blocks; different fixtures queue; expiry reclaim works; failed downstream dispatch releases.
- Migration structural test checks tables/indexes/slugs and rejects forbidden drop SQL.
- Access/config test confirms no browser-admin mutable write route.

## Done when

- Two simultaneous capacity-1 requests cannot both queue browser work.
- All decisions are durable, idempotent and safely explainable.
