# Phase 00 — Reconcile uncommitted changes

**Priority:** P0 (do first) · **Status:** pending · **Effort:** 0.5h

## Overview

Branch `investigate/1381-gallery-change-image` has uncommitted edits. Some become dead code once Path B is retired (P5). Decide keep/discard NOW so later phases don't build on throwaway.

## Current uncommitted state (verified)

```
 M src/blocks/hero/variants/split-video.tsx   ← KEEP
 M src/components/editor/ImageToolbar.tsx      ← THROWAWAY (P5 deletes ImageToolbar)
 M src/components/editor/PreviewFrame.tsx      ← PARTIAL (Strat 2/3 {id,url,alt} — throwaway in P5)
 M src/i18n/locales/en.json                    ← KEEP (uploading key) + EXTEND in P1
 M src/i18n/locales/ms.json                    ← KEEP
?? src/__tests__/unit/editor/f05-gh1381-upload-ux.test.tsx        ← REVIEW
?? src/__tests__/unit/editor/gh-1381-image-toolbar-ux.test.tsx    ← THROWAWAY (tests ImageToolbar)
?? plans/reports/...                            ← KEEP (reports)
```

## Decision matrix

| Change | Decision | Reason |
|--------|----------|--------|
| `split-video.tsx` `onVideoUploaded` + local `videoUrl` state | **KEEP** | Valid fix for first-upload-stale bug; independent of overlay refactor. P4 builds on it. |
| `ImageToolbar.tsx` Loader2 spinner | **KEEP for now, deleted in P5** | Harmless interim UX win while Path B is still the fallback. Don't invest more here. |
| `PreviewFrame.tsx` Strat 2/3 `{id,url,alt}` | **KEEP for now, removed in P5** | Makes Path B fallback render correctly during transition. Cheap insurance. |
| `i18n` `uploading` key (en+ms) | **KEEP + EXTEND** | P1 adds `mediaOverlay.*` keys alongside. |
| `gh-1381-image-toolbar-ux.test.tsx` | **DISCARD in P5** (keep now) | Tests ImageToolbar which P5 deletes. Keep until then so CI green during transition. |
| `f05-gh1381-upload-ux.test.tsx` | **REVIEW → adapt in P6** | If it asserts overlay/field-change behavior, migrate assertions to new overlay tests; if pure ImageToolbar, discard with P5. |

## Steps

1. `git diff` each modified file — confirm matches table above (already inspected by planner; spot-check).
2. Read both new test files; classify each `describe`/`it` as overlay-behavior (keep/migrate) vs ImageToolbar-only (discard with P5). Note classification in P6.
3. **Do NOT commit yet** — leave working tree as-is; P1 starts on top. (User controls commits per scope-discipline rule.)
4. Record in P5 acceptance: "delete `gh-1381-image-toolbar-ux.test.tsx` + ImageToolbar spinner + Strat 2/3 object edits".

## Files
- Read only (no edits this phase): the 5 modified + 2 new test files.

## Acceptance criteria
- [ ] Each uncommitted change classified keep/throwaway and noted in P5/P6.
- [ ] No new edits introduced; working tree unchanged.
- [ ] `f05-gh1381-upload-ux.test.tsx` contents triaged (overlay vs toolbar).

## Risks
- Discarding a test that covered a still-needed behavior → re-assert it in P6 overlay tests before deleting.

## Unresolved questions
- Q0.1: Does the user want P0 to commit the KEEP items (split-video, i18n) as a standalone `fix:` commit first, or carry them into P1's commit? (default: carry into P1)
