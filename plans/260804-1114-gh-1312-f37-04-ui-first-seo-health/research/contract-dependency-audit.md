---
type: researcher
date: 2026-08-04
---

# Researcher Report: US-F37-04 Contract and Dependency Audit

## Summary

Business 20 and AI 15 handoffs are on `staging`. Schema 35 remains on open PR #1728. Phase 1 UI work is independent, but the score/API cutover must wait for the canonical Schema artifact and scorer.

## Findings

### Authoritative contract

- PRD §5 defines Business 20, Schema 35, AI Discoverability 15, and Technical Health 30.
- PRD §12.3 requires all unresolved root causes after deduplication.
- Issue #1312 and the story source still mention up to three actions, OG image, and bad slug. Those clauses conflict with the PRD Technical 30 contract.

### Business and AI handoffs

- PR #1708 is on `staging`; `calculateBusinessDataScore()` exposes exact 7/8/5.
- PR #1719 is on `staging`; #1312 owns point attribution for crawler/sitemap/llms facts at 9/5/1.
- Their remaining live-QC issue status does not block consuming the merged code.

### Schema handoff

- PR #1728 remains open, `DIRTY`, and review-required at head `63ba02a5e71b168303fb235b78b64c308c830bf5`.
- It exports `generateSchemaGenerationArtifact()` and `calculateSchemaScore()`.
- #1312 must generate one artifact from one immutable site snapshot and pass that exact artifact to the scorer.
- Schema booleans must not be reconstructed from database fields or page blocks.
- Live TC-F37-02-45 and Rich Results evidence remain open upstream.

### Legacy runtime hazards

- `src/lib/seo/local-seo-score.ts` still uses the legacy 35/30/20/15 contract.
- The current API includes assumed CWV/mobile/HTTPS inputs and obsolete FAQ scoring.
- `src/lib/dashboard/seo-data.ts` uses OG/slug deductions and does not load real page layouts into Content Quality.
- Wiring the new UI to either path before atomic cutover would expose a false score.

## Recommendations

1. Keep Phase 1 unmounted and schema-agnostic.
2. Gate Phase 2 on PR #1728 merge/rebase and upstream focused test pass.
3. Implement one pure aggregate and one server-side evaluation path.
4. Preserve auth, rate limit, and tenant isolation from the current endpoint.
5. Fix the story source before Story Sync; do not implement stale issue clauses.

## Unresolved Questions

- A stable staging fixture must be assigned before the full 100-point browser proof.
- Search verification should remain a hidden issue until the approved Editor field/destination is implemented.
