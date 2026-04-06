# Research: Current Template Composer Analysis

## Current Architecture (2 files)

### template-definitions.ts (93 lines)
- 48 template defs = `{ category, businessIndex, variant, themePreset }`
- Deterministic: same input → same output
- Distribution: 11 starter + 22 professional + 15 premium
- Problem: businessIndex 0-4 recycled across tiers → fake diversity

### template-composer.ts (977 lines)
- `composeTemplate()` → builds pages from category content
- Page builders: buildHomePage, buildAboutPage, buildContactPage, buildServicesPage, buildBlogPage
- 17 block builders (all deterministic, all hardcoded order)

## Root Problems

### 1. Block Order is HARDCODED per page type
```
Home (professional): nav → hero → features → stats → gallery → 2 industry → testimonials → faq → cta → footer
About: nav → mini-hero → about → stats → team → testimonials → cta → footer
```
Every professional restaurant = SAME block sequence. No variation.

### 2. Block Variant Selection is INDEX-BASED
```typescript
heroVariant = CATEGORY_HERO_VARIANTS[category][businessIndex % variants.length]
```
Since businessIndex 0-4 rotates, hero variants repeat predictably.

### 3. No Block-Level Customization per Template
All templates of same tier get same:
- Feature count (always 3)
- Testimonial count (always 3)
- Gallery image count (always 6)
- Stats items (always 4)

### 4. Page Structure is TIER-LOCKED
- Starter = 1 page (home)
- Professional = 3 pages (home, about, contact)
- Premium = 5 pages (home, about, contact, services, blog)
No flexibility within tiers.

## What Needs to Change (Bước 2)

### template-definitions.ts → TemplatePreset format
```typescript
// OLD: just a pointer to category + business + tier
{ category: 'restaurant', businessIndex: 0, variant: 'starter', themePreset: ... }

// NEW: explicit blueprint with block selection + variants + page structure
{
  id: 'restaurant-rustic-kitchen',
  name: 'Rustic Kitchen',
  category: 'restaurant',
  businessIndex: 0,
  tier: 'professional',
  themePreset: RESTAURANT_PRESETS[0],
  pages: [
    {
      name: 'Home',
      slug: 'home',
      blocks: [
        { blockType: 'navigation', variant: 'transparent' },
        { blockType: 'hero', variant: 'parallax' },
        { blockType: 'features', variant: 'icon-top', count: 4 },
        { blockType: 'menu-display', variant: 'tabs' },
        { blockType: 'gallery', variant: 'masonry', count: 8 },
        { blockType: 'testimonials', variant: 'carousel', count: 5 },
        { blockType: 'cta', variant: 'banner' },
        { blockType: 'footer', variant: 'mega' },
      ]
    },
    {
      name: 'About',
      slug: 'about',
      blocks: [
        { blockType: 'navigation', variant: 'transparent' },
        { blockType: 'hero', variant: 'minimal', mini: true },
        { blockType: 'about', variant: 'timeline' },
        { blockType: 'team', variant: 'cards' },
        { blockType: 'stats', variant: 'grid' },
        { blockType: 'footer', variant: 'mega' },
      ]
    },
  ]
}
```

### template-composer.ts → Simpler, Blueprint-driven
```typescript
// OLD: builds pages algorithmically (400+ lines of if/else per tier)
// NEW: reads blueprint, fills content from category data
function composeFromBlueprint(preset: TemplatePreset): TemplateSeed {
  return {
    name: preset.name,
    pages: preset.pages.map(page => ({
      name: page.name,
      slug: page.slug,
      blocks: page.blocks.map(spec => buildBlock(spec, content))
    }))
  }
}
```

## Effort Estimate
- Rewrite template-definitions.ts: define 20-30 unique blueprints (~2h)
- Simplify template-composer.ts: blueprint-driven composition (~2h)
- Content diversity: ensure each template uses different business sample + block counts (~1h)
- Total: ~5h (0.5-1 day)
