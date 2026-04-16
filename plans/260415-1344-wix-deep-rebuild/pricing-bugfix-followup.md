---
title: "Pricing — Fix JIT bug + mobile overflow + comparison reference bug"
description: "12 lỗi của pricing block 789 LOC: dynamic Tailwind JIT miss, mobile overflow, comparison includes bug, currency format"
status: pending
priority: P1
effort: 10-14h
branch: chore/F01-remaining-plans
tags: [pricing, bugfix, wix-rebuild]
created: 2026-04-15
---

# Pricing — Sửa các lỗi còn lại

## Bối cảnh
Pricing là block lớn nhất (789 LOC, 8 variants: cards/table/horizontal/toggle/tiered/comparison/minimal/slider, polish 4/5). Có 2 bug SILENT nghiêm trọng (JIT dynamic class miss + comparison object reference `includes`) làm block render sai mà không throw error. Cộng thêm mobile overflow, currency format VND fail, a11y gaps.

## Phạm vi
Fix tất cả bug logic + UI + a11y + SEO. KHÔNG split file thành `variants/` trong vòng này (để Phase 03).

## Danh sách lỗi cần fix

### Lỗi A — `md:grid-cols-${n}` dynamic Tailwind JIT miss (1h, P1 SILENT) ⚠
**File**: `src/blocks/pricing/index.tsx`
**Vấn đề**: code dạng `` `md:grid-cols-${plans.length}` `` không được Tailwind JIT detect → class không sinh ra → 3 variants (cards/toggle/minimal) kẹt 1 cột desktop. Đây là silent bug.
**Cách sửa**:
1. Dùng object map: `const GRID_COLS = { 1: 'md:grid-cols-1', 2: 'md:grid-cols-2', 3: 'md:grid-cols-3', 4: 'md:grid-cols-4' }`.
2. Class: `GRID_COLS[Math.min(plans.length, 4)]`.
3. Add to `tailwind.config.ts` safelist nếu cần dynamic hơn.

**Kiểm tra**: devtools element → class `md:grid-cols-3` tồn tại + computed style grid-template-columns có 3 col ≥768px.

---

### Lỗi B — Comparison/table variants mobile 375px no horizontal scroll hint (45 phút, P1)
**File**: `src/blocks/pricing/index.tsx` (variants `comparison`, `table`)
**Vấn đề**: bảng 4-5 col > 375px → overflow cắt nội dung, user không biết có thể scroll.
**Cách sửa**:
1. Wrap `<table>` trong `<div className="overflow-x-auto -mx-4 px-4">`.
2. Thêm `<div className="md:hidden text-xs text-muted">← Vuốt để xem thêm →</div>` trên table.
3. Fade gradient right edge bằng `mask-image: linear-gradient(to right, black 90%, transparent)`.

**Kiểm tra**: 375px → có thể scroll ngang, thấy hint text + fade edge.

---

### Lỗi C — 789 LOC duplicate code giữa variants (3-4h, P2 maintenance)
**File**: `src/blocks/pricing/index.tsx`
**Vấn đề**: 8 variants trong 1 file → `PriceDisplay`, feature list, CTA button bị lặp ~5 lần.
**Cách sửa**:
1. Extract `PlanCard`, `PlanFeatureList`, `PlanPrice`, `PlanBadge` thành top-level components trong cùng file.
2. Mỗi variant chỉ compose layout wrapper + gọi components.
3. KHÔNG split file (defer Phase 03) — chỉ dedupe.

**Kiểm tra**: LOC giảm 30-40% (còn ~450-550 LOC), visual output giữ nguyên.

---

### Lỗi D — Toggle annual/monthly animation thiếu (45 phút, P2)
**File**: `src/blocks/pricing/index.tsx` (variant `toggle`)
**Vấn đề**: switch monthly/annual → giá swap instant, không có animation.
**Cách sửa**: wrap `PlanPrice` trong `<AnimatePresence mode="wait">` với `motion.span key={period}` + fade/slide transition.
**Kiểm tra**: click toggle → giá fade-out + fade-in smooth.

---

### Lỗi E — "Most popular" badge không animate (15 phút, P3)
**File**: `src/blocks/pricing/index.tsx`
**Vấn đề**: badge là static pill.
**Cách sửa**: thêm `animate-pulse` hoặc `motion.div` với subtle scale breathing (1 → 1.05 → 1 infinite).
**Kiểm tra**: badge có pulse effect nhẹ.

---

### Lỗi F — `comparison` variant `features.includes(feature)` object reference bug (45 phút, P1 SILENT) ⚠
**File**: `src/blocks/pricing/index.tsx` (variant `comparison`)
**Vấn đề**: check `plan.features.includes(rowFeature)` với `rowFeature` là object → `.includes` so sánh reference → luôn false → bảng hiện "—" (không có) cho tất cả rows. Silent bug.
**Cách sửa**: so sánh bằng string key: `plan.features.some(f => f.key === rowFeature.key)` hoặc build `Set` các keys.
**Kiểm tra**: comparison variant → cell hiển thị ✓ cho feature plan có, — cho plan không có.

---

### Lỗi G — Feature list checkmark missing icon var (15 phút, P2)
**File**: `src/blocks/pricing/index.tsx`
**Vấn đề**: checkmark dùng `text-green-500` hardcode thay vì token.
**Cách sửa**: thay bằng `text-[color:var(--success)]` hoặc dùng `CSS_VARS.success`.
**Kiểm tra**: theme light/dark → check color adapt.

---

### Lỗi H — Currency format hardcode `$`, không configurable (45 phút, P2)
**File**: `src/blocks/pricing/index.tsx`
**Vấn đề**: render `${price}` cứng → VND/EUR/GBP site đều hiện USD.
**Cách sửa**: schema `currency: z.enum(['USD', 'VND', 'EUR', 'GBP']).default('USD')`. Format bằng `Intl.NumberFormat(locale, { style: 'currency', currency })`.
**Kiểm tra**: pass `currency: 'VND'` → hiển thị "890.000 ₫" đúng format VN.

---

### Lỗi I — Keyboard nav table missing (45 phút, P2 a11y)
**File**: `src/blocks/pricing/index.tsx` (variant `comparison`, `table`)
**Vấn đề**: table cell không focusable, keyboard user không navigate được.
**Cách sửa**: thêm `role="grid"` trên table + `role="gridcell"` + `tabIndex={0}` cho cell có interactive content. Arrow key navigation optional.
**Kiểm tra**: tab vào table → focus vào cell, arrow nav nếu impl.

---

### Lỗi J — Product/Offer JSON-LD missing (1.5h, P2 SEO)
**File**: `src/blocks/pricing/index.tsx` + `src/lib/seo/json-ld.ts`
**Vấn đề**: không emit schema → Google không hiểu đây là pricing catalog.
**Cách sửa**: build array of `{ "@type": "Product", "name": plan.name, "offers": { "@type": "Offer", "price": ..., "priceCurrency": ... } }`.
**Kiểm tra**: Rich Results Test detect Product + Offer.

---

### Lỗi K — Currency regex fail với VND "890.000đ" (45 phút, P2)
**File**: `src/blocks/pricing/index.tsx`
**Vấn đề**: hiện có logic parse price từ string bằng regex `/\$(\d+)/` → VND format "890.000đ" không match.
**Cách sửa**: store price là `number` trong schema (không phải string). Format lúc render bằng Intl (xem Lỗi H).
**Kiểm tra**: pass price: 890000 với currency VND → render "890.000 ₫".

---

### Lỗi L — `scale-105` trên cards highlighted gây overlap mobile (15 phút, P2)
**File**: `src/blocks/pricing/index.tsx`
**Vấn đề**: featured card `scale-105` trên mobile → đè lên card bên cạnh (grid-cols-1 full width → scale làm card lớn hơn container).
**Cách sửa**: `md:scale-105` — chỉ scale ở desktop. Mobile giữ 1.0.
**Kiểm tra**: 375px → cards không overlap, featured có thể highlight bằng border/shadow thay vì scale.

---

## Thứ tự làm
1. **Lỗi E** (15 phút), **Lỗi G** (15 phút), **Lỗi L** (15 phút) — quickwins
2. **Lỗi D** (45 phút) — toggle animation
3. **Lỗi K** (45 phút) — price number schema
4. **Lỗi H** (45 phút) — Intl.NumberFormat
5. **Lỗi B** (45 phút) — mobile overflow hint
6. **Lỗi F** (45 phút) — comparison includes bug
7. **Lỗi I** (45 phút) — keyboard nav
8. **Lỗi A** (1h) — JIT dynamic class fix
9. **Lỗi J** (1.5h) — Product JSON-LD
10. **Lỗi C** (3-4h) — dedupe helpers

Tổng: **~10-14 giờ**.

## Tiêu chí hoàn thành
- [ ] cards/toggle/minimal variants hiển thị đúng số cột desktop (3-4 col tuỳ plans.length)
- [ ] comparison/table scroll ngang trên 375px + hint
- [ ] comparison cell feature compare bằng key, không object ref
- [ ] LOC pricing block ≤ 600
- [ ] Toggle annual/monthly có animation fade
- [ ] Currency VND/EUR render đúng format Intl
- [ ] Rich Results Test detect Product + Offer schema
- [ ] Featured card không overlap mobile
- [ ] `npx tsc --noEmit` sạch

## Rủi ro
- **Lỗi A**: nếu plans.length > 4 → object map miss → class undefined. Phải clamp `Math.min(4)`.
- **Lỗi C**: dedupe có thể break visual nếu variants có tweak nhỏ. Phải test từng variant screenshot trước/sau.
- **Lỗi K**: breaking schema change (string → number). Migration cho DB data cũ: parse string → number, fallback 0 nếu fail.

## Câu hỏi còn bỏ ngỏ
1. Có nên support `period: 'one-time' | 'monthly' | 'annually'` trong schema không? Hiện toggle hardcode monthly/annual.
2. Currency list có cần nhiều hơn 4 không? Nếu ≥ 10 currencies → cần Intl locale mapping.
