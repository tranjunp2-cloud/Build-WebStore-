---
issue: GH-768
branch: fix/F05-768-editor-perf-jank
status: done
---

# GH-768: Single Save Path — Remove Editor Jank

## Problem
1. Dual auto-save paths fire simultaneously → double API call every 3s
2. Every save triggers `setIframeKey++` → full iframe reload → jank/flicker
3. `editorStore.performSave` missing `headerBlock`/`footerBlock` in payload (silent bug)

## Solution (Approach B)
- `editorStore.performSave` becomes canonical save (full payload, handles auto-save)
- `handleSave` in page.tsx becomes thin wrapper (toast/UI only)
- Remove duplicate page-level auto-save useEffect
- Zustand subscription handles structural reload decisions
- `needsStructuralReload` flag tracks when iframe must reload vs UPDATE_BLOCK_DATA is sufficient

## Phases

| Phase | Description | Status |
|-------|-------------|--------|
| 01 | Fix `editorStore.performSave` — full payload + autoSaveEnabled guard | ✅ done |
| 02 | Cancel store auto-save timer in `handleSave` (double-save prevention) | ✅ done |
| 03 | Remove duplicate auto-save useEffect; sync templateApplied via store | ✅ done |
| 04 | Zustand subscription — not needed; structural reloads still explicit | skipped |
| 05a | Gap A: `updateHeaderBlock`/`updateFooterBlock` → `handleContentChange()` | ✅ done |
| 05b | Gap B: `handleBlockFieldChange`/`handleBlockUpdate` → `UPDATE_BLOCK_DATA` + `refreshPreview:false` via `PreviewFrameHandle` callback prop | ✅ done |
| 05c | Gap C: `handleSiteSettingsChange` → only reload iframe when branding/header/footer changes | ✅ done |
| 05d | Fix `onInlineEditSave` — change `refreshPreview:true` → `refreshPreview:false` | ✅ done |
| 06 | Update tests — TC-F12.06, TC-F12.14, TC-F12.15 added | ✅ done |
