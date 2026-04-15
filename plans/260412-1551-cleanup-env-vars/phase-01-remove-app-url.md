# Phase 01: Remove NEXT_PUBLIC_APP_URL

## Context
- Parent: [plan.md](./plan.md)
- Research: [env usage](./research/researcher-01-env-usage.md)

## Overview
- **Date**: 2026-04-12
- **Priority**: P2
- **Implementation status**: pending
- **Review status**: pending

## Key Insights
- `NEXT_PUBLIC_APP_URL` chỉ có 1 reference trong source code (`Users.ts:84`)
- Mọi config đều set nó = `NEXT_PUBLIC_SERVER_URL`
- `docker-compose.prod.yml` literally does `APP_URL=${SERVER_URL}`

## Related Code Files

| File | Change |
|------|--------|
| `src/collections/Users.ts:84` | Remove `process.env.NEXT_PUBLIC_APP_URL` from CORS origins |
| `.env.example:36` | Remove `NEXT_PUBLIC_APP_URL` line |
| `.env.staging.example:32` | Remove `NEXT_PUBLIC_APP_URL` line |
| `.env.production.example:25` | Remove `NEXT_PUBLIC_APP_URL` line |
| `docker-compose.yml:20` | Remove `NEXT_PUBLIC_APP_URL` env |
| `docker-compose.prod.yml:25` | Remove `NEXT_PUBLIC_APP_URL` env |
| `.do/app.yaml:59` | Remove `NEXT_PUBLIC_APP_URL` key |
| `scripts/check-env-vars.js:26` | Remove from required vars list |

## Implementation Steps

1. **`src/collections/Users.ts`** — Remove line 84 (`process.env.NEXT_PUBLIC_APP_URL`)
2. **`.env.example`** — Delete `NEXT_PUBLIC_APP_URL=http://localhost:3000`
3. **`.env.staging.example`** — Delete `NEXT_PUBLIC_APP_URL=...`
4. **`.env.production.example`** — Delete `NEXT_PUBLIC_APP_URL=...`
5. **`docker-compose.yml`** — Remove `NEXT_PUBLIC_APP_URL` from environment
6. **`docker-compose.prod.yml`** — Remove `NEXT_PUBLIC_APP_URL` from environment
7. **`.do/app.yaml`** — Remove `NEXT_PUBLIC_APP_URL` key-value
8. **`scripts/check-env-vars.js`** — Remove `'NEXT_PUBLIC_APP_URL'` from required array

## Todo
- [ ] Remove from Users.ts CORS list
- [ ] Remove from all .env files
- [ ] Remove from docker-compose files
- [ ] Remove from .do/app.yaml
- [ ] Remove from check-env-vars.js
- [ ] Verify no other references exist

## Success Criteria
- `grep -r "NEXT_PUBLIC_APP_URL" src/` returns 0 results
- `grep -r "NEXT_PUBLIC_APP_URL" .env*` returns 0 results
- Build passes (`npm run build`)
- CI check-env-vars passes

## Risk Assessment
- **Low risk** — variable was never used independently
- Only concern: if any external service references `NEXT_PUBLIC_APP_URL` env var name → but since Vercel sets it manually, just delete from Vercel too

## Security Considerations
- No security impact — removing unused CORS origin (was duplicate of SERVER_URL)
