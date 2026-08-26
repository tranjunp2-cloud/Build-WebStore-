# Phase 04 — Expand remaining domains and separate Regression

## Outcome

Apply the same certification gate to remaining CMS domains. Build Regression only as an independent target-specific execution contract.

## Steps

1. Refactor the pack model before the first Regression row: separate contract identity `(targetId, packId, profile, packVersion)` with its own spec, TC set, fixture and `autoDispatch` policy. Preserve at most one certified auto Smoke contract per target.
2. Update `src/lib/admin/qa/targeted-smoke-registry.ts`, `src/lib/admin/qa/manual-runs.ts`, `src/lib/admin/qa/targeted-smoke-dispatch.ts`, `.github/workflows/targeted-smoke.yml` and contract tests together. Existing static `.smoke.spec.ts` validation must not accept a Regression spec by accident.
3. Iterate domains after priority batches: product/editor supporting targets, storefront supporting targets, settings/platform and remaining catalog groups.
4. For each target, complete the Phase 03 admission checklist and update its matrix row in the same PR as its executable pack.
5. When QA supplies a true Regression candidate, create a new pack identity with its own spec, TC set, fixture/lease policy, runtime bound and workflow branch.
6. Keep automatic deploy dispatch Smoke-only. Expose Regression only in manual preflight after certification; unsupported profiles remain `NO_ACTIVE_PACK`.
7. Do not parallelize targets sharing a destructive fixture until fixture isolation/capacity proof is in place.

## Files

Same per-target contract files as Phase 03. No new general runner, no collection/database migration unless a future approved audit requirement explicitly needs persisted state.

## Success criteria

- Every new regression result derives from its own actual spec/TC contract.
- Catalog growth never turns a planned/manual row into an executable or passed row without QA approval.
- The final roll-up is `67/67` certified targets. Any target without its own
  source mapping, exact contract and Staging proof remains a release blocker
  for closing #1772, not an implicitly accepted gap.
