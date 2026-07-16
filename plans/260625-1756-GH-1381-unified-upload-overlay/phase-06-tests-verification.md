# Phase 06 — Tests + verification

**Priority:** P1 · **Status:** pending · **Effort:** 1.5h · **Runs:** incrementally per phase, final sweep after P5

## Overview

Per-phase tests (tester owns test files; reads impl, never edits). TC-IDs from `docs/qa/F05*.md` (editor feature). Import logic from source — no re-implementation, no mocked-away behavior.

## Test matrix

| Layer | Target | What | Phase |
|-------|--------|------|-------|
| Unit | `MediaUploadOverlay` | `valueShape` → payload shape: `media`→`{id,url,alt}`, `url-group`→`{url,alt}` (no id), `url-string`→plain string; not-owner → renders children only | P1 |
| Unit | `block-normalization` | `posterImage` in UPLOAD_FIELDS: object→id, integer→passthrough, string→null; before-after group `{url,alt}` NOT nulled (not in UPLOAD_FIELDS) | P2,P4 |
| Unit | field-path resolution | `images.2.image` → array index 2 subfield image (via the BLOCK_FIELD_CHANGED path util `updateValueAtPath`) | P3 |
| Integration | `BLOCK_FIELD_CHANGED` handler | nested array path → `updateBlock` + `UPDATE_BLOCK_DATA` + `performSave(true)` called; `isAllowedValue` accepts `{id,url,alt}` & `{url,alt}` | P1/P3 |
| Regression | before-after | upload before + after → both `.url` persist, neither nulled after `normalizeBlocksForPersistence` | P2 |
| Regression | save route round-trip | per migrated field: upload→save→reload keeps id/url at correct index | P3,P4 |
| E2E (optional/manual) | per block | hover→overlay→upload→in-place swap→reload-persist | all |

## Reconcile existing tests (per P0)
- `gh-1381-image-toolbar-ux.test.tsx` → delete with P5.
- `f05-gh1381-upload-ux.test.tsx` → triage: keep overlay-behavior assertions (migrate to `media-upload-overlay.test.tsx`), drop ImageToolbar-only ones.
- `tester-260625-1748-GH-1381-regression-tests.md` report exists → read it; reuse any still-valid regression cases.

## New test files (kebab-case, mirror src path)
- `src/__tests__/unit/blocks/media-upload-overlay.test.tsx` (P1)
- extend `src/__tests__/unit/lib/block-normalization.test.ts` (posterImage + before-after group) — if exists, append; else create
- `src/__tests__/unit/editor/block-field-changed-array-path.test.tsx` (P3) — or extend existing PreviewFrame test

## Steps
1. After each impl phase, tester runs `npm test` scoped to touched areas; 100% pass on new code.
2. Per `.claude/rules/testing.md`: every test → TC-ID; AAA; `vi.mock()` top-level; import from source.
3. Final sweep after P5: full `npm test` green; no references to deleted ImageToolbar in any test.
4. If schema touched (P4): `node scripts/check-migrations.js origin/staging` green.

## Acceptance criteria
- [ ] 100% pass on all new/changed code; full suite green after P5.
- [ ] before-after non-null regression test present + passing.
- [ ] posterImage normalization test present + passing.
- [ ] Array field-path test (`images.${i}.image`) present + passing.
- [ ] No test imports/asserts deleted ImageToolbar after P5.
- [ ] No fake data / mocked-away logic to force green (rule).

## Risks
| Risk | Mitigation |
|------|------------|
| Overlay runs in iframe → hard to unit test DOM/context | test the pure handlers (payload shape, valueShape) by extracting/exporting them; gate owner/iframe behavior behind context mocks |
| TC-IDs missing for new overlay behavior | add to `docs/qa/F05*.md` (docs-manager) before writing tests |

## Unresolved questions
- Q6.1: Does `docs/qa/F05*.md` have TC-IDs for upload UX, or must new ones be allocated first?
- Q6.2: Existing `block-normalization.test.ts` present to extend, or create new?
