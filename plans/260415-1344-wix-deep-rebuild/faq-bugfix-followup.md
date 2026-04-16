---
title: "FAQ — 11 lỗi + thêm 3 variants (numbered, category-tabs, search-filter)"
description: "FAQ block 205 LOC có 11 lỗi: CSS var verify, RichText support, FAQPage JSON-LD, allowMultiple. Đề xuất thêm 3 variants"
status: pending
priority: P1
effort: 8-10h
branch: chore/F01-remaining-plans
tags: [faq, bugfix, wix-rebuild, seo]
created: 2026-04-15
---

# FAQ — Sửa các lỗi còn lại

## Bối cảnh
FAQ block (205 LOC, 3 variants: accordion/grid/simple, polish 4/5). Researcher-01 note: "only 3 variants — feels thin; no icon/number/category UI". Accordion đã có ARIA + keyboard nav. Nhưng thiếu FAQPage JSON-LD (quan trọng SEO), answer không support RichText, và 3 variants quá ít cho block SEO như FAQ.

## Phạm vi
Fix 11 bugs + thêm 3 variants mới (numbered, category-tabs, search-filter). FAQPage JSON-LD là priority cao nhất vì impact direct SEO.

## Danh sách lỗi cần fix

### Lỗi A — Chỉ 3 variants, thiếu numbered/category-tabs/search-filter (4-5h, P2)
**File**: `src/blocks/faq/index.tsx`
**Vấn đề**: 3 variants quá ít. Mỗi site FAQ look y chang nhau.
**Cách sửa**: thêm 3 variants:
- `numbered`: list dạng "01. Câu hỏi... / 02. ..." với số to ở bên
- `category-tabs`: group items theo category, tab switcher trên (FAQs về "Billing" / "Shipping" / "Returns")
- `search-filter`: input search filter items real-time (fuzzy match title + answer)

**Kiểm tra**: config schema thêm 3 enum values + render đúng.

---

### Lỗi B — `key={i}` reconciliation bug (15 phút, P2)
**File**: `src/blocks/faq/index.tsx`
**Vấn đề**: `.map((item, i) => <div key={i}>)` → reorder / remove → React reconcile sai, accordion state leak.
**Cách sửa**: `key={item.id ?? \`${item.question}-${i}\`}`.
**Kiểm tra**: accordion đang mở item 3, remove item 1 → item 2 giữ state đúng.

---

### Lỗi C — `items.length === 0` silent return null (15 phút, P2)
**File**: `src/blocks/faq/index.tsx`
**Vấn đề**: hiện return null không wrap bởi comment → grep khó thấy. Ngoài ra có thể preferred pass empty state message thay vì null.
**Cách sửa**: explicit `if (!items?.length) { return null; }` ở top + add comment `// Early return: FAQ with no items is hidden`.
**Kiểm tra**: `items: []` → không render, console không warn.

---

### Lỗi D — `CSS_VARS.radiusLg` có thể chưa define (30 phút, P1 verify + fix)
**File**: `src/blocks/faq/index.tsx` + `src/lib/design-tokens.ts`
**Vấn đề**: code sử dụng `CSS_VARS.radiusLg` nhưng nếu token chưa define trong `design-tokens.ts` → undefined → class/style rỗng → accordion border radius mất.
**Cách sửa**:
1. Grep `CSS_VARS.radiusLg` trong design-tokens source.
2. Nếu không có → thêm: `radiusLg: 'var(--radius-lg, 12px)'` (có fallback).
3. Đồng bộ với tailwind.config.ts theme.borderRadius.

**Kiểm tra**: inspect FAQ card border-radius → hiển thị 12px.

---

### Lỗi E — `StaggerItem` nhận className trực tiếp, có thể không apply (45 phút, P2)
**File**: `src/blocks/faq/index.tsx`
**Vấn đề**: `<StaggerItem className="faq-item">` — nếu StaggerItem không forward className → class mất.
**Cách sửa**: verify StaggerItem component có `className` prop và forward tới motion.div. Nếu không → patch component hoặc wrap ngoài `<div className>`.
**Kiểm tra**: inspect DOM → `.faq-item` class present.

---

### Lỗi F — SimpleVariant `borderBottom` inline thay vì `last:border-none` (15 phút, P3)
**File**: `src/blocks/faq/index.tsx` (variant `simple`)
**Vấn đề**: dùng `style={{ borderBottom: i === items.length - 1 ? 'none' : '1px solid ...' }}` inline → không reusable, không theme-adaptive.
**Cách sửa**: thay bằng Tailwind `border-b last:border-b-0 border-[color:var(--border)]`.
**Kiểm tra**: last item không có border bottom.

---

### Lỗi G — `answer: string` không support RichText (1.5h, P1)
**File**: `src/blocks/faq/index.tsx` + config schema
**Vấn đề**: answer là plain string → user không format bold/list/link. Wix/Framer FAQ support rich text.
**Cách sửa**:
1. Schema: `answer: z.union([z.string(), z.object({ root: ... })])` để support cả plain và Lexical.
2. Component: nếu object → render bằng `<RichText data={answer} />` (Payload helper). Nếu string → `<p>{answer}</p>`.

**Kiểm tra**: pass answer là Lexical object → render formatted; pass string → render plain.

---

### Lỗi H — FAQPage JSON-LD schema missing (1.5h, P1 SEO) ⚠
**File**: `src/blocks/faq/index.tsx` + `src/lib/seo/json-ld.ts`
**Vấn đề**: FAQPage là 1 trong những schema có rich snippet mạnh nhất của Google (hiển thị trực tiếp Q&A trong search result). Không có = mất SEO opportunity lớn.
**Cách sửa**:
1. Build `{ "@context": "https://schema.org", "@type": "FAQPage", "mainEntity": items.map(item => ({ "@type": "Question", "name": item.question, "acceptedAnswer": { "@type": "Answer", "text": plainText(item.answer) } })) }`.
2. Render script tag ở cuối block.

**Kiểm tra**: Rich Results Test → detect FAQPage + preview Q&A in search result.

---

### Lỗi I — Accordion single-expand only, thiếu `allowMultiple` option (45 phút, P2)
**File**: `src/blocks/faq/index.tsx` (variant `accordion`)
**Vấn đề**: chỉ mở 1 item cùng lúc → user click item mới → item cũ đóng. Wix cho option allow-multiple.
**Cách sửa**: schema `allowMultiple: z.boolean().default(false)`. Nếu true → state là `Set<number>`. Nếu false → state là `number | null`.
**Kiểm tra**: pass `allowMultiple: true` → mở 3 items cùng lúc.

---

### Lỗi J — `role="presentation"` wrapper, could be `role="list"` (15 phút, P3)
**File**: `src/blocks/faq/index.tsx`
**Vấn đề**: wrapper ngoài là `div role="presentation"` → semantic yếu.
**Cách sửa**: thay bằng `role="list"` + mỗi item `role="listitem"`. Hoặc tốt nhất: dùng `<ul>` / `<li>` native.
**Kiểm tra**: screen reader announce "list, N items".

---

### Lỗi K — Section no `aria-labelledby` (15 phút, P2)
**File**: `src/blocks/faq/index.tsx`
**Vấn đề**: `<section>` không trỏ label tới heading → screen reader không có section name.
**Cách sửa**: `<h2 id="faq-heading">` + `<section aria-labelledby="faq-heading">`. Tạo unique id nếu có nhiều FAQ trên page.
**Kiểm tra**: VoiceOver announce "FAQ region".

---

## Thứ tự làm
1. **Lỗi B**, **C**, **F**, **J**, **K** (5 × 15 phút = 1h) — quickwins
2. **Lỗi D** (30 phút) — CSS_VARS verify
3. **Lỗi E** (45 phút) — StaggerItem className
4. **Lỗi I** (45 phút) — allowMultiple option
5. **Lỗi G** (1.5h) — RichText answer support
6. **Lỗi H** (1.5h) — FAQPage JSON-LD
7. **Lỗi A** (4-5h) — 3 new variants

Tổng: **~8-10 giờ**.

## Tiêu chí hoàn thành
- [ ] 6 variants total: accordion, grid, simple, numbered, category-tabs, search-filter
- [ ] Stable keys (không dùng index)
- [ ] `items: []` → return null
- [ ] `CSS_VARS.radiusLg` defined + border-radius render đúng
- [ ] RichText answer render formatted
- [ ] Rich Results Test detect FAQPage + preview Q&A
- [ ] `allowMultiple` prop works
- [ ] Section có `aria-labelledby`
- [ ] `npx tsc --noEmit` sạch

## Rủi ro
- **Lỗi G**: đổi schema answer sang union → breaking change cho data cũ. Phải test Lexical render không crash với string input.
- **Lỗi H**: FAQPage JSON-LD phải match nội dung visible đúng — Google penalize nếu schema Q khác visible Q.
- **Lỗi A**: search-filter variant cần fuzzy match lib → bundle size.

## Câu hỏi còn bỏ ngỏ
1. RichText renderer dùng Payload built-in hay custom? Nếu custom → có thể support được bold/link không?
2. Category-tabs variant: category lấy từ đâu (new schema field `category` per item hay parse từ question)?
3. Search-filter fuzzy match dùng `fuse.js` (8kb) hay simple `toLowerCase().includes()`?
