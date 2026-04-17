# Researcher 02 — Gen & Render Pipeline Entry Points

## AI Gen Paths

### OpenAI Path (gpt-4o with fallback)
- **File:** `src/lib/ai/openai-generator.ts`
- **Entry:** `generateSiteWithAI(businessInfo, extraInstructions?, language?, referencePrompt?): Promise<{ result: GenerationResult; events: SSEEvent[] }>`
- **Signature:** 
  ```ts
  businessInfo: {businessName, industry, shortDescription, products}
  language: 'en' | 'ms' | 'vi' | 'auto' (default)
  Returns: GenerationResult {siteName, siteType, blocks[], pages?, seo, language, theme}
  ```
- **Deps:** Requires `OPENAI_API_KEY` env. Falls back to `generateBlocks()` if missing.
- **SSE Events:** 'step' (progress), 'theme_set', 'block_complete', 'seo_generated', 'error', 'done'

### Rule-Based Fallback (Seeded PRNG)
- **File:** `src/lib/ai/generate-blocks.ts`
- **Entry:** `generateBlocks(prompt: string, seed?: number): GenerationResult` (pure, no deps)
- **Seed:** Accepts optional `seed` param → deterministic variant selection via `createSeededRandom(seed?)`
- **Intent Parser:** Detects type from prompt keywords (restaurant, ecommerce, portfolio, blog, business)
- **Returns:** Same `GenerationResult` shape as OpenAI path

## Template Composition Path

### Blueprint-Driven (Phase 3 — 56 new templates)
- **File:** `src/lib/ai/template-composer.ts`
- **Entry:** `composeFromBlueprint(preset: TemplatePreset, compositionSeed?: number): TemplateSeed`
- **Preset Shape:** 
  ```ts
  TemplatePreset {
    id, name, category, businessIndex, personality, themePreset,
    pages: PageBlueprint[],
    tags[], description
  }
  ```
- **Returns:** `TemplateSeed { name, description, category, defaultTheme, defaultBlocks, pages?, isPremium, isFeatured }`

### Definition-Based Tier System (Phase 2 — ~48 old templates)
- **Entry:** `composeTemplate(input: ComposerInput): TemplateSeed`
- **ComposerInput:**
  ```ts
  { category: string, businessIndex: number, variant: 'starter'|'professional'|'premium', 
    themePreset, compositionSeed?: number }
  ```
- **Variants:** Tier system picked per seed (deterministic when `compositionSeed` set)

### Internal Block Builders
- **Functions:** `buildNavigation`, `buildHero`, `buildFeatures`, `buildTestimonials`, `buildContact`, `buildFooter`, `buildStats` + 15 more category-specific builders
- **Signature:** Each takes `(biz: BusinessSample, category?: string, ...): Record<string, unknown>`
- **No buildHomePage export:** Composers directly assemble blocks into pages[] array

## Render Pipeline

### Entry Component
- **File:** `src/components/site-renderer/SiteRenderer.tsx`
- **Props:** `SiteRendererProps { site, page, pages?, isEditor?, siteId?, isOwner? }`
- **Site shape:** `{ theme?: {primaryColor, fontHeading, fontBody, ...}, ... }`
- **Page shape:** `{ layout?: (block[]), ... }`
- **Renderer Logic:**
  - Resolves theme via `resolveTheme()` → generates CSS custom properties
  - Iterates `page.layout[]` → looks up block type in `blockRegistry`
  - Wraps each block in `BlockErrorBoundary`
  - For editor mode: rewrites internal nav links to '#'

### Preview Routes
- **Editor Preview:** `GET /app/(preview)/preview/[siteId]/page.tsx` → renders site in iframe
- **Public Site:** `GET /sites/[slug]/[[...path]]/page.tsx` → renders via `getPayload()` + `SiteRenderer`
- **404 Fallback:** `src/app/sites/[slug]/not-found.tsx` → renders 404 page with SiteRenderer

### Block Registry Integration
- **Entry:** `blockRegistry.has(blockType)` check, then `blockRegistry.getBlockMeta(blockType)`
- **Variant Selection:** Deterministic per seed in composer via `selectVariant(blockType, seed, category)`

### Can Bypass CMS?
- **YES:** Pass blocks[] directly to SiteRenderer without saving to Payload CMS
- **How:** `<SiteRenderer site={{...theme}} page={{layout: blocks[]}} />`
- **Test Path:** `/test-blocks/page.tsx` already does this for verification

## Category Catalog

### 14 Categories (from template-definitions.ts + template-composer.ts)
1. **restaurant** — menu-display, booking-widget, gallery
2. **ecommerce** — products-grid, review-cards, pricing
3. **beauty** — gallery-masonry, booking-widget, before-after
4. **tech** — feature-comparison, pricing, video-showcase, stats
5. **health** — doctor-profile, booking-widget, review-cards
6. **education** — class-schedule, video-showcase, review-cards
7. **realestate** — property-card, review-cards
8. **fitness** — class-schedule, booking-widget, review-cards
9. **creative** — portfolio-grid, video-showcase, review-cards
10. **business** — service-cards, review-cards, client-logos
11. **fnb** — menu-display, review-cards
12. **events** — countdown-timer, booking-widget, review-cards
13. **blog** — blog-list, social-proof, review-cards
14. **travel** — booking-widget, review-cards, video-showcase

### Category DNA (template-definitions.ts)
- **CATEGORY_DNA:** Maps each category → `{ signatureBlocks[], mandatoryHomepageOrder[], subPageSet[], visualMood }`
- **Example (restaurant):** mandatoryHomepageOrder = [navigation, hero, logo-cloud, **menu-display**, gallery, cta, testimonials, faq, newsletter, footer]

### Template Count
- **v1 (legacy):** 10 industry templates (seed.ts)
- **v2 (definitions):** ~48 composed templates (composeTemplate)
- **v3 (blueprints):** 56 premium templates (composeFromBlueprint from TEMPLATE_PRESETS)

## Existing Scripts

### API Seed Endpoint
- **Route:** `POST /api/templates/seed`
- **Query modes:**
  - Default: seed 10 legacy templates (SEED_TEMPLATES)
  - `?v2=true`: seed ~48 from TEMPLATE_DEFINITIONS via composeTemplate
  - `?v3=true`: seed 56 from TEMPLATE_PRESETS via composeFromBlueprint
  - `?force=true`: delete existing before seeding
  - `?dry=true`: return JSON without writing to DB
- **Auth:** withAuth (JWT) OR `x-db-setup-key` header for internal db-setup.js

### CLI/Batch Scripts (scripts/)
- `seed.ts` — legacy seed (runs via db-setup.js)
- `seed-local.ts` — local dev template seed
- `db-setup.js` — migration executor + auto-seed orchestrator (runs as Docker CMD)
- No dedicated "gen-and-render" test harness yet

## Playwright Status
- **Installed:** YES
- **Config:** `playwright.config.ts` (root)
- **Test dir:** `./e2e/`
- **Projects:** smoke (no-auth), setup (auth), chromium (authenticated)
- **Workers:** 1 (sequential, shares auth state)
- **Existing tests:** Auth setup + authenticated flows (no gen/render harness)

## Harness Entry-Point Options (Ranked)

### Option 1: Direct Composition + Preview Route (BEST)
1. Loop N categories × seeds
2. Call `composeFromBlueprint(preset, seed)` or `composeTemplate(input)` 
3. Get `TemplateSeed { pages[] }` with blocks[] pre-built
4. POST to `/api/preview` or render directly via SiteRenderer
5. Screenshot via Playwright
6. **Pros:** No DB writes, no auth, pure JS logic, can run offline
7. **Cons:** Need mock `getPayload()` for site context

### Option 2: Seed + Playwright E2E
1. POST `/api/templates/seed?dry=true` → get all composed seeds
2. For each seed, create temp Site in DB (quick)
3. Visit `/preview/[siteId]` in Playwright
4. Screenshot, assert block presence, detect visual regressions
5. **Pros:** Tests real rendering pipeline, catches DB issues
6. **Cons:** Slower, needs DB setup, more integration risk

### Option 3: Node CLI Script (Fallback)
1. Write `scripts/test-harness-gen.ts`
2. Import `composeFromBlueprint`, `generateBlocks`, `SiteRenderer` (SSR render)
3. Loop categories, compose, render to HTML, diff snapshots
4. **Pros:** Standalone, can pipe HTML to percy/etc
5. **Cons:** Requires Node internals, SiteRenderer not designed for SSR

## Unresolved Questions

1. **Playwright @/ path imports:** Can Playwright tests import from `@/lib/ai` or need to mock?
2. **SiteRenderer in SSR:** Can we render component to HTML outside Next.js runtime for snapshot testing?
3. **Block variants:** How many variants exist per block type, and are broken variants already filtered?
4. **Theme presets:** How are RESTAURANT_PRESETS, etc. defined and can we loop them?
5. **V3 blueprint count:** TEMPLATE_PRESETS says 56 — where are they defined? Are they in code or DB?
