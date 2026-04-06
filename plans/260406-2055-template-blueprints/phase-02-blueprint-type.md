---
parent: plan.md
phase: 2
---

# Phase 2: Rewrite TemplatePreset Type + Composer

## Overview
- **Description:** Bỏ tier system, tạo blueprint format mới, composer đọc blueprint thay vì algorithmic
- **Priority:** P1
- **Implementation status:** done

## Key Changes vs Plan Cũ
- **BỎ** `variant: 'starter' | 'professional' | 'premium'` — tất cả templates đều premium
- **THÊM** `categoryDna: string` — reference tới CATEGORY_DNA
- **THÊM** `personality: string` — mỗi template có tính cách riêng (warm, bold, minimal, luxury...)

## TemplatePreset Type (NEW)

```typescript
export interface BlockSpec {
  blockType: string
  variant?: string
  count?: number
  overrides?: Record<string, unknown>
}

export interface PageBlueprint {
  name: string        // 'Home', 'Menu', 'Gallery'
  slug: string
  blocks: BlockSpec[]
}

export interface TemplatePreset {
  id: string                    // 'restaurant-warung-kampung'
  name: string                  // 'Warung Kampung'
  category: string              // 'restaurant'
  businessIndex: number         // 0-4
  personality: string           // 'warm-traditional', 'modern-dark', etc.
  themePreset: ThemePreset      // from theme-presets.ts
  pages: PageBlueprint[]        // 4-5 pages, ALL premium
  tags: string[]                // searchable keywords
  description: string           // 1-line for template picker
}

// NO tier field. All templates are premium.
```

## Composer Rewrite

### Before (977 lines, algorithmic)
```typescript
// if starter → 1 page
// if professional → 3 pages
// if premium → 5 pages
// Block order hardcoded per tier
```

### After (~200 lines, blueprint-driven)
```typescript
export function composeFromBlueprint(preset: TemplatePreset): TemplateSeed {
  const content = getCategoryContent(preset.category)
  const biz = content.businesses[preset.businessIndex]
  const pageNames = preset.pages.map(p => p.name)
  
  return {
    name: preset.name,
    description: preset.description,
    category: preset.category,
    isPremium: true,  // ALWAYS premium
    tags: preset.tags,
    defaultTheme: preset.themePreset,
    pages: preset.pages.map(page => ({
      name: page.name,
      slug: page.slug,
      blocks: page.blocks.map(spec =>
        buildBlock(spec, content, biz, preset.category, pageNames)
      )
    }))
  }
}
```

## Related Code Files
- `src/lib/ai/template-definitions.ts` — **REWRITE** type + export
- `src/lib/ai/template-composer.ts` — **SIMPLIFY** to blueprint-driven
- `src/app/api/templates/seed/route.ts` — update import

## Implementation Steps
1. Define new types (TemplatePreset, BlockSpec, PageBlueprint)
2. Create `buildBlock()` dispatcher (switch on blockType, call existing builders)
3. Write `composeFromBlueprint()` function
4. Update existing block builders to accept optional variant/count params
5. Remove tier-based logic (if starter/professional/premium)
6. Keep old `composeTemplate()` as deprecated wrapper temporarily

## Todo
- [ ] Define types
- [ ] buildBlock() dispatcher
- [ ] composeFromBlueprint()
- [ ] Update block builder signatures
- [ ] Remove tier logic
- [ ] TypeScript compiles

## Success Criteria
- [ ] No `'starter' | 'professional' | 'premium'` in new code
- [ ] composeFromBlueprint() produces valid TemplateSeed with 4-5 pages
- [ ] Block order from blueprint, not hardcoded
- [ ] All block variants from blueprint applied
