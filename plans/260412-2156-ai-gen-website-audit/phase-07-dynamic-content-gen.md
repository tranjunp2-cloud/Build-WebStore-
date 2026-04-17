# Phase 07 — Dynamic Content Gen từ Form Input (Stub)

> Parent: [plan.md](./plan.md) (Plan A — AI Variety Audit)
> Status: **planned, not yet detailed** | Priority: P2 | Effort: TBD (estimate 6-10h)
> Depends on: Phase 06 (composer unify must be done first)
> Created: 2026-04-14

## Vấn đề Phase 07 giải quyết

Phase 06 unify fallback path với composer, NHƯNG content vẫn pre-curated từ `src/lib/ai/content/{category}.ts`. Hệ quả:

- 2 user mở cùng 1 cafe → cùng menu (Pad Thai/Tom Yum) vì pick từ cùng `BusinessSample`
- 1 cafe Italian → vẫn nhận menu Pad Thai vì composer chọn random sample, không match cuisine
- User nhập `products: "coffee, milk tea, pastries"` trong form → fallback ignore, dùng menu canned
- User nhập `description: "Family bakery since 2020 in District 1"` → fallback ignore detail, dùng about body canned

→ Personalization chỉ ở mức **business name + theme color**. Content (menu items, services, FAQ, team, about body) vẫn generic theo sample.

## Mục tiêu

Trong fallback path, **parse structured form input** (BusinessInfo từ builder) để generate personalized content theo rule-based logic, KHÔNG cần LLM call:

| Form field | Block enrichment |
|---|---|
| `products: "coffee, milk tea, pastries"` | Split commas → 3 menu items + 3 service cards + 3 features |
| `services: "haircut, color, treatment"` | 3 service cards + 3 pricing tiers |
| `description: "Family bakery since 2020 in D1"` | Extract year (2020) → about timeline; location (D1) → contact + footer; "family-owned" → personality keyword |
| `phone, email, address` | Inject vào contact block thay vì sample data |
| `tagline` (nếu có) | Override hero subheadline |
| `targetAudience` | Filter testimonials cho đúng demographic |
| `tone: 'professional' \| 'friendly' \| 'luxury'` | Bias variant selection + CTA copy |

## High-level approach (chưa final)

1. **Form data extraction** — `extractBusinessFacts(formInput): BusinessFacts`
   - Parse comma-separated lists (products, services, features)
   - Extract years from description (regex `since (\d{4})`, `est. (\d{4})`)
   - Extract location keywords
   - Detect personality from adjectives ("luxury", "family", "modern")

2. **Per-block content enrichment** — `enrichBlock(block, facts): block`
   - menu-display: replace items with parsed products
   - service-cards: replace services with parsed services
   - features: replace features with parsed list (top 6)
   - about: synthesize body từ description + extracted facts
   - contact: inject real phone/email/address
   - faq: generate from product/service questions
   - team: KEEP canned (user uploads team via form sau)
   - testimonials: KEEP canned (user adds reviews via form sau)
   - hero: subheadline = tagline OR first sentence of description

3. **Run order** — `composeFallbackResult` calls composer first → then `enrichBlocks(result.blocks, formFacts)` post-process

4. **Test coverage** — 5-10 sample form inputs per category, snapshot test that enriched blocks contain parsed user data

## Out of scope (cho Phase 08+)

- Local LLM (Llama, Qwen) on-device for true generation
- Image generation từ prompt (vẫn dùng Unsplash stock fallback)
- Multi-language content gen (form input parse trong 1 ngôn ngữ at a time)
- Complex grammar rephrasing (vd "coffee" → "premium artisan coffee blends")

## Trigger điều kiện

Phase 07 sẽ được plan đầy đủ KHI:
1. Phase 06 đã ship + verified working trên staging
2. Real user feedback xác nhận Group 3 bugs (E menu items + G FAQ) là pain point
3. Có thời gian dev (~6-10h)

## Action item

- [ ] Sau khi Phase 06 done + merged → run `/plan:hard "phase 07 dynamic content gen từ form input parse"` để generate full plan với researchers
- [ ] Verify với user còn ưu tiên Phase 07 không (có thể OpenAI quota stable → fallback ít quan trọng)

## Related research

- `research/researcher-03-fallback-shape-adapter.md` Q3 — `BusinessSample` shape (no products[] array) → Phase 07 cần extend BusinessSample type to include products/services from form
- Plan A Phase 02 system prompt research — already extracts `selectPersonality(info)` từ form input → reuse cho Phase 07 personality detection
