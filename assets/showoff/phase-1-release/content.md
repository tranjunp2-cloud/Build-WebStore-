# ECH Prime Web v2 — Phase 1 Release

> **VI:** Thông báo release Phase 1 — nền tảng AI-powered website builder cho SMB Đông Nam Á.
> **EN:** Phase 1 release announcement — AI-powered website builder platform for SEA SMBs.
>
> **Release date:** 2026-04-19 · **Milestone:** v1.0 — Phase 1 · **Sprint 1-3**

---

## 1. Hero

### VI
**ECH Prime Web v2 — Phase 1 đã landed!**
Nền tảng AI builder cho SMB: từ ý tưởng đến storefront live trong <60 giây.
*110 issues closed · 97 PRs merged · 739 commits · 12 contributors.*

### EN
**ECH Prime Web v2 — Phase 1 has landed!**
The AI builder for SMBs: from idea to live storefront in under 60 seconds.
*110 issues closed · 97 PRs merged · 739 commits · 12 contributors.*

---

## 2. Shipped Features (20+ modules)

### VI — Tính năng đã ship

| Mã | Module | Highlights |
|---|---|---|
| **F01** | AI Site Generator | Chat builder, one-click publish, multilingual, AI image gen, template-first pipeline |
| **F02** | Authentication | OAuth, MFA, forgot password, SSO welcome email |
| **F03** | Dashboard | SSR analytics, owner tracking, storefront tracking, SEO widget |
| **F05** | AI Editor | Inline edit, multi-block, nested fields, draft/publish separation |
| **F06** | Onboarding Wizard | AI Discovery, welcome redirect, mobile UX |
| **F07** | Template Gallery | 30+ premium templates, category DNA, variant rotation |
| **F08** | Product Management | CRUD, categories, AI bulk create, dynamic attributes, mobile UX |
| **F10** | Orders Management | Dashboard, cancel+restock, filters, mobile drawers |
| **F11** | Undo/Redo | Full history incl. AI edits, mobile floating toolbar |
| **F12** | Auto-save Draft | Retry logic, conflict resolution |
| **F16** | Notification Center | SSE live toast, browser push, badge, admin broadcast |
| **F17** | Blog Management | CRUD, AI improve, pagination, 47 QC bugs squashed |
| **F18** | CMS Layout | Sidebar editor, route guards |
| **F19** | Store Configuration | Custom domain (DO API), QR payment, staff RBAC |
| **F20** | Help Center | Q&A accordion, instructions, i18n |
| **F21** | Localization | EN / MS / VI — full i18n across app |
| **F23** | Custom Subdomain | Tenant slug sync with builder |

### EN — Shipped features
Same table above — 17 major feature modules spanning AI site generation, e-commerce core, notifications, blog, onboarding, and localization.

---

## 3. Engineering Wins

### VI
- **Vercel Migration (2026-04-12)** — chuyển từ DigitalOcean App Platform sang Vercel CI-driven deploys, bypass commit-author check bằng `VERCEL_TOKEN`.
- **Fluid Compute + Neon Postgres** — serverless Next.js 15 + App Router + Payload CMS 3.
- **AI Gen Pipeline v2** — template-first composer với GPT personalization; structure enforcer; variant pools; Unsplash pipeline.
- **CI Pipeline** — quality → test → deploy-staging/production, ~11 phút/push, bot-driven Lark notifications.
- **Test Convention** — TC-ID naming, AAA pattern, vi.mock top-of-file, coverage targets 60% lines / 50% branches.
- **500 Fix Campaign** — rút lỗi production từ 450/day → <10/day qua 8 bugs / 6 PRs.
- **AI Code Review** — OpenAI Codex auto-review mọi PR với 13 project rules (AGENTS.md).

### EN
- **Vercel Migration (2026-04-12)** — moved from DigitalOcean App Platform to Vercel CI-driven deploys, bypassing Pro-plan commit-author checks via `VERCEL_TOKEN`.
- **Fluid Compute + Neon Postgres** — serverless Next.js 15 App Router + Payload CMS 3.
- **AI Gen Pipeline v2** — template-first composer with GPT personalization; structure enforcer; variant pools; Unsplash pipeline.
- **CI Pipeline** — quality → test → deploy-staging/production, ~11 min per push, bot-driven Lark notifications.
- **Test Convention** — TC-ID naming, AAA pattern, top-of-file `vi.mock`, coverage targets 60% lines / 50% branches.
- **500 Fix Campaign** — reduced production errors from 450/day → <10/day via 8 bugs / 6 PRs.
- **AI Code Review** — OpenAI Codex auto-review on every PR with 13 project rules (AGENTS.md).

---

## 4. By the Numbers

| Metric | Value |
|---|---|
| Issues closed (Phase 1) | **110** |
| Merged PRs | **97** |
| Commits (Feb–Apr 2026) | **739** |
| Contributors | **12** |
| Feature modules shipped | **17** |
| Time-to-site (AI gen) | **< 60s** |
| Prod error rate reduction | **450 → <10 / day** |
| Supported locales | **VI / EN / MS** |

---

## 5. Tech Stack

**Frontend:** Next.js 15 (App Router) · TypeScript · Tailwind · shadcn/ui · Zustand · TanStack Query
**Backend / CMS:** Payload CMS 3 · Next.js Route Handlers · Prisma-style Drizzle schema
**Database:** Neon Postgres (serverless, ap-southeast-1)
**AI:** OpenAI GPT-4o · Unsplash · Vercel AI SDK
**Auth:** JWT + Refresh · NextAuth · MFA
**Storage:** DO Spaces (S3) — dev bucket `tm-prime-web-dev`
**Payments:** Stripe · SePay (VietQR roadmap)
**Deploy:** Vercel (Fluid Compute) · GitHub Actions CI
**Monitoring:** Vercel Analytics · Lark CI/CD group notifications
**Testing:** Vitest · React Testing Library · Playwright

---

## 6. What's Next — Phase 2 (v1.1, due 2026-04-29)

### VI — Sắp tới
- **F13 Payment Gateway** — Stripe + SePay integration, webhook hardening.
- **F14 Shipping** — carrier integrations, rate calculation, label print.
- **F15 Admin Management** — super-admin console, tenant RBAC, global broadcast.
- **Cost telemetry** — OpenAI cost-per-user dashboard.
- **Template v3** — 10 categories × 3 templates, deeper CRO/SEO DNA.

### EN — Coming up
Same as above — Phase 2 focuses on payment, shipping, and admin to close the e-commerce loop.

---

## References / Footnotes

1. Milestone v1.0 — https://github.com/primeproduction/ech-prime-web-v2/milestone/8
2. Milestone v1.1 — https://github.com/primeproduction/ech-prime-web-v2/milestone/9
3. Vercel deploy plan — `plans/260413-1126-vercel-deploy-blocked/`
4. Template system standards — `docs/standards/WEBSITE_TEMPLATE_STANDARDS.md`
5. Test convention — `docs/TEST_CONVENTION.md`
6. 500 Fix campaign journal — `docs/journals/260415-500-fix-campaign-and-ai-gen-v2.md`
7. Payload CMS 3 — https://payloadcms.com
8. Next.js 15 — https://nextjs.org
9. Neon Postgres — https://neon.tech
10. Vercel Fluid Compute — https://vercel.com/docs/functions/runtimes
