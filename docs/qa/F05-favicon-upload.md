# Test Cases — F05 Favicon Upload Validation

> **Status:** Automated
> **Test Type:** Unit Tests
> **GH:** #1320 — favicon upload in global settings
> **Component:** `src/components/editor/FaviconEditor.tsx`

---

## Test Case Matrix

| TC-ID | Category | Description | Expected | Priority | AUTO |
|-------|----------|-------------|----------|----------|------|
| **TC-F05-FAV-01** | Format / Size | ICO 32×32 50KB → success; dimension check skipped | Upload proceeds, `onFaviconChange` called | P1 | ✓ |
| **TC-F05-FAV-02** | Format | WebP accepted → upload proceeds | Upload proceeds | P2 | — |
| **TC-F05-FAV-03** | Format | JPEG accepted → upload proceeds | Upload proceeds | P2 | — |
| **TC-F05-FAV-04** | Size | PNG 200×200 800KB → hard reject (>500KB) | `toast.error` tooLarge; no upload | P1 | ✓ |
| **TC-F05-FAV-05** | Size / Dim | PNG 200×200 80KB → clean success | Upload; no warning | P1 | ✓ |
| **TC-F05-FAV-06** | Size | PNG 200×200 150KB → soft warning + upload | `toast.warning` tooLargeWarning; upload proceeds | P1 | ✓ |
| **TC-F05-FAV-07** | Dimension | PNG 8×8 → tooSmall reject | `toast.error` tooSmall; no upload | P1 | ✓ |
| **TC-F05-FAV-08** | Dimension | PNG 1024×1024 → tooBig reject | `toast.error` tooBig; no upload | P1 | ✓ |
| **TC-F05-FAV-09** | Dimension | PNG 100×200 (non-square) → warning + upload | `toast.warning` notSquare; upload proceeds | P1 | ✓ |
| **TC-F05-FAV-10** | Format | `.txt` disguised as PNG (text/plain) → format reject | `toast.error` invalidFormat; no upload | P1 | ✓ |
| **TC-F05-FAV-11** | Format | `.gif` (image/gif) → format reject | `toast.error` invalidFormat; no upload | P1 | ✓ |
| **TC-F05-FAV-12** | Format | `.bmp` (image/bmp) → format reject | `toast.error` invalidFormat; no upload | P1 | ✓ |
| **TC-F05-FAV-13** | Concurrency | File selected while upload in progress (`isUploading: true`) → ignored | No upload, no toast | P1 | ✓ |

---

## Validation Rules (source of truth)

| Rule | Threshold | Behaviour |
|------|-----------|-----------|
| Format whitelist | ico, png, jpg/jpeg, webp | Hard reject: `invalidFormat` |
| Size hard limit | 500 KB | Hard reject: `tooLarge` |
| Size soft warning | 100 KB | Soft: `tooLargeWarning`, upload continues |
| Min dimensions | 16×16 px | Hard reject: `tooSmall` |
| Max dimensions | 512×512 px | Hard reject: `tooBig` |
| Non-square | width ≠ height | Soft: `notSquare`, upload continues |
| ICO dimension check | skipped | ICO is a multi-resolution container; browser Image API is unreliable for it |
