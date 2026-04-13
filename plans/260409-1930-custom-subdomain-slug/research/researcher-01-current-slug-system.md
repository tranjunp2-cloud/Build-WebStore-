# Current Slug System Research

## How slugs are generated now
- `src/app/api/ai/generate-site/route.ts:115` → `store-${user.id}`
- `src/app/api/ai/apply-template/route.ts` → same pattern
- Tenant collection: `slug` field — `unique: true`, `required: true`, `index: true`
- DB constraint enforces uniqueness

## Where slugs are used
1. **Subdomain routing** — middleware.ts extracts slug from `{slug}.web-v2.dev.ecommercehub.my`
2. **Site URL generation** — editor page.tsx: `https://${slug}.${PLATFORM_DOMAIN}`
3. **Publish API** — route.ts: `${tenantSlug}.${platformDomain}`
4. **Local direct access** — `/sites/{slug}/` path

## Key files
| File | Line | Purpose |
|------|------|---------|
| `src/collections/Tenants.ts:44` | slug field definition | unique constraint |
| `src/app/api/ai/generate-site/route.ts:115` | `store-${user.id}` | auto-gen on site create |
| `src/app/api/ai/apply-template/route.ts` | same pattern | template apply |
| `src/middleware.ts:108-109` | extract slug from subdomain | routing |
| `src/app/(editor)/editor/[siteId]/page.tsx:135-140` | build siteUrl | View Live |
| `src/app/api/sites/[siteId]/publish/route.ts:74-78` | build domainUrl | publish response |

## Limitations
- Format `store-{id}` is ugly, not brandable
- User cannot change slug after creation
- No UI to edit subdomain/slug
- No validation for reserved words (admin, www, api, etc.)
