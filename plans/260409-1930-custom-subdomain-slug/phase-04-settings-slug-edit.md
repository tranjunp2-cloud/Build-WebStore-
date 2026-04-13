# Phase 04: Settings Page Slug Editor

## Context
- Parent: [plan.md](plan.md)
- Depends on: Phase 02
- Priority: P3 | Effort: 2h

## Overview
Allow users to change subdomain from Settings → Domains page. Like Shopify "Store details → Change subdomain".

## Requirements
- Show current subdomain in Settings → Domains
- "Change subdomain" button → modal with slug picker
- Confirmation dialog (changing URL affects SEO)
- Old slug → 301 redirect for 30 days (SEO grace period)
- Rate limit: max 3 changes per month

## Architecture
```
Settings → Domains:
┌─────────────────────────────────────────────────────┐
│ Your website address                                 │
│ rimba-tours.web-v2.dev.ecommercehub.my              │
│                                    [Change subdomain]│
└─────────────────────────────────────────────────────┘

PATCH /api/tenant/slug
  body: { slug: "new-slug" }
  → Validate + check availability
  → Store old slug in tenant.previousSlugs array
  → Update tenant.slug
  → Return success
```

## Related Files
- `src/app/(dashboard)/settings/domains/DomainsClient.tsx` — add subdomain section
- `src/app/(dashboard)/settings/domains/actions.ts` — add slug change action
- `src/collections/Tenants.ts` — add `previousSlugs` array field
- `src/middleware.ts` — add 301 redirect for old slugs

## Implementation Steps
1. Add `previousSlugs` array field to Tenants collection + migration
2. Create PATCH `/api/tenant/slug` endpoint with validation
3. Add "Change subdomain" section to DomainsClient.tsx
4. Add confirmation modal with SEO warning
5. Update middleware: check previousSlugs → 301 redirect to current slug

## Success Criteria
- User can change subdomain from Settings
- Old URL redirects to new URL (301)
- Rate limited to prevent abuse

## Risk
- SEO impact: 301 redirects mitigate but not eliminate
- Users bookmarking old URLs → redirect handles this
- Need DB migration for previousSlugs field
