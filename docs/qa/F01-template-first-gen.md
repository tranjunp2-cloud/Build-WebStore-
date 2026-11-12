---
feature: F01 Template-First Gen
plan: plans/260416-1450-template-first-gen/plan.md
prd: docs/prd/F01-ai-builder.md
created: 2026-04-16
scenarios: 32
test-cases: 31
---

# QA Test Plan — F01 Template-First Gen

## 1. Test Strategy

| Type | Tool | Scope |
|---|---|---|
| Unit | Vitest | personalizeWithGPT(), composeTemplateResult(), merge logic |
| Integration | Vitest + mocked OpenAI | Full generateSiteWithAI() template-first path |
| E2E | Manual staging | Gen 5 sites, verify content + timing |
| Regression | Vitest existing suite | 76+ existing AI gen tests must pass |

**Coverage target**: 100% AC mapping, Critical + High scenarios covered

## 2. Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| Output shape drift (adapter miss field) | Critical — page create 500 | Medium | Type assertion at boundary |
| Blocks not flattened (media pipeline skip) | Critical — imageless site | Medium | Verify adapter populates result.blocks |
| extraInstructions ignored | High — user expectation | High | Detect → fallback to full GPT |
| Language mismatch (vi user, en template) | High — content mismatch | High | Phase 04 localization |
| Composer throws (not null) | High — 500 error | Low | try-catch wrap |
| GPT timeout blocks Promise.all | Medium — slow gen | Medium | Promise.allSettled + 10s timeout |

## 3. Scenario Summary

32 scenarios across 6 dimensions. Full report in `plans/260416-1450-template-first-gen/` conversation.

- Critical: 2
- High: 9
- Medium: 10
- Low: 5

## 4. Test Cases

### TC-TF-001: Template-first gen — happy path
- **Priority:** P1
- **Type:** Integration
- **AC Reference:** AC-1, FR-02, FR-17
- **Precondition:** Authenticated user, aiGenerationsCount < limit, GEN_MODE=template-first
- **Steps:**
  1. POST /api/ai/generate-site với businessInfo (beauty spa, en)
  2. Verify response 200
  3. Check timing < 15s
  4. Check response has siteId, 5 pages
- **Expected:** Site gen < 15s, 5 pages, hero headline = GPT-personalized (unique), features = curated template
- **Test Data:** businessName="Bella Spa", industry="beauty", products="massage, facial"

### TC-TF-002: Hero headline personalized by GPT
- **Priority:** P1
- **Type:** Integration
- **AC Reference:** AC-1
- **Precondition:** Same as TC-TF-001
- **Steps:**
  1. Gen site
  2. Find hero block in response
  3. Compare headline with template default
- **Expected:** Hero headline ≠ template default ("Discover Your Natural Radiance"). Should mention "Bella Spa" or "massage/facial"
- **Test Data:** Same as TC-TF-001

### TC-TF-003: GPT personalize fail → template default
- **Priority:** P1
- **Type:** Unit
- **AC Reference:** AC-1, BR-07
- **Precondition:** Mock OpenAI to throw
- **Steps:**
  1. Call generateSiteWithAI() with mocked GPT failure
  2. Verify result still returned (not thrown)
  3. Check hero headline = template default
- **Expected:** Site ships with composer defaults. No 500. GPT failure logged as warning.

### TC-TF-004: Unknown category → fallback to full GPT
- **Priority:** P1
- **Type:** Integration
- **AC Reference:** AC-1, FR-18
- **Precondition:** composeTemplateResult returns null for unknown category
- **Steps:**
  1. POST with industry="consulting" (not in 14 categories)
  2. Verify gen still succeeds
  3. Check timing ~63s (full GPT path)
- **Expected:** Falls back to AI-first path. Site gen succeeds. Longer time OK.
- **Test Data:** industry="consulting"

### TC-TF-005: extraInstructions present → fallback to full GPT
- **Priority:** P1
- **Type:** Integration
- **AC Reference:** AC-1
- **Precondition:** User provides extraInstructions
- **Steps:**
  1. POST with extraInstructions="Add 30% discount section"
  2. Verify gen uses AI-first path (timing ~63s)
  3. Verify extraInstructions reflected in output
- **Expected:** Template-first skipped. Full GPT handles custom instructions.

### TC-TF-006: referencePrompt (URL extraction) → fallback to full GPT
- **Priority:** P1
- **Type:** Integration
- **AC Reference:** AC-1
- **Steps:**
  1. POST with contentBrief containing referencePrompt
  2. Verify full GPT path used
- **Expected:** Recreation mode uses AI-first. Template-first skipped.

### TC-TF-007: Multilingual — language=ms
- **Priority:** P2
- **Type:** Integration
- **AC Reference:** AC-5, FR-16
- **Steps:**
  1. POST with language="ms", industry="restaurant"
  2. Check hero headline language = Malay (GPT personalize)
  3. Check SEO description language = Malay
- **Expected:** GPT outputs Malay headline/SEO. Template body localized for gallery heading + `/gallery` page title, homepage newsletter, sample product `shortDescription` (TC-TF-028..031, #2160). Known remaining gaps: Blog page headings, SEO titles of other sub-pages.

### TC-TF-008: Multilingual — language=vi
- **Priority:** P2
- **Type:** Integration
- **AC Reference:** AC-5, FR-16
- **Steps:** Same as TC-TF-007 with language="vi"
- **Expected:** GPT outputs Vietnamese headline/SEO. Template body = English.

### TC-TF-009: Promise.all timing — GPT slower than composer
- **Priority:** P2
- **Type:** Unit
- **Steps:**
  1. Mock composer to resolve in 100ms
  2. Mock GPT to resolve in 5000ms
  3. Measure total time
- **Expected:** Total ≈ 5000ms (not 5100ms). Promise.all parallel.

### TC-TF-010: Promise.allSettled — GPT timeout (>10s)
- **Priority:** P1
- **Type:** Unit
- **Steps:**
  1. Mock GPT to hang for 15s
  2. Verify gen completes in ~10s (GPT timeout cap)
  3. Verify template defaults used (GPT result discarded)
- **Expected:** Site ships in ~10s with template defaults. GPT timeout logged.

### TC-TF-011: Composer returns empty blocks
- **Priority:** P1
- **Type:** Unit
- **Steps:**
  1. Mock composeTemplateResult to return { blocks: [], pages: [] }
  2. Call generateSiteWithAI
- **Expected:** Detect empty → fallback to full GPT path. Not create empty site.

### TC-TF-012: adaptTemplateSeedToGenerationResult populates result.blocks
- **Priority:** P1 (Critical scenario)
- **Type:** Unit
- **Steps:**
  1. Call adaptTemplateSeedToGenerationResult with valid TemplateSeed
  2. Verify result.blocks is flat array of homepage blocks
  3. Verify result.pages has all page data
- **Expected:** result.blocks populated for media pipeline. result.pages populated for page create.

### TC-TF-013: SSE events compatible with client
- **Priority:** P2
- **Type:** Integration
- **Steps:**
  1. POST with stream=true
  2. Capture SSE events
  3. Compare event sequence with AI-first path
- **Expected:** Events include: step:composing, step:personalizing, theme_set, step:saving, done. Client handles gracefully.

### TC-TF-014: Rate limit — free tier check timing
- **Priority:** P1
- **Type:** Integration
- **AC Reference:** FR-15, BR-03
- **Steps:**
  1. Set aiGenerationsCount = 1 (free limit)
  2. POST gen
- **Expected:** 402 returned BEFORE composer or GPT runs. No resource waste.

### TC-TF-015: GEN_MODE=ai-first rollback
- **Priority:** P1
- **Type:** Integration
- **Steps:**
  1. Set env GEN_MODE=ai-first
  2. POST gen
  3. Verify full GPT path used (timing ~63s)
  4. Verify all recent fixes still work (max_tokens=10000, parallel media, orphan strip)
- **Expected:** Old behavior restored. All fixes preserved in rollback path.

### TC-TF-016: Content safety check runs before composer
- **Priority:** P1
- **Type:** Integration
- **AC Reference:** BR-06
- **Steps:**
  1. POST with businessName containing blocked keyword
  2. Verify 400 returned before any gen
- **Expected:** Safety check blocks request. Composer never called.

### TC-TF-017: logAiUsage called for personalize task
- **Priority:** P2
- **Type:** Unit
- **Steps:**
  1. Mock logAiUsage
  2. Run template-first gen
  3. Verify logAiUsage called with task='personalize', model='gpt-4.1-nano'
- **Expected:** Usage tracking works for new task type.

### TC-TF-018: Phase timing log shows gen_mode
- **Priority:** P2
- **Type:** Integration
- **Steps:**
  1. Gen with template-first
  2. Check Vercel logs for DONE line
- **Expected:** `[generate-site] DONE total=Xms compose=Yms personalize=Zms media=Wms db=Dms gen_mode=template-first`

### TC-TF-019: TEMPLATE_PRESETS batch2 (creative) — compose without error
- **Priority:** P1 (regression guard for GH-767)
- **Type:** Unit
- **AC Reference:** AC-1
- **Steps:**
  1. For each creative-category preset in TEMPLATE_PRESETS
  2. Call composeFromBlueprint(preset, seed, bizOverride)
  3. Apply filterUnsupportedBlocks to each page layout
- **Expected:** All 4+ creative presets compose non-null. No throw. All blocks in output are either registered block types or explicitly unsupported (filtered). Page slugs unique within each preset.

### TC-TF-020: TEMPLATE_PRESETS batch3 (events) — compose without error
- **Priority:** P1 (regression guard for GH-767)
- **Type:** Unit
- **AC Reference:** AC-1
- **Steps:**
  1. For each events-category preset in TEMPLATE_PRESETS
  2. Call composeFromBlueprint(preset, seed, bizOverride)
  3. Apply filterUnsupportedBlocks to each page layout
- **Expected:** All 4+ events presets compose non-null. No throw. All blocks in output are either registered block types or explicitly unsupported. Page slugs unique within each preset.

### TC-TF-021: All TEMPLATE_PRESETS — page slugs unique per preset
- **Priority:** P1 (regression guard for duplicate-slug 500 in GH-767)
- **Type:** Unit
- **Steps:**
  1. For ALL presets in TEMPLATE_PRESETS (batch1+2+3)
  2. Compose result
  3. Extract page.slug from each page
- **Expected:** Within each preset, all page slugs are unique. Homepage slug is '/' (first page). No two pages share the same slug.

### TC-TF-022: MenuFoodBlock — returns null when categories is empty (GH-1219)
- **Priority:** P1
- **Type:** Unit (component)
- **Steps:**
  1. Render `MenuFoodBlock` with `categories: []`
  2. Inspect the rendered container
- **Expected:** Component returns null — `container.firstChild` is null. No blank section rendered.

### TC-TF-023: validateBlocks gate — drops menu-food block when categories empty (GH-1219)
- **Priority:** P1
- **Type:** Unit (AI pipeline)
- **Steps:**
  1. Call `sanitizeBlockData` with `{ blockType: 'menu-food', categories: [] }`
  2. Check `categories` field on the result
- **Expected:** `categories` is still `[]` — the GH-1219 guard condition (`!Array.isArray(cats) || cats.length === 0`) evaluates to true, meaning the block would be dropped by `validateBlocks`.

### TC-TF-024: validateBlocks gate — keeps menu-food block when categories non-empty (GH-1219)
- **Priority:** P1
- **Type:** Unit (AI pipeline)
- **Steps:**
  1. Call `sanitizeBlockData` with a valid `menu-food` block (2 categories, 3+ items each)
  2. Check `categories` field on the result
- **Expected:** `categories.length > 0` — the GH-1219 drop condition is false; block is kept.

### TC-TF-025: Generated products-grid defaults follow page slug (GH-1588)
- **Priority:** P1
- **Type:** API integration (Vitest + mocked Payload)
- **Steps:**
  1. Generate a homepage and `/products` page that both contain a template-first `products-grid` block.
  2. Inspect the layouts persisted through the generate-site route.
- **Expected:** Only `/products` enables `showCategoryFilter`; both blocks restore headline/subheadline, normalize `limit` or legacy `count` to an integer from 1–20, and remove legacy `count` without changing unrelated blocks.

### TC-TF-026: Fallback products page without products-grid remains unchanged (GH-1588)
- **Priority:** P1
- **Type:** API integration (Vitest + mocked Payload)
- **Steps:**
  1. Generate a fallback site whose `/products` page does not contain `products-grid`.
  2. Inspect the persisted `/products` layout.
- **Expected:** Generation succeeds and normalization does not inject a new `products-grid` block.

### TC-TF-027: Malay image-reference retry preserves products-grid defaults (GH-1588)
- **Priority:** P1
- **Type:** API integration (Vitest + mocked Payload)
- **Steps:**
  1. Generate a Malay `/products` page containing a legacy `products-grid` shape and a numeric image reference that passes the media precheck.
  2. Make the first Payload page create fail with an upload foreign-key error.
  3. Inspect the page persisted by the image-free retry.
- **Expected:** The first create receives the numeric image reference; the retry removes it while preserving Malay headline/subheadline, `showCategoryFilter`, normalized `limit`, and removal of legacy `count`.

### TC-TF-028: Malay sample products — shortDescription in Bahasa Melayu (#2160)
- **Priority:** P2
- **Type:** Unit (Vitest, AI platform transport mocked) — `src/__tests__/unit/lib/ai/sample-products-language-prompt.test.ts`
- **AC Reference:** AC-5, FR-16
- **Steps:**
  1. `prepareSampleProducts` with issue input (Kek lapis, roti canai, kopi tarik) and language `ms` / `en` / `vi`.
  2. Inspect the `sitegen.sample-products` prompt.
- **Expected:** `ms` prompt requires `shortDescription` in Bahasa Melayu (shown on every storefront product surface), keeps `description` EN + `descriptionBM`. `en` has no Malay rule; `vi` keeps its generic target-language rule.

### TC-TF-029: Malay gallery heading + `/gallery` page title (#2160)
- **Priority:** P2
- **Type:** Unit (Vitest, real composer) — `src/__tests__/unit/templates/template-composer-malay-locale.test.ts`
- **AC Reference:** AC-5, FR-16
- **Steps:**
  1. `composeTemplateResult` with issue input, industry `fnb`, language `ms` (seeds 1-3) and `en`.
- **Expected:** `ms`: no gallery headline contains "Gallery" (composer → `Galeri — {biz}`); `/gallery` page title `Galeri` (nav/footer/SEO labels derive from it); slug stays `/gallery`, no `/galeri` link. `en` unchanged (`Gallery — {biz}`, title `Gallery`). `vi` gets the same fix (`Thư Viện Ảnh`).

### TC-TF-030: Malay homepage newsletter heading (#2160)
- **Priority:** P2
- **Type:** Unit (Vitest, real composer) — same file as TC-TF-029
- **AC Reference:** AC-5, FR-16
- **Steps:**
  1. Same as TC-TF-029; inspect homepage `newsletter` blocks.
- **Expected:** `ms`: headline `Ikuti Perkembangan Terbaru {biz}`, subheadline `Langgan untuk berita dan tawaran.` `en` unchanged.

### TC-TF-031: Template-first composes in the resolved locale (#2160)
- **Priority:** P2
- **Type:** Unit (Vitest, real `generateSiteWithAI` template-first path; AI platform scripted) — `src/__tests__/unit/ai/template-first-resolved-locale.test.ts`
- **AC Reference:** AC-5, FR-16
- **Steps:**
  1. Builder request shape: `language: 'auto'` + `targetLocale: 'ms'` (issue input, industry `fnb`).
  2. Repeat with `language: 'en'`.
- **Expected:** `ms`: gallery headlines `Galeri — {biz}`, `/gallery` title `Galeri` (composer receives the resolved locale, not raw `'auto'` → `'en'`). `en` unchanged (`Gallery — {biz}`).

## 5. Traceability Matrix

| AC / FR | Test Cases | Coverage |
|---------|-----------|----------|
| AC-1 (Gen site < 60s, 4 pages) | TC-TF-001, TC-TF-002, TC-TF-003, TC-TF-004 | ✅ Full |
| AC-5 (Multilingual output) | TC-TF-007, TC-TF-008, TC-TF-028, TC-TF-029, TC-TF-030, TC-TF-031 | ✅ Full |
| AC-6 (AI image) | TC-TF-012 (blocks populated for media) | ✅ Full |
| FR-02 (< 60s) | TC-TF-001, TC-TF-009, TC-TF-010 | ✅ Full |
| FR-15 (Rate limit) | TC-TF-014 | ✅ Full |
| FR-16 (Language detection) | TC-TF-007, TC-TF-008, TC-TF-028, TC-TF-029, TC-TF-030, TC-TF-031 | ✅ Full |
| FR-17 (4 pages minimum) | TC-TF-001, TC-TF-011 | ✅ Full |
| FR-18 (Layout per category) | TC-TF-001, TC-TF-004 | ✅ Full |
| BR-03 (Rate limit before API) | TC-TF-014 | ✅ Full |
| BR-06 (Content safety) | TC-TF-016 | ✅ Full |
| BR-07 (Quota protection on fail) | TC-TF-003 | ✅ Full |
| GH-1588 (products-grid generation defaults) | TC-TF-025, TC-TF-026, TC-TF-027 | ✅ Full |

## 6. Self-Check

```
📋 QA Test Plan Self-Check:
├── Gọi Skill tool ck:scenario? ✅
├── Số scenarios: 32 (>= 30) ✅
├── Số test cases: 27
├── Map 100% ACs? ✅ — AC-1,5,6 + FR-02,15,16,17,18 + BR-03,06,07
├── Có Traceability Matrix? ✅
├── Có Risk Assessment? ✅
├── Có severity cho mỗi TC? ✅ (P1/P2)
└── Có test data? ✅
```
