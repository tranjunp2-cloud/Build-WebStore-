# Phase 01 — Freeze catalog matrix and certification gate

## Context

- [Ticket #1772](https://github.com/primeproduction/ech-prime-web-v2/issues/1772)
- [Coverage inventory](./research/coverage-inventory.md)
- `src/lib/admin/qa/target-registry.ts`
- `docs/qa/F40-qa-control-center.md`

## Outcome

Create one checked-in, QA-readable and typed coverage matrix for all 67 active CMS targets. It distinguishes existing descriptive coverage from `certified_executable`, `planned`, `manual_only`, `no-certified-pack` and `deprecated` execution state.

## Files

| Action | File | Change |
| --- | --- | --- |
| Create | `src/lib/admin/qa/targeted-qa-coverage.ts` | Typed matrix plus validation that every active catalog target has exactly one row. |
| Modify | `src/lib/admin/qa/target-registry.ts` | Reuse IDs/domains/owners only; do not grant execution from its `coverage` field. |
| Modify | `src/lib/admin/qa/control-center.ts`, `src/lib/admin/qa/manual-runs.ts`, `src/lib/admin/qa/targeted-smoke-dispatch.ts` | Consume one shared certification resolver for Health/detail, manual preflight and deploy dispatch. |
| Modify | `src/app/studio/qa/ProjectHealthClient.tsx`, `src/app/studio/qa/ManualRunPanel.tsx` | Render certification state, owner and recovery consistently; never enable an uncertified profile. |
| Modify | `docs/qa/F40-qa-control-center.md` | QA-reviewed matrix export, batch owner and recovery note. |
| Modify | `.github/CODEOWNERS` and existing CI policy/check | Require QA + Engineering review for certification-bearing matrix/registry/workflow/fixture/spec changes; if repository policy cannot enforce required review, fail CI on missing checked-in approval provenance. |
| Modify | `src/__tests__/unit/qa/f40-targeted-smoke-registry.test.ts`, `src/__tests__/unit/qa/f40-project-health.test.ts`, `src/__tests__/unit/qa/f40-manual-runs.test.ts` | Matrix completeness, duplicate, execution-admission and reader-bypass failures. |
| Modify | `tests/f40-project-health.spec.ts`, `tests/f40-manual-runs.spec.ts` | Browser proof of certified vs blocked states and recovery text. |

## Steps

1. Define mandatory row data: target ID, domain, owner, QA priority, execution certification, TC IDs/types, source test reference, fixture/test account, duration, allowed profile/pack, QA approval provenance, sanitized staging proof ID/date and recovery note.
2. Populate all 67 rows from catalog; use `no-certified-pack` until all proof is attached. Keep the four current Smoke entries certified only after re-validating them against code/docs.
3. Validate: exact one matrix row per active target; no unknown ID. A `certified_executable` row must have a repository-relative existing source test, bounded duration, non-secret fixture label, proof and QA approval. A blocked/planned/manual row needs only owner, explicit gap reason and recovery instruction.
4. Project the shared certification resolver to Health/detail, manual preflight and automatic dispatch so no existing reader can bypass the matrix. The DTO exposes `certificationState`, allowed profiles, owner and recovery only—never a command, credential or raw artifact.
5. Enforce QA + Engineering review through `.github/CODEOWNERS`/branch policy for matrix, registry, workflow, fixture and target-spec changes. CI rejects `certified_executable` without complete approval/evidence provenance even when branch policy is unavailable locally.

## Success criteria

- 67/67 active target IDs appear once.
- UI/data contract cannot label a non-certified row runnable or healthy merely because old `coverage` says automated.
- No migration: matrix is checked-in policy, not mutable production data.

## Risks

- QA ownership/priority may be missing. Default to `unassigned` / `planned`; never invent approval.
- A new fixture account/secret is not assumed. Its row stays blocked until QA/DevOps approve the account and configuration path.
