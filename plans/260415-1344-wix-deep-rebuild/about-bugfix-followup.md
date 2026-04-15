---
title: "About — Fix 9 lỗi (Lexical strip, timeline grid, CLS guard, magic numbers)"
description: "Fix RichText in all 3 variants, timeline grid-cols layout, memoize image, split aspect-ratio"
status: done
priority: P1
effort: 4h
branch: chore/F01-remaining-plans
tags: [about, bugfix, cls, richtext, layout]
created: 2026-04-15
completed: 2026-04-15
---

# About — Fix 9 lỗi còn lại

## Bối cảnh
Audit tìm 10 lỗi about block. Critical: `toPlainText` strip Lexical → mất format bold/italic/link; Timeline desktop `flex` fragile vỡ alignment; Split variant duplicate `<img>` code + không có aspect-ratio → CLS bad. Fix 9/10 trong PR #642, defer CTA button field (cần AboutConfigSchema migration).

## Phạm vi
Đụng `src/blocks/about/index.tsx`. KHÔNG alter AboutConfigSchema (scope migration riêng). KHÔNG thêm 5 variants mới — Phase 05.

## Danh sách lỗi cần fix

### Lỗi G — toPlainText strip Lexical (CRITICAL) (45 phút, P1)
**Vấn đề**: Cả 3 variants call `toPlainText(description)` → strip bold/italic/link formatting → user viết rich content trong editor nhưng render plain.
**Cách sửa**: Import `<RichText value={description} />` từ `@payloadcms/richtext-lexical/react`. Thay tất cả `toPlainText` calls trong SimpleVariant, StoryVariant, SplitVariant. Container wrap `<div className="prose prose-neutral dark:prose-invert">` để style heading/list.

---

### Lỗi F — Timeline desktop flex fragile (1h, P1)
**Vấn đề**: Timeline dùng `flex flex-row` + manual `left-1/2` → alt item alignment shift khi text length khác nhau → visual broken.
**Cách sửa**: Dùng `grid-cols-[1fr_auto_1fr]` → 3 columns: left content, center divider, right content. Odd items col 1, even items col 3 (auto-place). Divider column auto width chứa dot + vertical line.

---

### Lỗi A — Magic number left-[23px] (5 phút, P2)
**Cách sửa**: `left-[calc(1.5rem-0.5px)]` với container `pl-6` → line align center với dot 1rem (16px).

---

### Lỗi B — getAboutImage re-compute mỗi render (10 phút, P3)
**Cách sửa**: `useMemo(() => getAboutImage(site), [site])`.

---

### Lỗi C — Story variant silent fallback (10 phút, P3)
**Vấn đề**: Nếu `story` field rỗng, variant silently render default copy → dev không biết config thiếu.
**Cách sửa**: `if (process.env.NODE_ENV === 'development' && !story) console.warn('[AboutStory] story field empty, using default')`.

---

### Lỗi E — Split variant duplicate img + no CLS guard (30 phút, P2)
**Vấn đề**: Split variant render `<img>` 2 lần (mobile + desktop) → duplicate payload. Không có `aspect-ratio` → image load shift layout.
**Cách sửa**:
1. Extract `<AboutImage src={...} alt={...} className="aspect-[4/3] object-cover w-full" />`
2. Render 1 lần. Dùng CSS `order` để swap vị trí mobile/desktop (`order-1 md:order-2`).
3. `aspect-[4/3]` reserve space → CLS = 0.

---

### Lỗi 8A — Category fallback chain (15 phút, P2)
**Cách sửa**: `site.siteType ?? site.category ?? 'business'` để Story/Split pick copy template đúng.

---

### Lỗi 9A — img alt "About headline" (5 phút, P2)
**Cách sửa**: `alt={\`About ${site.name}\`}` hoặc user-provided alt nếu có.

---

### Lỗi 13A — SimpleVariant early return all empty (10 phút, P3)
**Cách sửa**: `if (!headline && !description && !image) return null` — không render container rỗng.

---

### Deferred

| Lỗi | Mô tả | Lý do |
|---|---|---|
| D | CTA button field | Cần AboutConfigSchema migration + form editor update — scope riêng |
| 5 variants mới | mission-vision-values, stats-inline, founder-quote, team-preview, timeline-imagery | Phase 05 |

---

## Thứ tự làm

1. **Lỗi G** (45 phút) — RichText (critical cho content)
2. **Lỗi F** (1h) — Timeline grid refactor
3. **Lỗi E** (30 phút) — Split AboutImage + aspect-ratio
4. **Lỗi A + B + 8A + 9A** (30 phút) — gom quick wins
5. **Lỗi C + 13A** (20 phút) — dev warn + early return

Tổng: **3.5 giờ**.

## Tiêu chí hoàn thành
- [x] 3 variants (simple/story/split) render Lexical richtext qua `<RichText>`
- [x] Timeline desktop dùng `grid-cols-[1fr_auto_1fr]` layout stable
- [x] Magic number replaced với calc()
- [x] `getAboutImage` memoized via useMemo
- [x] Story variant dev console.warn khi thiếu
- [x] Split variant 1 `<AboutImage>` shared + `aspect-[4/3]` CLS guard
- [x] Category fallback chain `siteType → category → business`
- [x] img alt semantic `About ${site.name}`
- [x] SimpleVariant early return khi all empty
- [x] `tsc --noEmit` sạch
- [x] Lighthouse CLS score < 0.1 trên about page

## Kết quả thực hiện (2026-04-15)
- **PR**: #642 (merged/review)
- **Commit**: 73f081ca
- **Deferred**: Lỗi D (CTA button field), 5 variants mới Phase 05

## Rủi ro
- **RichText bundle**: `@payloadcms/richtext-lexical/react` đã có trong bundle (hero, features dùng rồi). Không thêm weight.
- **Timeline grid**: responsive breakpoint — mobile vẫn dùng flex col (grid chỉ desktop md+). Test 375px.
- **Split order swap**: nếu `direction` field ngược → test cả 2 chiều (image-left vs image-right).

## Câu hỏi còn bỏ ngỏ
1. CTA button field (Lỗi D) — migrate sang về AboutConfigSchema tới sprint nào? Cần cho v1.0?
2. 5 variants mới: PM priority? `founder-quote` hợp startup, `stats-inline` hợp SaaS/enterprise, `mission-vision-values` hợp corporate.
3. Timeline có cần support > 6 items không? Hiện grid auto-wrap, nhưng visual có thể lộn xộn.
