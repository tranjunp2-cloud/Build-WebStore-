# QA Test Cases — GH-1381: Gallery "Change Image" — báo thành công nhưng không lưu

> **Scope:** Issue #1381 (branch `investigate/1381-gallery-change-image`).
> Registry cho toàn bộ TC-ID `TC-GH1381-*` (các đợt fix 26/06 + 09/07). QC re-test 03/07 fail → đợt fix 09/07 bổ sung.

---

## 1. Context

Gallery (và 12 block khác) thay ảnh qua `MediaUploadOverlay` trong preview iframe → postMessage `BLOCK_FIELD_CHANGED` → parent editor apply + save.

**Root cause đợt QC re-test fail (03/07):**
1. Gallery render slot fallback (ảnh stock) kể cả khi `block.images` rỗng/ngắn hơn — ghi vào path `images.N.image` không tồn tại làm `updateValueAtPath` throw → handler chết im lặng: preview không đổi, không save.
2. Toast "Image updated" bắn từ overlay **trước khi** parent xử lý → success giả (silent data loss).
3. Progress % (overlay hợp nhất, commit 26/06) chưa từng được merge lên staging.

**Fix 09/07:**
- `src/lib/editor/update-value-at-path.ts` (tách từ PreviewFrame): tự tạo container trung gian (array/object) + pad `{}` cho slot thiếu.
- Protocol ACK `BLOCK_FIELD_CHANGE_RESULT`: parent chỉ reply `ok` sau khi apply + `performSave` settle; overlay chờ ACK rồi mới toast success/error (timeout 10s → fallback legacy).
- Handler `BLOCK_FIELD_CHANGED` bọc try/catch + gửi display block locale-merged (đồng bộ với Path B ImageToolbar).

## 2. Test Cases (automated)

| ID | Test file | Tiêu đề | Mức độ |
|:---|:---|:---|:---:|
| TC-GH1381-01..10 | `src/__tests__/unit/editor/gh-1381-gallery-image-replace.test.ts` | normalizeUploadField contract + FK-fallback guard + render gate | Blocker |
| TC-GH1381-UO-001..019 | `src/__tests__/unit/blocks/media-upload-overlay.test.tsx` | Overlay hợp nhất: owner gate, valueShape, progress %, video, error toast | Blocker |
| TC-GH1381-UO-020 | `src/__tests__/unit/blocks/media-upload-overlay.test.tsx` | Parent NACK → error toast kèm lý do, không có success toast | Blocker |
| TC-GH1381-UO-021 | `src/__tests__/unit/blocks/media-upload-overlay.test.tsx` | ACK sai field/blockIndex bị bỏ qua; chỉ ACK khớp mới toast | High |
| TC-GH1381-UO-022 | `src/__tests__/unit/blocks/media-upload-overlay.test.tsx` | Tap toggle control trên touch device (khôi phục GH-1191) | High |
| TC-GH1381-UVP-001..003 | `src/__tests__/unit/editor/update-value-at-path.test.ts` | Regression: path có sẵn, immutability, top-level | Blocker |
| TC-GH1381-UVP-004..008 | `src/__tests__/unit/editor/update-value-at-path.test.ts` | Fallback slot: images rỗng/thiếu/ngắn hơn index/null → tạo container + pad | Blocker |
| TC-GH1381-UVP-009..012 | `src/__tests__/unit/editor/update-value-at-path.test.ts` | Guards: index cap (chống OOM), non-index key trên array, blocked segments, empty path | Blocker |
| TC-GH1381-UX-001..015 | `src/__tests__/unit/editor/f05-gh1381-upload-ux.test.tsx` | Upload UX 13 blocks: spinner/disabled/i18n/persistence (renumber từ TC-GH1381-01..15, tránh trùng namespace) | High |
| TC-GH1381-ITB-001..008 | `src/__tests__/unit/editor/gh-1381-image-toolbar-ux.test.tsx` | ImageToolbar suppression + Path B UX (renumber từ TC-GH1381-01..08) | High |

## 3. Manual Verification Checklist (QC re-test)

- [ ] Staging: site AI-gen có gallery toàn ảnh fallback (`images` rỗng trong DB) → Change Image slot bất kỳ → ảnh đổi ngay trong preview, có progress %.
- [ ] Reload editor sau success toast → ảnh mới vẫn hiển thị (đã persist).
- [ ] Publish → storefront render ảnh mới.
- [ ] Variant Carousel + Grid + Masonry: replace đều hoạt động.
- [ ] Ngắt mạng ngay sau khi chọn ảnh → toast error có lý do cụ thể, KHÔNG có success toast.
- [ ] Hero banner replace vẫn có progress % (không regress).
