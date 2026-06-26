# Phase 04 — Video blocks + preserve YouTube URL UX

**Priority:** P1 · **Status:** pending · **Effort:** 2h · **Depends:** P1 · **Parallel with:** P2, P3

## Overview

Add in-iframe overlay to `video` and `video-showcase`. **Must NOT break YouTube/URL entry** — these blocks accept embed URLs (file upload would force MP4/WebM-only). Keep URL input as dual mode. Also owns `video/index.tsx` poster image (kept out of P2 to avoid file overlap).

## Scope
| Block | File | Video field | Poster/thumb field | UPLOAD_FIELDS action |
|-------|------|-------------|--------------------|--------------------|
| video | `src/blocks/video/index.tsx` | `videoUrl` (text) | `posterImage` (**upload→media**) | **ADD `posterImage` to UPLOAD_FIELDS** |
| video-showcase | `src/blocks/video-showcase/index.tsx` | `videos[].videoUrl` (text) | `videos[].thumbnailUrl` (**text**) | none — thumbnailUrl is URL string |
| hero video/split-video | (done in P1/P0) | `videoUrl` | — | reference only |

> `video-background` is archive/not-in-layout (registry only) → **out of scope** (YAGNI). Note in plan.

## Key decisions (CONFIRMED schema)

1. **`posterImage` is `type: 'upload', relationTo: 'media'`** (Pages.ts:750) but NOT in UPLOAD_FIELDS → an object `{id,url}` would NOT be normalized to id on save → Payload save would reject/mis-store.
   - **Action:** add `'posterImage'` to `UPLOAD_FIELDS` in `src/lib/block-normalization.ts:12`.
   - **No DB migration** — `poster_image_id` column already exists (field already declared). Verify column present via `\d pages_blocks_video` before relying.
   - **Safety check:** grep all blocks for `posterImage` usage as a *string* — if any block renders/saves `posterImage` as a bare URL string, adding to UPLOAD_FIELDS would null it. (Video-background treats it as string at runtime but is archive/not-saved-via-editor → low risk; confirm.)
   - Poster upload sends `{id,url,alt}` (`valueShape="media"`).

2. **`thumbnailUrl` is `type: 'text'`** (Pages.ts:1351) — a plain URL string. Overlay sends string URL (like videoUrl). **Never** add to UPLOAD_FIELDS (would null it).

3. **YouTube URL preservation:** overlay file-upload is *additive*. Keep the existing URL text input (sidebar/SettingsPanel or inline) so a user can still paste a YouTube embed URL. Overlay = "upload a file"; URL field = "paste a link". Both write `videoUrl`. Do NOT remove URL entry.

## Pattern

```tsx
// video block
<MediaUploadOverlay
  field="videoUrl" showImageButton={false} showVideoButton videoField="videoUrl"
  // poster as a second overlay or a second button:
>
  <video poster={posterImage?.url ?? posterImage} src={videoUrl} ... />
</MediaUploadOverlay>
```
- For `video` block with BOTH poster (image) and videoUrl (video): enable both buttons on one overlay — `showImageButton field="posterImage" valueShape="media"` is image, `showVideoButton videoField="videoUrl"` is video. The current overlay supports one image `field` + one `videoField` → works (image button uploads poster, video button uploads videoUrl).
- video-showcase per item: `field={`videos.${i}.thumbnailUrl`}` is the image-as-URL... but thumbnailUrl is text not a media object. Two sub-options:
  - (a) image button writes `videos.${i}.thumbnailUrl` as a **string url** (needs overlay to support `valueShape='url-string'` → send `uploaded.url` plain string, not object). **Add `valueShape='url-string'` to overlay** (small addition).
  - (b) video button writes `videos.${i}.videoUrl` string.

> **Overlay addition needed:** `valueShape='url-string'` (send `uploaded.url` as plain string) for thumbnailUrl. Add to P1 overlay if not already, or extend here (owned by P4 since it's the only consumer). Keep in P1 if cleaner — flag dependency.

## Files
- **Modify:** `src/blocks/video/index.tsx`, `src/blocks/video-showcase/index.tsx`
- **Modify:** `src/lib/block-normalization.ts` (add `posterImage` to UPLOAD_FIELDS) ⚠ shared with P5 — sequence P4 before P5 or assign this single edit to P4 only.
- **Read:** `media-upload-overlay.tsx`, `scripts/db-setup.js` (confirm video poster column migration exists)
- **Possibly modify:** `media-upload-overlay.tsx` for `valueShape='url-string'` (coordinate w/ P1)

## Implementation steps
1. Confirm `pages_blocks_video.poster_image_id` column exists (psql `\d` or grep db-setup.js). If missing → add migration entry (schema rule).
2. grep `posterImage` across `src/blocks/**` — confirm no string-URL save path. Then add `'posterImage'` to UPLOAD_FIELDS.
3. video: wrap `<video>` in overlay with image button (`field="posterImage" valueShape="media"`) + video button (`videoField="videoUrl"`). Keep URL input intact.
4. video-showcase: per item overlay; thumbnail via `valueShape='url-string'` → `videos.${i}.thumbnailUrl`; video via `videos.${i}.videoUrl`.
5. Typecheck. Run `node scripts/check-migrations.js origin/staging` if db-setup touched.

## Acceptance criteria
- [ ] video: upload poster (image) → `posterImage` persists as media id, renders; upload video file → plays; **paste YouTube URL still works**.
- [ ] `posterImage` added to UPLOAD_FIELDS; existing integer-id rows unaffected (normalize no-op); no string-poster block nulled.
- [ ] video-showcase: per-item thumbnail (string url) + video url upload work; persist at correct index.
- [ ] `check-migrations.js` passes if schema touched.
- [ ] Typecheck clean.

## Risks
| Risk | L×I | Mitigation |
|------|-----|------------|
| Adding posterImage to UPLOAD_FIELDS nulls a string-poster field elsewhere | L×H | step-2 grep gate before adding |
| poster_image_id column missing → save 500 | L×H | step-1 verify; add migration if absent |
| `valueShape='url-string'` ownership split between P1/P4 | M×L | put the shape enum in P1; P4 only consumes |
| Forcing file-only upload removes YouTube UX | M×M | keep URL text input (dual mode) — explicit acceptance |

## Unresolved questions
- Q4.1: Does `pages_blocks_video.poster_image_id` column already exist in db-setup.js? (verify before adding migration)
- Q4.2: Is any block saving `posterImage` as a bare string URL (would be nulled by UPLOAD_FIELDS)? video-background runtime treats as string but is archive — confirm not editor-saved.
- Q4.3: Should `video-background` (archive) be included now or left out? (default: out — YAGNI)
- Q4.4: Where does the YouTube URL input currently live for `video`/`video-showcase`? Maps say SettingsPanel has NO case for these → URL may be uneditable today. If so, this phase should ALSO add a URL input (scope creep — confirm with user).
