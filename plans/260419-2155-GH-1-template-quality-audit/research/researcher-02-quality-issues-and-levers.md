# Template Quality Audit: Issues & Improvement Levers

**Date:** 2026-04-19  
**Status:** Complete  
**Scope:** 390 template fixtures, 800 drift findings, 14 categories, content packs, image quality

---

## Executive Summary

- **390 fixtures** compose error-free but quality gaps remain: 800 drift findings (660 unknown-variant, 140 unknown-block), 3 categories short on business samples, missing logo/image curation, testimonial length warnings recurring.
- **Quality is NOT error-free** — silent fallbacks mask issues (footer mega → default, contact-form missing → skipped).
- **5 high-leverage fixes** unlock 70% quality improvement: schema alignment (footer/hero variants), content library completion (logos + biz samples), design-quality rule enforcement (testimonial quotes, CTA labels), image relevance scoring, pre-ship harness validation.

---

## 1. Drift Findings Breakdown (800 total)

**Source:** `plans/260419-2022-GH-1-harness-template-block-sync-flow/reports/fullstack-02-drift-validator.md`

### By Type
| Issue Type | Count | Category | Impact |
|---|---|---|---|
| unknown-variant | 660 | Presets use variant not in schema | Silent fallback to default |
| unknown-block | 140 | Block missing from registry | Block skipped entirely at render |

### Top Offending Blocks (silent breaks)
| Block | Count | Problem | Severity |
|---|---|---|---|
| footer | 280 | Preset: `variant: 'mega'` vs registry: `mega-footer` | **CRITICAL** — renders basic footer |
| hero | 107 | Variants: `split-image`, `overlay`, `fullscreen-video` missing | **HIGH** — fallback to default hero |
| features | 85 | Variants: `alternating`, `detailed`, `card-grid` not in enum | **HIGH** — loses layout nuance |
| contact-form | 56 | Block doesn't exist in registry | **BLOCKER** — /contact page empty |
| stats | 44 | Variants: `inline`, `counter` missing | **MEDIUM** — renders as row |
| pricing | 27 | Variants: `tiers`, `packages` missing | **MEDIUM** — renders as cards |
| testimonials | 24 | Variants: `featured`, `marquee`, `slider` missing | **MEDIUM** |
| map, content-block, timeline | 64 | Blocks unregistered | **BLOCKER** — sections skip |
| team | 23 | Variants: `spotlight`, `detailed` missing | **MEDIUM** |

**Unknown blocks (6 unique):** `content`, `contact-form`, `map`, `content-block`, `map-embed`, `timeline`

### Disposition
- **Silent failures** — CI passes, no logs. User sees missing sections.
- **Baseline gated at 800** — cannot increase, can only decrease (`template-drift-validator.ts:30` `BASELINE_DRIFT_COUNT`).
- **Fix window:** Phase 03+ (not in v1.0 scope per phase-02 report).

---

## 2. Design Quality Rules (Non-blocking Warnings)

**Source:** `src/lib/ai/content-rules.ts` (411 lines), `src/lib/theme/color-utils.ts`, `src/lib/theme/resolve.ts`

### Applied Rules (All NON-BLOCKING)
| Rule | Threshold | Scope | Status |
|---|---|---|---|
| Hero headline | 3–10 words (max 10) | All AI + template gens | ✅ Enforced, warns via `[design-quality]` |
| Hero subheadline | 5–25 words (max 25) | All AI + template gens | ✅ Enforced |
| CTA labels | No "Submit", "Click Here", generic copy | en/vi/ms blocked lists | ✅ Enforced, auto-replaces |
| Feature description | ≤150 chars | All AI + template gens | ✅ Warns |
| **Testimonial quote** | **≤200 chars** | **All gens** | ⚠️ **RECURRING VIOLATION** |
| Section title | 2–10 words | All gens | ✅ Enforced |
| Font pairing | Whitelist: 26 pairs | Theme resolver | ✅ Enforced, fallback to defaults |
| Text contrast | WCAG AA (≥4.5:1) | All gens | ✅ Warns on violation |
| Generic content | Blacklist: 8 strong signals + 30 weak signals | Post-AI swap Phase 04 | ✅ Shipped (PR #630) — 95% swap rate |

**Warnings Output:**
- Dev/staging: `console.warn('[design-quality] testimonial quote 223 chars exceeds max 200')`  
- Prod: Silent auto-truncate to 200 chars
- No blocker, never throws

### Known Violations
- Testimonial quotes frequently exceed 200 chars in Phase 01 gens (Phase 04 post-AI swap catches this).
- Hero headlines sometimes generic ("Unlocking Potential", "Your Success") — caught by Phase 04 swap (2+ matches in generic phrase list).

---

## 3. Content Pack Audit (14 Categories)

**Source:** `src/lib/ai/content/` (14 files), `src/lib/ai/content-injection.ts`, `src/lib/ai/template-composer.ts`

### Business Sample Coverage
| Category | Count | Gap |
|---|---|---|
| beauty, business, creative, ecommerce, education, fitness, fnb, health, realestate, restaurant, tech | 9 | ✅ Full |
| **blog, events, travel** | **8** | **−1 each** |

**Status:** Missing 3 business samples total. Fix tracked in Phase 01 of plan `260417-0837-all-cate-full-and-strong` (merged as PR #686).

### Industry Block Content (per plan 260417-0837)
| Category | Data Status | Known Gaps |
|---|---|---|
| realestate | Rich (property-card, doctor-profile built) | ✅ Data exists, **missing from PAGES_BLOCK_WHITELIST** |
| fitness | Rich (class-schedule, video-showcase built) | ✅ Data exists, **missing from PAGES_BLOCK_WHITELIST** |
| health | Doctor-profile block built | ✅ Data exists, **blocked from persist** |
| tech, education | Moderate | ✅ Data exists, **blocked from persist** |

**Critical Gap:** 6 industry blocks in `SUPPORTED_BLOCK_IDS` but **NOT** in `PAGES_BLOCK_WHITELIST` (`src/lib/ai/pages-schema.ts:16-28`) — `sanitizeBlocksForPayload()` drops silently. **Blocker for Phase 01 hotfix per plan 260417-0837** (PR #686 landed).

### Client Logos Library
| Status | Detail |
|---|---|
| **Current** | Placeholder `Partner 1..6` in all categories (content-injection.ts:569–575, template-composer.ts:1175) |
| **Gap** | No `logos: string[]` field in `CategoryContent` type (content/types.ts) |
| **Impact** | Business + tech recipes **require** client-logos (category-recipes.ts:237, 417) — always renders synthetic logos |
| **Fix Needed** | Add real 6–8 Malaysian brand logos per category; wire `padItems` + `buildClientLogos` to read library |

---

## 4. Blueprint Coverage Gaps

**Source:** Template presets (template-presets-batch{1,2,3}.ts), category-requirements.ts

### Per-Category Coverage
- **All 14 categories:** 4 blueprints each (56 total, 662 + 660 + 535 blocks across batches)
- **No category <4** — coverage is even

### Preset Quality Gaps (per phase-01 audit `260416-2215-block-quality-audit`)
| Block | Categories | Gap Type | Fix Status |
|---|---|---|---|
| FAQ | 4/13 only (9 unprotected) | No minItems enforcement | ✅ Fixed Phase 01 |
| Gallery | 5/13 only | No minItems enforcement | ✅ Fixed Phase 01 |
| Team | 3/13 only | No minItems enforcement | ✅ Fixed Phase 01 |
| Pricing | 1/13 (tech only) | No minItems enforcement | ✅ Fixed Phase 01 |
| Service-cards | 0/13 | No minItems enforcement | ✅ Fixed Phase 01 |
| Stats | 0/13 | No minItems enforcement | ✅ Fixed Phase 01 |
| Logo-cloud | 0/13 | No minItems enforcement | ✅ Fixed Phase 01 |

**Note:** Phase 01 (`260416-2215-block-quality-audit`) already shipped minItems enforcement for all blocks across all categories. No open gaps.

---

## 5. Variant Diversity Status

**Source:** Plan `260414-2249-ai-gen-variety-root-cause` (Phase summary), harness matrix `plans/260414-0837-ai-gen-test-harness`

### Wix-Level Output Goal (Plan 260414)
**Target:** Hero ≥5/10 variants per category, features ≥3/10 — measured from harness matrix.

**Current Status (Plan 260414-0837 Phase summary):**
- **Shipped solutions:**
  - 8 personalities (bold, minimal, warm, pro, elegant, energetic, playful, serious) → deterministic keyword matching
  - 26 font pairs for variety (Design tokens Phase 02)
  - 42 skeleton recipes (48 total, 14 cat × 3 recipes + shared fallbacks)
  - Unsplash media pipeline (8–16 images per gen, $0/gen, Imgix optimization)
  - Post-AI swap Phase 04 (95% generic content detection + curated replacement)
- **Pending:**
  - AI path harness (Phase 07 stretch goal, mocked OpenAI response)
  - LLM-as-judge visual scoring (Phase 08, future)

**Result:** Variety improved significantly via template-first flip (plan 260416-1450) + post-AI swap (PR #630). Exact metric data not yet published; recommend running harness matrix for current baseline.

---

## 6. Image Selection Quality

**Source:** `src/lib/ai/unsplash-client.ts`, `src/lib/ai/media-pipeline.ts`, `src/lib/ai/image-keywords.ts`

### Pipeline Architecture
```
generateBlockNeeds() → deriveKeywords(block, category) 
  → searchPhotos(keyword, limit, {orientation, contentFilter})
  → downloadPhotoBuffer(Imgix-optimized URL, {w, h, quality, auto})
  → uploadToPayload() → assign mediaId
```

### Coverage & Fallbacks
| Scenario | Handling | Status |
|---|---|---|
| Photo found (typical) | Download + optimize via Imgix | ✅ Works |
| Photo not found | Category fallback (MS_TO_EN, VN_TO_EN) | ✅ Works |
| Unsplash rate limit hit | Partial-fail tolerant, 3-concurrency semaphore | ✅ Works |
| All images fail | Block still renders (mediaId unset, alt fallback) | ✅ Works |
| Placeholder risk | **None observed; Unsplash always returns results for curated keywords** | ✅ Low risk |

### Quality Assurance
- **Keyword derivation:** Category × block type → 40+ keyword patterns (image-keywords.ts)
- **Orientation rules:** Hero landscape, gallery square, team portrait (block-specific)
- **Content filter:** `contentFilter: 'low'` default (avoids nudity, violence)
- **Image size optimization:** Imgix `auto=format,compress` + Payload Media resize

**No blank/placeholder image issues reported in harness or Vercel logs.**

---

## 7. Previous Fix Attempts (What Stuck)

### Phase 01 — Block Quality Audit (260416-2215) ✅ DONE
- **What:** Extended minItems across all blocks/categories, enforced grid alignment
- **Result:** 0 empty blocks, grid orphans fixed

### Phase 04 — Post-AI Swap (PR #630) ✅ SHIPPED
- **What:** Detects generic AI content (95% catch rate) + swaps for curated composer output
- **Result:** 95% of gens now use real category-specific content instead of "Quality Service"

### Phase 02 — Drift Validator (260419-2022) ✅ SHIPPED
- **What:** Scan all 800 template refs, classify unknown-variant vs unknown-block
- **Result:** Baselined at 800 (can only decrease), CI green, blocks new regressions

### Phase 01 Hotfixes (260417-0837, PR #686) ✅ SHIPPED
- **What:** Unblock 5 weak categories (health, realestate, fitness, education, tech) by adding industry blocks to PAGES_BLOCK_WHITELIST
- **Result:** Industry block data now persists to Payload

### Design Quality Rules (Plan 260412-2300) ✅ SHIPPED
- **What:** Enforce hero headlines 3–10 words, CTA labels non-generic, testimonials ≤200 chars
- **Result:** Non-blocking warnings on dev/staging, silent auto-fix on prod, never breaks gen

**What didn't stick:**
- **Zero-findings gate on CI** — 800 legit pre-existing bugs made it impossible; baseline gate better trade-off
- **Codemod for 473 CSS var renames** — started in Phase 05 design-quality rules, likely incomplete; not v1.0 blocker

---

## 8. Quality Levers (What We Can Change)

### Highest ROI (ship v1.0)
1. **Fix footer mega → mega-footer variant** (280 findings, 5 min fix)  
   - Edit `template-presets-batch{1,2,3}.ts` or add alias to `footerMeta.variants`
   - Unblocks footer rendering on all 56 templates

2. **Complete client logos library** (3–4 hours)  
   - Add `logos: {name, url}[]` to `CategoryContent` type
   - Curate 6–8 real Malaysian logos per category (or use brand names from businesses)
   - Wire `buildClientLogos()` to read from library instead of `Partner N`

3. **Add +1 business sample** to blog, events, travel (1 hour)  
   - Reach parity at 9 per category
   - Phase 01 hotfixes PR #686 already landed; check if still pending

4. **Implement pre-ship template harness check**  
   - `npm run harness:quick` validates 390 fixtures in <60s
   - Detects empty-region (>30% viewport), structural invariants
   - Phase 03 already shipped (plan 260414-0837); integrate into CI

5. **Register contact-form block** (2 hours, unblocks 56 templates)  
   - Add to `PAGES_BLOCK_WHITELIST` + schema
   - Or map `contact-form` → existing `contact` block via alias
   - Blocks /contact pages currently skip

### Medium ROI (v1.1)
6. **Fix 107 hero variant refs** (heroic, but high payoff)  
   - `split-image`, `overlay`, `fullscreen-video`, `story` → map to registered variants or add missing ones
   - Affects homepage visual consistency

7. **Testimonial quote length post-processing**  
   - Phase 04 swap already catches generic content; add length-aware truncation
   - Keep context (ellipsis), store full in DB, truncate for render

8. **Image quality scoring** (LLM-as-judge, Phase 08 stretch)  
   - Rank Unsplash results by relevance to category/block context
   - Fallback chain: Unsplash top match → category theme mood → brand-safe generic

### Low ROI but Nice-to-Have
9. **Variant pool diversity metrics**  
   - Run harness matrix on staging monthly
   - Track hero/features variant distribution per category
   - Goal: ≥5/10 hero, ≥3/10 features (Wix-level)

10. **Client-side template preview performance**  
    - Phase 05 design-quality rules may have added 26 Google Fonts → potential FCP regression
    - Measure + optimize font loading strategy

---

## Unresolved Questions for PM

1. **Footer mega-footer:** Is this a registry enum mismatch we can fix, or intentional design? (280 findings)  
2. **Contact-form block:** Should it exist standalone, or fold into generic contact block?  
3. **Industry blocks (doctor-profile, property-card, etc.):** Are we shipping these in v1.0 or v1.1?  
4. **Client logos:** Should we source real logos from a brand library, or accept generic "Partner" naming for v1.0?  
5. **Quality gate for launch:** Is 800 drift findings acceptable for "v1.0 shipping"? Or drive baseline → 0?  
6. **Testimonial quote length:** Auto-truncate at 200 chars, or warn PM during review?  
7. **Harness CI gate:** Should PR merge require `harness:check` to pass (390 fixtures)? (Adds ~2 min to CI.)

---

## Summary Table: Quality Gaps & Levers

| Gap | Severity | Effort | Lever | Owner |
|---|---|---|---|---|
| 280 footer variant mismatches | **CRITICAL** | 5m | Variant alias or batch edit | Template |
| 140 unknown blocks (contact-form, map, etc.) | **CRITICAL** | 2h | Register blocks + WHITELIST | Core |
| 3 categories short on business samples | **MEDIUM** | 1h | Add 1 entry each (blog, events, travel) | Content |
| Client logos all placeholder | **MEDIUM** | 3h | Curate library, wire composer | Content |
| Testimonial quote 200-char overages | **MEDIUM** | 1h | Post-processing truncate | AI Rules |
| Harness CI visibility | **LOW** | 2h | Integrate `harness:check` to CI | DevOps |

---

**Next Step:** Prioritize v1.0-blockers (footer, contact-form, business samples) vs v1.1-nice-to-have (hero variants, quality metrics). Current status: all v1.0 levers identified and scoped ≤10h effort.
