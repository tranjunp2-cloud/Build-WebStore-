---
title: "F40-08 workflow contract analysis"
created: 2026-08-18
---

# F40-08 workflow contract analysis

## Reusable path

`targeted-dispatch` verifies the staged immutable SHA, resolves changed paths, reads the allow-list, claims a fixture lease and dispatches GitHub Actions. `targeted-start` and signed ingest bind the exact target, pack, version, profile and declared TC IDs before releasing the lease. Manual preflight resolves the same server registry.

## Contract drift risk

The TypeScript registry and `.github/workflows/targeted-smoke.yml` both enumerate pack IDs/specs/TC IDs. A new pack must update both in one change, plus parity/negative tests. The workflow presently emits pack version `1`; do not release version >1 until it emits the selected contract version.

## Regression boundary

The workflow executes static `.smoke.spec.ts` entries. Adding `manualProfiles.regression` to a Smoke pack would preview Regression but execute Smoke. A Regression admission therefore needs its own pack ID, spec, TC list, fixture/preflight, workflow branch and verification. It remains opt-in manual; deploy-trigger dispatch remains Smoke only.

## Security and operations

- Keep GitHub credentials server/workflow only; never put them in matrix/UI/test fixtures.
- Reuse super-admin authorization, bounded inputs, exact PR/SHA validation and quota/fixture locks.
- Use safe terminal result summaries only; no raw trace, screenshot, cookie or request-body persistence.
- Preserve serial capacity until each new destructive flow has a dedicated resettable fixture.

