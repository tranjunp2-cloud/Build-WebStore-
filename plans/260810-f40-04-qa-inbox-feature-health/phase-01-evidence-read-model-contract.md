# Phase 01 — Evidence/read-model contract and additive persistence

## Context links

- Parent: [plan.md](plan.md); dependency: US-F40-02 persisted runs/results, F40-03 PR #1761, F40-05 findings, F40-07 manual dispatch.
- Docs: `docs/prd/qa-control-center.md`, `docs/stories/F40-qa-control-center-stories.md`, `docs/design/qa-control-center-ux.md`.

## Overview

- Date: 2026-08-10; Description: make only persisted, safe evidence available to the Inbox/detail read model; Priority: P1; Implementation status: pending; Review status: pending.

## Key Insights

- Existing results expose TC-ID, counts and one approved artifact, not fixture, semantic expected/actual, classification or visual triplets.
- Do not manufacture detail from UI constants; missing evidence must remain explicit/Unknown.

## Requirements

- Persist fixture reference, structured expected/actual summary, classification, approved evidence type/expiry, and optional visual baseline/current/diff/threshold/reviewer state.
- Visual review never creates a GitHub issue; F40-05 remains the only issue-creation boundary.

## Architecture

- Extend the F40-02 QA result/evidence model or add a dedicated immutable visual-comparison record linked to result/run/target.
- Define a server-only read contract with nullable evidence and explicit `unknown|expired|pending-review` states.

## Related code files

- `src/collections/QaTestRuns.ts`, `src/collections/QaTestResults.ts`, `src/lib/admin/qa/contracts.ts`, `scripts/db-setup.js`.

## Implementation Steps

1. Choose schema ownership with F40-05/F40-07 owners; document field producer and retention/expiry.
2. Add Payload fields/collection and additive migration (`IF NOT EXISTS`; update `COLLECTION_SLUGS` for any new collection).
3. Validate only approved HTTPS/sanitized evidence and bounded threshold/status values on ingest.
4. Backfill nothing as healthy; legacy records render evidence unavailable.

## Todo list

- [ ] Resolve visual-review ownership.
- [ ] Define DTO and validation.
- [ ] Add collection/schema migration and examples if env/config changes.
- [ ] Verify migration against empty and populated staging-like DB.

## Success Criteria

- A failure has traceable run/target/TC-ID fields; absent/expired evidence cannot be read as pass.
- Visual review data is durable, safe, and has no outbound GitHub side effect.

## Risk Assessment

- Cross-story schema collision or unmerged F40-03 contract; mitigate with owner sign-off and integration gate.

## Security Considerations

- Reject raw logs/private URLs; authorize all reads server-side; retain expiry and do not expose credentials.

## Next steps

- Build the read API after migration/contract review is approved.
