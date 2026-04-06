# Research: Current Template System State

## Template Collection (Payload CMS)
- **File:** `src/collections/Templates.ts`
- Fields: name, description, category (11 industries), thumbnail, previewUrl
- Flags: isPremium, isFeatured, usageCount, sortOrder
- Theme: primaryColor, secondaryColor, fonts, colorMode
- Blocks: defaultBlocks JSON

## Template Composition
- `src/lib/ai/template-composer.ts` — 1.5k lines, compose from category content
- `src/lib/ai/template-definitions.ts` — 48 templates (11 starter + 22 pro + 15 premium)
- `src/lib/ai/seed-templates.ts` — legacy 10 templates (multi-page, MY content)
- `src/lib/ai/theme-presets.ts` — 55 color/font presets (5/category)
- `src/lib/ai/content/` — 11 category content files (MY-localized)

## Current APIs
- `GET /api/templates/list` — fetch all, sort by sortOrder
- `GET /api/templates/preview` — HTML render for iframe
- `POST /api/templates/seed` — seed DB (default/v2/force/dry-run modes)
- `POST /api/ai/apply-template` — apply template → creates new site → redirect editor
- ❌ `POST /api/templates/search` — MISSING

## Current UI Components
- `EditorTemplateModal.tsx` — picker in editor (12 category tabs, 300ms search)
- `TemplateCard.tsx` — iframe preview 30%, featured/premium badges, hover actions
- `TemplatePreviewModal.tsx` — fullscreen preview

## Builder Flow (Current)
```
/onboarding → 3 options:
  1. Build with AI → /builder/new (BusinessInfoForm → generate → editor)
  2. Choose Template → /templates (gallery → apply → editor)
  3. Start from Scratch → /editor/new
```

## Gaps
- Template gallery at `/templates` separate from builder flow
- No "pick template THEN customize with AI" hybrid flow
- EditorTemplateModal only available INSIDE editor (post-creation)
- No template preview before committing
- No mobile bottom sheet gallery
