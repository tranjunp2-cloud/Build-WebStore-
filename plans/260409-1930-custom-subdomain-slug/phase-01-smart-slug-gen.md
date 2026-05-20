# Phase 01: Smart Slug Generation from Business Name

## Context
- Parent: [plan.md](plan.md)
- Priority: P2 | Effort: 2h

## Overview
Replace `store-${user.id}` with slug derived from business/store name. If AI generated site, use the site name. If template applied, use template + user input.

## Key Insights
- Onboarding already asks for business name/type
- AI generate-site creates site with `name` field
- Slug must be DNS-safe: lowercase, alphanumeric + hyphens, 3-63 chars

## Requirements
- Generate brandable slug from business name
- Handle collisions: append random suffix if taken (e.g., `rimba-tours` → `rimba-tours-7k3`)
- Keep `store-{id}` as ultimate fallback if name is empty

## Architecture
```typescript
// src/lib/utils/slugify.ts
export function generateTenantSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // strip diacritics
    .replace(/[^a-z0-9]+/g, '-')   // non-alphanum → hyphen
    .replace(/^-|-$/g, '')          // trim hyphens
    .slice(0, 50)                   // max length
    || 'my-store'                   // fallback
}

export async function ensureUniqueSlug(
  payload: Payload, baseSlug: string
): Promise<string> {
  const exists = await payload.find({
    collection: 'tenants', where: { slug: { equals: baseSlug } }, limit: 1
  })
  if (!exists.docs.length) return baseSlug
  // Append random 3-char suffix
  const suffix = Math.random().toString(36).slice(2, 5)
  return ensureUniqueSlug(payload, `${baseSlug}-${suffix}`)
}
```

## Related Files
- `src/app/api/ai/generate-site/route.ts:115` — replace `store-${user.id}`
- `src/app/api/ai/apply-template/route.ts` — same
- `src/lib/utils/slugify.ts` — NEW utility

## Implementation Steps
1. Create `src/lib/utils/slugify.ts` with `generateTenantSlug()` + `ensureUniqueSlug()`
2. Update `generate-site/route.ts`: use `generateTenantSlug(siteName)` instead of `store-${user.id}`
3. Update `apply-template/route.ts`: same change
4. Add unit tests for slugify (diacritics, unicode, edge cases)
5. Backward compatible: existing `store-{id}` slugs keep working

## Success Criteria
- New tenants get brandable slugs from business name
- No slug collisions (uniqueness guaranteed)
- Existing tenants unaffected
- Unit tests pass

## Risk
- Unicode business names (Vietnamese, Chinese) → strip diacritics, fallback to ASCII
- Very long names → truncate at 50 chars
- Collision loop → max 5 retries then fallback to `store-{id}`
