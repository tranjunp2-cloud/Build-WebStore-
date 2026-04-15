# Phase 06 — Personalization Layer

## Context links
- **Parent**: [plan.md](./plan.md)
- **Depends on**: Phase 05 (user has picked template via matching engine)

## Overview
- **Date**: 2026-04-15
- **Description**: Take user-picked TemplateEntry + WizardAnswers.businessInfo → produce personalized Site ready to save. AI is limited to NARROW tasks: business name injection, image selection, SEO metadata. NO content generation. This is where ech-prime differs from current AI gen path.
- **Priority**: P0
- **Implementation status**: pending
- **Review status**: not reviewed
- **Effort**: 3-5 days

## Key Insights
- **AI does narrow tasks only** — (1) replace "Demo Dental Clinic" with user's businessName, (2) pick hero images from Unsplash matching template style, (3) generate 60-char SEO title. That's it. No features, no pricing, no team bios.
- **95% template content stays** — only strings mentioning businessName swap. Features/stats/pricing/team fully preserved from template.
- **Image selection is ranking, not generation** — Unsplash search → filter by template style tags → pick top 3. Similar to Phase 05 matching engine.

## Requirements
- POST `/api/templates/personalize` endpoint
- Input: `{ templateId, businessInfo, logoMediaId? }`
- Output: new Site + Pages ready for Payload save
- Personalization steps:
  1. Deep-clone template.pages[]
  2. String replacement: `[businessName]` placeholder → `businessInfo.name`
  3. Inject user's phone/email/address if provided (into contact block only)
  4. Image selection: Unsplash search by template tags + businessInfo.category → pick 3 photos → upload to Media collection
  5. SEO metadata: OpenAI 1-shot call to generate (title, description) from template content + businessInfo — CONTAINED, 1 call per gen
  6. Replace template hero image with personalized Unsplash result
- Do NOT touch: features content, stats values, pricing tiers, team bios, testimonials, FAQs

## Architecture

### New files
```
src/app/api/templates/personalize/route.ts                  # POST endpoint
src/lib/templates/personalization/inject-business-name.ts   # string replacement
src/lib/templates/personalization/inject-contact.ts         # contact block merge
src/lib/templates/personalization/select-images.ts          # Unsplash ranking
src/lib/templates/personalization/generate-seo.ts           # 1-shot OpenAI
src/lib/templates/personalization/orchestrator.ts           # pipeline
```

### Pipeline
```
input: { template, businessInfo, logoMediaId }
  ↓
deepClone(template.pages)
  ↓
injectBusinessName(pages, businessInfo.name)  // string replace [businessName] placeholder
  ↓
if businessInfo.phone/email/address:
  injectContact(pages, businessInfo)           // merge into contact block
  ↓
selectHeroImages(template.tags, businessInfo.category)  // Unsplash rank, upload 3 images
  ↓
replaceHeroImages(pages, selectedImages)
  ↓
generateSEO(template, businessInfo)  // 1 OpenAI call, returns { title, description } per page
  ↓
applySEO(pages, seoData)
  ↓
output: { pages, seo, theme: template.theme }
  ↓
save to Payload (Site + Pages)
```

### Business name placeholder strategy
- Templates authored in Phase 03 use `[businessName]` as placeholder
- Example: `"Welcome to [businessName] — your trusted dental clinic"`
- Personalization replaces with user's actual name
- Designer authoring guide documents placeholder convention

### Image selection
- Reuse Plan D (Unsplash pipeline) media-pipeline.ts helpers
- Filter search by template.tags + WizardAnswers.category + personality
- Rank by Unsplash relevance API
- Pick top 3 → upload to Payload Media
- Replace template's 3 hero image slots

### SEO generation
- Single OpenAI call (GPT-4o-mini for speed + cost)
- Prompt: `Generate SEO title (60 chars) + meta description (155 chars) for a {template.parentCategory} business "{businessInfo.name}" with tagline "{template.searchableContent.substring(0, 100)}"`
- JSON response format
- Fallback: algorithmic `"${businessInfo.name} — ${template.name}"` if OpenAI fails

## Related code files
- `src/lib/ai/media-pipeline.ts` — Unsplash integration (reuse)
- `src/lib/ai/image-keywords.ts` — keyword derivation (reuse)
- `src/lib/ai/seo-generator.ts` — Plan 2249 Phase 06 (reuse if compatible)
- `src/lib/ai/generate-meta.ts` — existing SEO helper (reference)
- `src/lib/ai/fallback-adapter.ts:mapBusinessInfo` — BusinessInfo mapping (reuse)

## Implementation Steps
1. Template placeholder convention doc (0.5 day):
   - Document `[businessName]`, `[phone]`, `[email]`, `[address]` placeholders
   - Update Phase 03 content quality standards
2. Business name injection (0.5 day):
   - Recursive replace across pages[].blocks[]
   - Unit tests: nested fields, array fields, empty strings
3. Contact block injection (0.5 day):
   - Find contact block in pages
   - Merge user's phone/email/address
4. Image selection pipeline (1 day):
   - Reuse media-pipeline + image-keywords
   - Unsplash search + upload
   - Image field replacement
5. SEO generation (0.5 day):
   - 1-shot OpenAI call
   - Fallback handling
6. Orchestrator + API endpoint (0.5 day):
   - Wire pipeline steps
   - Error handling
7. Wire to Phase 04 wizard Step 5 "Pick template" → personalize → save → navigate to builder (0.5 day)
8. Integration test (0.5 day)

## Todo list
- [ ] Placeholder convention doc
- [ ] Business name injection
- [ ] Contact block injection
- [ ] Image selection pipeline
- [ ] SEO generation
- [ ] Orchestrator + API endpoint
- [ ] Wire to wizard flow
- [ ] Integration test

## Success Criteria
- End-to-end test: wizard → pick template → personalize → save → preview site shows businessName correctly
- Template feature/stats/pricing/team content UNCHANGED post-personalization (deep equality check)
- SEO metadata generated within 2s OR fallback used
- Hero images are 3 distinct Unsplash photos matching template style
- Personalized Site renders identically to template except for businessName + contact fields + hero images

## Risk Assessment
- **Placeholder coverage** — designer may forget `[businessName]` in some fields → user sees "Demo Dental Clinic". Mitigation: Phase 02 tool validates templates have ≥3 placeholder references before publish.
- **Unsplash rate limit** — heavy personalization volume may hit Unsplash 50/hr demo tier. Mitigation: upgrade to Unsplash production tier OR cache common images.
- **SEO OpenAI failures** — network issues, content safety. Mitigation: fallback to algorithmic SEO, log failure rate to monitor.
- **Deep clone performance** — 5 pages × 12 blocks × nested data → clone cost. Mitigation: benchmark, optimize with structuredClone (built-in, fast).

## Security Considerations
- Business name user input — sanitize before string replacement (prevent script injection into blocks)
- Unsplash API key secret — pull from Vercel env
- OpenAI API key secret — same
- Logo upload reuses existing Payload media pipeline

## Next steps
- Phase 07 rolls out feature flag + measures content quality vs old flow
- Future: expand personalization — AI-generated "welcome message" custom to user input (controlled scope)
