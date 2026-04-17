---
title: "Hero — Fix variant sameness, LCP và 5 wow variants mới"
description: "8 lỗi hero block + đề xuất 5 variants mới (broken-grid, image-mask, typographic, mesh-bg, video-bg-fullscreen) để phá cảm giác samey"
status: pending
priority: P1
effort: 12-16h
branch: chore/F01-remaining-plans
tags: [hero, bugfix, wix-rebuild, variants]
created: 2026-04-15
---

# Hero — Sửa các lỗi còn lại

## Bối cảnh
Hero block hiện có 11 variants (polish 4/5) nhưng researcher-01 nhận xét: "variants feel samey because they share same decorative vocabulary (gradient blob, brand tint) and only re-arrange text/image — no bold typography, layered shapes, or asymmetric grids". 8 lỗi bên dưới nhắm vào visual variety, LCP performance, a11y và wow factor.

## Phạm vi
- Fix LCP (next/image), alt text Lexical bug, variant overflow mobile, slideshow hover pause, image fallback, blur placeholder.
- Thêm 5 wow variants mới phá vỡ decorative vocabulary cũ.
- KHÔNG refactor dispatcher 36 LOC, KHÔNG đụng 11 variants hiện có (chỉ fix bugs trong từng file).

## Danh sách lỗi cần fix

### Lỗi A — 11 variants cùng decorative vocabulary (4-6h, P1)
**File**: `src/blocks/hero/variants/*.tsx`
**Vấn đề**: tất cả 11 variants dùng chung `GradientBlob` + `brand-tint` overlay → render ra 11 shades của cùng 1 look. Wix/Framer dùng mesh gradient, layered shapes, broken grid, asymmetric image crop.
**Cách sửa**:
1. Tạo `src/blocks/hero/decorative/` chứa 5 primitive: `MeshGradient`, `NoiseTexture`, `LayeredShapes`, `BrokenGrid`, `DiagonalDivider`.
2. Mỗi variant pick 1-2 primitive khác nhau (không variant nào dùng trùng combo).
3. Map trong `HERO_DECORATIVE_BY_VARIANT` để lock choice per variant.

**Kiểm tra**: screenshot 11 variants side-by-side → nhận ra ngay 11 cái khác nhau.

---

### Lỗi B — Variants thin (49-127 LOC), thiếu wow (2h, P2)
**File**: `src/blocks/hero/variants/*.tsx`
**Vấn đề**: mỗi variant chỉ 49-127 LOC (researcher-01) → chỉ rearrange text + image + CTA, không có scroll-linked animation, không có typographic hero (chữ khổng lồ), không có mask image.
**Cách sửa**: cho mỗi variant thêm 1 "signature move" (ví dụ: magazine variant → letter-by-letter headline reveal; parallax → background parallax scroll; fullscreen → kenburns image zoom).
**Kiểm tra**: mỗi variant có ít nhất 1 animation/effect không xuất hiện ở variant khác.

---

### Lỗi C — Next/Image missing cho hero image → LCP regression (1.5h, P1)
**File**: `src/blocks/hero/variants/*.tsx` (những file dùng `<img>` trực tiếp)
**Vấn đề**: dùng `<img>` raw thay vì `next/image` → không tự động sinh srcset, không lazy, không blur placeholder. Hero image là LCP element → ảnh hưởng Core Web Vitals.
**Cách sửa**:
1. Import `Image from 'next/image'`.
2. Set `priority` true cho hero image (trừ slideshow, dùng eager cho slide đầu).
3. `fill` + `sizes="100vw"` cho fullscreen variant.
4. `width`/`height` cho magazine/split variants.

**Kiểm tra**: Lighthouse → LCP < 2.5s. View source → `<img srcset="...">` không còn raw `<img>`.

---

### Lỗi D — Alt text render `[object Object]` khi `image.alt` là Lexical (15 phút, P1)
**File**: `src/blocks/hero/variants/*.tsx`
**Vấn đề**: Payload rich text field trả về object Lexical, nếu component pass thẳng vào `alt={image.alt}` → render thành `[object Object]`.
**Cách sửa**: dùng helper `lexicalToPlainText(image.alt)` hoặc fallback `image.alt?.root ? extractText(image.alt) : image.alt ?? 'Hero image'`.
**Kiểm tra**: inspect hero image trong DOM → attribute `alt` là plain text.

---

### Lỗi E — `92vh` tràn viewport mobile (15 phút, P2)
**File**: `src/blocks/hero/variants/fullscreen.tsx`
**Vấn đề**: `min-h-[92vh]` không tính đến address bar mobile → thực tế hero bị cắt ~10% bottom trên iOS Safari.
**Cách sửa**: dùng `min-h-[85vh] md:min-h-[92vh]` hoặc `min-h-[100dvh]` (dynamic viewport height) cho mobile.
**Kiểm tra**: Safari iOS → hero hiển thị đủ CTA button, không bị address bar đè.

---

### Lỗi F — Slideshow variant không pause on hover (30 phút, P2 WCAG)
**File**: `src/blocks/hero/variants/slideshow.tsx`
**Vấn đề**: auto-rotate interval chạy liên tục, user hover vào CTA button cũng không dừng → WCAG 2.2.2 (Pause, Stop, Hide) fail.
**Cách sửa**: thêm state `isPaused`, `onMouseEnter={() => setPaused(true)}` + `onMouseLeave={() => setPaused(false)}` + `onFocus`/`onBlur` cho keyboard user. Interval chỉ tick khi `!isPaused`.
**Kiểm tra**: hover hero slideshow → slide dừng, rời chuột → chạy lại.

---

### Lỗi G — Image fallback không nhất quán giữa variants (1h, P2)
**File**: `src/blocks/hero/variants/*.tsx`
**Vấn đề**: một số variant fallback về industry image, vài variant render gradient rỗng, vài variant crash khi `image` undefined.
**Cách sửa**: tạo shared helper `getHeroImageSrc(image, category)` trả về theo chain: `image?.url → industryImage(category) → PLACEHOLDER_HERO`. Tất cả variants dùng helper này.
**Kiểm tra**: pass `image: undefined` → tất cả variants render fallback đẹp, không crash.

---

### Lỗi H — Blur placeholder missing (1h, P3)
**File**: `src/blocks/hero/variants/*.tsx`
**Vấn đề**: next/image có support `placeholder="blur"` + `blurDataURL`, nhưng không variant nào dùng → user thấy flash trắng khi image load.
**Cách sửa**: nếu Payload upload có `sizes.thumbnail.url` → generate blur data URL; nếu không → dùng static `BLUR_DATA_URL_FALLBACK` base64 1x1 grey.
**Kiểm tra**: throttle network 3G → hero image có blur → sharp transition.

---

### Đề xuất thêm (không bắt buộc trong plan này): 5 wow variants mới
1. `broken-grid` — asymmetric grid 12-col, image span 5/7, text span 4, có white space lớn
2. `image-mask` — chữ title làm mask cho image bg (CSS `background-clip: text`)
3. `typographic-hero` — chỉ có text khổng lồ 120px+ + 1 small image thumbnail, no big bg
4. `mesh-bg` — mesh gradient fullscreen + glass card center chứa CTA
5. `video-bg-fullscreen` — video loop background + dark overlay + centered text

Track ở section riêng trong Phase 03 nếu timeline cho phép.

## Thứ tự làm
1. **Lỗi D** (15 phút) — alt text fix
2. **Lỗi E** (15 phút) — viewport mobile
3. **Lỗi F** (30 phút) — slideshow pause
4. **Lỗi G** (1h) — image fallback helper
5. **Lỗi H** (1h) — blur placeholder
6. **Lỗi C** (1.5h) — next/image migration
7. **Lỗi B** (2h) — signature moves per variant
8. **Lỗi A** (4-6h) — decorative primitives + rewire

Tổng: **~12-16 giờ**.

## Tiêu chí hoàn thành
- [ ] Screenshot 11 variants side-by-side → visually distinct (≥80% reviewers phân biệt được)
- [ ] Mỗi variant có 1 signature animation/effect riêng
- [ ] Lighthouse LCP < 2.5s trên template có hero
- [ ] Alt text render plain string, không `[object Object]`
- [ ] Fullscreen variant không bị address bar đè trên iOS Safari
- [ ] Slideshow pause khi hover/focus
- [ ] `image: undefined` không crash bất kỳ variant nào
- [ ] 3G throttle → image blur-to-sharp transition smooth
- [ ] `npx tsc --noEmit` sạch

## Rủi ro
- **Lỗi A**: thay decorative system là breaking visual → phải test 11 variants visual regression, có thể làm vỡ template đã publish.
- **Lỗi C**: next/image yêu cầu `domains` config trong `next.config.js` → nếu user upload image từ CDN lạ → Image component fail, phải fallback về `<img>` hoặc config `remotePatterns`.
- **Lỗi B**: thêm animation có thể làm performance regress trên low-end mobile → phải respect `prefers-reduced-motion`.

## Câu hỏi còn bỏ ngỏ
1. 5 wow variants mới có vào Phase 03 hay tách plan riêng?
2. Decorative primitive dùng SVG inline hay CSS-only? SVG dễ style hơn nhưng bundle to hơn.
3. Video bg variant có cần thumbnail fallback cho slow connection không?
