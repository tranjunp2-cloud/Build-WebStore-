---
title: "Service Cards — Fix icon system, empty state và schema JSON-LD"
description: "6 lỗi còn lại của block service-cards: icon emoji string, thiếu empty state, WCAG fail, list variant rời, featured fragment, Service JSON-LD"
status: pending
priority: P2
effort: 5-6h
branch: chore/F01-remaining-plans
tags: [service-cards, bugfix, wix-rebuild]
created: 2026-04-15
---

# Service Cards — Sửa các lỗi còn lại

## Bối cảnh
Block `service-cards` là block mới sinh ra từ vòng rebuild này, chưa có trong scorecard researcher-01. Khi render thì đã ra đúng layout và đúng token màu, nhưng chất lượng icon + empty state + SEO + accessibility chưa đạt mức Wix. 6 lỗi bên dưới ảnh hưởng trực tiếp đến polish score + search ranking.

## Phạm vi
Chỉ fix phần render + config + accessibility + JSON-LD. KHÔNG đụng layout tổng thể của variants, KHÔNG thêm variants mới trong vòng này.

## Danh sách lỗi cần fix

### Lỗi A — `service.icon` là string emoji thay vì lucide icon (1.5h, P2)
**File**: `src/blocks/service-cards/index.tsx`
**Vấn đề**: field icon hiện đang render `{service.icon}` như text, composer gen ra emoji (🚀, 💡). Mỗi site khác nhau font emoji khác nhau → nhìn không nhất quán, không scale theo brand.
**Cách sửa**:
1. Đổi `service.icon` schema từ `z.string()` sang `z.enum([...LUCIDE_ICON_KEYS])`.
2. Map key → component trong `src/lib/icons/lucide-map.ts` (tạo nếu chưa có).
3. Render bằng `<LucideIcon name={service.icon} className="h-8 w-8" style={{ color: 'var(--primary)' }} />`.
4. Composer: cập nhật `buildServiceCards` để pick icon key theo category từ `SERVICE_ICON_BY_CATEGORY`.

**Kiểm tra**: gen 3 site ở 3 category khác nhau → icon render ra lucide, không còn emoji.

---

### Lỗi B — Thiếu empty state khi `services.length === 0` (15 phút, P2)
**File**: `src/blocks/service-cards/index.tsx`
**Vấn đề**: nếu composer trả về mảng rỗng (do AI gen fail hoặc category không có service), block render ra grid trống toang → trông như bug.
**Cách sửa**: early return null nếu `!services?.length`. Consistent với pattern ở `faq` và `testimonials`.
**Kiểm tra**: pass `services: []` vào story/test → block không render.

---

### Lỗi C — List variant mobile align rời (30 phút, P2)
**File**: `src/blocks/service-cards/index.tsx` (variant `list`)
**Vấn đề**: ở breakpoint 375px, icon + title + description dùng `flex-row` mặc định, text wrap awkward, icon bị push lên đầu không align với title.
**Cách sửa**: thêm `flex-col sm:flex-row` + `items-start sm:items-center` + `gap-3 sm:gap-4` cho list item wrapper. Icon container dùng `shrink-0`.
**Kiểm tra**: resize devtools xuống 375px, mở template có list variant → icon + title căn đẹp, không tràn.

---

### Lỗi D — `opacity-50` trên text fail WCAG (15 phút, P1)
**File**: `src/blocks/service-cards/index.tsx`
**Vấn đề**: description có chỗ dùng `opacity-50 text-white` trên nền dark → contrast ratio ~2.5:1, WCAG AA yêu cầu 4.5:1.
**Cách sửa**: thay `opacity-50` bằng `text-[color:var(--text-muted)]` (token đã define trong design-tokens). Nếu variant đặc biệt cần mờ hơn → dùng `opacity-70` tối thiểu (ratio ~3.8:1 vẫn fail AA nhưng pass AAA large text).
**Kiểm tra**: chrome devtools → inspect description → contrast ratio ≥ 4.5:1.

---

### Lỗi E — Featured fragment không stagger animation (1h, P3)
**File**: `src/blocks/service-cards/index.tsx` (variant `featured`)
**Vấn đề**: biến thể featured có fragment nhóm "featured service" ra giữa + "other services" ra dưới, nhưng cả 2 fragment dùng cùng `StaggerGrid` → featured và other item animate cùng lúc, không có nhịp.
**Cách sửa**: wrap featured bằng `<AnimatedSection>` riêng với `delay: 0`, others dùng `StaggerGrid` với `baseDelay: 0.3`. Tạo visual beat.
**Kiểm tra**: reload page có featured variant → featured card vào trước, others vào sau 0.3s.

---

### Lỗi F — Service JSON-LD schema missing (1.5h, P2)
**File**: `src/blocks/service-cards/index.tsx` + `src/lib/seo/json-ld.ts`
**Vấn đề**: block không emit schema.org `Service` markup → Google không hiểu đây là danh sách dịch vụ, mất cơ hội rich snippet.
**Cách sửa**:
1. Thêm helper `buildServiceSchema(services, businessName)` trong `src/lib/seo/json-ld.ts` (pattern giống existing `buildOrganizationSchema`).
2. Trong component, render `<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />` ở cuối block.
3. Mỗi service → `{ "@type": "Service", "name": ..., "description": ..., "provider": { "@type": "Organization", "name": businessName } }`.

**Kiểm tra**: view source của page có block này → thấy `"@type": "Service"`. Test với Google Rich Results Test.

---

## Thứ tự làm
1. **Lỗi B** (15 phút) — early return empty
2. **Lỗi D** (15 phút) — opacity fix WCAG
3. **Lỗi C** (30 phút) — list variant mobile align
4. **Lỗi E** (1h) — featured stagger beat
5. **Lỗi A** (1.5h) — lucide icon system
6. **Lỗi F** (1.5h) — JSON-LD schema

Tổng: **~5-6 giờ**.

## Tiêu chí hoàn thành
- [ ] Icon render bằng lucide component, không còn emoji string
- [ ] `services: []` → block return null, không render container trống
- [ ] List variant ở 375px: icon + text align, không tràn
- [ ] Description contrast ratio ≥ 4.5:1 (WCAG AA)
- [ ] Featured fragment có delay 0.3s so với others
- [ ] View source có `<script type="application/ld+json">` chứa `"@type": "Service"`
- [ ] `npx tsc --noEmit` sạch
- [ ] Unit tests existing vẫn pass

## Rủi ro
- **Lỗi A**: đổi schema từ string sang enum là breaking change. Nếu DB đã có data cũ icon emoji → migration phải map emoji → lucide key, hoặc zod schema fallback khi parse fail.
- **Lỗi F**: nếu JSON-LD sai format → Google có thể penalize SEO. Phải test trước với Rich Results Test tool.

## Câu hỏi còn bỏ ngỏ
1. Icon set nào — lucide hay heroicons? Nav dùng lucide → nên đồng bộ.
2. Service JSON-LD có cần `areaServed` / `offers.price` không? Hiện composer chưa gen giá → có thể defer.
