# Phase 06 — Real Images & Content Polish

## Context
Hien tai tat ca images trong template-composer.ts la `placehold.co` gray boxes:
```
https://placehold.co/600x400/e2e8f0/64748b?text=Gallery+1
https://placehold.co/400x500/e2e8f0/64748b?text=Kurung
https://placehold.co/200x80/e2e8f0/64748b?text=Client+A
```

Template nhin "demo" va "fake" vi placeholder images. Replace voi Unsplash URLs (free, no API key needed for static URLs).

## Related Code Files
- `src/lib/ai/template-composer.ts` — `buildGallery()`, `buildPropertyCard()`, `buildProductQuickView()`, `buildPortfolioGrid()`, `buildClientLogos()`, `buildHero()`
- `src/lib/ai/content/*.ts` — 11 category content files (may co image fields)

## Key Insight
Unsplash cho phep direct linking voi format: `https://images.unsplash.com/photo-{ID}?w=600&h=400&fit=crop`
Hoac dung curated collections: `https://source.unsplash.com/collection/{ID}/600x400` (deprecated nhung van hoat dong).

Tot nhat: curate 5-10 image URLs per category, hardcode trong code. Khong can API.

## Requirements
1. Replace tat ca `placehold.co` URLs voi real Unsplash images
2. Category-appropriate images (restaurant = food photos, tech = laptop/code, etc.)
3. 5-10 unique images per category
4. Client logos: use simple SVG placeholders (cleaner than placehold.co)
5. Avatar images for team members

## Implementation Steps

### Step 1: Create image catalog per category
File: `src/lib/ai/images.ts` (NEW)

```ts
export const CATEGORY_IMAGES: Record<string, { hero: string[]; gallery: string[]; avatars: string[] }> = {
  restaurant: {
    hero: [
      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&h=800&fit=crop', // restaurant interior
      'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&h=800&fit=crop', // dining table
    ],
    gallery: [
      'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&h=400&fit=crop', // food plating
      'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=600&h=400&fit=crop', // dish
      'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&h=400&fit=crop', // pizza
      'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=600&h=400&fit=crop', // food close-up
      'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=600&h=400&fit=crop', // breakfast
      'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&h=400&fit=crop', // fine dining
    ],
    avatars: [
      'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=200&h=200&fit=crop', // chef
      'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=200&h=200&fit=crop',
    ],
  },
  ecommerce: {
    hero: [/* product flatlay, warehouse, online shopping */],
    gallery: [/* product photos, packaging, lifestyle */],
    avatars: [/* professional headshots */],
  },
  beauty: {
    hero: [/* salon interior, treatment room */],
    gallery: [/* skincare products, nail art, spa */],
    avatars: [/* beautician, therapist */],
  },
  tech: {
    hero: [/* laptop, code screen, office */],
    gallery: [/* team working, server room, dashboard */],
    avatars: [/* developer headshots */],
  },
  // ... 11 categories, 5-10 images each
}
```

### Step 2: Update template-composer.ts — use real images
Replace trong cac builder functions:

**buildGallery()** (line 308-322):
```ts
// TRUOC
{ image: { url: 'https://placehold.co/600x400/e2e8f0/64748b?text=Gallery+1', alt: '...' } }

// SAU
const images = CATEGORY_IMAGES[category]?.gallery ?? CATEGORY_IMAGES['business']!.gallery
images.map((url, i) => ({ image: { url, alt: `${biz.name} photo ${i + 1}` } }))
```

**buildHero()** (line 79-95):
```ts
// Add background image tu category hero images
backgroundImage: CATEGORY_IMAGES[category]?.hero[seed % heroImages.length]
```

**buildPropertyCard()** (line 613-627): replace placehold.co voi real estate images
**buildProductQuickView()** (line 629-645): replace voi product images
**buildPortfolioGrid()** (line 647-662): replace voi creative work images
**buildClientLogos()** (line 690-703): replace voi simple SVG data URIs

### Step 3: Avatar images for team members
Update `buildTeam()` (line 415-456):
```ts
members: teamMap[category].map((m, i) => ({
  ...m,
  avatar: {
    url: CATEGORY_IMAGES[category]?.avatars[i % avatars.length],
    alt: m.name,
  },
}))
```

### Step 4: Client logo SVGs
Thay vi placehold.co, dung inline SVG data URIs cho client logos:
```ts
const GENERIC_LOGOS = [
  `data:image/svg+xml,${encodeURIComponent('<svg width="200" height="80" xmlns="http://www.w3.org/2000/svg"><rect fill="#e2e8f0" width="200" height="80" rx="8"/><text x="100" y="45" text-anchor="middle" fill="#64748b" font-family="sans-serif" font-size="16">Partner A</text></svg>')}`,
  // ... 5 logos
]
```

### Step 5: Content polish — business-specific stats
Hien tai `buildStats()` dung CUNG stats cho moi business trong category.
Update: stats nhan biz name va vary numbers per businessIndex.

```ts
function buildStats(category: string, biz: BusinessSample, seed: number) {
  const base = statsMap[category]
  // Vary numbers slightly per business
  return base.map(stat => ({
    ...stat,
    value: varyNumber(stat.value, seed), // e.g. 15 → 12 or 18
  }))
}
```

## Todo
- [ ] Create `src/lib/ai/images.ts` — curate 5-10 Unsplash URLs per 11 categories
- [ ] Replace `buildGallery()` placehold.co → real images
- [ ] Replace `buildHero()` — add backgroundImage from category
- [ ] Replace `buildPropertyCard()` placehold.co → real estate images
- [ ] Replace `buildProductQuickView()` placehold.co → product images
- [ ] Replace `buildPortfolioGrid()` placehold.co → creative work images
- [ ] Replace `buildClientLogos()` placehold.co → SVG data URIs
- [ ] Add avatar URLs to `buildTeam()` members
- [ ] Content polish: vary stats numbers per business
- [ ] Verify: 0 placehold.co URLs remaining trong template-composer.ts

## Success Criteria
- 0 occurrences cua `placehold.co` trong generated templates
- Moi category co >=5 unique, appropriate images
- Gallery block nhin "real" — actual food/product/portfolio photos
- Team members co avatar images (khong con empty circles)
- Client logos nhin clean (SVG rectangles voi text)

## Risk Assessment
- LOW: Chi thay doi static URLs, khong anh huong logic
- Unsplash URLs stable — images hosted on Unsplash CDN, khong bi mat
- Image loading: add `loading="lazy"` neu chua co
- CORS: Unsplash images khong co CORS issue cho `<img>` tags
- Size: specify `w=` va `h=` params de Unsplash serve optimized size
