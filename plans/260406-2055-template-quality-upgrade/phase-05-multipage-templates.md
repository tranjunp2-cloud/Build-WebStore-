# Phase 05 — Multi-Page Templates

## Context
Hien tai template-composer.ts DA CO multi-page logic:
- `getPageNames()` (line 743): starter=['/'], professional=['/', 'about', 'contact'], premium=['/', 'about', 'services', 'contact', 'blog']
- `buildAboutPage()` (line 860), `buildContactPage()` (line 876), `buildServicesPage()` (line 889), `buildBlogPage()` (line 913)

Van de: moi page dung CUNG builders voi CUNG variants. About page luon = nav + about:split + stats:row + team:grid + testimonials:cards + cta + footer. Khong variety.

## Related Code Files
- `src/lib/ai/template-composer.ts` — `buildAboutPage()`, `buildContactPage()`, `buildServicesPage()`, `buildBlogPage()`
- `src/lib/ai/template-definitions.ts` — TemplatePreset (sau Phase 04 co `aboutBlocks`, `servicesBlocks`)
- `src/lib/ai/content/*.ts` — category content files

## Key Insight
Multi-page DA DUOC implement. Can upgrade CHAT LUONG tung page va add VARIETY.
Focus: moi category co about/services page voi NOI DUNG KHAC NHAU, khong chi thay doi block order.

## Requirements
1. About page: unique content per category (story, milestones, values)
2. Services page: category-specific service blocks va layout
3. Contact page: varied layouts (map, hours, multiple locations)
4. Page block specs in TemplatePreset (tu Phase 04)

## Implementation Steps

### Step 1: Enrich About page per category
File: `src/lib/ai/template-composer.ts`

Thay vi 1 `buildAboutPage()` chung, tao content maps:

```ts
const ABOUT_CONTENT: Record<string, { story: string; mission: string; values: { title: string; description: string; icon: string }[] }> = {
  restaurant: {
    story: 'Started as a humble warung in 2010, we have grown into...',
    mission: 'To bring authentic Malaysian flavours to every table.',
    values: [
      { title: 'Quality Ingredients', description: 'We source locally...', icon: 'Leaf' },
      { title: 'Family Tradition', description: 'Recipes passed down...', icon: 'Heart' },
      { title: 'Community First', description: 'Supporting local suppliers...', icon: 'Users' },
    ],
  },
  tech: { /* ... */ },
  // ... 11 categories
}
```

About page blocks vary per template:
- Template A: hero-minimal → story(about:split) → values(features:grid-3) → stats → team → footer
- Template B: hero-minimal → timeline(step-process) → team:cards → testimonials → cta → footer
- Template C: hero-minimal → about:centered → gallery:collage → stats:highlight → newsletter → footer

### Step 2: Enrich Services page per category
File: `src/lib/ai/template-composer.ts`

Services page blocks vary:
- Restaurant: service-cards + menu-display + booking-widget + pricing + faq
- Beauty: service-cards + before-after + booking-widget + pricing + testimonials
- Tech: features:bento + pricing-table + feature-comparison + cta
- Fitness: class-schedule + service-cards + pricing + testimonials

### Step 3: Enrich Contact page
Hien tai contact page chi co: hero-minimal + contact-form + footer.

Add variety:
- Version A: hero-minimal + contact:split + google-maps + faq + footer
- Version B: hero-minimal + contact:centered + stats:row + footer
- Version C: hero-minimal + contact:detailed + review-cards + footer

### Step 4: Add page specs to TemplatePreset
File: `src/lib/ai/template-definitions.ts`

```ts
export type TemplatePreset = {
  // ... existing fields
  aboutBlocks?: BlockSpec[]     // custom about page layout
  servicesBlocks?: BlockSpec[]  // custom services page layout
  contactBlocks?: BlockSpec[]   // custom contact page layout
}
```

### Step 5: Update composeTemplate() to use page specs
File: `src/lib/ai/template-composer.ts`

```ts
// In composeTemplate():
if (preset.aboutBlocks) {
  templatePages.push(buildPageFromSpecs('About', '/about', preset.aboutBlocks, biz, content, category, pages))
} else {
  templatePages.push(buildAboutPage(biz, content, category, pages))
}
```

## Todo
- [ ] Create `ABOUT_CONTENT` map — unique story/mission/values per 11 categories
- [ ] Create 3 about page layouts (block combos) — assign per template via preset
- [ ] Create category-specific services pages (different block combos per industry)
- [ ] Create 3 contact page layouts (block combos)
- [ ] Add `aboutBlocks`, `servicesBlocks`, `contactBlocks` to TemplatePreset type
- [ ] Update `composeTemplate()` — use page specs from preset
- [ ] Implement `buildPageFromSpecs()` generic function
- [ ] Test: verify professional/premium templates co >1 page, moi page nhin khac nhau

## Success Criteria
- About page: unique content per category (khong chi "About {business name}")
- Services page: category-specific blocks (restaurant co menu, beauty co before-after)
- Contact page: 3 layout variations across templates
- Moi page render dung, no broken blocks

## Risk Assessment
- LOW: Multi-page da duoc implement, chi upgrade content va variety
- Pages chi affect professional/premium tiers
- Backward compatible: existing pages van render dung
