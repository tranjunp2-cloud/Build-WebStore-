# Phase 02 — logo-cloud: exclude from photo injection + monogram placeholder

## Context links
- Verified: `src/lib/ai/media-injector.ts` (`BLOCK_IMAGE_SPEC['logo-cloud']:51`, `getImageEnabledBlocks:91`, `planImageNeeds:162`, `cleanupNonNumericImageFields:240`, `stripOrphanMediaRefs:298`, `hydrateUrlUploadsToMedia:673`), `src/blocks/logo-cloud/index.tsx` (`LogoPlaceholder:48`, `LogoImage:68`), `src/lib/ai/content-injection.ts:594-602`, `src/lib/ai/content/client-logos-library.ts` (`url` intentionally omitted → name-only badges).

## Overview
- **Date**: 2026-07-09 · **Priority**: P1 · **Status**: implemented
- Fixes Issue 2: (a) stop pool photos filling logo slots; (b) upgrade placeholder to uniform monogram badges (2-3 chars, brand-color tile). No AI logo gen. Editor image-replace + real uploaded logos still render.

## Key insights
- **Do NOT remove** `BLOCK_IMAGE_SPEC['logo-cloud']`: it's reused by `hydrateUrlUploadsToMedia` (ingests editor-uploaded real logo URLs → Media), `cleanupNonNumericImageFields`, `stripOrphanMediaRefs`. Removing it breaks the real-logo render path. Exclude only from **fulfillment** (`planImageNeeds`).
- On staging/prod `PIXABAY_BLOCKS=all` → `getImageEnabledBlocks()` includes `logo-cloud` → currently planned + filled with pool photos. Add a hard-skip set in `planImageNeeds` so logo-cloud is never a fetch need regardless of env.
- content-injection emits `logos:[{name, logo:{url:'', alt}}]` (library `url` omitted). With injection skipped, `logo.url` stays `''` → `cleanupNonNumericImageFields` deletes the non-numeric `logo` object → block sees `item.logo?.url` falsy → renders `LogoPlaceholder`. Monogram path, by construction.
- `LogoPlaceholder` current: `split(/\s+/).map(w=>w[0]).slice(0,2)` → single-word "Aeon" → "A" (1 char). Fix: single word → first 2 letters; multi-word → up to 3 initials.

## Requirements
**Functional**
- logo-cloud never receives stock/pool photos during gen (any `PIXABAY_BLOCKS` value).
- `LogoPlaceholder`: monogram 2-3 chars — single-word → first 2 letters ("Aeon"→"AE"); multi-word → first letter of up to 3 words ("Bank Negara Malaysia"→"BNM"); empty→"?". Uniform brand-color tile background, consistent style.
- Editor image-replace (`data-image-index`) preserved on placeholder. Real uploaded logo (numeric `logo` Media ID or valid `logo.url`) still renders via `LogoImage`.

**Non-functional**
- Files <200 lines. No schema change. No behavior change to other blocks in `planImageNeeds`.

## Architecture
```
gen: content-injection → logos:[{name, logo:{url:'', alt}}]
      planImageNeeds ── NO_STOCK_BLOCKS.has('logo-cloud') ⇒ continue (no need)   ← FIX A
      cleanupNonNumericImageFields ⇒ delete logo:{url:''}  (non-numeric)
      render: item.logo?.url falsy ⇒ LogoPlaceholder(monogram, tile)             ← FIX B
editor upload: logo URL ⇒ hydrateUrlUploadsToMedia (spec entry KEPT) ⇒ numeric ID
      render: item.logo.url present ⇒ LogoImage (real logo)                      ← preserved
```

## Related code files
- **Modify** `src/lib/ai/media-injector.ts`: add `const NO_STOCK_BLOCKS = new Set(['logo-cloud'])`; in `planImageNeeds` loop add `if (NO_STOCK_BLOCKS.has(blockType)) continue` (after `blockType` resolved, before spec use). Keep `BLOCK_IMAGE_SPEC['logo-cloud']` untouched. Add brief comment referencing GH-1185.
- **Modify** `src/blocks/logo-cloud/index.tsx`: rewrite `LogoPlaceholder` monogram logic + brand-color tile styling. Keep `data-image-index`. Keep `LogoImage` grayscale behavior for REAL logos only (or drop `grayscale` class — optional, see risk). Keep `LogoFrame`/`LogoImageOverlay` structure.
- **Delete**: none.

## Implementation steps
1. media-injector: add `NO_STOCK_BLOCKS` + skip in `planImageNeeds`. Verify `hydrateUrlUploadsToMedia`/`cleanupNonNumericImageFields`/`stripOrphanMediaRefs` still iterate logo-cloud spec (unchanged).
2. logo-cloud block: extract `computeMonogram(name)` helper — single-word→`slice(0,2)`, multi-word→first letters up to 3; uppercase; fallback "?".
3. Style placeholder as filled brand tile (e.g. `background: rgba(var(--brand-primary-rgb),0.12)`, `color: var(--brand-primary)`, centered bold monogram) — uniform across slots. Keep click target + `data-image-index`.
4. Typecheck + lint clean.

## Todo list
- [x] `NO_STOCK_BLOCKS` skip added to `planImageNeeds`
- [x] `BLOCK_IMAGE_SPEC['logo-cloud']` retained (hydrate/cleanup/strip intact)
- [x] `computeMonogram` 2-3 char logic (single + multi word)
- [x] brand-color tile styling, uniform
- [x] `data-image-index` + real `LogoImage` path preserved
- [x] typecheck/lint clean (tsc clean; `next lint` fails project-wide on a pre-existing worktree/eslintrc config conflict unrelated to these files — confirmed by reproducing on an untouched file)

## Success criteria
- Gen with `PIXABAY_BLOCKS=all`: logo slots show consistent monogram tiles, zero grayscale stock photos.
- "Aeon"→"AE", "Maxis"→"MA", "Bank Negara Malaysia"→"BNM".
- Editor replacing a logo (upload) renders the real image (LogoImage). Real logo with valid URL unaffected.

## Risk assessment
| Risk | L×I | Mitigation |
|------|-----|-----------|
| Removing spec entry breaks real-logo ingest | (avoided) | Explicitly KEEP spec; skip only in planImageNeeds |
| Existing saved pages have numeric pool-photo logos persisted | M×L | Render path unchanged for numeric IDs; only new gens change. Backfill not in scope (note for QC) |
| grayscale CSS still greys real uploaded logos | L×L | Optional: keep grayscale for brand consistency (real logos), or drop — decide with QC; default keep (unchanged) |
| Monogram unreadable for non-Latin names | L×L | `toUpperCase()` + first chars; acceptable, matches current design |

## Security considerations
- No new external fetch. Editor upload path (`ingestUrlToMediaIfNeeded`) allowlist unchanged. Monogram derived from already-sanitized `name`.

## Next steps
- Independent of phase-01. Feeds phase-03 (media-injector + block tests + TC-F04/F38 additions).

## Rollback
- Remove `NO_STOCK_BLOCKS` skip and revert `LogoPlaceholder` → pre-fix behavior. Fully isolated, no data migration.
