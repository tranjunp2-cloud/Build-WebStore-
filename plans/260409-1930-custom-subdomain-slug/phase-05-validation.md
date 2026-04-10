# Phase 05: Reserved Words + Validation

## Context
- Parent: [plan.md](plan.md)
- Depends on: Phase 01
- Priority: P2 | Effort: 1h

## Overview
Block reserved/dangerous slugs + add Payload beforeChange hook for server-side validation.

## Reserved Words Blocklist
```
admin, www, api, app, mail, ftp, static, assets, cdn,
help, support, status, blog, store, shop, dashboard,
login, register, signup, auth, oauth, sso,
billing, payment, checkout, cart,
docs, developer, dev, staging, test, demo,
primeweb, ecommercehub, ech
```

## Implementation Steps
1. Create `src/lib/utils/reserved-slugs.ts` with blocklist
2. Add Payload `beforeChange` hook on Tenants collection to validate slug
3. Integrate validation into `/api/slug/check` and slug generation
4. Add unit tests for edge cases

## Validation Rules
- 3-63 chars (DNS label spec)
- Lowercase `[a-z0-9-]` only
- Cannot start/end with hyphen
- Cannot be pure numbers
- Not in reserved list
- Not existing tenant slug

## Success Criteria
- Reserved slugs blocked at API + DB hook level
- Clear error messages for each validation failure
