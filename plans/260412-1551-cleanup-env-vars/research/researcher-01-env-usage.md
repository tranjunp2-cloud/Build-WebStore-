# Research: NEXT_PUBLIC_SERVER_URL vs NEXT_PUBLIC_APP_URL Usage

## NEXT_PUBLIC_SERVER_URL — Active, used in 9+ files

| File | Line | Purpose |
|------|------|---------|
| `src/payload.config.ts` | 70 | Payload `serverURL` config |
| `src/payload.config.ts` | 178-182 | CORS + CSRF allow-list |
| `src/middleware.ts` | 73 | Extract `SERVER_DOMAIN` for routing guard |
| `src/collections/Users.ts` | 71,272,526 | Password reset email URL generation |
| `src/collections/Users.ts` | 83 | CORS origin validation |
| `src/collections/Pages.ts` | 999 | Base URL for page operations |
| `src/app/api/orders/create/route.ts` | 134 | Stripe checkout success/cancel URL |
| `src/app/api/stripe/connect/onboard/route.ts` | 53 | Stripe onboarding redirect |
| `src/app/api/seo/sitemap/route.ts` | 48 | Sitemap base URL |
| `src/app/api/health/route.ts` | 58 | Health check env validation |
| `src/app/(dashboard)/settings/staff/actions.ts` | 12 | Internal API call URL |
| `src/components/dashboard/views/AnalyticsView.tsx` | 111 | Filter external referrers |

## NEXT_PUBLIC_APP_URL — Barely used, mirrors SERVER_URL

| File | Line | Purpose |
|------|------|---------|
| `src/collections/Users.ts` | 84 | Added to CORS origins (same list as SERVER_URL) |
| `docker-compose.prod.yml` | 25 | `NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_SERVER_URL}` (explicit mirror) |
| `docker-compose.yml` | 20 | Same value as SERVER_URL (`localhost:3005`) |
| `.do/app.yaml` | 59 | Placeholder — same domain as SERVER_URL |
| `.env.staging.example` | 32 | Same value as SERVER_URL |
| `.env.production.example` | 25 | Same value as SERVER_URL |
| `.env.example` | 36 | Different port (3000 vs 3005) — appears to be a typo |
| `scripts/check-env-vars.js` | 26 | Listed as required env var |

## Conclusion

`NEXT_PUBLIC_APP_URL` is redundant:
- Only 1 source code reference (`Users.ts:84`) — alongside `SERVER_URL` in same CORS list
- Every config explicitly sets it = `SERVER_URL`
- `docker-compose.prod.yml` literally does `APP_URL=${SERVER_URL}`
- Can be safely removed with zero functional impact
