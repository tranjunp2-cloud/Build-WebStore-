# Phase 02 — Harden pack/workflow contract parity

## Context

- [Workflow analysis](./research/workflow-contract.md)
- `src/lib/admin/qa/targeted-smoke-registry.ts`
- `.github/workflows/targeted-smoke.yml`
- `src/lib/admin/qa/targeted-smoke-dispatch.ts`

## Outcome

Make each future certified contract impossible to partially admit. Registry, workflow, target-start, ingest and matrix must agree on target ID, pack/version/profile, runner type, exact test selector, TC IDs and any required fixture. The static workflow may duplicate the contract only when a CI parity test proves it one-to-one.

## Runner policy

| Contract type | Use | Workflow execution | Fixture requirement |
| --- | --- | --- | --- |
| `unit` / `logic` | Pure business rules, mapping and validation | Exact allow-listed Vitest file(s) at the deployed commit | None |
| `api` | Route/service behavior and safe integration seams | Exact allow-listed Vitest/API test file(s); isolated DB only when stateful | Only for stateful integration |
| `smoke` | Critical browser journey after deployment | Exact allow-listed Playwright spec/project/grep | Dedicated resettable tenant/account and lease |

No contract accepts a shell command, glob, arbitrary test name or runner from the deploy webhook, UI or GitHub input. A deploy never falls back to running the entire repository.

## Files

| Action | File | Change |
| --- | --- | --- |
| Modify | `src/lib/admin/qa/targeted-smoke-registry.ts` | Evolve to a typed allow-list contract with an explicit `(targetId, packId, profile, version, runner)` identity. |
| Modify | `.github/workflows/targeted-smoke.yml` | Each allow-list branch emits `target_id`, `pack_version`, runner, exact test files/selector, TC IDs and fixture only when required; no fallback/default target branch. |
| Modify | `src/lib/admin/qa/targeted-smoke-dispatch.ts`, `src/lib/admin/qa/manual-runs.ts` | Resolve auto dispatch only from one certified Smoke contract; manual preflight resolves the exact requested profile and rejects ambiguity. |
| Modify | `src/app/api/admin/qa/targeted-start/route.ts`, `src/app/api/admin/qa/ingest/route.ts` | Bind emitted target/version/profile to dispatch before terminal results or lease release. |
| Create | `src/__tests__/unit/qa/f40-targeted-smoke-workflow-contract.test.ts` | Parse static workflow contract and prove matrix ↔ registry ↔ YAML exact parity. |
| Modify | `src/__tests__/unit/qa/f40-targeted-smoke-registry.test.ts`, `src/__tests__/api/f40-targeted-dispatch-route.test.ts` | Drift, unknown profile/version, target fall-through, unsafe spec and exact dispatch tests. |
| Modify | `tests/f40-targeted-smoke-api.spec.ts` | Browser/API path confirms an uncertified target is blocked with recovery text. |

## Steps

1. Define a discriminated `unit | api | smoke` execution contract. A target can have multiple contracts, but a changed-source map selects a bounded exact set and only `smoke` requires a fixture lease. Manual preflight uses target + explicit profile + pack identity, never array order.
2. Maintain workflow branches as static code, then parse/verify their declared outputs in CI. The parity test fails on missing/orphaned contract, duplicate pack, wrong target/runner/test selector/TC/fixture/version, unknown profile or a default target fall-through.
3. Bind the workflow outputs to signed start/ingest. A mismatch rejects terminal persistence and preserves conservative lease recovery; no new pack can become Checkout by default.
4. Keep HMAC, exact PR/SHA and safe-evidence rules unchanged. Apply fixture capacity/global profile quotas only to stateful Smoke/API contracts; unit/logic contracts use bounded per-deploy concurrency and deterministic target ordering. One target failure is independently recorded and never widens/retries another contract.
5. Add version propagation before accepting a non-v1 pack version.

## Success criteria

- TypeScript registry and workflow cannot silently drift.
- A matrix row alone never executes; a workflow input alone never broadens scope.
- Workflow artifacts follow policy: safe summaries reach Payload; raw Playwright report/trace/video upload is removed or explicitly sanitized, access-restricted and retention-bounded before expansion. Vitest output is reduced to declared TC status and a safe failure summary only.
