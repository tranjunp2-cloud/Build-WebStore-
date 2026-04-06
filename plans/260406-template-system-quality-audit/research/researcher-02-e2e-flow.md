---
name: End-to-End Template Flow Audit
description: Full flow trace from template picker to rendered site — gaps identified
type: research
---

# End-to-End Template Flow Audit

## Flow (Working ✅)
```
User → EditorTemplateModal → GET /api/templates/list
     → Select template → POST /api/ai/apply-template
     → Fetch template.defaultBlocks + defaultTheme
     → Create/update site + 1 homepage
     → SiteRenderer → resolveTheme() → generateThemeCSS()
     → blocks.map(b => registry.getComponent(b.blockType))
     → Rendered page
```

## GAP 1: Multi-Page Not Persisted (HIGH)
- template-composer outputs 1-5 pages per template tier
- seed endpoint: `defaultBlocks: seed.pages[0]?.layout ?? []` — discards pages 1-4
- apply-template: creates only 1 Homepage + 1 404 page
- **Professional (3 pages) and Premium (5 pages) lose their structure**
- Fix: add `pages` array to Templates collection, seed all pages, apply creates all

## GAP 2: Stub Blocks Render Empty (HIGH)
- stats (23 lines), team (24), newsletter (18) render minimal/broken content
- about (78), faq (54), cta (55) render basic but lack variants/polish
- These are in EVERY template's composition → user sees low-quality sections

## GAP 3: AI Block Silent Drop (MEDIUM)
- Unknown block types silently skipped in SiteRenderer (returns null)
- No user notification that blocks were dropped
- Low frequency but confusing UX

## GAP 4: Template Seed Not Auto-Run (LOW)
- Seed requires manual `POST /api/templates/seed?v2=true`
- No migration/startup hook
- If DB is fresh, template picker shows empty

## Connected & Working
- Theme system (6 colors, 20 fonts, presets) ✅
- Block registry (51 types) ✅
- Template composer (48 definitions) ✅
- SiteRenderer + CSS injection ✅
- EditorTemplateModal UI ✅
