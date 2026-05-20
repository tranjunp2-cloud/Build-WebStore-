---
title: "Gallery — Fix lightbox a11y CRITICAL + LCP + filter chips"
description: "11 lỗi của gallery block 531 LOC: lightbox no focus trap, raw img, justified fake, no filter UI, ImageGallery JSON-LD"
status: pending
priority: P1
effort: 9-12h
branch: chore/F01-remaining-plans
tags: [gallery, bugfix, wix-rebuild, a11y]
created: 2026-04-15
---

# Gallery — Sửa các lỗi còn lại

## Bối cảnh
Gallery (531 LOC, 6 variants: grid/masonry/carousel/lightbox/filmstrip/justified, polish 4/5). Có lightbox nhưng thiếu focus trap + scroll lock + aria-modal (CRITICAL a11y). Raw `<img>` 5 chỗ → LCP killer. Justified variant là fake (random flexGrow thay vì đo aspect). Thiếu filter UI và JSON-LD.

## Phạm vi
Fix accessibility, LCP, filter chips, empty state, SEO schema. Justified fake: chọn approach — fix hoặc remove variant.

## Danh sách lỗi cần fix

### Lỗi A — Lightbox missing scroll lock + focus trap + aria-modal (2h, P1 a11y CRITICAL) ⚠
**File**: `src/blocks/gallery/index.tsx` (lightbox variant + helper `Lightbox`)
**Vấn đề**: lightbox mở ra:
- Background body vẫn scroll được → user touch mobile scroll page phía sau lightbox.
- Tab ra khỏi lightbox → focus leak sang nav/footer.
- Không có `role="dialog"` + `aria-modal="true"` + `aria-labelledby` → screen reader không nhận ra modal.

**Cách sửa**:
1. Dùng lib `focus-trap-react` hoặc shadcn `Dialog` primitive.
2. Body scroll lock: `document.body.style.overflow = 'hidden'` khi open, cleanup khi close.
3. Thêm `role="dialog"` + `aria-modal="true"` + `aria-label="Image viewer"`.
4. Esc key close + click outside close (đã có?) verify.
5. Return focus về trigger thumbnail khi close.

**Kiểm tra**: open lightbox → tab chỉ vòng trong lightbox; VoiceOver announce "Image viewer dialog"; esc close → focus về thumbnail cũ.

---

### Lỗi B — Justified variant fake (3-5h hoặc 45 phút remove, P2)
**File**: `src/blocks/gallery/index.tsx` (variant `justified`)
**Vấn đề**: "justified" trong design gallery thực sự cần đo `naturalWidth/naturalHeight` rồi pack rows đầy width (Flickr style). Hiện tại dùng `flexGrow: Math.random()` + `height: 240px` cứng → fake justified.
**Cách sửa option A (full fix, L)**:
1. Tạo hook `useJustifiedLayout(images, containerWidth, targetRowHeight=240)`.
2. Pre-load image dimensions bằng `new Image()` hoặc từ Payload metadata (`image.width/height` đã có).
3. Pack rows: greedy fill tới khi tổng aspect ratio * target-height > containerWidth → scale row.
**Cách sửa option B (remove, XS)**: xoá justified khỏi variant enum, map rotate sang masonry.
**Kiểm tra**: render 10 images aspect khác nhau → rows đầy width, không có white space phải.

---

### Lỗi C — No filter by tag/category chips (2h, P2)
**File**: `src/blocks/gallery/index.tsx`
**Vấn đề**: Wix gallery ship filter chips ("All / Work / Travel / Food") → không có.
**Cách sửa**:
1. Schema: `image.tags: z.array(z.string()).optional()`.
2. Component: compute unique tags, render chips row trên grid.
3. State `activeTag` filter images bằng `images.filter(img => !activeTag || img.tags?.includes(activeTag))`.
4. Chip active style + "All" option.

**Kiểm tra**: render gallery với tags → click chip → grid filter.

---

### Lỗi D — Raw `<img>` 5 chỗ → LCP killer (1.5h, P1)
**File**: `src/blocks/gallery/index.tsx`
**Vấn đề**: researcher-01 đếm 5 chỗ dùng `<img>` raw thay vì `next/image` → không srcset, không lazy, không optimize.
**Cách sửa**: replace all `<img>` → `<Image>` với `width`/`height` (có từ Payload metadata) + `sizes` phù hợp grid.
**Kiểm tra**: grep `<img` trong file → 0 kết quả. Lighthouse LCP cải thiện.

---

### Lỗi E — No empty state (15 phút, P2)
**File**: `src/blocks/gallery/index.tsx`
**Vấn đề**: `images: []` → render grid trống.
**Cách sửa**: early return null.
**Kiểm tra**: empty array → không render.

---

### Lỗi F — Carousel missing swipe gesture + pagination dots (45 phút, P2)
**File**: `src/blocks/gallery/index.tsx` (variant `carousel`)
**Vấn đề**: touch swipe không có + không có dot indicator dưới.
**Cách sửa**:
1. Dùng `onTouchStart/End` detect horizontal delta > 50px → change active.
2. Render dots dưới carousel, mỗi dot `aria-label="Go to image N"`.

**Kiểm tra**: mobile swipe → change image; dots update active state.

---

### Lỗi G — Thumbnail `scrollIntoView` missing (30 phút, P3)
**File**: `src/blocks/gallery/index.tsx` (variant `filmstrip`)
**Vấn đề**: click thumbnail index xa → thumbnail bar không auto-scroll tới thumbnail active → user phải scroll tay.
**Cách sửa**: `useEffect` watch activeIndex → `thumbnailRefs[activeIndex].scrollIntoView({ behavior: 'smooth', inline: 'center' })`.
**Kiểm tra**: click image thứ 15 → thumbnail 15 vào giữa bar.

---

### Lỗi H — Masonry column order bug (45 phút, P3)
**File**: `src/blocks/gallery/index.tsx` (variant `masonry`)
**Vấn đề**: CSS columns không preserve order (image 1, 2, 3 → column 1: 1, column 2: 2, column 3: 3 thay vì 1→2→3 theo row reading order).
**Cách sửa**: dùng JS-based masonry pack (greedy min-height column) hoặc accept thay đổi order (current). Nếu giữ CSS columns → document limitation.
**Kiểm tra**: render 9 images → order reading-top-to-bottom-left-to-right.

---

### Lỗi I — Lightbox counter + preload missing (30 phút, P3)
**File**: `src/blocks/gallery/index.tsx` (lightbox)
**Vấn đề**: không hiển thị "3 / 20" counter. Không preload image next/prev → flash trắng khi navigate.
**Cách sửa**:
1. Render `<div>{activeIndex + 1} / {images.length}</div>` góc trên.
2. Preload: `useEffect` khi activeIndex thay đổi → `new Image().src = images[activeIndex+1]?.url`.

**Kiểm tra**: navigate lightbox → thấy counter, next load nhanh.

---

### Lỗi J — ImageGallery JSON-LD schema missing (1.5h, P2 SEO)
**File**: `src/blocks/gallery/index.tsx` + `src/lib/seo/json-ld.ts`
**Vấn đề**: không emit `ImageGallery` schema → Google không hiểu là album.
**Cách sửa**: build `{ "@type": "ImageGallery", "image": [...] }` với mỗi image là `{ "@type": "ImageObject", "url", "caption" }`.
**Kiểm tra**: Rich Results Test detect.

---

### Lỗi K — Alt fallback empty string (15 phút, P2)
**File**: `src/blocks/gallery/index.tsx`
**Vấn đề**: `alt={image.alt ?? ''}` → screen reader đọc "image" generic nếu alt thiếu.
**Cách sửa**: fallback theo chain: `image.alt || image.caption || \`Gallery image ${i+1}\``.
**Kiểm tra**: screen reader đọc fallback text khi alt missing.

---

## Thứ tự làm
1. **Lỗi E** (15 phút) — empty state
2. **Lỗi K** (15 phút) — alt fallback
3. **Lỗi I** (30 phút) — counter + preload
4. **Lỗi G** (30 phút) — thumbnail scrollIntoView
5. **Lỗi F** (45 phút) — swipe + dots
6. **Lỗi H** (45 phút) — masonry order (hoặc defer)
7. **Lỗi D** (1.5h) — next/image migration
8. **Lỗi J** (1.5h) — ImageGallery JSON-LD
9. **Lỗi C** (2h) — filter chips
10. **Lỗi A** (2h) — lightbox a11y CRITICAL
11. **Lỗi B** (45 phút để remove, hoặc 3-5h để fix thật)

Tổng: **~9-12 giờ** (nếu remove justified) / **~12-16 giờ** (nếu fix thật).

## Tiêu chí hoàn thành
- [ ] Lightbox có focus trap + scroll lock + aria-modal
- [ ] Grep `<img` trong gallery/index.tsx → 0 kết quả
- [ ] Filter chips render và lọc đúng theo tag
- [ ] `images: []` → return null
- [ ] Carousel swipe works trên mobile + dots update
- [ ] Thumbnail filmstrip auto-scroll tới active
- [ ] Lightbox counter + preload next image
- [ ] Rich Results Test detect ImageGallery
- [ ] Alt fallback không bao giờ empty
- [ ] `npx tsc --noEmit` sạch

## Rủi ro
- **Lỗi A**: focus-trap-react thêm ~10kb bundle. Nếu budget tight → tự impl focus trap với querySelectorAll(focusable).
- **Lỗi B**: nếu chọn fix thật → phải pre-load dimensions async → first paint delay. Option remove an toàn hơn.
- **Lỗi D**: next/image yêu cầu domain config → Payload CDN URL phải trong `remotePatterns`.

## Câu hỏi còn bỏ ngỏ
1. Justified variant: remove hay fix thật? Đề xuất remove trong vòng này, fix sau nếu users kêu.
2. Masonry: accept column order limitation hay rewrite JS-based?
3. Filter chips có cần multi-select không? (Wix hiện single-select.)
