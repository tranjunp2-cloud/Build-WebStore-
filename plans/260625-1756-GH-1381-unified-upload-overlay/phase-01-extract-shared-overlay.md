# Phase 01 — Extract shared MediaUploadOverlay + i18n

**Priority:** P0 · **Status:** pending · **Effort:** 3h · **Blocks:** P2, P3, P4

## Overview

Extract the in-iframe overlay from `HeroMediaOverlay` into a reusable `MediaUploadOverlay`. Hero migrates to consume it with **zero behavior change**. i18n the hardcoded strings. This is the foundation; every later phase imports it.

## Source of truth
- `src/blocks/hero/hero-media-overlay.tsx` (the working pattern, fully read)
- `src/blocks/logo-cloud/LogoImageOverlay.tsx` (alt hover-button placement reference)

## Design — `src/blocks/shared/media-upload-overlay.tsx` (new, <200 lines)

Props (superset of current HeroMediaOverlay, all optional except `children`+`field`):

```ts
type MediaUploadOverlayProps = {
  children: ReactNode
  field: string                       // e.g. "image", "images.2.image", "videoUrl"
  altText?: string
  className?: string
  positionClass?: string              // default 'relative'
  buttonPosition?: 'top-right' | 'top-center' | 'above'  // default 'top-right'
  showImageButton?: boolean           // default true
  showVideoButton?: boolean           // default false
  videoField?: string
  valueShape?: 'media' | 'url-group'  // 'media' → {id,url,alt}; 'url-group' → {url,alt} (before-after)
  onImageUploaded?: (url: string) => void  // for first-paint blocks lacking <img> (parity w/ video)
  onVideoUploaded?: (url: string) => void
}
```

### Behavior (lift verbatim from HeroMediaOverlay)
- `useIsOwner()` + `useBlockEditCallback()` guards → render plain children if not owner.
- `useUploadProgress()` XHR hook → progress bar (the GOOD UX, replaces LogoImageOverlay's `uploadMediaAction`).
- Hover tracking on parent element + window-blur reset (HeroMediaOverlay lines 74-91) — keep.
- contentEditable focus tracking to hide overlay while text-editing (lines 48-70) — keep.
- Image: validate jpeg/png/webp → `compressImage` → upload → `onFieldChange`.
  - `valueShape==='media'`: `onFieldChange(field', {id,url,alt})` (strip trailing `.url`).
  - `valueShape==='url-group'`: `onFieldChange(field', {url, alt})` — NO id (before-after group).
  - call `onImageUploaded?.(url)` after (for blocks with no rendered `<img>` on first upload).
- Video: validate mp4/webm → upload → DOM-surgery `video.src` if present else `onVideoUploaded` → `onFieldChange(videoField, url)` (string).
- Progress bar JSX (lines 163-176) → use i18n strings.

### Button position variants
- `top-right`: current `flex items-start justify-end p-2` (default).
- `top-center` / `above`: for small array items / logos (LogoImageOverlay uses `bottom-full left-1/2` floating). Provide `above` to cover logo-cloud reconcile.

## i18n

Add to `src/i18n/locales/en.json` + `ms.json` under `editor` (next to existing `imageToolbar`):

```json
"mediaOverlay": {
  "changeImage": "Change Image",
  "changeVideo": "Change Video",
  "uploading": "Uploading... {progress}%",
  "processing": "Processing...",
  "imageTypeError": "Only JPG, PNG, and WebP images are supported",
  "videoTypeError": "Only MP4 and WebM videos are supported",
  "imageUpdated": "Image updated",
  "videoUpdated": "Video updated",
  "uploadFailed": "Upload failed"
}
```
- `ms.json`: provide Malay translations (match existing tone). Reuse existing `imageToolbar.uploading` value style.
- Component reads via `useI18n()` — but overlay runs **inside the iframe**. Confirm `useI18n` works in iframe context (Hero currently hardcodes English → it may NOT have i18n in iframe). **If `useI18n` unavailable in iframe**, pass strings down as props from a thin wrapper, OR keep English constants in the shared component and defer i18n (YAGNI). Decide in step 2.

## Hero migration

Rewrite `hero-media-overlay.tsx` to re-export / thin-wrap `MediaUploadOverlay`:
```tsx
export function HeroMediaOverlay(props) {
  return <MediaUploadOverlay buttonPosition="top-right" {...props} />
}
```
Keep the named export so all hero variant imports stay unchanged. Net diff for hero = behavior-identical.

## Files
- **Create:** `src/blocks/shared/media-upload-overlay.tsx`
- **Modify:** `src/blocks/hero/hero-media-overlay.tsx` (→ thin wrapper)
- **Modify:** `src/i18n/locales/en.json`, `src/i18n/locales/ms.json`
- **Read:** `src/hooks/use-upload-progress.ts`, `src/components/site-renderer/BlockEditCallbackContext.tsx`, `src/components/site-renderer/OwnerContext.tsx`, `src/i18n/index.ts` (confirm iframe availability)

## Implementation steps
1. Create `media-upload-overlay.tsx` by copying HeroMediaOverlay; add `valueShape`, `buttonPosition`, `onImageUploaded` props.
2. Determine i18n-in-iframe feasibility (grep iframe renderer for `useI18n`/`I18nProvider`). If unavailable → keep English constants, drop i18n keys from scope, note in Q1.1.
3. Add i18n keys (if feasible) to en + ms.
4. Replace HeroMediaOverlay body with `<MediaUploadOverlay .../>` wrapper.
5. `npx tsc --noEmit` (or project typecheck script) → 0 errors.

## Acceptance criteria
- [ ] `MediaUploadOverlay` exists, <200 lines, typechecks.
- [ ] Hero (all 10 variants incl. video, split-video) upload image + video — identical behavior to before (manual smoke or P6 test).
- [ ] `valueShape='url-group'` path sends `{url,alt}` (no id) — unit asserted.
- [ ] No hardcoded "Uploading..."/"Change Image" left in shared component (or documented i18n-deferred).
- [ ] split-video first-upload still works (P0 fix intact).

## Risks
| Risk | Mitigation |
|------|------------|
| `useI18n` not available inside iframe → runtime crash | Step 2 gate; fallback to English constants |
| Hover/focus listeners regress for cards-overlay/parallax | Lift verbatim; smoke-test those 2 variants |
| Prop explosion violates KISS | Keep variants minimal (`media`/`url-group`, 3 positions); YAGNI on anything unused |

## Unresolved questions
- Q1.1: Is `useI18n` usable inside the preview iframe? If not, accept English-only overlay strings (defer i18n)?
- Q1.2: Keep `HeroMediaOverlay` named export as wrapper (zero churn) vs codemod all hero imports to `MediaUploadOverlay`? (default: keep wrapper — DRY/least churn)
