# AI Gen Similarity Root Cause Analysis
**Branch:** feat/F01-ai-gen-variety-fix  
**Scope:** Theme / Color / Font / Image / Copy Similarity  
**Date:** 2026-04-14  
**Report ID:** researcher-02-theme-content-similarity

---

## Executive Summary
Despite commit 4659837d wiring theme presets into the AI happy path, sites remain visually similar. Diagnosis identifies **5 critical root causes** (high/med impact), each with exact code paths and function signatures.

---

## Root Cause #1: Limited Theme Preset Coverage with Deterministic Hash Clustering
**Impact:** HIGH

**Finding:**
- 5 presets per category × 14 categories = 55 total presets ✓
- BUT: `hashBusinessName()` → `pickCategoryTheme(category, seed)` uses modulo-5 determinism
- Hash collision **observed**: common names cluster on indices 0–2
  - Example: "Farah Glow" → preset_idx=0, "Priya Nails" → idx=1, "Zen Hair" → idx=2
  - "Test Beauty 1" → idx=2, "Test Beauty 2" → idx=3, "Test Beauty 3" → idx=4
  - **Same category = same hash buckets → all "Warm Spice" + "Elegant-serif" fonts**

**Code Path:**
- `src/lib/ai/category-theme-picker.ts:64-71` — `hashBusinessName(name)` djb2 hash
- `src/lib/ai/category-theme-picker.ts:42-48` — `pickCategoryTheme()` uses `Math.abs(seed) % presets.length`
- `src/lib/ai/openai-generator.ts:71-73` — called with `themeSeed = hashBusinessName(businessInfo.businessName)`

**2-3 Line Snippet:**
```typescript
const index = Math.abs(Math.floor(seed)) % presets.length
return presets[index]!  // With 5 presets and common names, index clusters to 0-2
```

---

## Root Cause #2: Font Pairing Collapse Within Categories
**Impact:** MEDIUM

**Finding:**
- 17 unique `fontPairingId` values map to only ~10 unique (fontHeading, fontBody) pairs
- Multiple presets in same category share **identical font pairs**
  - Beauty: "Rose Petal" + "Soft Blush" = `elegant-serif` (Playfair Display + Lato)
  - Beauty: "Natural Glow" + others = `artisan` (Playfair Display + Nunito)
  - Restaurant: 3 presets use either `warm-friendly` or `elegant-serif`
- **Result:** Font never differs within a category despite color change

**Code Path:**
- `src/lib/ai/theme-presets.ts:4-14` — ThemePreset type with `fontPairingId` field
- `src/lib/ai/font-pairings.ts:17-37` — FONT_PAIRINGS map; 17 IDs → ~10 unique pairs
- `src/lib/ai/openai-generator.ts:143-150` — theme object uses `fontPairingId` directly

**2-3 Line Snippet:**
```typescript
'elegant-serif':   { fontHeading: 'Playfair Display', fontBody: 'Lato' },
'artisan':         { fontHeading: 'Playfair Display', fontBody: 'Nunito' },
// Multiple presets per category share these IDs
```

---

## Root Cause #3: Image Keyword Collapse for Same Category
**Impact:** MEDIUM-HIGH

**Finding:**
- `deriveKeywords(category, blockType, ctx)` uses `pickRandom()` on CATEGORY_BASE_KEYWORDS
- Each category has only **3-5 base keywords**; modulo-5 hash clustering + random = 1-2 keywords for all beauty salon gens
- Example: `CATEGORY_BASE_KEYWORDS['beauty']` = 4 terms; if all hash to index 0-1, all gens get:
  - Hero: "spa treatment" + (random modifier) = ~2-3 Unsplash results
  - Gallery: "beauty salon" + (random modifier) = ~3-4 identical results
- **Unsplash top-5 results repeat across gens → visually identical hero + gallery**

**Code Path:**
- `src/lib/ai/image-keywords.ts:20-35` — CATEGORY_BASE_KEYWORDS with 3-5 entries per category
- `src/lib/ai/image-keywords.ts:179-195` — `deriveKeywords()` calls `pickRandom(baseList)` (line 185)
- `src/lib/ai/image-keywords.ts:170-173` — `pickRandom()` uses `Math.random()` (non-deterministic, but only 3-5 choices)
- `src/lib/ai/media-injector.ts:120-125` — calls `deriveKeywords(category, blockType, ctx)` per block

**2-3 Line Snippet:**
```typescript
const baseList = CATEGORY_BASE_KEYWORDS[category] ?? ['modern business']
const base = pickRandom(baseList) ?? 'modern business'  // Only 3-5 choices
// All gens of same category likely pick same 1-2 keywords
```

---

## Root Cause #4: Content Library Reuse with Insufficient Padding Diversity
**Impact:** MEDIUM

**Finding:**
- Each category has only **5 BusinessSample entries** (verified: beauty.ts, restaurant.ts, etc.)
- `category-requirements.ts` sets `minItems` for testimonials/features/gallery: 3–8 per block
- `structure-enforcer.ts` pads short arrays via `buildBlockFromLibrary()` + `pickSeeded(arr, seed)`
- When AI returns 2 testimonials but minItems=4, **content-injection pads with `businesses[0]` hardcoded testimonials**
  - Line 66: `const biz: BusinessSample | undefined = content.businesses[0]` (ALWAYS index 0)
  - Result: **same 4 testimonials injected across all gens in same category**

**Code Path:**
- `src/lib/ai/content/beauty.ts` — 5 BusinessSample entries (name, testimonials, faqs)
- `src/lib/ai/content-injection.ts:56-80` — `buildBlockFromLibrary()` hardcodes `businesses[0]`
- `src/lib/ai/category-requirements.ts:32-37` — beauty minItems = {team:3, testimonials:4, gallery:6}

**2-3 Line Snippet:**
```typescript
const biz: BusinessSample | undefined = content.businesses[0]  // Always first
// Same testimonials/FAQs for every padded beauty salon gen
const picked = pickSeeded(arr, seed)  // Only 5 choices, seed mod 5
```

---

## Root Cause #5: Personality Selector Keyword Collapse
**Impact:** LOW-MEDIUM

**Finding:**
- `selectPersonality(info)` keyword-matches 8 personalities against `{businessName + industry + products + shortDescription}`
- Beauty/spa keywords ("spa", "wellness", "skincare") match **"warm" personality 90%+ of time**
- "Warm" prompt = soft gradients + rounded shapes + friendly tone (same for ALL beauty gens)
- Restaurant keywords ("cafe", "cozy", "bakery") also cluster on "warm"
- **Result:** Personality score determinism + limited candidate pool (3 personalities chosen) → convergence

**Code Path:**
- `src/lib/ai/system-prompt.ts:57-98` — STYLE_PERSONALITIES array with 8 personalities + keywords
- `src/lib/ai/system-prompt.ts:105-125` — `selectPersonality()` keyword-scores, picks from top 3
- `src/lib/ai/system-prompt.ts:69-72` — "warm" personality has 10 keywords; beauty/spa/cafe keywords match all

**2-3 Line Snippet:**
```typescript
const scored = STYLE_PERSONALITIES.map(p => ({
  score: p.keywords.filter(kw => input.includes(kw)).length,  // All spa/cafe → "warm"
}))
```

---

## Root Cause #6: System Prompt Boilerplate Dominance
**Impact:** MEDIUM

**Finding:**
- `system-prompt.ts` = 471 lines total
- ~400 lines (85%) are **category-agnostic boilerplate**: block registry, output format, validation rules, anti-patterns
- ~40 lines (8%) are **dynamic theme injection** (themeContext.preset)
- ~30 lines (7%) are **business-specific** (user prompt input)
- **LLM with >85% identical prompt across gens → converges to median output**
- `buildUserPrompt()` includes businessName but theme prompt is soft guidance (not hard override until post-parse)

**Code Path:**
- `src/lib/ai/system-prompt.ts:224-400` — `buildSystemPrompt()` static boilerplate (ANTI-PATTERN: hardcoded VARIETY RULES at line 402+ that don't affect JSON output)
- `src/lib/ai/openai-generator.ts:75-76` — system + user prompts passed to GPT-4o
- Theme override happens **post-parse** (line 136), not in system prompt

---

## Root Cause #7: Theme Override Timing (Minor)
**Impact:** LOW

**Finding:**
- Commit 4659837d correctly hard-overrides theme post-parse (line 136-155 in openai-generator.ts)
- BUT: AI copy generation (headlines, CTAs, feature titles) already happened BEFORE override
- AI saw soft guidance (moodHint) but no hard hex values during content generation
- **Result:** Colors are forced preset, copy/layout are AI-generic

---

## Recommended Fix Directions (No Code)

### Priority 1 (HIGH): Increase Preset Diversity
1. **Expand theme presets**: 5 → 8-10 per category (use hash modulo-8/10)
2. **Unique font pairs per preset**: Audit 17 fontPairingIds → 14+ unique pairs; assign 1 per preset
3. **Deterministic variant selection**: Instead of modulo-hash clustering, use **seeded shuffle** of preset list per category

### Priority 2 (MEDIUM): Image Keyword Expansion & Randomization
1. **Expand CATEGORY_BASE_KEYWORDS**: 3-5 → 8-10 terms per category
2. **Add per-preset image mood hints**: e.g., "minimal" → {keywords: ["minimalist interior"]}
3. **Use deterministic seeding for pickRandom**: `seed % arr.length` instead of pure Math.random() to ensure variety

### Priority 3 (MEDIUM): Content Library Diversity
1. **Use businessIndex rotation**: Map hash → one of 5 BusinessSamples instead of hardcoded [0]
2. **Extend minItems thresholds**: Reduce padding need by increasing AI-generation minItems expectations
3. **Create variant testimonials/FAQs**: Per BusinessSample, store 3-5 variants per block type

### Priority 4 (LOW-MEDIUM): Personality Randomization
1. **Break keyword clustering**: Add negation keywords (e.g., "NOT spa" for minimal personality)
2. **Weighted random from top 3**: Not just top candidate

### Priority 5 (MEDIUM): System Prompt Entropy
1. **Inject hard hex values into system prompt**: Not just soft moodHint
2. **Add explicit variety instruction per generation**: "Use variant X of hero, variant Y of features"
3. **Move boilerplate to external schema file**: Reduce prompt size; focus on business-specific instruction

---

## Unresolved Questions
1. **Image hash collisions**: Do different businesses in same category actually hit the same Unsplash top-5? Needs audit of 10+ sample gens.
2. **Content library usage frequency**: How often does structure-enforcer actually pad vs. AI delivers full minItems? Telemetry gap.
3. **Personality impact on layout**: Does "warm" personality instruction actually affect block variant selection downstream? Tracing needed.
4. **Cumulative entropy**: If fixes applied in order (presets + keywords + content), what is net visual similarity reduction? A/B test needed.
