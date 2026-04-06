---
title: "Premium Template Blueprints — Category DNA"
description: "30 premium templates (3/category), mỗi ngành có DNA riêng: block combo, section order, visual mood đặc trưng"
status: done
priority: P1
effort: 2d
branch: staging-2
tags: [templates, blueprints, category-dna, premium]
created: 2026-04-06
---

# Premium Template Blueprints — Category DNA

## Related Docs (PHẢI ĐỌC trước khi implement)
- **PRD**: [`docs/prd/F31-template-blueprints.md`](../../docs/prd/F31-template-blueprints.md) — 15 FRs, 14 ACs, 8 NFRs
- **Standards**: [`docs/standards/WEBSITE_TEMPLATE_STANDARDS.md`](../../docs/standards/WEBSITE_TEMPLATE_STANDARDS.md) — SEO, CRO, animations
- **QA Test Plan**: `docs/qa/F31-template-blueprints.md` (chưa có — chạy `/docs-project:qa` sau)

⛔ **Cook PHẢI đọc PRD + Standards trước khi code.**

## Prerequisite
Bước 1 (gạch) xong trước — blocks đều đẹp.

## Problem
48 templates cũ chia tier (starter/professional/premium) nhưng nhìn giống nhau.
Anh muốn: **TẤT CẢ premium, đa dạng, đặc trưng từng ngành rõ ràng.**

## Solution — Category DNA
Mỗi ngành có "DNA" riêng gồm 5 yếu tố:
1. **Signature blocks** — blocks chỉ ngành đó mới có (menu cho restaurant, booking cho health...)
2. **Section order** — thứ tự blocks theo conversion flow của ngành
3. **Visual mood** — warm/dark/minimal/bold + color palette + font style
4. **Content style** — RM pricing, MY locale, industry-specific copy
5. **Page set** — pages phù hợp ngành (Menu page cho restaurant, Gallery cho beauty...)

**TẤT CẢ templates đều premium** — 4-5 pages, feature-rich, không có tier.

## Phases

| Phase | Task | Effort | Files | Status |
|-------|------|--------|-------|--------|
| [01](phase-01-category-dna.md) | Define Category DNA cho 14 ngành (11 cũ + 3 mới) | 3h | `template-definitions.ts` | done |
| [02](phase-02-blueprint-type.md) | Rewrite TemplatePreset type + composer | 3h | `template-definitions.ts` + `template-composer.ts` | done |
| [03](phase-03-fifty-six-blueprints.md) | 56 premium blueprints (4/category × 14) + unique sub-pages | 8h | `template-definitions.ts` | done |
| [04](phase-04-seed-verify.md) | Seed + verify all 56 render | 2h | `seed/route.ts` | done |

> **Lưu ý:** SEO layer (JSON-LD, heading hierarchy, image optimization) ĐÃ TÁCH ra khỏi plan này.
> SEO sửa block components + SiteRenderer = **gạch**, không phải nhà.
> SEO metadata (meta title/description per page) vẫn nằm trong composer (Phase 2).
> Xem `docs/standards/WEBSITE_TEMPLATE_STANDARDS.md` Section 3 + `phase-04-seo-schema.md` (reference only).

## Key Files
| File | Change |
|------|--------|
| `src/lib/ai/template-definitions.ts` | Rewrite: Category DNA + 30 blueprints |
| `src/lib/ai/template-composer.ts` | Simplify: blueprint-driven + SEO schema injection |
| `src/lib/ai/content/*.ts` | Minor: thêm page-specific content nếu cần |
| `src/app/api/templates/seed/route.ts` | Update seed cho blueprint format |
| `src/components/site-renderer/SiteRenderer.tsx` | SEO: JSON-LD injection, heading hierarchy |

## Validation Summary

**Validated:** 2026-04-06
**Questions asked:** 6

### Confirmed Decisions

| # | Decision | User Choice |
|---|----------|-------------|
| 1 | Số lượng categories | **14 ngành** — 11 cũ + Events/Wedding, Blog/Media, Travel/Tourism |
| 2 | Số lượng templates | **56 templates** — 4 per category × 14 |
| 3 | Sub-pages | **Unique per template** — mỗi template có blueprint riêng cho tất cả sub-pages |
| 4 | Design rule exceptions | **Strict** — mọi template PHẢI có logo-cloud, FAQ, mid-CTA, newsletter. Không exception. |
| 5 | Templates per category | **4 per category** — 4 personalities: warm, dark, minimal, bold |
| 6 | Old templates | **Xóa 48 cũ** — seed 56 mới, không giữ templates cũ |

### Action Items (cần update phase files)
- [x] Phase 1: Thêm DNA cho 3 categories mới (Events/Wedding, Blog/Media, Travel/Tourism)
- [x] Phase 1: Thêm content files cho 3 categories mới (`src/lib/ai/content/events.ts`, `blog.ts`, `travel.ts`)
- [x] Phase 1: Thêm theme presets cho 3 categories mới (5 presets/category = 15 presets mới)
- [x] Phase 3: Tăng từ 30 → 56 blueprints (4/category × 14)
- [x] Phase 3: Mỗi template có FULL sub-page blueprints (unique, không shared)
- [x] Phase 3: Tổng page blueprints: 56 templates × 4-5 pages = ~250 page blueprints
- [x] Phase 3: Strict enforcement — logo-cloud, FAQ, mid-CTA, newsletter trên MỌI homepage
- [x] Phase 4: Update verify count 56 (không phải 30)

## Standards Reference
Full doc: `docs/standards/WEBSITE_TEMPLATE_STANDARDS.md`

## Chuẩn Template (từ Wix/Envato/SEO research)
**Homepage flow chuẩn:** nav → hero → trust-bar → features → industry → stats → gallery → testimonials → mid-CTA → pricing → FAQ → blog-preview → newsletter → contact → footer
**SEO bắt buộc:** 1 H1/page, JSON-LD (Organization, BreadcrumbList, FAQPage), canonical, meta tags
**CRO:** CTA ở 5 vị trí (hero, after features, mid-page, after testimonials, footer)
**Animation:** scroll fade-in, stagger cards, counter stats, respect prefers-reduced-motion
