---
date: 2026-04-19
author: dev (with PM discussion)
tags: [template, ai-gen, quality, F01]
related-plans:
  - plans/260419-2155-GH-1-template-quality-audit/
  - plans/260419-2022-GH-1-harness-template-block-sync-flow/
---

# Template gen — why outputs look similar (analysis + deferred roadmap)

PM observation (2026-04-19): "Các template đang giống nhau."

## Bối cảnh

Harness `npm run harness:gen` sinh 390 fixture từ 56 blueprint + 22 legacy cat-variant cells × 5 seeds. Khi anh rà output qua `/test-harness/[fixtureId]` + dashboard `/templates-health`, cảm nhận templates trùng lặp nhiều. Phân tích xác nhận — không phải cảm nhận sai.

## 5 nguyên nhân cấu trúc

### 1. Preset pool mỏng (4/cat)
- 56 blueprint / 14 category = ~4 blueprint/cat (blog + events chỉ 3)
- Hardcode: `src/lib/ai/template-presets-batch1.ts` (20), `batch2.ts` (20), `batch3.ts` (16)
- 1 user restaurant tối đa thấy 4 layout khác nhau

### 2. Seed xoay nông
- `compositionSeed` từ `scripts/test-harness/matrix.ts:seedFromString()` deterministic
- Ảnh hưởng: variant pick (hero/features/footer) + shuffle 2-3 middle blocks
- KHÔNG ảnh hưởng: content text, image keyword, recipe rhythm, theme
- Cùng seed + businessIndex → output giống hệt 100%

### 3. Content pool nhỏ
- 8-9 business sample per category trong `src/data/`
- 6 client logos "Partner 1-6" placeholder giống nhau mọi ngành
- Testimonials pool ~5-10/cat
- Copy text dùng chung content pack per category

### 4. Recipe rhythm ít đa dạng
- `src/lib/ai/category-recipes.ts` có 3 rhythm: story-first, menu-first, gallery-first
- Không phải category nào cũng có đủ 3 — hầu hết mặc định `hero → features → testimonials → cta → footer`

### 5. Image pipeline trùng
- Unsplash keyword search (`src/lib/ai/unsplash-*`) trả về cùng top-20 ảnh cho cùng query
- Hero/gallery images thường trùng giữa template cùng ngành

## Vai trò AI vs preset (quan trọng)

```
User input (business name, industry, vibe)
    ↓
AI CHỈ personalize text + CTA label
    ↓
Block sequence + theme + variant đã fix sẵn trong preset
```

2 user cùng ngành → thấy khung giống hệt, chỉ khác chữ. AI không đổi cấu trúc.

## Subscription tier ≠ template variant (hay nhầm)

- `SubscriptionPlan` (`src/lib/ai/config.ts:126`) = `free|starter|pro|business` → chỉ dùng cho `RATE_LIMITS` (số gen/tháng)
- `variant` trong preset type (`starter|professional|premium`) = complexity label, KHÔNG phải subscription
- Tất cả 56 blueprint đều `premium`
- F13 Payment (Phase 2) sẽ tie plan với quota/custom domain/SEO — KHÔNG với template selection

## Roadmap 4 tầng (DEFERRED theo quyết định PM 2026-04-19)

PM priority hiện tại: **fix chất lượng 56 blueprint hiện có trước**, không expand số lượng. Roadmap giữ lại để tham chiếu tương lai:

| Tầng | Hiện tại | Future target |
|------|---------|---------------|
| Preset count | 4/cat | 8-10/cat |
| Content pool | 8-9 sample | 20+ sample + AI generate fresh per gen |
| Variant selection | Seed-deterministic | User vibe/mood → variant |
| Theme preset | 3-4/cat | 8-10/cat + user color pick |
| Image pipeline | Unsplash top-20 | AI-gen Nano Banana per business |
| Subscription tier | Không tie | Free=2 preset/cat, Pro=full, Business=AI-custom |

## Next step (PM directive 2026-04-19)

Chuyển sang workflow **audit + fix từng blueprint**. Plan mới được tạo riêng để:
- Review visual từng cái trong 56 blueprint
- Triage OK / minor / major
- Fix preset definition + content pack + variant selection per blueprint
- Deliver "ít nhưng chuẩn" trước khi expand

Plan path: `plans/260419-2231-GH-1-per-template-quality-fix/` (sẽ tạo).
