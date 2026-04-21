# Phase 05 — Category-Specific Enhancements

## Context links
- Parent: [plan.md](plan.md)
- Depends on: Phase 03 baseline (confirms which gaps by category)
- Can parallel with: Phase 04

## Overview
Date: 2026-04-18
Description: Add category-specific blocks expected by professional templates: Before-After (Beauty), Video Showcase (Tech/Fitness), Case Studies (B2B/Creative), Map embed (Restaurant/Real Estate/Health), Class Schedule (Education/Fitness), etc.
Priority: P1
Implementation status: pending
Review status: not started

## Key Insights
- 115+ missing component instances across ~200 category-specific recommendations (from researcher-02)
- High-ROI picks prioritized: Before-After, Video, Case Studies, Map, Class Schedule, Step/How-It-Works
- Each enhancement adds 1-2 blocks to 2-4 presets per category → 56 blueprints touched

## Requirements

### 5.1 Beauty — Before-After Gallery (4/4 presets)
- Add `{ blockType: 'before-after', variant: 'slider' }` to Home or Services page
- Sample data: 3 transformation pairs in `content/beauty.ts` (add `beforeAfter` array)
- Block exists in codebase (`src/blocks/before-after/index.tsx`) — recently fixed for undefined label

### 5.2 Tech + Fitness — Video Showcase (8 presets)
- Add `{ blockType: 'video-showcase' }` to Home after Features
- Sample data: placeholder YouTube ID + thumbnail
- Note: media injection doesn't apply (harness) but production builder fetches real

### 5.3 B2B + Creative — Case Studies (8 presets)
- Add `{ blockType: 'case-studies', variant: 'grid' }`
- Requires block if not exists (check src/blocks/case-studies/)
- Content: 3 mock case studies per preset (client, industry, result metric)

### 5.4 Restaurant + Real Estate + Health — Map Embed (8-12 presets)
- Use existing `google-maps` block (verified in src/blocks/google-maps/)
- Add to Contact page (not Home) — standard section 1.2 Contact sub-page
- Sample data: address already in businesses[0].address, geocode via static iframe URL

### 5.5 Education + Fitness — Class Schedule (3-6 presets)
- Use existing `class-schedule` block
- Add to Services/Classes page
- Sample data: 5-7 classes per week with time + instructor

### 5.6 SaaS + Service-based — Step/How-It-Works (10-12 presets)
- Use existing `step-process` block (verify)
- Add to Home between Features and Testimonials
- Sample data: 3-4 steps per preset

## Architecture

Each enhancement follows same pattern:
1. Verify block component exists + renders correctly in harness
2. Update 1-N preset files to add block at correct position
3. Update content library for category with required sample data
4. Regen matrix + visual QA

Prerequisite: Phase 04's batch-edit script template can be reused with different transforms.

## Related code files
- `src/blocks/before-after/index.tsx` (existing)
- `src/blocks/video-showcase/index.tsx` (existing)
- `src/blocks/case-studies/index.tsx` (check exists)
- `src/blocks/google-maps/index.tsx` (existing)
- `src/blocks/class-schedule/index.tsx` (existing)
- `src/blocks/step-process/index.tsx` (check exists)
- `src/lib/ai/content/{beauty,tech,fitness,business,creative,restaurant,realestate,health,education}.ts`
- `src/lib/ai/template-presets-batch{1,2,3}.ts`

## Implementation Steps
1. Audit existing blocks: confirm case-studies + step-process exist or need building
2. For each sub-task (5.1 → 5.6):
   a. Update content library with sample data
   b. Insert block into relevant presets (script-driven)
   c. Regen matrix
   d. Visual check in harness
   e. Score check — dimension improvement
3. Commit per sub-task (6 commits total)

## Todo list
- [ ] Audit blocks exist (case-studies, step-process)
- [ ] 5.1 Beauty Before-After (4 presets)
- [ ] 5.2 Video Showcase (8 presets)
- [ ] 5.3 Case Studies (8 presets, may need block build)
- [ ] 5.4 Map Embed in Contact pages (8-12 presets)
- [ ] 5.5 Class Schedule (3-6 presets)
- [ ] 5.6 Step/How-It-Works (10-12 presets)
- [ ] Regen + score + commit per sub-task

## Success Criteria
- Beauty 4/4 have Before-After
- Tech + Fitness 8/8 have Video Showcase
- B2B + Creative 8/8 have Case Studies
- Restaurant + RE + Health 8/12 have real Map in Contact
- Education + Fitness 3/6 have Class Schedule
- SaaS + Service 10/12 have Step/How-It-Works
- Scorer "Industry Section" coverage 68% → >85%

## Risk Assessment
- **Medium**: Case Studies + Step Process blocks may not exist → need to build (+2h each). Fall back to skip if scope creep.
- **Low**: Map iframe URL generation from address string — use `https://www.google.com/maps/embed/v1/place?q={address}&key=...` but needs Google Maps API key in env.
- **Low**: Video ID placeholders — use public-domain videos (e.g., Pexels) to avoid copyright.

## Security Considerations
- Google Maps iframe: sanitize address for URL encoding, no XSS risk
- Video URLs: whitelist domains (youtube, vimeo, pexels)
- Case study content: no user data, sample only

## Next steps
- Phase 06: Re-score + confirm improvement.
