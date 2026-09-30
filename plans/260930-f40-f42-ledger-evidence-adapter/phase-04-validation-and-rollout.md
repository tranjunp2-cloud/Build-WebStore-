# Phase 04 — Validation and rollout

## Goal

Prove F40 reads F42 evidence safely, then enable only where a verified staging run
and schema exist.

## Files

- Modify: `src/__tests__/unit/qa/f40-migration-reconciliation.test.ts`
- Create: `src/__tests__/unit/qa/f40-f42-ledger-evidence-provider.test.ts`
- Create: `src/__tests__/api/f40-f42-ledger-reconciliation.test.ts`
- Modify: `tests/studio-migration-diff.spec.ts`
- Modify: `docs/qa/F40-qa-control-center.md`

## Test matrix

1. Exact map, no target, duplicate target, failed/rolled-back map and reuse map.
2. Verified versus applying/failed run; Store outside batch; cursor bounds.
3. Open/resolved exception and no raw `detail` in output.
4. Super Admin success; unauthenticated and malformed requests rejected.
5. Schema unavailable/timeout remain `unverified`, never demo fallback.
6. UI run selection, issue filter, empty state, demo label and 375px layout.

## Rollout

1. Deploy F42 schema before F40 capability is enabled.
2. Test one approved F42 staging batch, capturing only safe run IDs/counts.
3. Enable evidence provider per approved environment.
4. Roll back by disabling the provider; never delete ledger rows or rerun importer.

## Definition of done

- Focused tests, typecheck, lint and `git diff --check` pass.
- One verified F42 staging batch displays correctly in F40 with masked data.
- QA handoff explicitly marks field-value parity as deferred.
