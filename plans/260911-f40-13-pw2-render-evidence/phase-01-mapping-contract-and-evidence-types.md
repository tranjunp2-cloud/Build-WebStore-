# Phase 01 — Khóa mapping contract và evidence types fail-closed

## Mục tiêu

Chốt identity PW1→PW2 trước khi viết truy vấn hoặc UI; define types/state reducer để mọi thiếu hụt evidence thành `unverified`, không thành match.

## File targets

- **New:** `src/lib/admin/qa/migration-render-evidence.ts` — types, allow-listed DTO sanitization, three-layer classifier, overall reducer.
- **New:** `src/lib/admin/qa/migration-render-mapping-provider.ts` — provider interface and only a fail-closed unavailable implementation until mapping owner registers source thật.
- **Modify:** `docs/qa/F40-qa-control-center.md` — add TC-F40-13-01…08.
- **Potentially new (only after schema approval):** a mapping collection/config under `src/collections/` and matching additive SQL in `scripts/db-setup.js`; no schema speculative change in this phase.

## Implementation steps

1. Document and validate an immutable mapping row: opaque IDs for PW1 component/page/site and PW2 site/page/layout block, expected PW2 `blockType`, mapping version/hash, provenance and timestamp.
2. Define `MigrationRenderEvidenceProvider.getPageEvidence({ storeId, pageId })`; provider receives only validated IDs and never a user-supplied SQL fragment/URL.
3. Implement pure `deriveOverallStatus`: only three positive statuses yield `pass`; data missing/mismatch or verified live failure yields `failed`; all other combinations yield `needs_review`.
4. Implement response allow-list. Preserve short, escaped reason codes and safe field diffs only; bound sizes/depth, mask/drop sensitive keys and values. Raw JSON display must use a sanitized, capped representation.
5. Add unavailable/mapping-missing provider response that explicitly sets data/component/live all unverified where appropriate. It must have no fallback to `PageBlockItem.pw2Preview`, title, order or `pw2Block` inference.

## Acceptance / test mapping

- TC-F40-13-01 (Unit, Critical): exact `legacy_id` mapping resolves one PW2 layout block; absent/ambiguous mapping remains unverified.
- TC-F40-13-02 (Unit, Critical): no `pass` result when any layer is unverified/unsupported/not-rendered/missing/mismatch.
- TC-F40-13-06 (Unit, Critical): DTO redaction strips credentials/PII and caps raw evidence.

## Exit criteria

- Mapping contract signed by owners listed in parent plan.
- Types compile without `any`, and no source code uses preview-derived state as PW2 data evidence.
