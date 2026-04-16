---
date: 2026-04-14
branch: feat/F01-ai-gen-variety-fix
pr: '#555'
session_duration: ~6 hours
commits: 10
tests_delta: 367 → 455 (+88)
tags: [ai-gen, unsplash, theme, design-quality, architecture, forensic-audit]
---

# 2026-04-14 — AI Gen Deep Dive (Unsplash + Category DNA + Forensic Audit)

**Context file** — the single journal entry a future session should read to understand
the AI site generation pipeline, what's shipped, what's broken, and where the bodies
are buried. Long but searchable. Sections are independent — skim headings.

---

## TL;DR — 4 problems, 4 outcomes

| Problem | Outcome |
|---|---|
| AI gen output visually bland (1 hero DALL-E, everything else placeholder) | **SHIPPED** Unsplash media pipeline — 8–16 real images per gen, $0/gen |
| AI gen sparse (5–7 blocks, AI defaults to safe layout) | **SHIPPED** Category DNA structure enforcer — injects mandatory blocks, pads items |
| Team avatars missing, hero bg missing, features duplicate, subpages broken, dark mode unreadable | **SHIPPED** 6 post-fix commits catching schema drift + UX bugs |
| "Where's the category DNA I remember building?" | **FORENSIC AUDIT** — Plan B 18 commits DONE but AI happy path never wired to `theme-presets.ts`. **NEW PLAN 08 created** to wire in 3h |

---

## 1. AI Site Generation — flow diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                     USER FORM (BusinessInfo)                         │
│   name, industry, shortDescription, products, language               │
└──────────────────────┬───────────────────────────────────────────────┘
                       ▼
          ┌────────────────────────────┐
          │  /api/ai/generate-site     │
          │  route.ts                  │
          └────┬──────────────────────┬┘
               │                      │
               ▼                      ▼
   ┌───────────────────┐    ┌─────────────────────┐
   │ generateSiteWithAI│    │ Legacy DALL-E hero  │
   │ (openai-gen)      │    │ (behind flag)       │
   │                   │    │ ENABLE_DALLE_HERO=  │
   │  ┌─────────────┐  │    │   false (default)   │
   │  │ buildSystem │  │    └─────────────────────┘
   │  │ Prompt      │  │        SKIP NOW
   │  └──────┬──────┘  │
   │         ▼         │
   │  ┌─────────────┐  │    ┌─────────────────────┐
   │  │ OpenAI 4.1- │  │───►│ Fallback path       │
   │  │ mini call   │  │    │ (quota/error)       │
   │  └──────┬──────┘  │    │                     │
   │         ▼         │    │ composeFallback-    │
   │  ┌─────────────┐  │    │ Result()            │
   │  │ parseJson   │  │    │   ├ pickCategory    │
   │  └──────┬──────┘  │    │   ├ composeFrom-    │
   │         ▼         │    │   │   Blueprint     │
   │  ┌─────────────┐  │    │   │  (uses theme-   │
   │  │ validate    │  │    │   │   presets.ts ✓) │
   │  │ Blocks      │  │    │   └ adapt → Gen-    │
   │  │  ├ sanitize │  │    │       Result        │
   │  │  ├ drop un- │  │    └──────────┬──────────┘
   │  │  │  supported│  │               │
   │  │  └ enforce  │  │               │
   │  │    MinStruc │  │               │
   │  │    + items  │  │               │
   │  └──────┬──────┘  │               │
   │         ▼         │               │
   │  result.blocks    │◄──────────────┘
   │  result.theme ❌  │  (AI happy path does NOT read theme-presets.ts — THIS IS THE GAP)
   └─────────┬─────────┘
             ▼
   ┌──────────────────────┐
   │ planImageNeeds()     │ ← walks blocks, identifies image slots
   │ (media-injector)     │
   └──────┬───────────────┘
          ▼
   ┌──────────────────────┐
   │ fulfillImageNeeds()  │ ← Unsplash search → download → upload Payload Media
   │  ├ deriveKeywords    │    category × block × MS/VN fallback
   │  ├ media-pipeline    │    concurrency 3, partial-fail tolerant
   │  └ assign closures   │    mutate blocks[i][field] = mediaId
   └──────┬───────────────┘
          ▼
   ┌──────────────────────┐
   │ cleanupNonNumeric-   │ ← strip any upload field that's not a Media ID
   │ ImageFields()        │
   └──────┬───────────────┘
          ▼
   ┌──────────────────────┐
   │ sanitizeBlocksFor-   │ ← route.ts older sanitizer (normalizes navigation,
   │ Payload (legacy)     │    hero, contact, testimonials, etc)
   └──────┬───────────────┘
          ▼
   ┌──────────────────────┐
   │ applyGeneratedSite-  │ ← injects page nav links (/, /about, /services)
   │ Navigation           │
   └──────┬───────────────┘
          ▼
   ┌──────────────────────┐
   │ payload.create() × N │ ← save pages (multi-page: home, about, services, contact)
   └──────┬───────────────┘
          ▼
   SSE events stream back:
   step → theme_set → block_complete × N → seo_generated → saving → done

   Frontend AIBuilderPageClient consumes SSE, renders preview, navigates.

Render layer (preview/[siteId]):
  SiteRenderer → blockRegistry.getComponent(blockType) → Block variants
  Theme resolved via resolveTheme() → CSS vars (--accent, --surface-*, --text-*)
  isEditor=true → rewrites internal nav URLs to ?pageId={matched}
```

---

## 2. Architecture map — key files

### AI generation core
- `src/lib/ai/openai-generator.ts` — `generateSiteWithAI()` entry, calls AI or fallback, runs validateBlocks, enforces structure
- `src/lib/ai/system-prompt.ts` — builds system+user prompts, CATEGORY_SIGNATURE_BLOCKS, HERO_VARIANTS_BY_CATEGORY, personality selector
- `src/lib/ai/generate-blocks.ts` — deprecated legacy safety net (still used as 2nd-tier fallback)
- `src/lib/ai/fallback-adapter.ts` — shape adapter composer→GenerationResult (consumes theme-presets ✓)
- `src/lib/ai/template-composer.ts` — composer path, builds blocks from TEMPLATE_PRESETS
- `src/app/api/ai/generate-site/route.ts` — HTTP handler, auth, tenant, SSE streaming, final save

### Sanitization layer
- `src/lib/ai/openai-generator.ts` `sanitizeBlockData()` — per-block normalization, 50+ field aliases, drop rules
- `src/lib/ai/unsupported-blocks.ts` — shared drop list (before-after, menu-display, review-cards, booking-widget)
- `src/app/api/ai/generate-site/route.ts` `sanitizeBlocksForPayload()` — legacy sanitizer ran after, handles nav/hero/contact
- `src/lib/ai/content-rules.ts` — blocked CTAs, word count limits, post-hoc auto-fix

### Category DNA layer (Plan B — 5 phases shipped earlier)
- `src/lib/design-tokens.ts` — SPACING, RADIUS, SHADOW, ICON_SIZE, SECTION_PADDING, CONTAINER constants
- `src/lib/theme/color-utils.ts` — `generatePalette(primary, mode)` 60-30-10 semantic layer, WCAG AA
- `src/lib/theme/resolve.ts` — theme → CSS vars
- `src/lib/ai/theme-presets.ts` — **70 curated themes (14 cat × 5 variants)** ✓ EXISTS
- `src/blocks/shared/SectionWrapper.tsx` — section padding component
- `src/blocks/**/index.tsx` (47 blocks) — all refactored to use design tokens
- `src/lib/ai/content-rules.ts` — Phase 04 content validation

### Unsplash pipeline (this session)
- `src/lib/ai/unsplash-client.ts` — HTTP wrapper, searchPhotos, downloadPhotoBuffer, trackDownload, Imgix URL builder, SSRF guard, retry
- `src/lib/ai/media-pipeline.ts` — orchestration search→download→upload, concurrency 3 semaphore, hero fallback chain
- `src/lib/ai/image-keywords.ts` — category × block keyword derivation, MS_TO_EN_FALLBACKS + VN_TO_EN_FALLBACKS
- `src/lib/ai/media-injector.ts` — planImageNeeds, fulfillImageNeeds, cleanupNonNumericImageFields, BLOCK_IMAGE_SPEC

### Category DNA enforcer (this session)
- `src/lib/ai/category-requirements.ts` — CATEGORY_REQUIREMENTS (14 × minBlocks/mandatory/recommended/minItems), NAV_VARIANT_BY_CATEGORY, ITEM_FIELD_BY_BLOCK
- `src/lib/ai/content-injection.ts` — buildBlockFromLibrary (17 block types), padItems with dedup
- `src/lib/ai/structure-enforcer.ts` — enforceMinimumStructure (insert at smart positions), enforceMinItems

### Render layer
- `src/components/site-renderer/SiteRenderer.tsx` — consumes block registry, emits theme CSS, editor mode URL rewriter
- `src/app/(preview)/preview/[siteId]/page.tsx` — fetches site+page, tenant-isolated, multi-page aware
- `src/lib/navigation.ts` — nav link visibility filter

---

## 3. Plan graph (F01 AI gen variety)

```
Plan A (260412-2156-ai-gen-website-audit)     — AI variety audit & fix
│   status: done (phase 02-07)
│   │
│   ├── Phase 02 system-prompt variety rules  ✓
│   ├── Phase 03 sanitizer fuzzy match        ✓
│   ├── Phase 04 fallback seeded PRNG          ✓
│   ├── Phase 05 template-composer seeds       ✓
│   ├── Phase 06 fallback-composer unify       ✓ (9bf02d4)
│   └── Phase 07 dynamic content (stub)        defer
│
Plan B (260412-2300-design-quality-rules)     — Design tokens + color + blocks refactor
│   status: done (all 5 phases, 18 commits)
│   │
│   ├── Phase 01 design tokens                 ✓ 5a1a6997
│   ├── Phase 02 typography + font pairings    ✓ 4050a136
│   ├── Phase 03 color system (60-30-10)       ✓ 373554f2
│   ├── Phase 04 content validation            ✓ 5b7594ac
│   └── Phase 05 block audit (47 blocks)       ✓ 4be2fe2f..1113b32e
│
Plan C (multiple — model eval, cost leaks, harness)  — misc hardening
│   ├── AI model eval harness                   ✓ e08a937a
│   ├── Flip to gpt-4.1-mini                    ✓ 56adabe0
│   └── Cost leaks + usage logging              ✓ 9ccea6b7 8f4cd4b3
│
Plan D (260414-1400-ai-gen-unsplash-pipeline) — Unsplash + Category DNA enforcer (THIS SESSION)
│   status: in_progress (core done, few-shot deferred)
│   │
│   ├── Phase 01 Unsplash client                 ✓
│   ├── Phase 02 media pipeline                  ✓
│   ├── Phase 03 keyword strategy (MS+VN)        ✓
│   ├── Phase 04 route integration + un-drop     ✓
│   ├── Phase 05 category DNA enforcer           ✓ (few-shot defer)
│   ├── Phase 06 unit tests (e2e matrix defer)   ✓
│   └── Phase 07 env config (prod tier defer)    ✓
│
Plan E (260414-1630-phase-08-audit)            — Wire theme-presets to AI happy path (FOUND TODAY)
    status: pending
    │
    ├── Phase 01 category-theme-picker helper    pending
    ├── Phase 02 happy path theme override       pending
    ├── Phase 03 system prompt injection         pending
    └── Phase 04 e2e verify 5 categories         pending
```

---

## 4. Bugs discovered + fixed this session

Ten bugs, ordered by impact:

### Critical (functional, blocked gen)

1. **Social widget platform enum validation 500** — Payload schema requires enum, AI sent "twitter"/"tiktok" → ValidationError → 500. **Fix** (fc0020d): alias table `twitter → instagram` etc, strip invalid platforms.
2. **Generic links cleanup overwriting social-widget platform** — generic sanitizer rewrote `{platform, url}` to `{label, url}` → platform dropped → 500. **Fix** (fc0020d): skip socialWidget in generic links cleanup.
3. **Unsplash media pipeline wiring** — DALL-E only hero, all gallery/portfolio dropped. **Fix** (0e62c423): Full pipeline Phase 01-07.

### High (visible to user, degraded UX)

4. **Team field schema drift** — `BLOCK_IMAGE_SPEC.team.itemField = 'avatar'` but Payload uses `members[].image`. Result: letter placeholders. **Fix** (7ce55c32): use `image` field.
5. **Hero centered variant no image** — Only set `backgroundImage`, centered reads `image`. **Fix** (7ce55c32): share 1 Media ID across both top-level fields.
6. **Preview subpages not clickable** — SiteRenderer editor mode rewrote all internal nav links to `#`. **Fix** (e8c7e1c6): slug→pageId map, rewrite to `/preview/{siteId}?pageId={id}`.
7. **Dark mode opacity unreadable** — 195 blocks use `opacity-50` for muted text. On dark bg: 3.5:1 contrast fails WCAG AA. **Fix** (5a2096a2): scoped CSS override boosts `.opacity-50 { opacity: 0.80 }` when `colorMode === 'dark'`.

### Medium (aesthetic)

8. **Nav variant bland** — AI defaults to `simple`/`transparent`, renders as dark dim bar. **Fix** (e8c7e1c6): `NAV_VARIANT_BY_CATEGORY` map, structure-enforcer overrides to `pill`/`centered`/`mega-menu`.
9. **Features duplicate padding** — `padItems` pulled library items without dedup → "Quality Service" + "Fast Response" ×2. **Fix** (7ce55c32): dedup by lowercase `title`/`name`.
10. **Stats suffix stripping** — `clampStatValue` was stripping `+`/`%` from small numbers. **Fix** (3e7fe8cd): only clamp absurd values (>100K), preserve verbatim otherwise.

---

## 5. Schema drift gotchas (Zod ↔ Payload mismatch)

**Core pattern:** `src/blocks/**/config.ts` Zod schemas (AI-facing) DIFFER from `src/collections/Pages.ts` block definitions (DB-facing).

Known drift cases:
| Block | Zod field | Payload field |
|---|---|---|
| `team.members[]` | `avatar` (optional `{url, alt}`) | `image` (upload → Media ID) |
| `portfolio-grid` | `items[].image` | `projects[].image` |
| `hero` | `image` ImageRef `{url, alt}` | `image` + `backgroundImage` BOTH are upload fields |
| `testimonials[]` | `avatar` `{url, alt}` | `avatar` upload (same name, different type) |

**Rule for future code:** always check `src/collections/Pages.ts` for the authoritative field names. The Zod block schemas are AI-facing prompt-engineering tools and can drift.

**Blocks in `BLOCKS_NOT_IN_PAYLOAD`** (registered in Zod but missing from Pages.ts):
- `before-after` — needs Payload schema migration to re-enable
- `menu-display` — separate from `menu-food` (both exist, confusing naming)
- `review-cards`, `booking-widget` — not yet in Pages.ts

---

## 6. Category DNA gap — why user's "I remember building this" was right

User said: "phase 8 này a nhớ đã làm rồi, nhưng sao chưa áp dụng được".

**Forensic finding:** Plan B (design-quality-rules) shipped ALL 5 phases on current branch with 18 commits. Includes `theme-presets.ts` with **70 curated themes (14 categories × 5 variants each)** with category-appropriate primaryColor, fontPairingId, colorMode, spacing, radius, shadow.

**The gap:** AI happy path in `openai-generator.ts` **does not consume `theme-presets.ts`**. It builds theme from AI response (which defaults to generic `#0ea5e9` sky blue). Only `composeFromBlueprint` in the fallback path uses the presets.

**Evidence:**
- `openai-generator.ts:95-100` — `theme: { primaryColor: parsed.theme?.primaryColor || '#0ea5e9', ... }`
- `system-prompt.ts:116-121` — has a "CATEGORY PALETTES" advisory text block but it's plaintext suggestion, not enforced
- AI output observation: Bo Bo Spa, Saigon Realty, Ristorante Bella Vista all render with primary `#0ea5e9` — AI rarely deviates from training-data median

**Fix plan:** `plans/260414-1630-phase-08-audit/` — 3h effort, zero new infrastructure, just wire existing assets:
1. `pickCategoryTheme(category, seed)` helper (30m)
2. Override `result.theme` with preset in `generateSiteWithAI` (1h)
3. Inject preset hex into system prompt for soft guidance (1h)
4. E2E verify 5 categories produce distinct colors (30m)

---

## 7. Validation decisions logged (Plan D — Unsplash)

| Q | Decision | Rationale |
|---|---|---|
| Attribution UI | **alt-text only** — `${desc} — Photo by ${user} on Unsplash` in `<img alt>` | Satisfies Unsplash ToS + SEO-friendly, zero visible UI work |
| Few-shot examples scope | **EN + MS priority, VN for QA only** | **Target market = Malaysia (MY)**. User override of plan recommendation |
| `before-after` block | **keep dropped** | Payload schema migration out of scope, defer followup |
| Pexels fallback | **stub only** | Ship V1 fast, promote to real impl if Unsplash rate-limit pain in prod |

**Malaysia market key insight:** production languages are EN + MS (Malay), NOT Vietnamese. VN is internal team QA only. This cascaded to:
- `MS_TO_EN_FALLBACKS` table added in `image-keywords.ts` (primary)
- `VN_TO_EN_FALLBACKS` kept (team QA)
- `image-keywords.ts:translateIndustryToEn` iterates MS table first unless `language === 'vi'`
- Future few-shot examples: 14 × EN + 14 × MS, NOT 14 × VN

---

## 8. Commits this session (10)

| SHA | Type | Description |
|---|---|---|
| `3e7fe8cd` | fix | preserve stat suffixes + footer links + gallery test shape |
| `0ffd0eae` | fix | icon variety + hero min cta + service-cards normalize |
| `0e62c423` | feat | unsplash media pipeline + category dna enforcer (17 files, core) |
| `9389b7a9` | test | update drop list tests after gallery re-enable |
| `afa75abe` | docs | journal entry for unsplash pipeline |
| `7ce55c32` | fix | team field payload schema + hero dual image + dedup padding |
| `e8c7e1c6` | feat | preview subpage routing + category-specific nav variant |
| `5a2096a2` | fix | dark mode opacity boost — restore muted text contrast |
| (prior) `fc0020d` | fix | drop unsupported blocks + social-widget link platform bug |
| (prior) `c9fc963` | fix | ai gen sanitizer + sse parser bugs |

Total session delta: 455/455 AI unit tests passing (was 367 baseline, +88 new).

---

## 9. Open questions + deferred

Technical:
- **Unsplash Production tier approval** — manual action required by account owner (user). Demo tier 50/hr enough for dev but WILL throttle in prod.
- **Few-shot examples per category** — 14 × EN + 14 × MS, deferred. Gap-filler + library injection already solves sparse layout; few-shot is incremental polish.
- **E2E matrix test file** — 5 canonical × 3 runs structured assertions, not written. Manual curl e2e used instead.
- **`before-after` block Payload schema migration** — out of scope, followup plan needed.
- **Photo ID → Media ID cache** — cross-tenant asset reuse to reduce Unsplash API calls. Flagged in researcher-02.
- **Tenant scoping on Media read** — researcher-02 §2 security flag. Cross-tenant Media visibility. Separate security plan.
- **Real Pexels implementation** — stub only currently. Promote if Unsplash rate-limit pain.
- **Proper `opacity-*` cleanup in 195 block uses** — currently CSS override patch. Proper fix replaces with `var(--text-secondary)` CSS var, ~20 block files.

UX / design:
- **Category DNA theme wiring** — **Plan E created, ready to cook.** This is the biggest-visual-impact deferred item.
- **Subpage visual variety** — Home has rich blocks, About/Services/Contact reuse smaller subset. Not explicitly fixed.
- **Newsletter block garish gradient** — block-level styling overrides theme palette. Minor.
- **Hero image relevance** — Unsplash "modern architecture realestate" sometimes returns hotel interiors not luxury homes. Keyword quality iterative.

---

## 10. Patterns to reuse in future sessions

### Mock Payload for unit tests
```ts
const mockPayload = { create: vi.fn().mockResolvedValue({ id: 42 }) }
```
Use instead of spinning real Payload instance in tests.

### SSE parser edge case
**Gotcha:** `let currentEvent = ''` MUST be declared OUTSIDE the while loop when parsing SSE stream — otherwise chunk boundaries split between `event:` line and `data:` line silently drop events. Fixed in `AIBuilderPageClient.tsx`.

### Fallback chain pattern
```
Primary source (Unsplash search)
    ↓ fail
Broadened search (drop most-specific keyword)
    ↓ fail
Hardcoded stock URL (hero only)
    ↓ fail
Empty array (caller decides)
```
Never throw all the way up — log + degrade gracefully.

### Concurrency limit without new deps
```ts
class Semaphore {
    private queue: Array<() => void> = []
    private active = 0
    constructor(private max: number) {}
    async run<T>(fn: () => Promise<T>): Promise<T> {
        if (this.active >= this.max) await new Promise<void>(r => this.queue.push(r))
        this.active++
        try { return await fn() }
        finally { this.active--; this.queue.shift()?.() }
    }
}
```
Avoids `p-limit` dependency. Used in media-pipeline.ts.

### Slug → pageId map for preview URL rewrite
```ts
const slugToPageId = new Map<string, string>()
for (const p of pages) {
    const withSlash = p.slug.startsWith('/') ? p.slug : `/${p.slug}`
    slugToPageId.set(withSlash, String(p.id))
}
slugToPageId.set('/', String(homepage.id))
```
Used in SiteRenderer editor mode. Enables nav clicks in preview mode.

---

## 11. Glossary

- **Plan A/B/C/D/E** — parallel feature plans, all on `feat/F01-ai-gen-variety-fix`
- **Category DNA** — visual + structural identity per business category (spa≠tech≠restaurant)
- **Drop list** — `BLOCKS_REQUIRE_MEDIA_PIPELINE` + `BLOCKS_NOT_IN_PAYLOAD` sets in `unsupported-blocks.ts`
- **Schema drift** — mismatch between Zod AI-facing schemas and Payload DB-facing schemas
- **Gap-filler** — `enforceMinimumStructure()` in `structure-enforcer.ts`, injects mandatory blocks post-AI
- **Padder** — `enforceMinItems()` same file, pads block items from content library
- **Happy path** — AI succeeds, `generateSiteWithAI` returns via OpenAI
- **Fallback path** — AI fails/quota-exhausted, `composeFallbackResult` returns via composer + curated content
- **Soft guidance vs hard override** — prompt instruction AI can ignore vs server-side overwrite
- **theme-presets.ts** — the 70-theme library that exists but isn't wired to AI happy path (THE gap)

---

## 12. Useful commands

```bash
# Run all AI unit tests
pnpm vitest run src/__tests__/unit/lib/ai

# Run dev server (port 3001, worktree)
PORT=3001 pnpm dev

# E2E gen test with curl
curl -sS -c /tmp/cookies -X POST 'http://localhost:3001/api/users/login' \
  -H 'Content-Type: application/json' \
  -d '{"email":"test1@primeweb.app","password":"TestPass123!"}'

curl -sS -b /tmp/cookies -c /tmp/cookies -X POST 'http://localhost:3001/api/users/verify-otp' \
  -H 'Content-Type: application/json' \
  -d '{"email":"test1@primeweb.app","otp":"123456"}'

curl -sS -b /tmp/cookies -X POST 'http://localhost:3001/api/ai/generate-site?stream=true' \
  -H 'Content-Type: application/json' \
  -d '{"businessInfo":{"businessName":"Test","industry":"beauty","shortDescription":"...","products":"..."},"language":"en"}' \
  --max-time 120

# Dev OTP bypass — any 6-digit code works in dev mode
# Test users: test1-5@primeweb.app / TestPass123!

# Reset test user tenant (wipes site to gen fresh)
curl -sS -X POST 'http://localhost:3001/api/e2e/ensure-test-user' \
  -H 'Authorization: Bearer local-test-secret-12345' \
  -H 'Content-Type: application/json' \
  -d '{"email":"test1@primeweb.app","password":"TestPass123!"}'

# Check log for pipeline events
grep -E "Media Pipeline|Media Injector|Structure Enforcer|Dropping" {dev-server-log}
```

---

## 13. Key file paths (absolute)

```
Worktree:       /Users/ngotuannhan/Claude Code/projects/ech-prime-web-v2/.claude/worktrees/template-audit
Branch:         feat/F01-ai-gen-variety-fix
PR:             #555

Plan A:         plans/260412-2156-ai-gen-website-audit/
Plan B:         plans/260412-2300-design-quality-rules/
Plan D:         plans/260414-1400-ai-gen-unsplash-pipeline/
Plan E:         plans/260414-1630-phase-08-audit/  ← pending cook

Env local:      .env.local (UNSPLASH_ACCESS_KEY set, ENABLE_DALLE_HERO=false)
Preset library: src/lib/ai/theme-presets.ts  ← 70 themes, wire target
```

---

**End of deep dive.** For the next session, read this file first. All the decisions, gotchas, and context for the AI gen pipeline are here.
