# Research: Domain Environment Variables Architecture

## 4 Domain Env Vars

| Variable | Purpose | Example (staging) |
|----------|---------|-------------------|
| `NEXT_PUBLIC_SERVER_URL` | Canonical app URL (Payload, CORS, emails) | `https://web-cms-v2.dev.ecommercehub.my` |
| `NEXT_PUBLIC_PLATFORM_DOMAIN` | Base for tenant subdomains | `web-v2.dev.ecommercehub.my` |
| `NEXT_PUBLIC_ADMIN_DOMAIN` | Payload CMS admin domain | `web-cms-v2.dev.ecommercehub.my` |
| `NEXT_PUBLIC_APP_URL` | **REDUNDANT** — mirrors SERVER_URL | Same as SERVER_URL |

## Middleware Routing Logic (middleware.ts)

```
1. Static files → pass through
2. /api/* or /admin → pass through (line 67)
3. ADMIN_DOMAIN check (line 80):
   - Only rewrite if ADMIN_DOMAIN !== SERVER_DOMAIN
   - When equal → skip (staging case)
4. Subdomain detection (line 105):
   - hostname.endsWith(`.${PLATFORM_DOMAIN}`)
   - Excludes www and ADMIN_DOMAIN
5. Custom domain (line 156):
   - Excludes PLATFORM_DOMAIN, ADMIN_DOMAIN, SERVER_DOMAIN, localhost, vercel
```

## Bug Root Cause

`.env.staging.example` had `NEXT_PUBLIC_SERVER_URL=https://web-v2.dev.ecommercehub.my`
but `NEXT_PUBLIC_ADMIN_DOMAIN=web-cms-v2.dev.ecommercehub.my`

SERVER_DOMAIN (web-v2) !== ADMIN_DOMAIN (web-cms-v2) → admin rewrite triggered on main domain.

Fix: SERVER_URL must = `https://web-cms-v2.dev.ecommercehub.my` on staging.
Dockerfile already has correct value. Issue is Vercel/GitHub Secrets override.

## Files Using PLATFORM_DOMAIN (keep this var)

| File | Purpose |
|------|---------|
| `src/middleware.ts:4` | Default `primeweb.app`, subdomain detection |
| `src/app/sites/[slug]/not-found.tsx:9` | Tenant context |
| `src/app/(editor)/editor/[siteId]/page.tsx:142` | Preview URL |
| `src/components/onboarding/SlugPicker.tsx:47` | Slug preview |
| `src/components/editor/SettingsPanel.tsx:405` | SEO preview |
| `src/app/api/sites/[siteId]/publish/route.ts:93` | Published site URL |

## Files Using ADMIN_DOMAIN (keep this var)

| File | Purpose |
|------|---------|
| `src/middleware.ts:72,80,108,150` | Routing exclusions |
| Only middleware | No other code references |
