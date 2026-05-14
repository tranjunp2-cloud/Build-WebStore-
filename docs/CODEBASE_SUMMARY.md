---
owner: Dev
last_updated: 2026-05-12
---

# Codebase Summary

Map of `src/` directory, key modules, and entry points. Read this first to orient.

## Top-level structure

```
src/
├── app/              Next.js App Router — route groups: (auth), (builder), (dashboard),
│                     (editor), (frontend), (payload), (preview); plus api/, sites/
├── blocks/           Page builder block components (F01, F05 AI gen targets)
├── collections/      Payload CMS collection definitions (schema source of truth)
├── components/       Shared React components (UI + feature-specific)
│   ├── ui/           shadcn/ui primitives (DO NOT modify directly)
│   └── [feature]/    Feature-scoped components (builder/, editor/, storefront/, ...)
├── data/             Seed data, static JSON (themes, templates, industry packs)
├── hooks/            Custom React hooks (TanStack Query wrappers, form helpers)
├── i18n/             Locale dictionaries (F21 localization, en/vi/ms)
├── lib/              Business logic, API clients, utilities
│   ├── ai/           OpenAI + AI gen pipeline (F01 core)
│   ├── email/        SMTP via Payload (see .claude/rules/email-smtp.md)
│   ├── payment/      Payment integration (F13 — Phase 2)
│   ├── images/       Image processing + S3 upload (via Payload cloud-storage + AWS SDK)
│   ├── cache/        Caching utilities
│   ├── storefront/   Storefront utilities (cart, editor intercepts)
│   └── otp/, analytics/, notifications/, fonts/  Feature-specific utilities
├── providers/        React context providers (theme, query client, auth)
├── scripts/          CLI tools scoped to src/ (admin, migration helpers)
├── store/            Zustand stores (builderStore, cartStore, editorStore, notificationStore)
├── types/            Shared TypeScript types
├── utils/            Misc pure utilities
├── __tests__/        Vitest unit + integration tests
└── payload.config.ts Payload CMS + DB config (schema + SMTP + S3 + plugins)
```

## Entry points

| Path | Purpose |
|------|---------|
| `src/app/layout.tsx` | Root layout — theme, providers, i18n |
| `src/app/(dashboard)/**` | Admin dashboard route group |
| `src/app/(frontend)/**` | Public storefront route group |
| `src/app/(builder)/**` | Visual builder route group (F01/F05) |
| `src/app/(editor)/**` | AI editor route group (F05) |
| `src/app/(payload)/**` | Payload CMS admin UI |
| `src/app/api/**` | REST API routes (`account`, `admin`, `ai`, `analytics`, `auth`, `blog-categories`, `blogs`, `contact-submit`, `cron`, `dashboard`, ...) |
| `src/app/api/v1/sso/**` | SSO provisioning endpoint (only versioned route currently) |
| `src/app/sites/[slug]/**` | Public site rendering |
| `src/payload.config.ts` | Collections, fields, access, plugins, SMTP |
| `scripts/db-setup.js` | Migration executor (runs in `vercel build`) |

## Collections (`src/collections/`)

19 Payload collections — schema source of truth:

- **Identity:** `Users`, `Tenants`, `Subscribers`, `Subscriptions`
- **CMS:** `Pages`, `Sites`, `Templates`, `Media`, `Blogs`, `BlogCategories`
- **Commerce:** `Products`, `Categories`, `Orders`, `ContactSubmissions`
- **Infra:** `AiUsageLogs`, `Analytics`, `Notifications`, `PushSubscriptions`, `SEOMetaJobs`

Adding a new collection requires: Payload config + migration in `scripts/db-setup.js` + slug in `COLLECTION_SLUGS[]`. See `.claude/rules/database-schema.md`.

## Key modules

- **AI gen pipeline** (`src/lib/ai/`) — F01 core. OpenAI client, prompt templates, block generator, variant rotation, fallback SVG, section-label dedup. See `docs/architecture/F01-ai-builder.md`.
- **Builder store** (`src/store/builderStore.ts`) — Zustand store for in-memory page tree. Gold-standard test: `src/__tests__/unit/builder/builder-store.test.ts`.
- **Stores** (`src/store/`) — `builderStore`, `cartStore`, `editorStore`, `notificationStore` (Zustand).
- **Auth** (`src/app/api/auth/`, `src/lib/auth.ts`) — JWT + Payload session, OTP via AWS SES. SSO provisioning at `src/app/api/v1/sso/`.
- **Shipping** (`src/lib/shipping/`) — F14 flat-rate Malaysia shipping. Modules: `constants.ts` (region defs, defaults, MY_STATES enum), `classify-region.ts` (state→region via isEastState), `calculate-fee.ts` (config + state + subtotal → fee + hint), `types.ts` (ShippingConfig/ShippingHint). APIs: `GET /api/sites/:siteId/shipping-config` (public read), `PATCH /api/sites/:siteId/shipping-config` (authed write), `POST /api/orders/calculate-shipping` (public calc with integer guard). Dashboard settings page at `src/app/(dashboard)/settings/shipping/`. See `docs/architecture/F14-shipping.md`.
- **Images / S3** (`src/lib/images/`, Payload plugin-cloud-storage) — upload via AWS SDK v3 to DO Spaces-compatible S3.
- **Email** (`src/lib/email/send.ts`) — Custom utility over `payload.sendEmail()`. See `.claude/rules/email-smtp.md`.
- **Test harness** (`scripts/test-harness/`) — E2E page-gen regression harness with Playwright visual diff.
- **Template drift validator** (`src/lib/ai/template-drift-validator.ts`) — scans TS presets + DB templates against live block registry; CI gate + post-deploy preflight. Paired with `block-schema-version.ts` hash stamped on seed.
- **Templates health dashboard** (`src/app/(dashboard)/templates-health/`) — super-admin page surfacing per-template drift badges + re-seed/re-harness buttons.
- **E2E shipping tests** (`e2e/f14-shipping.spec.ts`) — F14 API route reachability + auth validation (RF-03).

## Notable patterns

- **Path alias:** `@/*` → `./src/*` (tsconfig.json)
- **Strict TS:** `strict: true` in tsconfig; no `any` unless justified
- **Server components first:** App Router defaults to RSC; add `'use client'` only when needed
- **`force-dynamic` required:** Pages using `getPayload()` or `SiteRenderer` must `export const dynamic = 'force-dynamic'`

## Related docs

- Feature detail: `docs/architecture/F*.md`, `docs/prd/F*.md`
- System architecture (layers + data flow): `docs/architecture/_OVERVIEW.md`
- Code standards (lint, imports, naming): `docs/standards/CODE_STANDARDS.md`
- Harness rubric QC guide (all 11 dims, 58 criteria, FAQ): `docs/standards/HARNESS_EVALUATION_RULES.md`
- DB lifecycle: `docs/DB-LIFECYCLE.md`
