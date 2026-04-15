# Phase 01 — Research, Architecture, Template Taxonomy

## Context links
- **Parent**: [plan.md](./plan.md)
- **Dependencies**: none (Phase 01 is foundation)
- **Primary reference**: `docs/journals/260415-ai-gen-vs-template-composer-research.md`
- **Comparison data**: `plans/260414-2253-ai-gen-variety-root-cause/reports/comparison-ai-vs-template.md`

## Overview
- **Date**: 2026-04-15
- **Description**: Lock scope + data model + taxonomy before code. Research Wix/Shopify/Squarespace template approaches, interview 3-5 users về "what makes templates feel professional", design new TemplateEntry schema that replaces current ComposerInput + TemplatePreset, propose 40 sub-niche taxonomy expansion.
- **Priority**: P0 (blocks all subsequent phases)
- **Implementation status**: pending
- **Review status**: not reviewed
- **Effort**: 1 week (4-5 working days)

## Key Insights
- **Don't skip research**: rebuild without understanding what "quality" means to users = building wrong thing. Spend 2-3h per user interview, 3-5 users = 10-15h well-invested
- **Sub-niche matters**: `health` category covers dental, spa, pharmacy, pediatric — each has different UX norms. Generic `health` template feels generic everywhere. 40 sub-niches = much better fit
- **Schema-first**: define TemplateEntry Zod schema + Payload collection migration plan BEFORE writing authoring tool code

## Requirements
- Write research document: "Wix ADI architecture deep-dive" covering: wizard steps, template count, personalization mechanism, fallback behavior
- Complete 3-5 user interviews (10-15min each) on current AI gen output + show Wix samples → capture what they notice
- Define `TemplateEntry` schema:
  - `id, slug, category, subNiche, tier, theme, pages[], tags[], previewImage, version, status (draft/published), author, createdAt`
  - Replace existing `ComposerInput` + `TemplatePreset` + `SEED_TEMPLATES`
- Propose sub-niche taxonomy (target: 40 sub-niches total across 14 parent categories)
- Propose Payload collection migration: new `templates-v2` collection or extend existing `templates`
- Define feature flag approach (rollout Phase 07)

## Architecture

### Current state
```
categories (14) — coarse
TEMPLATE_PRESETS (50) — flat array
SEED_TEMPLATES (25) — hand-written TS
template-composer — 28 builder functions with category switches
```

### Target state
```
categories (14 parent) → subNiches (40) — tree
templates table (500+ target) — Payload collection
each template:
  - Fully-authored via admin tool (Phase 02)
  - Pages + blocks hardcoded (no runtime composition)
  - Preview image + metadata for ranking
  - Version + draft/publish workflow
```

### Data model draft
```ts
interface TemplateEntry {
  id: string                     // payload auto
  slug: string                   // 'dental-modern-clinic-001'
  parentCategory: 'health'       // 1 of 14
  subNiche: 'dental-clinic'      // 1 of 40
  tier: 'free' | 'premium'
  tags: string[]                 // ['modern', 'blue', 'appointment-heavy']
  previewImage: MediaId          // thumbnail for gallery
  theme: ThemePreset             // locked at template level
  pages: TemplatePage[]          // hand-curated
  searchableContent: string      // for ranking (denormalized)
  version: number
  status: 'draft' | 'published'
  authorId: string               // Payload user
  createdAt: Date
  updatedAt: Date
}
```

## Related code files
- `src/lib/ai/template-definitions.ts` — current `TEMPLATE_PRESETS`, `CategoryDna` (deleted)
- `src/lib/ai/seed-templates.ts` — `SEED_TEMPLATES` to migrate
- `src/lib/ai/template-composer.ts` — 28 builders to reuse for tool preview
- `src/lib/ai/category-recipes.ts` — 42 recipes (reference for sub-niche inspiration)
- `src/collections/Templates.ts` (if exists) — Payload collection to extend
- Wix ADI public docs + engineering blog posts

## Implementation Steps
1. Wix ADI architecture research (2h):
   - Read engineering blog, public docs, screenshots of wizard flow
   - Identify: wizard step count, template count per industry, personalization trigger points
   - Output: `research/researcher-01-wix-architecture.md`
2. Competitor scan (1h):
   - Shopify theme store architecture
   - Squarespace template count + selection flow
   - Webflow template library
   - Output: append to researcher-01 doc
3. User interview prep (1h):
   - 5 questions focused on "what feels professional" not "what do you want"
   - Show side-by-side screenshots of current AI gen output + Wix sample
4. User interviews (3-5 × 15min = 1.5h total)
   - Beta test users or prospect users
   - Record pain points on current output
   - Output: `research/researcher-02-user-interviews.md`
5. Sub-niche taxonomy design (3h):
   - List 14 parent categories
   - Brainstorm 2-4 sub-niches per category
   - Validate against interview data
   - Output: `reports/subniche-taxonomy.md` — 40 sub-niches
6. Data model design (3h):
   - `TemplateEntry` TypeScript + Zod schema
   - Payload collection migration script draft
   - Sample 5 template entries in JSON format
   - Output: `reports/template-entry-schema.md`
7. Review gate with anh (30min): present taxonomy + schema, confirm before Phase 02 starts

## Todo list
- [ ] Write Wix architecture research (≤150 lines)
- [ ] Scan competitors (Shopify, Squarespace, Webflow)
- [ ] Prep + conduct 3-5 user interviews
- [ ] Design 40 sub-niche taxonomy
- [ ] Define TemplateEntry schema + Payload migration plan
- [ ] Review gate with anh Nhan

## Success Criteria
- Research doc <150 lines, cites ≥3 external sources
- User interview summary identifies ≥5 concrete "professional" indicators
- Sub-niche taxonomy has 40 items, each has ≥1 user persona
- TemplateEntry schema passes Zod `safeParse()` on 5 sample JSON entries
- Anh confirms taxonomy + schema before Phase 02 starts

## Risk Assessment
- **User interviews may reveal need is different from scoped solution** — mitigation: keep timebox 1 week, fail fast if rebuild direction wrong
- **Sub-niche count may be wrong** — mitigation: launch with 40, add more as data shows need
- **Schema lock-in** — mitigation: version field + migration plan from day 1

## Security Considerations
- User interview recordings (if captured) must follow data retention policy
- Template schema fields must not leak user credentials

## Next steps
- Phase 02 (authoring tool) picks up schema + taxonomy
- Phase 03 (library v1) uses schema to author 100 templates
- Phase 04 (wizard UI) reads sub-niche taxonomy for wizard steps
