# PrimeWeb — Build Checklist (Auth-First Flow)

## Wave 1: Foundation (✅ Done)
- [x] Next.js 15 + Payload CMS 3 + Docker
- [x] 7 Payload Collections (Tenants, Users, Sites, Pages, Media, Templates, Subscriptions)
- [x] Multi-tenant middleware (subdomain + custom domain)
- [x] SSR Site Renderer + 8 core blocks
- [x] Marketing homepage
- [x] Cursor rules (always, frontend, ai-features, cms-blocks)
- [x] SPEC.md v3.0 (BMAD, 19 sections)
- [x] BMAD AI-Factory Lite (.ai/ + docs/)
- [x] Git + GitHub setup (clean structure)

## Wave 2: Auth + Onboarding (🔄 Current — follows user journey)

### 2.1 Auth Flow ← **NEXT**
- [ ] Login page (`/login`) — email + password
- [ ] Register page (`/register`) — email + password + name
- [ ] Payload auth session (built-in JWT)
- [ ] Auth guard middleware (protect /dashboard, /builder, /editor)
- [ ] 401 → redirect /login
- [ ] Logout action
- [ ] BMAD: PRD → Arch → Dev → QA

### 2.2 Onboarding
- [ ] Onboarding Welcome (`/onboarding`) — post-register landing
- [ ] Store Basic Setup (`/onboarding/setup`) — slug, delivery defaults
- [ ] → redirects to AI Builder

### 2.3 Dashboard (✅ Done)
- [x] Dashboard BMAD Run (PRD → Arch → Dev → QA ✅ PASS)
- [x] 6 components (Greeting, Stats, SiteGrid, EmptyState, Banner, Skeleton)

## Wave 2.5: UX Quick Wins (Done)
- [x] Sidebar: remove "Soon" items (SEO, Analytics, Billing)
- [x] Site cards: gradient thumbnails + initials (no more globe icons)
- [x] Stats: only real data (total sites, published count, storage)
- [x] Empty state: two-path cards (AI Builder + Template Gallery)
- [x] Editor: block fields editable (headline, subheadline, ctaText, description)
- [x] UX Audit report created and copied to docs/tracking/

## Wave 3: AI Core (Done)

### 3.1 AI Chat Builder
- [x] Rule-based block generator (5 business types × 7 blocks)
- [x] POST /api/ai/generate-site (creates Site + Page in DB)
- [x] Full-screen chat + 3-step flow (describe → confirm → generate)
- [ ] LLM integration (OpenAI GPT-4) — currently rule-based

### 3.2 AI Editor
- [x] 3-panel layout: block list + live iframe preview + settings panel
- [x] Live preview via /api/preview/[siteId] (8 block types → standalone HTML)
- [x] Publish flow (1-click → update status + timestamp)
- [x] Save API (/api/sites/[siteId]/save) — blocks + theme to DB
- [x] Live theme editing (color picker, font selectors, dark/light toggle)
- [x] Block delete/duplicate with unsaved changes indicator
- [ ] Inline text editing in preview (Phase 2)
- [ ] Drag-and-drop block reorder

### 3.3 Template Gallery
- [x] Template Gallery page (/templates) with category filter + search
- [x] 6 preset templates (Business, Restaurant, E-commerce, Portfolio, Blog, Agency)
- [x] Seed API (/api/templates/seed)
- [x] Apply-template API (creates site from template's default blocks)
- [ ] Template thumbnail previews (screenshots)

## Wave 4: Commerce + SEO + Storefront
- [ ] Products CRUD + AI description
- [ ] Orders management
- [ ] Payment (FPX, GrabPay, card)
- [ ] Delivery (J&T, Pos Laju)
- [ ] SEO Dashboard + AI SEO
- [ ] Public storefront SSR + JSON-LD

## Wave 5: Polish + Test + Launch
- [ ] Playwright E2E tests
- [ ] Core Web Vitals > 90
- [ ] Custom domain (Cloudflare API)
- [ ] Security audit
- [ ] UAT + Launch
