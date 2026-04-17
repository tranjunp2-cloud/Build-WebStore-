# Research: Design Quality Rules for AI Website Generation

## Sources
- Anthropic Claude Frontend Aesthetics Cookbook
- Impeccable Design Skill (15K+ GitHub stars, by Paul Bakaus)
- v0 by Vercel — Design System approach
- Web Design Research (AIDA, 60-30-10, 8px grid)
- CRO Research (6-word headlines, single CTA/viewport, 48px touch)

## Key Findings

### "AI Slop" Problem
LLMs tạo design trung bình — median training data:
- Purple/indigo gradients (Tailwind defaults)
- Inter font mọi nơi
- Three-box icon grid
- Cards lồng cards
- Gray text trên colored backgrounds

**Fix: Constraints > encouragement.** Cấm cụ thể + encode rules chuyên nghiệp.

### 5 Patterns Từ Top Builders

1. **Guide specific dimensions** — typography, color, motion riêng biệt (Anthropic)
2. **Reject reflex defaults** — cấm Inter+Inter, purple gradient (Impeccable)
3. **Closed token layer** — AI chọn từ set cố định, không đoán (v0)
4. **OKLCH color space** — perceptually uniform, tint neutrals (Impeccable)
5. **Structured specs** — 8 sections per component, machine-readable (Hardik Pandya)

### Concrete Rules

**Color:** OKLCH > HSL, tint neutrals toward brand, 60-30-10, never pure black
**Typography:** 1.25 modular scale, max 2 fonts, contrast axes, min 16px body
**Spacing:** 8px grid (8,16,24,32,48,64,96), gap > margin, card padding < section spacing
**Ordering:** AIDA funnel, CTA mỗi 3-4 sections, alternate text/visual
**CTA:** 48px min height, action verb + benefit, single CTA/viewport
**Anti-patterns:** purple gradient, Inter+Inter, nested cards, "Click Here"
