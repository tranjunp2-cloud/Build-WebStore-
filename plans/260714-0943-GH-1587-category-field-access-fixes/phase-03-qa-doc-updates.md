# Phase 03 — QA Doc Updates (Group E / M4 + Group F item 2)

## Context links
- Plan: [plan.md](./plan.md) — see Unresolved Question 1 (M4 decision gate)
- Target: `docs/qa/F08-product-crud.md` (TC-F08-05-05 ~L190, TC-F08-05-07 ~L192)
- Slug logic refs: `CategoryManager.tsx` `generateSlug`, `Categories.ts:130-131`,
  DB unique `(tenant_id, slug)` at `db-setup.js:4976-4978`

## Overview
- **Priority:** P3 (docs). **Status:** completed.
- Docs-only; disjoint file from all code phases → parallelizable.
- One agent owns `docs/qa/F08-product-crud.md` (both edits in same file).

## Key insights
- **M4:** TC-F08-05-05 step 2c expects same-name-under-different-parent = "ALLOWED", but slug is
  name-only (no parent component) and DB unique = `(tenant_id, slug)` without `parent_id`. So it
  will actually FAIL with `CATEGORY_SLUG_DUPLICATE`. Doc contradicts real behavior.
- **F item 2:** TC-F08-05-07 tests category image upload — a REMOVED feature (`image_id` column
  dropped in `db-setup.js:4982-4984`; no image field in `CategoryManager.tsx`).

## Requirements
1. **M4 — apply user-chosen path only:**
   - Default **(a):** update TC-F08-05-05 step 2c expected outcome from "ALLOWED" to "rejected as
     duplicate (`CATEGORY_SLUG_DUPLICATE`)"; add note that name-dedup is per-(parent,tenant) but
     slug-uniqueness is per-(tenant) only.
   - **(b)** (only on explicit sign-off): document new parent-aware slug behavior instead — do NOT
     author this without decision. Path (b) also implies code work NOT in this plan.
2. **F item 2:** mark TC-F08-05-07 obsolete/removed (feature dropped in PR #1605). Keep row for
   traceability but annotate "REMOVED — category image feature dropped, GH-1587".

## Related code files
- Modify: `docs/qa/F08-product-crud.md`

## Implementation steps
1. Confirm M4 decision (a) or (b) with lead/PM BEFORE editing.
2. Edit TC-F08-05-05 row per chosen path.
3. Annotate TC-F08-05-07 as removed/obsolete.
4. Verify markdown table integrity (column count, pipes).

## Todo list
- [x] M4 decision confirmed (a) — fixed QA doc per decided path
- [x] TC-F08-05-05 expected outcome updated to "CATEGORY_SLUG_DUPLICATE" rejection
- [x] TC-F08-05-07 marked obsolete (category image feature removed)
- [x] table renders valid

## Success criteria
- QA doc matches actual enforced behavior (no contradiction with slug uniqueness reality).
- Obsolete image test clearly flagged.

## Risk assessment
| Risk | L×I | Mitigation |
|------|-----|-----------|
| Editing before decision → wrong doc | Med×Low | gate on M4 confirmation (step 1) |
| Path (b) sneaks in code change | Low×Med | plan forbids (b) code without sign-off |

## Security considerations
- None (docs).

## Next steps
- Independent of code phases. Feeds Phase 06 review.
