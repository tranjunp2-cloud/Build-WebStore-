---
parent: plan.md
phase: 4
---

# Phase 4: Seed + Verify All 30 Templates + Quality Checklist

## Overview
- **Description:** Update seed endpoint, seed 30 templates, verify all render correctly
- **Priority:** P1
- **Implementation status:** done

## Related Code Files
- `src/app/api/templates/seed/route.ts` — update seed logic
- `src/app/api/templates/preview/route.ts` — verify multi-page renders
- `src/app/api/templates/list/route.ts` — verify metadata

## Implementation Steps

### Step 1: Update seed route
- Import `TEMPLATE_PRESETS` (new) instead of `TEMPLATE_DEFINITIONS` (old)
- Call `composeFromBlueprint()` for each preset
- Remove v1/v2 mode bifurcation — only blueprint mode
- Store pages in `templates_template_pages` table (from quality-audit Phase 3)

### Step 2: Clean old templates
- `?force=true` deletes old 48 templates before seeding 30 new ones
- Old templates had tier-based naming → new ones have personality-based naming

### Step 3: Verify each template
```bash
# Seed all 30
curl -X POST localhost:3000/api/templates/seed?force=true

# Count = 30
curl localhost:3000/api/templates/list | jq '.data | length'

# Check each category has 3
curl localhost:3000/api/templates/list | jq '.data | group_by(.category) | map({(.[0].category): length})'

# Preview spot check (5 random)
for id in restaurant-warung-kampung tech-startup-launch beauty-rose-petal fitness-power-gym creative-minimal-canvas; do
  curl "localhost:3000/api/templates/preview?id=$id" -o /dev/null -w "$id: %{http_code}\n"
done
```

### Step 4: Visual spot check
- Open 5 templates in browser (1 per 2 categories)
- Verify: signature blocks visible, theme applied, responsive, no placehold.co

## Todo
- [ ] Update seed route for blueprints
- [ ] Remove v1/v2 bifurcation
- [ ] Seed 30 templates locally
- [ ] Verify count + category distribution
- [ ] Visual check 5 templates
- [ ] All pages render (not just homepage)

## Success Criteria
- [ ] Exactly 30 templates in DB
- [ ] 3 per category
- [ ] Each template has 4-5 pages stored
- [ ] Preview renders all pages without error
- [ ] Category filter in template picker works

## Quality Checklist per Template (từ standards doc Section 7)

### Visual Quality
- [ ] Hero ấn tượng, value proposition rõ trong 3 giây
- [ ] Color palette consistent (6 tokens)
- [ ] Typography hierarchy rõ (H1 > H2 > H3 > body)
- [ ] Images chất lượng, không placeholder gray

### SEO Quality
- [ ] 1 H1 per page
- [ ] JSON-LD schemas present (Organization, BreadcrumbList, page-specific)
- [ ] Meta title + description set
- [ ] Images: alt text set

### Conversion Quality
- [ ] CTA visible above fold
- [ ] Trust bar (logo-cloud) present after hero
- [ ] Mid-page CTA present
- [ ] FAQ present (FAQPage schema)
- [ ] Newsletter before footer

### Category DNA
- [ ] Signature blocks visible on homepage
- [ ] Section order follows category conversion flow
- [ ] Visual mood matches category (warm for F&B, dark for tech, etc.)

## Risk Assessment
- MEDIUM: `templates_template_pages` table from quality-audit Phase 3 must exist first
- LOW: Seed endpoint is admin-only, no user impact during transition
