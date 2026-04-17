# Phase 02: Slug Availability Check API

## Context
- Parent: [plan.md](plan.md)
- Depends on: Phase 01
- Priority: P2 | Effort: 1h

## Overview
Public API endpoint for real-time slug availability check. Used by onboarding UI and settings page.

## Requirements
- Check if slug is taken by another tenant
- Check reserved words blocklist
- Validate format (DNS-safe)
- Rate limited (prevent enumeration)

## Architecture
```
GET /api/slug/check?slug=mybakery

Response (available):
{ "available": true, "slug": "mybakery" }

Response (taken):
{ "available": false, "slug": "mybakery", "suggestions": ["mybakery-kl", "mybakery-my"] }

Response (invalid):
{ "available": false, "error": "invalid_format", "message": "Only lowercase letters, numbers, and hyphens" }

Response (reserved):
{ "available": false, "error": "reserved", "message": "This subdomain is reserved" }
```

## Related Files
- `src/app/api/slug/check/route.ts` — NEW endpoint
- `src/lib/utils/slugify.ts` — reuse validation

## Implementation Steps
1. Create `src/app/api/slug/check/route.ts`
2. Validate format: 3-63 chars, lowercase alphanumeric + hyphens
3. Check reserved words: admin, www, api, app, mail, ftp, static, assets, cdn, help, support, status, blog
4. Query `tenants.slug` for existence check
5. If taken, suggest 3 alternatives (append city codes: kl, jb, pg, or random)
6. Rate limit: max 30 checks/minute per IP

## Success Criteria
- Real-time check works < 200ms
- Reserved words blocked
- Suggestions helpful when taken
