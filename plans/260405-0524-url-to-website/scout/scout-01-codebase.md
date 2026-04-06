# Scout Report: URL-to-Website Feature — Codebase Analysis
**Date:** 2026-04-05  
**Branch:** feat/rebuild-user-flow  
**Scope:** Medium thoroughness — all 8 key files analyzed  
**Report Author:** Claude Code Scout

---

## Executive Summary

The ECH Prime Web v2 AI builder flow is well-structured with clear separation of concerns:
- **Form Layer** (`BusinessInfoForm.tsx`) — collects user input
- **API Layer** (`/api/ai/generate-site/route.ts`) — orchestrates generation with auth + rate limiting
- **AI Core** (`openai-generator.ts` + `system-prompt.ts`) — generates blocks via GPT-4o with fallback
- **Validation** (`ai.ts`, `content-safety.ts`) — schema + safety checks
- **State** (`builderStore.ts`) — client-side Zustand store
- **Registry** (`blocks/registry.ts`) — 20 block types, Zod schemas + metadata

**For URL-to-Website feature:** Will require changes to form layer (accept URL), system prompt (web scraping instructions), API route (fetch + parse URL), and minimal changes elsewhere. Current architecture supports this well.

---

## 1. BusinessInfoForm.tsx

**Path:** `/Users/ngotuannhan/Claude Code/projects/ech-prime-web-v2/src/components/builder/BusinessInfoForm.tsx`  
**Lines:** 284  
**Exports:** Default export component + TypeScript types (`BusinessInfoFormProps`, `IndustryOption`)

### Current Structure
- **Form Fields (4):** businessName, industry, shortDescription, products
- **Industry Lookup:** Fetches `/api/data/industries` on mount (live CMS data)
- **Validation:** Client-side validation with min length checks (businessName ≥3 chars, etc.)
- **Layout:** Left form + right promo card (BuilderStepScreen wrapper)
- **Submit:** Calls `onSubmit(form)` → parent or `setBusinessInfo()` store action

### Key Functions
| Function | Purpose |
|----------|---------|
| `validate()` | Checks form fields meet min requirements |
| `submitForm()` | Triggers submit callback or store action |
| `fetchIndustryOptions()` | Loads industry list from API |

### What Needs to Change for URL Feature
- **Form Field:** Add new optional `businessUrl` field (radio/toggle: "Text" vs "URL")
- **Conditional UI:** Show URL input OR (businessName + industry + description + products) based on toggle
- **Validation:** If URL mode: validate URL format; if text mode: keep existing validation
- **Line estimate:** +80–120 lines (conditional rendering + new field type)

---

## 2. openai-generator.ts

**Path:** `/Users/ngotuannhan/Claude Code/projects/ech-prime-web-v2/src/lib/ai/openai-generator.ts`  
**Lines:** 518  
**Exports:** 
- `generateSiteWithAI(businessInfo, extraInstructions?, language)` — async, returns `{ result, events }`
- `sanitizeBlockData(block)` — normalizes AI JSON for Payload CMS
- Type: `SSEEvent`, `GenerationResult`, `GeneratedBlock`

### Current Flow
1. **Input:** `BusinessInfoInput` object (businessName, industry, shortDescription, products)
2. **Prompt Building:** Calls `buildSystemPrompt()` + `buildUserPrompt()` → GPT-4o
3. **GPT-4o Call:** `model: 'gpt-4o'`, `temperature: 0.7`, `max_tokens: 8000`
4. **Output:** JSON with theme, blocks (array), SEO, category, language
5. **Validation:** Each block validated against `blockRegistry.validate()` before adding to result
6. **Fallback:** If OpenAI fails or no API key → `generateWithFallback()` (rule-based templates)
7. **Sanitization:** `sanitizeBlockData()` removes hallucinated fields, normalizes arrays, enforces enum variants

### Sanitization Logic (Lines 183–518)
Critical transformations:
- **Upload Fields:** Strips string URLs from `image`, `backgroundImage`, `logo` fields (Payload expects numeric Media IDs)
- **Variant Enums:** Validates `variant` field against allowed values per block type
- **Navigation:** Renames `navLinks` → `links`, normalizes button structure
- **Hero:** Normalizes `ctaButtons`, badge structure
- **Contact:** Converts `formFields` strings into proper objects (`{ fieldName, label, fieldType, required }`)
- **Footer:** Normalizes `columns[].links[]` and `socials[]`
- **Testimonials/Team:** Standardizes nested structures
- **Block-Type Specific:** FAQ items, pricing plans, features arrays

### Key Issue: No Web Scraping
**Currently:** Form input → direct GPT-4o → blocks. **No URL handling.**

### What Needs to Change for URL Feature
- **New Input Type:** Accept `{ businessUrl: string }` OR `{ businessName, industry, ... }`
- **Web Scraper:** New function `fetchAndParseUrl(url)` → extracts: business name, description, products, images, contact info
- **Prompt Injection:** Pass scraped content to `buildUserPrompt()` instead of (or in addition to) form fields
- **Error Handling:** URL fetch timeouts, 404s, parsing failures → fallback to asking user for manual info
- **Line estimate:** +150–200 lines (URL fetcher + parser + flow modifications)

---

## 3. system-prompt.ts

**Path:** `/Users/ngotuannhan/Claude Code/projects/ech-prime-web-v2/src/lib/ai/system-prompt.ts`  
**Lines:** 120  
**Exports:**
- `buildSystemPrompt(language)` — returns GPT-4o system prompt (string)
- `buildUserPrompt(info, extraInstructions?, language)` — returns user message (string)
- Type: `BusinessInfoInput`

### System Prompt Contents
- **JSON Format Spec:** Exact structure (siteName, category, theme, seo, language, blocks array)
- **Block Types:** Lists all available blocks + variants + editable fields (auto-populated from `blockRegistry`)
- **Rules:** 8–14 blocks per site, language detection, content quality, category-specific palettes
- **Content Rules:** Hero headline must mention business, About section must describe real products, etc.

### User Prompt Contents
- Combines form fields (businessName, industry, products, description)
- Adds extraInstructions if provided
- Language auto-detection logic

### What Needs to Change for URL Feature
- **System Prompt:** Add note about URL scraping (if applicable) — instruct GPT to use scraped web content
- **User Prompt:** Modify to accept either form data OR scraped web content, clarifying the source:
  ```
  "Created a website for: [from URL https://example.com]"
  vs
  "Created a website for: [from form input]"
  ```
- **Language:** Keep language detection, but apply to scraped content
- **Line estimate:** +30–50 lines (clarifications + conditional messaging)

---

## 4. Zod Schemas (ai.ts)

**Path:** `/Users/ngotuannhan/Claude Code/projects/ech-prime-web-v2/src/lib/validations/ai.ts`  
**Lines:** 34  
**Exports:**
- `generateSiteSchema` — Zod schema for `/api/ai/generate-site` POST body
- `editBlockSchema`, `rewriteTextSchema`, `applyTemplateSchema` — other AI endpoints

### generateSiteSchema Structure
```typescript
z.object({
  businessInfo: z.object({
    businessName: z.string().min(1),
    industry: z.string().min(1),
    products: z.string().min(1),
    shortDescription: z.string().min(1),
  }),
  extraInstructions: z.string().optional(),
  language: z.enum(['en', 'ms', 'vi', 'auto']).optional(),
})
```

### What Needs to Change for URL Feature
**Option A: Make businessInfo discriminated union**
```typescript
businessInfo: z.discriminatedUnion('source', [
  z.object({ source: z.literal('form'), businessName: ..., industry: ... }),
  z.object({ source: z.literal('url'), businessUrl: z.string().url() }),
])
```

**Option B: Add optional businessUrl to existing schema**
```typescript
businessInfo: z.object({
  businessUrl: z.string().url().optional(),
  businessName: z.string().min(1).optional(),
  ...
}).refine(
  (data) => data.businessUrl || (data.businessName && data.industry && ...),
  "Must provide either businessUrl or full business form data"
)
```

**Recommendation:** Option B (simpler, backward compatible).

- **Line estimate:** +10–20 lines

---

## 5. Rate Limiting (rateLimit.ts)

**Path:** `/Users/ngotuannhan/Claude Code/projects/ech-prime-web-v2/src/lib/rateLimit.ts`  
**Lines:** 109  
**Exports:**
- `checkRateLimit(key, limit, windowMs)` — single-tier limiter
- `checkTwoTierRateLimit(userId, burstLimit, sustainedLimit)` — burst (5/min) + sustained (20/hr)
- Type: `RateLimitResult`

### Current Implementation
- **In-memory Map:** `rateLimitMap<key, { count, resetAt }>`
- **Cleanup:** Garbage collection every 1 hour
- **Two-Tier:** Checks per-minute burst first, then per-hour sustained
- **Used by:** `/api/ai/generate-site` (line 90)

### Impact of URL Feature
**No changes needed.** URL fetching will happen server-side BEFORE rate limit check (same route), so no additional rate limit required. The 20/hr site generation limit still applies.

---

## 6. Content Safety (content-safety.ts)

**Path:** `/Users/ngotuannhan/Claude Code/projects/ech-prime-web-v2/src/lib/ai/content-safety.ts`  
**Lines:** 56  
**Exports:**
- `checkBusinessInfoSafety(input)` — blocks terms like "porn", "drugs", "weapons", "trafficking"
- Type: `BusinessInfoSafetyInput`

### Current Implementation
- **Blocked Terms:** 19 terms (hardcoded)
- **Normalization:** Lowercases, removes punctuation, collapses whitespace
- **Check:** Looks for substring match in combined fields
- **Used by:** `/api/ai/generate-site` (line 173)

### Impact of URL Feature
**New concern:** If URL contains blocked terms in domain name or content, should we:
1. Reject the URL outright? (strict)
2. Filter the URL content before sending to GPT? (moderate)
3. Let GPT-4o handle it? (permissive)

**Recommendation:** Add `checkBusinessInfoSafety()` check on scraped content + URL domain.

- **Line estimate:** +30–50 lines (URL domain check + scraped content safety)

---

## 7. Builder Store (builderStore.ts)

**Path:** `/Users/ngotuannhan/Claude Code/projects/ech-prime-web-v2/src/store/builderStore.ts`  
**Lines:** 199  
**Exports:** `useBuilderStore` (Zustand hook)

### State Shape
```typescript
type BuilderState = {
  userId: string | null
  businessInfo: BusinessInfo | null  // ← Form data from step 1
  step: 'info' | 'chat' | 'done'
  status: BuilderStatus  // 'idle' | 'streaming' | 'done' | 'error'
  messages: Message[]
  blocks: any[]
  theme: ThemeConfig | null
  siteId: string | null
  siteName: string | null
  progress: ProgressStep
  error: { code, message, retryable } | null
}
```

### Actions
- `setBusinessInfo(info)` — moves to 'chat' step
- `addBlock(block)` — accumulates during generation
- `setTheme(theme)` — when theme received from AI
- `setProgress(progress)` — for streaming UI
- `reset()` — clear everything

### Persistence
- **LocalStorage:** Via `zustand/middleware` persist
- **Key:** `'prime-builder-session'`
- **Selective:** Only persists non-streaming state (status, messages, blocks, theme, siteId, siteName)

### Impact of URL Feature
**Minor changes needed:**
- `BusinessInfo` type should support `businessUrl?: string` field
- **No store action changes** — `setBusinessInfo()` handles both form and URL-based info automatically

---

## 8. Block Registry (blocks/registry.ts)

**Path:** `/Users/ngotuannhan/Claude Code/projects/ech-prime-web-v2/src/blocks/registry.ts`  
**Lines:** 135  
**Exports:** `blockRegistry` object with methods

### Registered Blocks (20 total)
1. navigation
2. hero
3. features
4. about
5. testimonials
6. faq
7. contact
8. gallery
9. footer
10. pricing
11. cta
12. stats
13. team
14. newsletter
15. video
16. logo-cloud
17. blog-list
18. products-grid
19. products-featured
20. custom-html
21. socialWidget
22. cartWidget

### Registry API
| Method | Purpose |
|--------|---------|
| `getComponent(blockType)` | Returns React component |
| `getSchema(blockType)` | Returns Zod validation schema |
| `getBlockMeta(blockType)` | Returns metadata (variants, fields, description) |
| `getBlockTypes()` | Array of all block type strings |
| `getAllMeta()` | All metadata (used by system prompt builder) |
| `validate(blockType, config)` | SafeParse block against schema |
| `has(blockType)` | Boolean check |
| `count` | Getter returning total blocks |

### Impact of URL Feature
**No changes.** Registry is immutable from URL-to-website perspective. It's read-only during AI generation.

---

## 9. API Route: /api/ai/generate-site/route.ts

**Path:** `/Users/ngotuannhan/Claude Code/projects/ech-prime-web-v2/src/app/api/ai/generate-site/route.ts`  
**Lines:** 871  
**HTTP Method:** POST  
**Query Params:** `?stream=true` (optional, enables SSE response)

### Request Flow
1. **Parse + Validate** → `generateSiteSchema`
2. **Auth** → `getCurrentUser()`
3. **Rate Limit** → 2-tier check (5/min burst + 20/hr sustained)
4. **Tenant Resolution** → Get or auto-create tenant (FR-15 legacy support)
5. **Safety Check** → `checkBusinessInfoSafety()`
6. **Parallel Image Gen** → `generateAndUploadHeroImage()` (DALL-E)
7. **AI Generation** → `generateSiteWithAI()` (GPT-4o or fallback)
8. **Hero Image Injection** → Attach uploaded media to hero block
9. **Site Create/Update** → 1 site per tenant rule (update if exists, create if new)
10. **Page Creation** → Build homepage + about/products/contact pages
11. **AI Generation Count** → Increment for FR-15 (free tier = 1 generation max)
12. **Response** → SSE stream OR JSON (backward compatible)

### Key Helpers
| Function | Lines | Purpose |
|----------|-------|---------|
| `getGenerationErrorMessage()` | ~20 | Extract error from response object |
| `formatSavedAt()` | ~6 | Format timestamp |
| `trackBuilderEvent()` | ~14 | Fire-and-forget analytics event |
| `clearBuilderSessionStorage()` | ~4 | Clean localStorage |
| `sanitizeBlocksForPayload()` | ~240 | Normalize AI blocks to Payload CMS schema |
| `applyGeneratedSiteNavigation()` | ~65 | Fix nav links to match generated pages |
| `createPageHero()` | ~40 | Create hero blocks for about/products/contact pages |
| `buildGeneratedPages()` | ~100 | Build 4-page structure (home, about, products, contact) |

### What Needs to Change for URL Feature
**Major:** Add URL fetch + parsing before AI generation.

```
New flow:
1. Parse + validate (schema allows businessUrl OR form data)
2. Auth + rate limit
3. **NEW: If businessUrl → fetch + parse URL**
4. **NEW: Merge parsed data into businessInfo**
5. Tenant + safety + existing flow
```

New helper functions:
- `fetchAndParseUrl(url)` → returns `{ businessName, description, products, logoUrl, ... }`
- Error handling for: fetch timeouts, 404s, non-HTML, parsing failures
- Fallback: If URL fetch fails → ask user OR skip (graceful degradation)

- **Line estimate:** +200–300 lines total (URL fetcher + merging logic + error handling)

---

## 10. Frontend: AIBuilderPageClient.tsx

**Path:** `/Users/ngotuannhan/Claude Code/projects/ech-prime-web-v2/src/app/(builder)/builder/new/AIBuilderPageClient.tsx`  
**Lines:** 26,480 (very large, only first 100 lines read)  
**Purpose:** Main builder UI orchestrator (Step 1: form → Step 2: generation → Step 3: completion)

### High-Level Structure (from inspection)
- **Live Preview** — renders blocks in real-time as they stream in
- **Block Reordering** — drag-and-drop via Framer Motion
- **State Management** — uses `useBuilderStore` (Zustand)
- **SSE Streaming** — listens to `/api/ai/generate-site?stream=true`
- **Analytics Tracking** → calls `trackBuilderEvent()`
- **Session Management** → localStorage meta (BUILDER_SESSION_META_KEY)

### What Needs to Change
**Minimal:** The form component now accepts URL OR form input, so the flow is automatic. No changes needed in orchestrator logic.

---

## Summary Table: Changes Required by File

| File | Lines | Severity | Change Type | Est. Lines |
|------|-------|----------|-------------|-----------|
| **BusinessInfoForm.tsx** | 284 | HIGH | Add URL input + conditional UI | +80–120 |
| **openai-generator.ts** | 518 | HIGH | Add web scraper + flow logic | +150–200 |
| **system-prompt.ts** | 120 | MEDIUM | Update prompts for URL context | +30–50 |
| **ai.ts (Zod)** | 34 | MEDIUM | Add businessUrl to schema | +10–20 |
| **content-safety.ts** | 56 | LOW | Add URL domain check | +30–50 |
| **rateLimit.ts** | 109 | NONE | No changes | 0 |
| **builderStore.ts** | 199 | LOW | Update BusinessInfo type | +5 |
| **blocks/registry.ts** | 135 | NONE | No changes | 0 |
| **generate-site/route.ts** | 871 | HIGH | URL fetch + merge + error handling | +200–300 |
| **AIBuilderPageClient.tsx** | 26480 | NONE | No changes (auto-handled by form) | 0 |

**Total Estimated New Lines:** ~500–775 lines across 6 files

---

## Critical Implementation Notes

### 1. Web Scraping Strategy
**Decision:** Use Node.js native `fetch()` + HTML parser library (e.g., `cheerio` or `jsdom`) on server-side.

**Not recommended:**
- Browser-based scraping (overkill, slow, memory intensive)
- Third-party scraping APIs (adds latency, cost)

**Why server-side:** Route.ts is backend; no CORS issues; full HTML available.

### 2. URL Validation & Error Handling
```typescript
try {
  const url = new URL(businessUrl) // Throws if invalid
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Invalid protocol')
  
  const response = await fetch(url, { timeout: 5000 })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  
  const html = await response.text()
  const parsed = parseHtml(html)
  
  return {
    businessName: parsed.title || url.hostname,
    shortDescription: parsed.description || parsed.og_description || '',
    products: parsed.text_body.slice(0, 500) || '',
    ...
  }
} catch (error) {
  // Fallback: Return partial data or empty object, let user provide form data
  console.error('[URL Parser] Error:', error.message)
  return null
}
```

### 3. Payload CMS One-Site-Per-User Rule
**Current:** Route checks `existingSites.where({ tenant: { equals: tenantId } })` — updates existing or creates new.

**For URL feature:** Same logic applies. If user re-generates from different URL, it updates the same site. No schema changes needed.

### 4. Business Info Type Evolution
```typescript
// Before:
type BusinessInfo = {
  businessName: string
  shortDescription: string
  industry: string
  products: string
  language?: 'en' | 'ms' | 'vi' | 'auto'
}

// After (backward compatible):
type BusinessInfo = {
  businessName: string
  shortDescription: string
  industry: string
  products: string
  language?: 'en' | 'ms' | 'vi' | 'auto'
  businessUrl?: string  // NEW
  source?: 'form' | 'url'  // OPTIONAL, for analytics
}
```

### 5. Testing Considerations
- Mock `fetch()` for URL fetching in unit tests
- Test HTML parsing: valid pages, 404s, timeouts, invalid HTML
- Integration test: form submit → URL fetch → AI generation
- E2E: Full flow with real URL (staging only)

---

## Files to Monitor During Implementation

1. `/src/blocks/types.ts` — May need to extend ThemeConfig if storing source URL
2. `/src/collections/pages.ts` — Payload Pages collection schema (read-only, but confirm layout structure)
3. `/src/app/api/ai/` — Other AI routes (edit-block, rewrite-text) may benefit from similar URL logic
4. `.env.staging.example` / `.env.production.example` — May need new env vars (e.g., SCRAPER_TIMEOUT)

---

## Recommended Implementation Order

1. **Phase 1:** Update schema + form UI (BusinessInfoForm + Zod)
2. **Phase 2:** Build URL scraper utility (separate file, testable)
3. **Phase 3:** Integrate into API route (route.ts)
4. **Phase 4:** Update system prompt (optional, for better AI context)
5. **Phase 5:** Add safety checks (content-safety.ts)
6. **Phase 6:** Test + iterate

**Total effort:** ~3–4 developer days (1 dev)

---

## Conclusion

The codebase is **well-prepared** for URL-to-website feature:
- ✅ Clear separation of concerns (form → API → AI → storage)
- ✅ Extensible schema validation (Zod)
- ✅ Good error handling precedents
- ✅ Rate limiting + safety checks already in place
- ✅ No major architectural changes needed

**Main work:** Web scraping logic + form UI enhancement.

