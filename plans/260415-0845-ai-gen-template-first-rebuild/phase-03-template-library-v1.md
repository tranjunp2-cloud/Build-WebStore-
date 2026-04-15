# Phase 03 — Template Library v1 (100 curated templates)

## Context links
- **Parent**: [plan.md](./plan.md)
- **Depends on**: Phase 02 (authoring tool ready)
- **Parallel with**: Phase 04 (wizard UI — different skill, can run simultaneously)

## Overview
- **Date**: 2026-04-15
- **Description**: Author 100 hand-curated TemplateEntry records cho 5 hottest categories (beauty, restaurant, health, tech, business) × 20 sub-niches × ~3 templates/sub-niche. Designer + developer collaboration. Mostly designer work with developer support for block-level tweaks.
- **Priority**: P0 (blocks measurement + rollout)
- **Implementation status**: pending
- **Review status**: not reviewed
- **Effort**: 4 weeks (designer primary, ~5h per template × 100 = 500h solo OR split across 2-3 designers)

## Key Insights
- **100 templates = bare minimum for Wix-parity feel** — below that, users see same template twice too quickly. Wix has 900+, but 100 for 5 categories is enough for v1 launch.
- **Sub-niche diversity > category breadth** — 20 templates cho dental (sub-niches: family clinic, cosmetic, pediatric, orthodontist, surgical) feels richer than 20 templates spread across `health`.
- **Content quality > quantity** — reuse template-composer curated content (Malaysian-specific) as starting point for every new template, then designer polishes.
- **Photography drives perception** — 3 hero images per template from Unsplash premium (or curated local stock) = 50% of "looks premium" feeling.

## Requirements
- 100 TemplateEntry records published
- Category split (based on Phase 01 interviews):
  - Beauty: 25 (5 sub-niches × 5 templates) — spa/nails/hair/makeup/skincare
  - Restaurant: 20 (4 sub-niches × 5) — fine-dining/cafe/fast-food/bakery
  - Health: 25 (5 sub-niches × 5) — dental/gp/cosmetic/pediatric/wellness
  - Tech: 15 (3 sub-niches × 5) — saas/agency/consulting
  - Business: 15 (3 sub-niches × 5) — legal/accounting/marketing-agency
- Every template:
  - Complete 5 pages (Home + 4 sub-pages)
  - ~10-12 blocks per homepage (no stubs)
  - Fully curated content — no "Lorem ipsum", no "Team Lead" placeholders
  - Premium hero image (Unsplash curated or custom)
  - Mobile-responsive validated
  - Theme locked at template level (color + font)
- QA checklist per template (Phase 07 gate)

## Architecture

### Content sourcing strategy
```
For each template, start from template-composer curated content:
  - buildFeatures(biz, category)  → hand-curated features
  - buildStats(category)          → category-specific stats
  - buildPricing(category)        → RM pricing, localized
  - buildTeam(category)           → Malaysian names + credentials
  - buildTestimonials(content)    → curated testimonials
  - buildFAQ(content)             → curated FAQs

Designer polishes:
  - Swap 1-2 features to match sub-niche (dental ≠ spa features)
  - Swap pricing tiers to match target market segment
  - Swap team bios to match sub-niche (dentist ≠ physiotherapist credentials)
  - Pick preview image matching brand mood
  - Tune color + font to differentiate from other templates in same sub-niche
```

### Designer workflow
```
1. Open admin tool (Phase 02)
2. Click "New template" → select category + sub-niche
3. Tool pre-populates blocks from template-composer curated content
4. Designer swaps/polishes content + image + theme
5. Save as draft
6. Preview mobile + desktop
7. Publish when reviewed
```

### Resource allocation
- **Option A**: Anh + em 100 templates × 5h = 500h solo → 12 weeks full-time. Too slow.
- **Option B**: Hire 1 contractor designer, 100 × 4h = 400h → 10 weeks. Realistic.
- **Option C**: Hire 2-3 contractors in parallel → 3-5 weeks. Fastest, highest cost.

Phase 01 decides resource.

## Related code files
- `src/lib/ai/template-composer.ts` — ~280 curated content builders (starting point)
- `src/lib/ai/content/*.ts` — 14 category content files
- `src/lib/ai/theme-presets.ts` — 112 presets to assign
- `src/lib/ai/font-pairings.ts` — 25 font pairs to assign
- Phase 02 admin tool — authoring UI
- Unsplash API + curated collection (premium) if budget allows

## Implementation Steps
1. Pre-populate template skeleton from composer (1 day engineering):
   - Script: take (category, sub-niche, businessIndex) → generate draft TemplateEntry
   - Designer starts from draft instead of blank
2. Designer onboarding (1 day):
   - Tool walkthrough
   - Content quality standards doc
   - Review checklist
3. Parallel authoring (4 weeks designer work):
   - Beauty batch: 25 templates, week 1
   - Restaurant batch: 20 templates, week 1-2
   - Health batch: 25 templates, week 2-3
   - Tech batch: 15 templates, week 3
   - Business batch: 15 templates, week 3-4
4. Weekly review gates (em + anh):
   - Sample 5 random templates per batch
   - Reject if quality below bar → re-author
5. Final QA pass (3 days):
   - Full 100-template review
   - Mobile check
   - Published status
6. Import to production DB (1 day):
   - Publish workflow via admin tool

## Todo list
- [ ] Write content quality standards doc
- [ ] Build template skeleton pre-population script
- [ ] Designer onboarding (tool + standards)
- [ ] Author 25 beauty templates
- [ ] Author 20 restaurant templates
- [ ] Author 25 health templates
- [ ] Author 15 tech templates
- [ ] Author 15 business templates
- [ ] Weekly review gates (4 weeks)
- [ ] Final QA pass
- [ ] Import all 100 to production DB

## Success Criteria
- 100 TemplateEntry records published (not draft)
- All 20 sub-niches have ≥3 templates each
- Every template passes QA checklist:
  - No placeholder content
  - 5 complete pages
  - Mobile responsive
  - Theme locked
  - Preview image premium quality
- Spot-check: 10 random templates rate ≥8/10 on internal QA

## Risk Assessment
- **Designer bandwidth** — highest risk, may slip timeline. Mitigation: hire 2 contractors instead of 1.
- **Quality drift over batches** — designer fatigue → later batches lower quality. Mitigation: weekly review gates.
- **Content staleness** — Malaysia-specific content (FPX rates, Insurance panels) may become stale. Mitigation: add `contentReviewedAt` field to schema, set 6-month review reminder.
- **Preview image licensing** — premium Unsplash may hit rate limits or licensing issues for commercial use. Mitigation: validate license terms in Phase 01 research; fallback to free tier or hire photographer.

## Security Considerations
- Template content indexed in Payload — searchable public. Don't include internal notes in content fields.
- Audit log every publish action

## Next steps
- Phase 04 (wizard UI) uses templates for gallery
- Phase 05 (matching engine) ranks these templates
- Phase 07 (rollout) measures user picks from this library
