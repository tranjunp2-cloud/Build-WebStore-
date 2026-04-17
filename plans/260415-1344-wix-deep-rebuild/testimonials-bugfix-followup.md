---
title: "Testimonials — 10 lỗi nhỏ còn lại + Review JSON-LD"
description: "Testimonials là block polish 5/5 tốt nhất, nhưng vẫn còn 10 lỗi nhỏ: direction-rtl invalid, a11y, JSON-LD, img raw"
status: pending
priority: P1
effort: 5-7h
branch: chore/F01-remaining-plans
tags: [testimonials, bugfix, wix-rebuild, seo]
created: 2026-04-15
---

# Testimonials — Sửa các lỗi còn lại

## Bối cảnh
Testimonials (746 LOC, 8 variants) là block được researcher-01 đánh polish 5/5 (best in class): đã có auto-rotate + reduce-motion, layoutId shared transitions, star rating helper, AuthorMeta helper. Tuy nhiên vẫn có 10 lỗi nhỏ ảnh hưởng a11y, SEO và visual polish.

## Phạm vi
Fix các lỗi nhỏ + thêm `Review` JSON-LD để enable rich snippet stars trên Google. KHÔNG thêm variants mới.

## Danh sách lỗi cần fix

### Lỗi A — `md:direction-rtl` invalid Tailwind class (15 phút, P1)
**File**: `src/blocks/testimonials/index.tsx` (variant `video-text`)
**Vấn đề**: researcher-01 spot được class `md:direction-rtl` — đây không phải Tailwind utility valid → không có effect. Intent là đảo vị trí video + text ở desktop.
**Cách sửa**: thay bằng `md:flex-row-reverse` (nếu parent là flex) hoặc `md:[direction:rtl]` (arbitrary property syntax Tailwind 3.1+).
**Kiểm tra**: desktop video-text variant → video ở phải, text ở trái.

---

### Lỗi B — Decorative quote mark giant serif feels 2019 (30 phút, P2)
**File**: `src/blocks/testimonials/index.tsx`
**Vấn đề**: dùng ký tự `&ldquo;` font serif size ~80px làm decorative → nhìn cũ kỹ, trendy 2019-2020.
**Cách sửa**: thay bằng SVG quote icon (lucide `Quote`) hoặc abstract shape (blob / underline accent). Giảm size xuống 40px, đặt opacity 0.15.
**Kiểm tra**: visual compare trước/sau → cảm giác modern hơn.

---

### Lỗi C — Carousel `autoRotateInterval` hardcoded (30 phút, P2)
**File**: `src/blocks/testimonials/index.tsx` (variant `carousel`)
**Vấn đề**: interval 5000ms cứng. Một số brand muốn slower (8s cho deep testimonial) hoặc faster (3s cho short quote).
**Cách sửa**: thêm prop `autoRotateMs` vào config schema, default 5000. Component dùng `autoRotateMs ?? 5000`.
**Kiểm tra**: pass `autoRotateMs: 8000` → interval chạy 8 giây.

---

### Lỗi D — Auto-rotate thiếu `aria-live="polite"` (15 phút, P1 a11y)
**File**: `src/blocks/testimonials/index.tsx`
**Vấn đề**: carousel auto-rotate change content không có announce cho screen reader → user không biết nội dung đã đổi.
**Cách sửa**: wrap active slide trong `<div aria-live="polite" aria-atomic="true">`. Dot indicators giữ `aria-label="Go to testimonial N"`.
**Kiểm tra**: VoiceOver/NVDA → announce nội dung mới khi slide đổi.

---

### Lỗi E — Carousel missing pause on hover (30 phút, P2)
**File**: `src/blocks/testimonials/index.tsx` (variant `carousel`)
**Vấn đề**: hover không pause interval → user đọc nửa chừng bị đổi slide.
**Cách sửa**: state `isPaused`, `onMouseEnter/Leave` + `onFocus/Blur`. Giống pattern hero slideshow.
**Kiểm tra**: hover → slide dừng, rời chuột → chạy lại.

---

### Lỗi F — Review JSON-LD schema missing → mất rich snippet stars (1.5h, P1 SEO)
**File**: `src/blocks/testimonials/index.tsx` + `src/lib/seo/json-ld.ts`
**Vấn đề**: không emit `Review` hoặc `AggregateRating` → Google không hiển thị ⭐ rating trong search result → mất CTR lớn.
**Cách sửa**:
1. Build helper `buildReviewSchema(testimonials, businessName)`:
   ```json
   { "@type": "Review", "reviewRating": { "@type": "Rating", "ratingValue": 5 }, "author": { "@type": "Person", "name": ... }, "reviewBody": ... }
   ```
2. Nếu có >= 3 reviews → thêm `AggregateRating` với average.
3. Render script tag cuối block.

**Kiểm tra**: Rich Results Test → detect Review + AggregateRating, preview có stars.

---

### Lỗi G — Early return empty state missing (15 phút, P2)
**File**: `src/blocks/testimonials/index.tsx`
**Vấn đề**: một vài variant có early return `if (!testimonials?.length) return null`, một vài không có → inconsistent.
**Cách sửa**: early return ở top của main component trước khi dispatch variant.
**Kiểm tra**: `testimonials: []` → không render.

---

### Lỗi H — Stable keys thay vì `key={i}` (15 phút, P3)
**File**: `src/blocks/testimonials/index.tsx`
**Vấn đề**: `.map((t, i) => <Card key={i}>)` → nếu reorder hoặc remove → React reconcile sai.
**Cách sửa**: dùng `key={t.id ?? \`${t.author}-${i}\`}`.
**Kiểm tra**: reorder testimonials → animation smooth, không flash.

---

### Lỗi I — `<blockquote>` semantic missing (15 phút, P3)
**File**: `src/blocks/testimonials/index.tsx`
**Vấn đề**: quote render trong `<p>` hoặc `<div>` → không semantic, SEO + a11y loss.
**Cách sửa**: wrap quote text trong `<blockquote cite={...}>` + attribution trong `<cite>` hoặc `<footer>`.
**Kiểm tra**: DOM inspector → blockquote + cite/footer có mặt.

---

### Lỗi J — `AvatarRing` img raw vs Next/Image (45 phút, P2)
**File**: `src/blocks/testimonials/index.tsx` (helper `AvatarRing`)
**Vấn đề**: avatar dùng `<img>` raw → không lazy, không optimize, không srcset.
**Cách sửa**: thay bằng `<Image width={64} height={64}>` với loader mặc định.
**Kiểm tra**: DOM → `<img srcset="...">` không còn raw.

---

## Thứ tự làm
1. **Lỗi A** (15 phút) — direction-rtl fix
2. **Lỗi D** (15 phút) — aria-live polite
3. **Lỗi G** (15 phút) — empty state top
4. **Lỗi H** (15 phút) — stable keys
5. **Lỗi I** (15 phút) — blockquote semantic
6. **Lỗi B** (30 phút) — modernize quote decor
7. **Lỗi C** (30 phút) — autoRotateMs prop
8. **Lỗi E** (30 phút) — carousel pause
9. **Lỗi J** (45 phút) — AvatarRing next/image
10. **Lỗi F** (1.5h) — Review JSON-LD

Tổng: **~5-7 giờ**.

## Tiêu chí hoàn thành
- [ ] Video-text variant desktop: video phải, text trái
- [ ] Screen reader announce nội dung slide mới
- [ ] Carousel pause on hover + focus
- [ ] Rich Results Test hiện Review + AggregateRating + stars
- [ ] `testimonials: []` → return null ở mọi variant
- [ ] Map dùng stable key thay vì index
- [ ] Quote render trong `<blockquote>`
- [ ] Avatar dùng next/image
- [ ] `npx tsc --noEmit` sạch

## Rủi ro
- **Lỗi F**: `AggregateRating` yêu cầu >= 1 review để Google hiển thị. Nếu AI gen testimonial fake → Google có thể penalty. Phải chắc data là real hoặc ít nhất author là real person.
- **Lỗi A**: `md:flex-row-reverse` chỉ work nếu parent flex. Nếu hiện tại parent grid → phải đổi cả parent.

## Câu hỏi còn bỏ ngỏ
1. AggregateRating có nên bật mặc định không? (Rủi ro Google penalty với fake data.)
2. Quote decor modernize thế nào — SVG blob hay underline brush stroke?
