# Phase 05 — Retire Path B (ImageToolbar + handleImageReplace cascade)

**Priority:** P2 · **Status:** pending · **Effort:** 2h · **Depends:** P2, P3, P4 (ALL blocks migrated) · **MUST be last code phase**

## Overview

Remove the parent-frame upload system now that every block has an in-iframe overlay. This is destructive — gated on a full migration checklist. Single commit for clean revert.

## Pre-condition checklist (ALL must be ✓ before starting)

Every block with image/video upload migrated to `MediaUploadOverlay`:
- [ ] hero (P1) · [ ] logo-cloud (P3) · [ ] about (P2) · [ ] property-card (P2) · [ ] before-after (P2)
- [ ] gallery (P3) · [ ] gallery-masonry (P3) · [ ] carousel (P3) · [ ] team (P3)
- [ ] testimonials (P3) · [ ] social-proof (P3) · [ ] portfolio-grid (P3)
- [ ] video (P4) · [ ] video-showcase (P4)

If ANY unchecked → STOP, do not retire Path B.

## What gets removed

| Item | File | Lines (approx) | Notes |
|------|------|----------------|-------|
| `IMAGE_EDITING_STARTED` postMessage emit | `src/components/editor/PreviewScripts.tsx` | image/`data-image-index` click handler | removes click-to-edit |
| `IMAGE_EDITING_STARTED` receiver + `imageClickData` state | `PreviewFrame.tsx` | ~292, receiver block | |
| `<ImageToolbar>` render | `PreviewFrame.tsx` | ~1651-1654 | |
| `handleImageReplace` + Strategies 1–7 | `PreviewFrame.tsx` | ~790-1015 (keep `UPDATE_BLOCK_DATA` push used by overlay path) | ⚠ surgical — `UPDATE_BLOCK_DATA` is shared |
| `isImageProcessing` state | `PreviewFrame.tsx` | ~292 | |
| `ImageToolbar` component | `src/components/editor/ImageToolbar.tsx` | whole file | DELETE |
| `data-image-index` attrs | all migrated block files | various | remove (no longer read) — optional cleanup, can defer |
| `imageToolbar` i18n keys | `en.json`/`ms.json` | — | remove `editor.imageToolbar.*` (changeImage/uploading/generateAI) unless reused |
| P0 throwaway: ImageToolbar spinner, Strat 2/3 `{id,url,alt}` | per P0 table | — | removed with their host code |
| `gh-1381-image-toolbar-ux.test.tsx` | test | whole file | DELETE (per P0) |

⚠ **`UPDATE_BLOCK_DATA` postMessage (PreviewFrame ~1010-1015) is used by the overlay path too** — do NOT delete. Only remove the `handleImageReplace`-specific logic that feeds it from Path B.

⚠ **`uploadMediaAction`** (`src/app/(dashboard)/actions/media.ts`) — still used by `BlockImageEditor` (SettingsPanel sidebar) and possibly others. **Do NOT delete.** grep usages first.

## Implementation steps
1. Verify pre-condition checklist 100%.
2. grep `IMAGE_EDITING_STARTED`, `data-image-index`, `ImageToolbar`, `handleImageReplace`, `isImageProcessing`, `imageClickData` → enumerate every reference.
3. Remove emit in PreviewScripts; remove receiver/state/render/handler in PreviewFrame; keep `UPDATE_BLOCK_DATA` and `updateBlock`.
4. Delete `ImageToolbar.tsx`; remove import.
5. grep `uploadMediaAction` — confirm remaining users; leave intact.
6. Remove `data-image-index` from block files (or defer to a cleanup commit — low risk to leave).
7. Remove `imageToolbar` i18n keys if unreferenced (grep `imageToolbar`).
8. Delete `gh-1381-image-toolbar-ux.test.tsx`; adapt/keep `f05-gh1381-upload-ux.test.tsx` per P0 triage.
9. Typecheck + full test run.

## Acceptance criteria
- [ ] Clicking an image in preview no longer opens the parent-frame ImageToolbar (overlay is the only path).
- [ ] No dead references to ImageToolbar / handleImageReplace / IMAGE_EDITING_STARTED (grep clean).
- [ ] `uploadMediaAction` still present + working for sidebar `BlockImageEditor`.
- [ ] `UPDATE_BLOCK_DATA` overlay path still re-renders blocks live.
- [ ] All migrated blocks still upload correctly (P6 regression).
- [ ] Typecheck + full suite green.

## Risks
| Risk | L×I | Mitigation |
|------|-----|------------|
| Removing shared `UPDATE_BLOCK_DATA`/`updateBlock` by accident | M×H | surgical removal; keep those two; grep callers |
| A block was missed → now non-editable (no Path B fallback) | M×H | pre-condition checklist gate; manual smoke per block |
| Deleting `uploadMediaAction` breaks sidebar BlockImageEditor | L×H | grep-confirm other users; leave action intact |
| i18n key removal breaks a stray reference | L×M | grep before removing |

## Rollback
Single commit `refactor(editor): retire parent-frame ImageToolbar upload path`. Revert restores Path B wholesale (no schema/data change to undo).

## Unresolved questions
- Q5.1: Confirm `uploadMediaAction` consumers besides BlockImageEditor (grep) — anything else relying on Path B?
- Q5.2: Remove `data-image-index` now or defer to a follow-up cleanup commit? (default: defer — harmless dead attr, smaller risky diff)
