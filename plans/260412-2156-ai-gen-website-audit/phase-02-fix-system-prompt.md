# Phase 02: Fix System Prompt for Variety

## Context
- Parent: [plan.md](plan.md)
- File: `src/lib/ai/system-prompt.ts` (176 → 403 lines)
- Status: **done** ✅
- Commit: `beffa9b`

## Implemented Changes

### 2.1 PROFESSIONAL DESIGN RULES (research-backed)
Nguồn: Anthropic Claude Cookbook, Impeccable (15K GitHub stars), v0 Vercel, CRO Research

| Rule | Chi tiết |
|------|---------|
| Hero Section | Headline 5-8 words, subheadline 12-20 words, 1 primary CTA (action verb + benefit) |
| Color 60-30-10 | 60% neutral surface, 30% secondary, 10% accent (CTA only). Never pure #000000 |
| Typography | 2 fonts, contrast axes (serif+sans). Cấm Inter+Inter, DM Sans+DM Sans |
| Section Ordering | AIDA funnel, CTA mỗi 3-4 sections, xen kẽ text-heavy/visual-heavy |
| Anti-Patterns | Cấm purple gradient, cards-in-cards, "Welcome to our website", same font heading+body |

### 2.2 Context-Aware Style Personalities
- 8 personalities với keyword matching từ user input
- `selectPersonality(info)`: phân tích businessName + industry + products + description
- Top 3 matching personalities → random 1 → inject vào user prompt
- Skip khi reference mode (tạo lại từ URL)

### 2.3 Dynamic Composition Hints
- `generateCompositionHint(category)`: tạo bố cục MỚI mỗi lần gọi
- `CATEGORY_SIGNATURE_BLOCKS`: 14 categories × 2-3 signature blocks
- `HERO_VARIANTS_BY_CATEGORY`: 14 categories × 5 preferred hero variants
- Common block pool + shuffle → vô hạn combinations

### 2.4 VARIETY RULES (7 rules)
- Never default to first variant
- Vary hero (12), features (8), testimonials (8), footer (6), contact (6)
- Include ≥1 uncommon block (step-process, before-after, countdown-timer...)
- Block order must vary
- VARIANT MOOD MAPPING: dramatic→fullscreen, professional→centered, creative→magazine
