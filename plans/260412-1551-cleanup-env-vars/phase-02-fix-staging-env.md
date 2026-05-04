# Phase 02: Fix SERVER_URL Staging Value

## Context
- Parent: [plan.md](./plan.md)
- Depends on: [Phase 01](./phase-01-remove-app-url.md) (can run in parallel)
- Research: [domain vars](./research/researcher-02-domain-vars.md)

## Overview
- **Date**: 2026-04-12
- **Priority**: P1 (fixes active bug)
- **Implementation status**: partial (`.env.staging.example` already updated)
- **Review status**: pending

## Key Insights
- Dockerfile already has correct value: `NEXT_PUBLIC_SERVER_URL=https://web-cms-v2.dev.ecommercehub.my`
- `.env.staging.example` had wrong value: `https://web-v2.dev.ecommercehub.my` (already fixed)
- Vercel Dashboard still has wrong value → must update manually

## Related Code Files

| File | Change |
|------|--------|
| `.env.staging.example:30` | ✅ Already fixed to `https://web-cms-v2.dev.ecommercehub.my` |
| Vercel Dashboard | Manual: update `NEXT_PUBLIC_SERVER_URL` env var |

## Implementation Steps

1. ✅ **`.env.staging.example`** — Already updated with correct value + warning comment
2. **Vercel Dashboard** — Update `NEXT_PUBLIC_SERVER_URL` to `https://web-cms-v2.dev.ecommercehub.my`
3. **Vercel Dashboard** — Delete `NEXT_PUBLIC_APP_URL` (after Phase 01)
4. **Redeploy** — Required because `NEXT_PUBLIC_*` vars are baked at build time

## Todo
- [x] Fix `.env.staging.example` value
- [ ] Update Vercel Dashboard `NEXT_PUBLIC_SERVER_URL`
- [ ] Delete Vercel Dashboard `NEXT_PUBLIC_APP_URL`
- [ ] Trigger Vercel redeploy
- [ ] Verify `web-cms-v2.dev.ecommercehub.my` shows login page (not Payload admin)

## Success Criteria
- `web-cms-v2.dev.ecommercehub.my/` shows marketing/login page
- `web-cms-v2.dev.ecommercehub.my/admin` shows Payload admin panel
- `{shop}.web-v2.dev.ecommercehub.my/` shows tenant site
- No CORS errors on login/dashboard

## Risk Assessment
- **Medium risk** — changing SERVER_URL affects Payload serverURL, CORS, email URLs
- Mitigated: Dockerfile already uses `web-cms-v2` → build-time value was correct all along
- Only runtime behavior was affected by Vercel env override

## Security Considerations
- CORS origins will use `web-cms-v2.dev.ecommercehub.my` — correct
- Payload CSRF validation uses same URL — correct
