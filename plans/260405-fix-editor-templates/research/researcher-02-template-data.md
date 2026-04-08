---
title: Template Data & API Research
---

## Templates Collection (src/collections/Templates.ts)
- Fields: name, description, category (hasMany), thumbnail, previewUrl
- defaultTheme: primaryColor, secondaryColor, fontHeading, fontBody, colorMode
- defaultBlocks: JSON — pre-configured page layout blocks
- 10 industry templates seeded via /api/templates/seed

## Template Categories
restaurant, ecommerce (hidden v1.0), beauty, tech, health, education, realestate, fitness, creative, business

## Block Types in Templates
navigation, hero, features, testimonials, contact, footer, stats, about, cta, pricing

## Apply Template Flow (current)
1. Fetch template → extract defaultBlocks + defaultTheme
2. Create NEW site with template theme
3. Create homepage + 404 page with template blocks
4. Increment usageCount
5. Return siteId → redirect to editor

## Missing: Apply to Existing Site
- No API endpoint exists
- Would need: update existing site theme + replace page blocks
- Confirmation UX needed (destructive action)
