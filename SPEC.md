# SPEC.md — Web Store (AI Website Builder)
> **Version:** 4.0 (Master Document) | **Updated:** 2026-03-08 | **Owner:** Ben (Antigravity)  
> **Rule:** `@SPEC.md` trước BẤT KỲ feature nào — đây là **HIẾN PHÁP** duy nhất của dự án

> [!IMPORTANT]
> **Document Hierarchy:**  
> `SPEC.md` (this file) = Master skeleton + Rules + References  
> `docs/AI_BUILDER_SPEC.md` = AI features deep technical spec (referenced by §7)  
> `docs/PLAN-ai-webbuilder.md` = Build plan with sprint order (referenced by §17)  
> `docs/prd/{feature}.md` = PRD cho từng feature (bắt buộc trước khi code)  
> `docs/architecture/{feature}.md` = Architecture note (bắt buộc trước khi code)

---

## 🗂️ MỤC LỤC NHANH

| # | Section | Mô tả |
|---|---------|--------|
| 1 | [Product Overview](#1-product-overview) | Vision, USP, Target User |
| 2 | [BMAD Workflow](#2-bmad-workflow) | Quy trình build chuẩn |
| 3 | [Tech Stack](#3-tech-stack) | Frontend, Backend, AI, Infra |
| 4 | [Design System](#4-design-system) | Tokens, components |
| 5 | [Screen Inventory](#5-screen-inventory) | Tất cả screens, P0/P1/P2 |
| 6 | [User Stories (P0)](#6-user-stories-p0) | Stories ready để dev |
| 7 | [AI Features Spec](#7-ai-features-spec) | Builder, Editor, SEO, Rate Limits |
| 8 | [API Contracts](#8-api-contracts) | Endpoints, request/response |
| 9 | [Data Models](#9-data-models) | Payload CMS Collections schema |
| 10 | [UX Rules](#10-ux-rules) | Navigation flow, states |
| 11 | [Security & Auth](#11-security--auth) | JWT, RBAC, rate limit |
| 12 | [SEO Implementation](#12-seo-implementation) | Meta, JSON-LD, sitemap |
| 13 | [10-Point Done Checklist](#13-10-point-done-checklist) | Gate trước khi merge |
| 14 | [API Response Format](#14-api-response-format) | Standard envelope |
| 15 | [6-Layer Architecture](#15-6-layer-architecture-checklist) | Per-feature checklist |
| 16 | [Test Requirements](#16-test-requirements) | Unit, E2E |
| 17 | [Build Tracking](#17-build-tracking) | Wave 1-5 progress |
| 18 | [Measure & Iterate](#18-measure--iterate) | Analytics, KPIs |
| 19 | [Env Variables](#19-environment-variables-template) | .env template |
| **20** | **[Feature Registry](#20-feature-registry)** | **Master index — docs & build status per feature** |

---

## 1. PRODUCT OVERVIEW

### Vision
Web Store là **AI-first website builder cho SME** — chủ shop không cần kỹ thuật có thể tạo website đẹp, chuyên nghiệp chỉ bằng **chat với AI trong 5 phút**.

### USP (Unique Selling Points)
1. **AI Chat Builder** — chat tạo và sửa website như Lovable/Cursor
2. **5-minute website** — từ prompt → live site trong 5 phút
3. **Inline AI edit** — click bất kỳ element, AI sửa ngay tại chỗ
4. **AI SEO Engine** — tự động generate + optimize SEO
5. **Block-based** — output luôn đẹp, responsive, SEO-ready (không phải raw code)
6. **Multi-tenant SaaS** — subdomain + custom domain

### Target User
- SME (chủ tiệm nhỏ, freelancer, cá nhân kinh doanh)
- Không rành tech, không có designer
- Muốn có website nhanh, chuyên nghiệp
- **3 Personas:** SME Owner (Local Seller), Dropshipper/Social Seller, Malay Consumer
- **Full market research:** [`docs/malaysia-market-context.md`](docs/malaysia-market-context.md)

### Target Market
- **Primary:** Malaysia (MY)
- **Languages:** English (EN) + Bahasa Melayu (MY) — **BOTH required on all UI**
- **Default lang:** EN, user can toggle to MY
- **Payment:** Stripe (cards), FPX (P1), E-wallets (P1)
- **Cultural:** Halal cert support (P2), Seasonal commerce (Hari Raya, CNY, Deepavali)

### 🚨 3 MANDATORY BUILD RULES (Must follow for ALL templates & features)

> [!CAUTION]
> Bất kỳ PR/feature nào **KHÔNG** tuân thủ 3 rules dưới đây sẽ bị reject.

#### Rule 1: MOBILE-FIRST RESPONSIVE ✅
- **All templates, blocks, sections MUST be mobile-responsive**
- Breakpoints: `768px` (tablet), `480px` (mobile)
- Grid layouts → stack vertically on mobile
- Hero split-screen → single column on mobile
- Font sizes: use `clamp()` for fluid typography
- Touch-friendly: buttons ≥ 44px tap target, no hover-only interactions
- Test: every template MUST render correctly on 375px (iPhone SE) and 390px (iPhone 14)

#### Rule 2: SEO OPTIMIZED ✅
- Every generated website page MUST include:
  - `<title>` tag with business name + keyword
  - `<meta name="description">` (max 160 chars)
  - `<meta name="viewport">` for mobile
  - Open Graph tags (`og:title`, `og:description`, `og:image`)
  - `<html lang="en">` (or `ms` for Malay)
  - Semantic HTML: `<header>`, `<main>`, `<section>`, `<footer>`, `<nav>`
  - Heading hierarchy: single `<h1>`, proper `<h2>`/`<h3>` nesting
  - `alt` text on all images
  - JSON-LD structured data (LocalBusiness, Organization)
- Performance: all templates load < 3s on 3G
- Image optimization: lazy loading, WebP format

#### Rule 3: BILINGUAL EN/MY (English + Bahasa Melayu) ✅
- **ALL user-facing UI** must support both languages
- Implementation:
  - Platform UI (dashboard, editor, gallery): i18n via locale files
  - Template content: AI generates in user's selected language
  - Template preview: seed data in EN (default) with MY translations available
  - Language toggle: visible in navbar/header of all pages
- Locale files: `src/i18n/locales/en.json`, `src/i18n/locales/ms.json`
- Default locale: `en`
- URL strategy: `/en/...` and `/ms/...` (prefix-based routing)
- Date/currency: EN uses `MYR 299.00`, MY uses `RM299.00`

---

## 2. BMAD WORKFLOW

> **Quy trình chuẩn.** Áp dụng cho mọi feature/module mới. Không áp dụng cho bug fix nhỏ hoặc infra changes.

### 2.1 Tổng quan flow
```
PLAN               BUILD              CHECK             ACT
────               ─────              ─────             ───
project-planner → worker agents  → quality-inspector → orchestrator
(PRD + Stories)   (code + tests)   (audit + verify)   (review + ship)
     ↓                                    ↓
  Readiness Gate                      QA Report
  (PASS/FAIL)                     docs/qa/{feature}.md
```

### 2.2 Khi nào dùng BMAD flow
| Situation | Flow |
|---|---|
| Feature mới có UX phức tạp (AI Builder, Checkout) | **Full BMAD** — PRD → Architecture → Gate → Sprint → QA |
| Feature nhỏ đã rõ yêu cầu (thêm field, CRUD) | **Quick Flow** — Story ngắn → Gate 5 phút → Sprint |
| Bug fix | **Direct** — Describe bug → Fix → Test → PR |
| Infra / DevOps | **Direct** — Task → Implement → Done |

### 2.3 Agent Routing (BMAD Phase → Agent)

| Phase | Agent | Skill(s) | Output |
|-------|-------|----------|--------|
| **PLAN** | `project-planner` | `brainstorming`, `plan-writing` | `docs/prd/{feature}.md` |
| **BUILD (FE)** | `frontend-specialist` | `modern-web-architect` | Components, UI |
| **BUILD (BE)** | `backend-specialist` | `ai-engineer`, `api-patterns` | Server Actions, API |
| **CHECK** | `quality-inspector` | `testing-patterns` | `docs/qa/{feature}.md` |
| **ACT** | `orchestrator` | — | Review + Ship |

> 🔴 **Routing Rule:** WEB project → `frontend-specialist` + `backend-specialist`.  
> MOBILE → `mobile-developer` only. KHÔNG bao giờ dùng sai agent.

### 2.4 BMAD Doc Gate — Required Documents

> 🔴 **RULE: Trước khi code BẤT KỲ feature nào, các file dưới đây PHẢI tồn tại và được approved.**  
> **< 5/5 PASS → HOLD. Không code khi chưa đủ docs.**
>
> **Naming convention**: Tất cả docs dùng format `F{XX}-{feature-name}` (ví dụ: `F10-storefront-commerce.md`)

| # | Document | Path | Created By | Approved By | Content |
|---|----------|------|-----------|-------------|---------|
| 1 | **PRD** | `docs/prd/F{XX}-{name}.md` | `project-planner` | Product Owner | User Story, Gherkin AC, Technical Requirements, 10-Point Checklist |
| 2 | **Architecture** | `docs/architecture/F{XX}-{name}.md` | `backend/frontend-specialist` | Tech Lead | System flow, Component tree, State design, Error matrix |
| 3 | **UI Mockups** | `docs/design/F{XX}-{name}-*.png` | `frontend-specialist` | Product Owner | Desktop + Mobile mockups for all key screens |
| 4 | **API Contract** | Trong PRD §8 hoặc `AI_BUILDER_SPEC.md §14` | `backend-specialist` | — | Endpoint, Request, Response, Error codes |
| 5 | **Dependencies** | Verified by agent | — | — | API keys, Collections ready, Docker OK |

**After build:**

| # | Document | Path | Created By |
|---|----------|------|------------|
| 6 | **QA Report** | `docs/qa/F{XX}-{name}.md` | `quality-inspector` |

### 2.5 BMAD Gate Checklist Template

```
──────────────────────────────────────────────────
BMAD GATE — Feature: [F{XX}-feature-name]
──────────────────────────────────────────────────
☐ 1. PRD exists?           → docs/prd/F{XX}-{name}.md
      Gherkin AC complete?   PASS ☐  /  FAIL ☐

☐ 2. Architecture exists?  → docs/architecture/F{XX}-{name}.md
      Component tree clear?  PASS ☐  /  FAIL ☐

☐ 3. UI Mockups exist?     → docs/design/F{XX}-{name}-*.png
      Mobile + Desktop?      PASS ☐  /  FAIL ☐

☐ 4. API contracts ready?  → In PRD §8 or SPEC.md §8
      Error codes defined?   PASS ☐  /  FAIL ☐

☐ 5. Dependencies resolved?
      API keys configured?   PASS ☐  /  FAIL ☐
      Collections ready?     PASS ☐  /  FAIL ☐

Result: ___/5 PASS → [PROCEED / HOLD]
──────────────────────────────────────────────────
```

### 2.4 User Story Convention
```markdown
# US-[ID]: [Tên feature]
Wave: [N] | Priority: P[0/1/2] | Estimate: [S/M/L/XL]

## Story
As a [user type]
I want to [action]
So that [benefit]

## Acceptance Criteria
GIVEN [context]
WHEN [action]
THEN [outcome]
AND [additional check]

## Definition of Ready
- [ ] UI mockup approved
- [ ] API contract in SPEC.md §8
- [ ] Dependencies confirmed

## Definition of Done
- [ ] 10-Point Checklist pass (§13)
- [ ] TypeScript clean (tsc --noEmit)
```

---

## 3. TECH STACK

### Frontend
```
Framework:    Next.js 15 (App Router)
CMS:          Payload CMS 3.14+
UI Library:   shadcn/ui + Tailwind CSS
State:        Zustand (editor state) + TanStack Query (server state)
AI Streaming: Vercel AI SDK (useChat, useCompletion)
Forms:        React Hook Form + Zod
Animation:    Framer Motion
Preview:      iframe sandboxed
```

### Backend (Payload CMS — integrated)
```
Runtime:      Next.js API Routes + Payload CMS API (auto-generated)
Database:     PostgreSQL 16 via @payloadcms/db-postgres
Storage:      MinIO / AWS S3 (S3-compatible)
```

### AI Services
```
Text Gen:     OpenAI GPT-4o (site generation) + GPT-4o-mini (edits, SEO)
Image Gen:    DALL-E 3
```

### Infra & DevOps
```
Deploy:       Docker (App + PostgreSQL + MinIO)
CDN:          Cloudflare (custom domain SSL)
Monitoring:   Sentry (errors)
```

> **DEPLOY RULE:** LUÔN dùng Docker. KHÔNG `npm install` / `npm run dev` trực tiếp.
> ```
> Chạy:    docker compose up -d
> Rebuild: docker compose build --no-cache && docker compose up -d
> Log:     docker compose logs -f web
> Tắt:     docker compose down
> ```

---

## 4. DESIGN SYSTEM

### Color Tokens
```typescript
export const colors = {
  primary:   '#2563EB', // Blue — CTA, actions
  secondary: '#0EA5E9', // Sky — secondary
  accent:    '#8B5CF6', // Violet — AI features
  success:   '#22C55E',
  warning:   '#F59E0B',
  error:     '#EF4444',
  gray: {
    50: '#F8FAFC', 100: '#F1F5F9', 200: '#E2E8F0',
    300: '#CBD5E1', 400: '#94A3B8', 500: '#64748B',
    600: '#475569', 700: '#334155', 800: '#1E293B',
    900: '#0F172A', 950: '#020617',
  },
  ai: {
    purple: '#7C3AED',
    gradient: 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)',
    glow: 'rgba(139, 92, 246, 0.3)',
  }
}

export const typography = {
  fontDisplay: "'Plus Jakarta Sans', sans-serif",
  fontBody:    "'DM Sans', sans-serif",
  fontMono:    "'JetBrains Mono', monospace",
}
```

### Component Conventions
- 3 states bắt buộc: **Loading** (Skeleton), **Error** (Alert + retry), **Empty** (icon + title + CTA)
- Button loading: `disabled + spinner` — không double submit
- Form: inline Zod validation, không alert popup
- Toast: mọi action đều có toast feedback
- Modal: ESC + click outside để close

---

## 5. SCREEN INVENTORY

### Group A: Onboarding & AI Builder
| Screen | Path | Priority | Story |
|--------|------|----------|-------|
| Register / Login | `/register`, `/login` | P0 | US-001 |
| Onboarding Welcome | `/onboarding` | P0 | US-001 |
| **AI Chat Builder** | `/builder/new` | P0 🌟 | US-002 |
| Template Gallery | `/templates` | P1 | — |

### Group B: AI Editor (Core Product)
| Screen | Path | Priority | Story |
|--------|------|----------|-------|
| **AI Editor** (chat + preview) | `/editor/:siteId` | P0 🌟 | US-004 |
| Page Manager | Editor tab | P0 | US-005 |
| Block Library | Editor tab | P1 | — |

### Group C: Dashboard & Management
| Screen | Path | Priority | Story |
|--------|------|----------|-------|
| Dashboard | `/dashboard` | P0 | US-006 |
| Media Library | `/dashboard/media` | P1 | — |
| Site Settings | `/dashboard/sites/:id/settings` | P1 | — |

### Group D: E-commerce (Wave 4)
| Screen | Path | Priority | Story |
|--------|------|----------|-------|
| Products List | `/dashboard/products` | P0 | US-007 |
| Product Create/Edit | `/dashboard/products/:id` | P0 | US-007 |
| Cart + Checkout | Storefront `/cart`, `/checkout` | P0 | US-008 |

### Group E: SEO & Analytics (Wave 4-5)
| Screen | Path | Priority | Story |
|--------|------|----------|-------|
| **SEO Dashboard** | `/dashboard/seo` | P0 🌟 | US-009 |
| Analytics | `/dashboard/analytics` | P1 | — |
| Billing | `/dashboard/billing` | P1 | — |

### Group F: Published Storefront
| Screen | URL Pattern | Priority | Story |
|--------|------------|----------|-------|
| Home | `slug.primeweb.app/` | P0 | US-010 |
| Pages | `slug.primeweb.app/:pageSlug` | P0 | US-010 |

---

## 6. USER STORIES (P0)

> Stories linked to separate file: `user_stories_p0.md`  
> Full stories with Gherkin AC: US-001 → US-010

| ID | Feature | Wave | Size | Key AC |
|----|---------|------|------|--------|
| US-001 | Register & Welcome | 1 | S | Register → auto-login → /onboarding |
| US-002 ⭐ | AI Chat Builder | 3 | XL | Chat → generate site < 60s → preview |
| US-003 | Store Setup | 1 | S | AI Chat collects info (no form) |
| US-004 ⭐ | AI Editor (Split) | 3 | XL | 3-panel: Chat + Preview + Settings |
| US-005 | Page Manager | 3 | M | CRUD pages + soft delete |
| US-006 | Dashboard | 1 | M | Stats + site cards + empty state |
| US-007 | Products CRUD + AI | 4 | L | AI description, soft delete |
| US-008 ⭐ | Checkout (Stripe) | 4 | XL | Cart → payment → confirm |
| US-009 ⭐ | SEO Dashboard | 4 | L | Score 0-100, AI fix all |
| US-010 | Publish Site | 3 | M | Publish → live subdomain |

---

## 7. AI FEATURES SPEC

> 📖 **Full technical spec:** [`docs/AI_BUILDER_SPEC.md`](docs/AI_BUILDER_SPEC.md) (700 dòng, 16 sections)
>
> File này chỉ chứa **summary**. Chi tiết system prompts, block schemas, SSE protocol,
> error handling, và API contracts nằm trong file trên.

### 7.1 AI Features Index

| Feature | Spec Section | PRD | Architecture | Priority |
|---------|-------------|-----|-------------|----------|
| AI Chat Builder | [SPEC §2](docs/AI_BUILDER_SPEC.md#2-ai-chat-builder) | `docs/prd/ai-chat-builder.md` | `docs/architecture/ai-chat-builder.md` | P0 🌟 |
| AI Editor | [SPEC §3](docs/AI_BUILDER_SPEC.md#3-ai-editor) | `docs/prd/ai-editor.md` | `docs/architecture/ai-editor.md` | P0 🌟 |
| Inline AI Edit | [SPEC §4](docs/AI_BUILDER_SPEC.md#4-inline-ai-edit) | `docs/prd/inline-edit.md` | — (trong ai-editor) | P0 |
| AI SEO Engine | [SPEC §5](docs/AI_BUILDER_SPEC.md#5-ai-seo-engine) | `docs/prd/ai-seo-engine.md` | `docs/architecture/ai-seo-engine.md` | P0 🌟 |
| AI Image Generation | [SPEC §6](docs/AI_BUILDER_SPEC.md#6-ai-image-generation) | — (trong ai-chat-builder) | — | P1 |
| Block Renderer | [SPEC §7](docs/AI_BUILDER_SPEC.md#7-block-output-schema) | `docs/prd/block-renderer.md` | — | P0 |

### 7.2 AI Cost Optimization (7 Strategies)
1. **Model routing:** GPT-4o (generation) vs GPT-4o-mini (edits) — 15x cheaper
2. **Block JSON output:** ~200 tokens vs ~2000 tokens HTML — 10x cheaper
3. **Response caching:** Same industry = cache template — 90% savings
4. **Template-first:** Load template → AI customize only — 8x cheaper
5. **Minimal context:** Send only active block JSON, not full page — 10x cheaper
6. **Rate limits per tier:** See §7.3
7. **Lazy AI:** 70% operations don't need AI (drag, reorder, color pick)

### 7.3 AI Rate Limits
| Action | Free | Starter ($9) | Pro ($29) | Business ($79) |
|--------|------|-------------|-----------|----------------|
| Site generation | 1x total | 5/month | 20/month | Unlimited |
| Chat edits | 20/day | 100/day | 500/day | Unlimited |
| Image generation | 3/day | 10/day | 50/day | Unlimited |
| SEO analysis | 3/day | 10/day | 30/day | Unlimited |

---

## 8. API CONTRACTS

> Payload CMS auto-generates REST/GraphQL APIs. Custom endpoints below.

### AI Endpoints (Server Actions)
```typescript
// AI Chat Builder — SSE streaming
'use server'
generateSite(prompt: string, siteId: string)
  → Stream: progress | content_chunk | done | error

// AI Editor Chat — SSE streaming
chatEdit(siteId: string, messages: Message[], context: { pageId, blockId? })
  → Stream: message + changes[]

// Inline AI Edit
inlineEdit(siteId: string, blockId: string, currentContent: string, instruction: string)
  → { content: string, alternatives?: string[] }

// AI SEO
analyzeSEO(siteId: string)
  → { score: number, issues: Issue[], suggestions: string[] }

optimizeAllSEO(siteId: string)
  → Stream: progress per page
```

### Site Management (Payload API + custom)
```typescript
// Payload CMS auto-generated:
GET/POST/PATCH/DELETE /api/sites
GET/POST/PATCH/DELETE /api/pages
GET/POST/PATCH/DELETE /api/media

// Custom:
POST /api/sites/:id/publish
POST /api/sites/:id/unpublish
POST /api/pages/:pageId/blocks/reorder   // drag-drop
```

### Storefront (Public, no auth)
```typescript
GET /api/storefront/:slug              // Site + theme
GET /api/storefront/:slug/:pageSlug    // Page + blocks
```

---

## 9. DATA MODELS

> Implemented as Payload CMS Collections. Fields below map to Payload field configs.

### Sites Collection
```
id, slug (unique), name, description, logoUrl
customDomain (unique), subdomain (unique)
isPublished, publishedAt
themeConfig (JSON): { primaryColor, secondaryColor, fontHeading, fontBody, colorMode }
aiContext (JSON): AI memory about this site
seoConfig (JSON): site-wide SEO defaults
tenant (relationship → tenants)
deletedAt (date, nullable) ← SOFT DELETE
```

### Pages Collection
```
id, slug, title, pageType (HOME|ABOUT|CONTACT|BLOG|CUSTOM)
isPublished, sortOrder
blocks (layout field → block configs)
seoTitle, seoDesc, ogImage, schemaOrg (JSON-LD)
site (relationship → sites)
tenant (relationship → tenants)
deletedAt ← SOFT DELETE
```

### Blocks (Layout Field on Pages)
```
Each block: { blockType, variant, config (JSON with content fields) }
Types: navigation, hero, about, features, testimonials, contact,
       gallery, footer, pricing, faq, cta, stats, team, blog-list,
       video, logo-cloud, newsletter, products-grid, products-featured, custom-html
```

### Other Collections
```
tenants:       id, slug, customDomain, plan, stripeCustomerId, deletedAt
users:         id, email, role (super-admin|owner|editor|viewer), tenants[]
media:         id, file, alt, isAIGenerated, tenant
templates:     id, name, category, blocks (JSON), themeDefaults
subscriptions: id, plan, status, stripeSubscriptionId, tenant
ai-messages:   id, role, content, changes (JSON), pageId, site
```

---

## 10. UX RULES

### Navigation Flows
```
Register success   → auto-login → /onboarding          (KHÔNG /login)
Onboarding         → /builder/new                       (KHÔNG /dashboard)
Site generated     → /editor/:siteId
Publish success    → toast + open live URL in new tab
Delete anything    → confirm modal + 5s undo toast (soft delete)
401 response       → redirect /login
```

### Toast Conventions
```
SUCCESS:    green,  3s, bottom-right
ERROR:      red,    5s, bottom-right, kèm "Chi tiết" nếu có
INFO:       blue,   3s, auto-dismiss
AI ACTION:  violet, 3s, kèm "Xem thay đổi"
UNDO:       gray,   5s, kèm "Hoàn tác" button
```

### AI Editor UX
- Chat panel: 380px fixed trái, collapsible trên mobile
- Live preview: changes apply realtime
- Auto-save: debounce 3s sau mỗi thay đổi
- Undo/Redo: Ctrl+Z / Ctrl+Y — áp dụng cả AI changes
- Draft/Published: badge rõ ràng ở header

---

## 11. SECURITY & AUTH

```
Auth:           Payload CMS built-in (JWT + sessions)
Rate limiting:  AI gen per tier (§7.5), Login 5x/15min
RBAC Roles:     OWNER > ADMIN > EDITOR > VIEWER
Multi-tenant:   MỌI query PHẢI scope theo tenant field + deletedAt IS NULL
Soft delete:    KHÔNG bao giờ hard delete
CORS:           Whitelist origin
CSP:            Strict headers cho storefront
Input:          Payload parameterized queries (SQL injection proof)
XSS:            Sanitize user input (Payload built-in)
```

---

## 12. SEO IMPLEMENTATION

### Per-page Metadata (Next.js App Router)
```typescript
export async function generateMetadata({ params }): Promise<Metadata> {
  const page = await getPageWithSEO(params.slug, params.pageSlug)
  return {
    title: page.seoTitle || page.title,
    description: page.seoDesc,
    openGraph: { title: page.seoTitle, description: page.seoDesc, images: [page.ogImage] },
    robots: { index: true, follow: true },
  }
}
```

### Auto-generate
```
When site published: sitemap.xml, robots.txt
Per page: metaTitle, metaDescription, ogImage
Per product: JSON-LD Product schema
```

---

## 13. 10-POINT DONE CHECKLIST

> **Bắt buộc** mọi screen/feature trước PR.

```
☐ 1.  LOADING STATE     — Skeleton (không spinner đơn lẻ)
☐ 2.  EMPTY STATE       — Icon + title + CTA (không blank)
☐ 3.  ERROR STATE       — Toast đỏ + nút Thử lại
☐ 4.  FORM VALIDATION   — Zod inline, lỗi dưới field
☐ 5.  BUTTON STATES     — disabled + spinner khi loading
☐ 6.  TOAST FEEDBACK    — Mọi mutation có toast
☐ 7.  AUTH REDIRECT     — 401 → /login
☐ 8.  MOBILE 375px      — Layout không vỡ
☐ 9.  TYPESCRIPT CLEAN  — Zero any, tsc --noEmit pass
☐ 10. TESTS PASS        — npm test (Vitest unit + integration)
```

---

## 14. API RESPONSE FORMAT

```typescript
// Success
{ success: true, data: { ... }, meta?: { page, total, limit } }

// Error
{ success: false, error: { code: 'VALIDATION_ERROR', message: '...', details?: [] } }

// Codes: AUTH_REQUIRED (401), FORBIDDEN (403), NOT_FOUND (404),
//        VALIDATION_ERROR (422), AI_RATE_LIMIT (429), INTERNAL_ERROR (500)
```

> **Note:** Payload CMS REST API has its own format. Custom endpoints follow above.

---

## 15. 6-LAYER ARCHITECTURE CHECKLIST

> Mỗi feature mới, check đủ 6 layers trước khi code.

```
Layer 1 — PRODUCT/UX:     UI mockup approved, 3 states, mobile, user flow
Layer 2 — API/BACKEND:    Endpoint documented, validation, response format
Layer 3 — DATA/STORAGE:   Collection updated, indexes, soft delete, tenant scope
Layer 4 — SECURITY/AUTH:  Auth guard, rate limit, RBAC, input sanitization
Layer 5 — OPS/RELIABILITY: Sentry logging, background jobs if needed
Layer 6 — BUSINESS:       Subscription tier check, audit log
```

---

## 16. TEST REQUIREMENTS

### Unit Tests
```
Target: > 70% coverage cho business logic
Must test: AI prompt builders, Zod schemas, utility functions
```

### E2E Tests (Playwright) — Critical Paths
```
☐ P0: Register → AI Builder → Generate → Publish
☐ P0: AI Chat Editor — change content
☐ P0: Add Product → Live on storefront
☐ P1: Checkout (Cart → Stripe → Confirm)
☐ P1: SEO Dashboard → Fix All
```

---

## 17. BUILD TRACKING

> 📖 **Full build plan:** [`docs/PLAN-ai-webbuilder.md`](docs/PLAN-ai-webbuilder.md)  
> Bao gồm: 10 features, agent assignments, sprint order, dependency graph, verification plan.

### Quick Summary

| Wave | Focus | Status |
|------|-------|--------|
| **Wave 1** | Foundation (Next.js, Payload, Docker, SPEC) | ✅ DONE |
| **Wave 2** | Auth + Onboarding + Dashboard | ✅ DONE |
| **Wave 3** | AI Core (Builder + Editor + Blocks) | 🔄 CURRENT |
| **Wave 3.5** | Premium Templates + i18n EN/MY | ✅ DONE |
| **Wave 4** | Commerce + SEO + Storefront | ⬜ NEXT |
| **Wave 5** | Polish + Testing + Launch | ⬜ |

### Sprint Order (Wave 3+)
```
Sprint 1: F-05 Block Renderer      ← Foundation cho mọi thứ
Sprint 2: F-01 AI Chat Builder      ← Core USP
Sprint 3: F-02 AI Editor + F-06 Undo + F-07 Auto-Save
Sprint 4: F-03 Inline Edit + F-08 Publish
Sprint 5: F-04 SEO Engine + F-09 Images + F-10 Templates
```

> Chi tiết agent assignments, dependencies, và acceptance criteria xem [PLAN](docs/PLAN-ai-webbuilder.md).

---

## 18. MEASURE & ITERATE

### Key Events to Track
```typescript
// Onboarding funnel
track('register_completed')
track('ai_builder_started')
track('ai_builder_completed', { generationTimeSeconds })
track('site_published', { timeToPublishMinutes })

// Editor engagement
track('ai_chat_message_sent')
track('inline_edit_used', { blockType })
track('undo_used')

// Commerce
track('product_added', { hasAIDescription })
track('checkout_completed', { paymentMethod, total })
```

### KPIs
| Metric | Target |
|--------|--------|
| Time to first website (register → publish) | < 10 min |
| AI generation success rate | > 95% |
| Onboarding completion rate | > 70% |
| Site publish rate | > 50% |

---

## 19. ENVIRONMENT VARIABLES TEMPLATE

```bash
# .env — KHÔNG commit, add vào .gitignore

# ─── App ───────────────────────────────────────
NODE_ENV=development
NEXT_PUBLIC_SITE_URL=http://localhost:3005

# ─── Database ──────────────────────────────────
DATABASE_URI=postgresql://webstore:webstore@postgres:5432/webstore
PAYLOAD_SECRET=your-payload-secret-min-32-chars

# ─── AI Services ───────────────────────────────
OPENAI_API_KEY=sk-...

# ─── Storage (MinIO / S3) ─────────────────────
S3_ENDPOINT=http://minio:9000
S3_ACCESS_KEY=webstore
S3_SECRET_KEY=webstore123
S3_BUCKET=webstore-media

# ─── Payments ──────────────────────────────────
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# ─── Monitoring ────────────────────────────────
SENTRY_DSN=https://...@sentry.io/...

# ─── Cloudflare (custom domain) ────────────────
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_ZONE_ID=...
```

---

## PROJECT STRUCTURE

```
web-store/
├── .cursor/rules/           ← Cursor AI rules (BMAD + 10-Point + Deploy)
├── docs/                    ← 📂 BMAD Documents (governed by §2)
│   ├── README.md            ← Doc hub overview
│   ├── AI_BUILDER_SPEC.md   ← AI features deep spec (referenced by §7)
│   ├── PLAN-ai-webbuilder.md← Build plan (referenced by §17)
│   ├── prd/                 ← PRDs per feature (BMAD Gate §2.4)
│   ├── architecture/        ← Architecture notes (BMAD Gate §2.4)
│   ├── stories/             ← User stories (Gherkin AC)
│   ├── qa/                  ← QA reports (after build)
│   ├── decisions/           ← Architecture Decision Records
│   └── tracking/            ← Walkthroughs, screenshots
├── src/
│   ├── app/
│   │   ├── (frontend)/      ← Marketing + Onboarding
│   │   ├── (dashboard)/     ← Dashboard with sidebar
│   │   ├── (builder)/       ← AI Chat Builder (full-screen)
│   │   ├── (editor)/        ← AI Editor (3-panel)
│   │   ├── (payload)/       ← Payload CMS admin + API
│   │   └── sites/[slug]/    ← Published storefront (SSR)
│   ├── blocks/              ← Block definitions (config + component + editor)
│   ├── collections/         ← Payload CMS collections
│   ├── components/
│   │   ├── ui/              ← shadcn/ui base
│   │   ├── dashboard/       ← Dashboard components
│   │   ├── editor/          ← Editor components
│   │   └── site-renderer/   ← SSR render engine
│   ├── hooks/               ← Custom hooks
│   ├── lib/                 ← Utilities (ai, stripe, s3)
│   │   └── ai/config.ts     ← AI cost optimization (7 strategies)
│   └── payload.config.ts
├── SPEC.md                  ← THIS FILE (HIẾN PHÁP — Source of Truth)
├── docker-compose.yml
└── package.json
```

---

## 20. FEATURE REGISTRY (UNIFIED)

> **Master index** — Trạng thái docs và build cho mỗi feature.
> Cập nhật bảng này khi tạo PRD, Architecture, hoặc hoàn thành sprint.
> **Ref:** [`docs/malaysia-market-context.md`](docs/malaysia-market-context.md) cho MY market priorities.

### Legend
| Icon | Meaning |
|------|---------|
| ⬜ | Not started |
| 📝 | Draft (created, pending approval) |
| ✅ | Approved / Done |
| 🚀 | Shipped (live) |
| — | Not required for this feature |

### Feature Status

| ID | Feature | Wave | Priority | PRD | Stories | Code | Status |
|----|---------|------|----------|-----|---------|------|--------|
| **F01** | AI Chat Builder | 3 | P0 🌟 | ✅ `F01-ai-chat-builder.md` | ✅ | ✅ Built | ⚠️ Needs UI polish |
| **F02** | Auth (Login/Register/Forgot/Reset) | 1 | P0 | ✅ `F02-auth.md` v2.0 | ✅ | ✅ Rebuilt | ✅ SaaS Bible compliant |
| **F03** | Dashboard Overview | 1 | P0 | ✅ `F03-dashboard.md` | ✅ | ✅ Built | ⚠️ Needs UI polish |
| **F04** | Block Renderer Engine | 3 | P0 | ✅ `F04-block-renderer.md` | — | ⚠️ Monolith | 🔴 Needs refactor |
| **F05** | AI Editor (Split Screen) | 3 | P0 🌟 | 📝 `F05-ai-editor.md` | ✅ | ✅ Basic | ⚠️ Needs rebuild |
| **F06** | Onboarding Flow | 1 | P0 | 📝 `F06-onboarding.md` | — | ✅ Basic | ⚠️ Needs rebuild |
| **F07** | Template Gallery | 3.5 | P1 | 📝 `F07-template-gallery.md` | — | ⚠️ Static | ⚠️ Needs rebuild |
| **F08** | Publish Flow | 3 | P0 | 📝 `F08-publish-flow.md` | ✅ | ❌ Not built | 🔴 Needs build |
| **F09** | Products CRUD | 4 | P0 | 📝 `F09-products-crud.md` | ✅ | ✅ Basic | ⚠️ Needs polish |
| **F10** | Storefront Commerce | 5 | P0 🌟 | ✅ `F10-storefront-commerce.md` | ✅ | ✅ Built | ⚠️ Needs UI polish |
| **F11** | Orders Management | 4 | P0 | 📝 `F11-orders-management.md` | — | ✅ Basic | ⚠️ Needs polish |
| **F12** | SEO Dashboard | 4 | P0 🌟 | 📝 `F12-seo-dashboard.md` | ✅ | ✅ Basic | ⚠️ Needs rebuild |
| **F13** | Analytics Dashboard | 5 | P1 | 📝 `F13-analytics-dashboard.md` | — | ✅ Basic | ⚠️ Needs polish |
| **F14** | Undo/Redo System | 3 | P0 | 📝 `F14-undo-redo.md` | — | ❌ Not built | 🔴 Needs build |
| **F15** | Auto-Save & Draft | 3 | P0 | 📝 `F15-auto-save-draft.md` | — | ❌ Not built | 🔴 Needs build |
| — | i18n EN/MY (Bilingual) | 3.5 | P0 | — | — | ⚠️ Partial | In progress |
| — | Payment Gateway (FPX) | 6 | P0 🌟 | ⬜ | — | ❌ | Future wave |
| — | WhatsApp Integration | 6+ | P1 | ⬜ | — | ❌ | Future wave |
| — | Halal Trust Badge | 6+ | P2 | ⬜ | — | ❌ | Future wave |

### BMAD Gate Quick Check

```
🔴 Trước khi bắt đầu code Feature X:
   1. Check bảng Feature Registry ở trên
   2. PRD column = ✅ or 📝?  → Nếu ⬜ → STOP, tạo PRD trước
   3. Architecture column = ✅ hoặc —?  → Nếu ⬜ → STOP, tạo architecture trước
   4. UI Mockups = ✅?  → Nếu ⬜ → STOP, tạo mockups trước
   5. Chạy BMAD Gate Checklist (§2.5)
   6. 5/5 PASS → bắt đầu code
```

---

> **Cursor reminder:**  
> 1. Luôn `@SPEC.md` khi bắt đầu feature — §20 (Feature Registry) để check docs status  
> 2. §2 (BMAD Gate) bắt buộc trước khi code  
> 3. §13 (10-Point Checklist) bắt buộc trước khi merge PR  
> 4. §7 → link tới `AI_BUILDER_SPEC.md` cho chi tiết AI features  
> 5. §17 → link tới `PLAN-ai-webbuilder.md` cho build plan  
> 6. [`docs/malaysia-market-context.md`](docs/malaysia-market-context.md) cho MY market insights
