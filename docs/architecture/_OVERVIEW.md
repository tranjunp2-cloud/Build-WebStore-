---
owner: Dev
last_updated: 2026-04-19
---

# System Architecture

Unified view of the ech-prime-web-v2 stack: client, server, data, external services. For per-feature architectural detail, see `docs/architecture/F*.md`.

## Layers

```
┌──────────────────────────────────────────────────────────────────┐
│ Client                                                           │
│  Next.js 15 (App Router, Server Components)                      │
│  Tailwind CSS + shadcn/ui + Radix primitives                     │
│  Zustand (builder-store, auth-store) + TanStack Query            │
│  React Hook Form + Zod                                            │
└──────────────────────────────────────────────────────────────────┘
                │ fetch / form POST
                ▼
┌──────────────────────────────────────────────────────────────────┐
│ Server (Vercel Functions, Node.js runtime)                       │
│  Next.js API Routes (src/app/api/**, v1/sso for SSO only)        │
│  Payload CMS 3 admin + REST/GraphQL (src/app/(payload)/**)       │
│  Business logic (src/lib/**)                                     │
└──────────────────────────────────────────────────────────────────┘
                │ Drizzle ORM (via Payload)                   │ external
                ▼                                              ▼
┌──────────────────────────────────┐    ┌────────────────────────────────┐
│ Database                         │    │ External Services              │
│  PostgreSQL on Neon (serverless) │    │  OpenAI (AI gen, SEO)          │
│  ap-southeast-1 region           │    │  AWS S3 (via DO Spaces) storage│
│  Migrations: scripts/db-setup.js │    │  AWS SES (SMTP, email/OTP)     │
│                                  │    │  Stripe (payments — F13 P2)    │
└──────────────────────────────────┘    │  Lark (bot, notifications)     │
                                         │  Upstash Redis (rate limit)    │
                                         │  Unsplash (stock images)       │
                                         │  ECH Distribution API          │
                                         └────────────────────────────────┘
```

## Deploy architecture

```
Developer merges a PR into staging (the PR already ran changes → quality ∥ affected tests)
         │
         ▼
GitHub Actions (.github/workflows/ci.yml)
         │  deploy-scope → deploy-ai-platform (if touched) → deploy-staging
         │  (separate workflows on the same push: staging-full-tests.yml, e2e-staging.yml)
         ▼
vercel pull --environment=staging --token=$VERCEL_TOKEN
         │
vercel build --target=staging  (runs scripts/db-setup.js against Neon)
         │
vercel deploy --prebuilt --target=staging --archive=tgz
         │
Alias rollover verification (web-v2.dev.ecommercehub.my)
         │
smart-notify → Lark [PrimeWeb - V2] — CI/CD
```

Full rules: `.claude/rules/vercel-deploy.md`.

## Data flow: AI site generation (F01 hot path)

```
User submits prompt
  → POST /api/ai/generate (Vercel Function)
  → Lib: src/lib/ai/{prompt-builder,variant-rotator,dedup-section-label}
  → OpenAI completion (GPT-4 family)
  → Validate output → map to block schema (src/blocks/**)
  → Payload creates Sites + Pages + nested blocks (Drizzle INSERT)
  → Response: site URL
User redirected to /builder
  → Render from Payload (SiteRenderer) with force-dynamic
```

Detail: `docs/architecture/F01-ai-builder.md` + `docs/architecture/ai-gen-flow-diagrams.md`.

## Feature architecture index

All feature-specific architecture lives in `docs/architecture/F*.md`:

| ID | Feature | Doc |
|----|---------|-----|
| F01 | AI Web Builder | [F01-ai-builder.md](architecture/F01-ai-builder.md) |
| F02 | Auth Flow | [F02-auth.md](architecture/F02-auth.md) |
| F03 | Dashboard + SEO Tracker | [F03-dashboard.md](architecture/F03-dashboard.md) |
| F05 | AI Editor | [F05-ai-editor.md](architecture/F05-ai-editor.md) |
| F06 | Onboarding | [F06-onboarding.md](architecture/F06-onboarding.md) |
| F07 | Templates Gallery | [F07-template-gallery.md](architecture/F07-template-gallery.md) |
| F08 | Products CRUD | [F08-products-crud.md](architecture/F08-products-crud.md) |
| F09 | Storefront Commerce | [F09-storefront-commerce.md](architecture/F09-storefront-commerce.md) |
| F10 | Orders Management | [F10-orders-management.md](architecture/F10-orders-management.md) |
| F11 | SEO Dashboard | [F11-seo-dashboard.md](architecture/F11-seo-dashboard.md) |
| F15 | Support — mở CMS merchant không cần OTP | [F15-support-merchant-access.md](architecture/F15-support-merchant-access.md) |
| F16 | Notification Center | [F16-notification-center.md](architecture/F16-notification-center.md) |
| F17 | Blog Management | [F17-blog-management.md](architecture/F17-blog-management.md) |
| F18 | CMS Layout | [F18-cms-layout.md](architecture/F18-cms-layout.md) |
| F19 | Store Configuration | [F19-store-configuration.md](architecture/F19-store-configuration.md) |
| F22 | Tracking Analytics | [F22-tracking-analytics.md](architecture/F22-tracking-analytics.md) |
| F32 | Email Template CMS | [F32-email-template-cms-settings.md](architecture/F32-email-template-cms-settings.md) |
| F37 | Local SEO & Search Performance | In development (first phase US-F37-03 shipped) |
| F48 | Media Management | [F48-media-management.md](architecture/F48-media-management.md) |
| F99 | CI/CD Monitoring | [F99-cicd-monitoring.md](architecture/F99-cicd-monitoring.md) |

## Cross-cutting concerns

- **Auth & tenancy:** `src/collections/Users.ts` + `Tenants.ts`; JWT + Payload session
- **Media:** S3 upload → `Media` collection → CDN (Vercel edge + DO Spaces)
- **Logging:** Payload logger (JSON structured) → Vercel log drain
- **Caching:** Next.js route cache (ISR where applicable) + in-memory for AI prompts (short TTL)
- **Email:** AWS SES via Payload SMTP; 7 templates indexed in [email-templates.md](architecture/email-templates.md)
- **Rate limiting:** Upstash Redis (`@upstash/ratelimit`) for AI endpoints

## Related docs

- `docs/CODEBASE_SUMMARY.md` — `src/` directory map
- `docs/DB-LIFECYCLE.md` — schema change workflow
- `.claude/rules/vercel-deploy.md` — deploy pipeline detail
- `.claude/rules/database-schema.md` — Payload Drizzle conventions
