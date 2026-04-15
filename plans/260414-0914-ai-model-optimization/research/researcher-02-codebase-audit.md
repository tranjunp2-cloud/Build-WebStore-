# OpenAI API Audit Report — ECH Prime Web v2

**Audit Date:** 2026-04-14  
**Scope:** All `openai.chat.completions.create()` calls in `src/`  
**Methodology:** Static analysis + config review  

---

## Executive Summary

- **Total API Calls:** 10 distinct endpoints + 1 library function
- **Model Routing:** `selectModel()` defined in config.ts but **NOT actively used** (dead code)
- **Hardcoded Models:** All calls hardcode `gpt-4o` or `gpt-4o-mini` directly
- **Cost Leaks:** 2 calls use `gpt-4o` (expensive) that could use `gpt-4o-mini`
- **Response Format:** 6/10 use `response_format: { type: 'json_object' }` (structured output)
- **Rate Limiting:** Present (Upstash Redis + in-memory fallback, 20 req/hr baseline)
- **Retry Logic:** Only `extract-from-url` has fallback; others fail hard

---

## All OpenAI Calls Inventory

| Line | File | Model | Temp | Max Tokens | Format | System Prompt Size | User Input | Frequency | Feature |
|------|------|-------|------|-----------|--------|-------------------|-----------|-----------|---------|
| 64 | `lib/ai/openai-generator.ts` | `gpt-4o` | 0.7 | 8000 | `json_object` | ~800 | Dynamic (100-500 words) | **Per site gen** | Site Generation (GPT-4o) |
| 60 | `lib/ai/generate-meta.ts` | `gpt-4o-mini` | 0.7 | 300 | `json_object` | ~300 | Dynamic (100 chars+keywords) | Bulk SEO queue | Page/Product SEO |
| 40 | `app/api/products/generate-description/route.ts` | `gpt-4o-mini` | 0.6 | 500 | `json_object` | ~250 | Dynamic (name+category) | Per product | Product Description |
| 72 | `app/api/ai/product-description/route.ts` | `gpt-4o-mini` | 0.7 | 500 | (plain) | ~450 | Dynamic (name+features) | Per product | Product Description v2 |
| 46 | `app/api/ai/rewrite-text/route.ts` | `gpt-4o-mini` | 0.7 | 500 | (plain) | ~250 | Dynamic (text+instruction) | Per edit | Inline Text Edit |
| 58 | `app/api/ai/generate-blog/route.ts` | `gpt-4o-mini` | 0.7 | 3000 | `json_object` | ~450 | Dynamic (prompt+language) | Per request | Blog Generation |
| 98 | `app/api/ai/seo-generate/route.ts` | `gpt-4o-mini` | 0.6 | 400 | `json_object` | ~400 | Dynamic (name+category) | Per product | Product SEO (structured) |
| 99 | `app/api/ai/products-bulk-parse/route.ts` | **`gpt-4o`** | 0.2 | 3000 | `json_object` | ~1500 | Dynamic (bulk product list) | **Per batch import** | Bulk Product Parse (gpt-4o) |
| 171 | `app/api/ai/edit-block/route.ts` | **`gpt-4o`** | 0.7 | 2000 | `json_object` | ~800 | Dynamic (instruction+block schema) | Per edit request | Chat Block Edit (gpt-4o) |
| 92 | `app/api/seo/fix/route.ts` | `gpt-4o-mini` | 0.3 | 200 | `json_object` | ~200 | Dynamic (page content) | Bulk fix per site | Batch SEO Metadata Fix |
| 75 | `app/api/ai/extract-from-url/route.ts` | `gpt-4o-mini` | 0.3 | 2000 | `json_object` | ~400 | Dynamic (scraped HTML) | Per URL extract | URL Extraction (Scraper) |

---

## Model Routing Analysis

### 1. `selectModel()` Function (config.ts, lines 21–35)

**Status:** DEFINED BUT DEAD CODE — never imported or used anywhere.

```typescript
export function selectModel(task: AITask): AIModel {
    switch (task) {
        case 'site-generation': return 'gpt-4o'      // High quality
        case 'chat-edit':
        case 'inline-edit':
        case 'seo-generation':
        case 'content-rewrite':
        case 'product-description':
        case 'url-extraction':
            return 'gpt-4o-mini'  // Cost-optimized (15x cheaper)
    }
}
```

**Grep Result:** No imports of `selectModel` found anywhere in codebase except test file.

### 2. Hardcoded Models — Cost Risks

**2 CALLS USE `gpt-4o` UNNECESSARILY:**

1. **Line 99, `products-bulk-parse/route.ts`** (bulk product parsing)
   - Model: `gpt-4o` (should be `gpt-4o-mini`)
   - Why: Structured parsing of user input; variance in quality acceptable
   - Est. cost delta: +$0.015/request

2. **Line 171, `edit-block/route.ts`** (chat-based block edits)
   - Model: `gpt-4o` (could be `gpt-4o-mini`)
   - Why: Block editing is iterative user feedback loop; lower quality acceptable
   - Est. cost delta: +$0.0005/request

**All remaining 8 calls already use `gpt-4o-mini`** ✓

---

## Response Format Coverage

| Type | Count | Usage |
|------|-------|-------|
| `json_object` | 6 | Return structured JSON to API clients |
| Plain text | 2 | Rewrite/edit returns raw text |
| (none specified) | 2 | Let OpenAI choose format |

**Note:** No `response_format: { type: 'json_schema' }` usage (structured outputs feature not adopted yet).

---

## System Prompts

### Size Analysis
- **Smallest:** ~200 chars (`seo/fix/route.ts`)
- **Largest:** ~1500 chars (`products-bulk-parse/route.ts`)
- **Median:** ~400 chars
- **Strategy:** Static templates in `config.ts` not widely used; most routes define prompts inline.

### Content Quality
- **SEO prompts:** Emphasize character/keyword constraints → good
- **Product parsing:** Detailed variant tier restrictions (max 2) → good
- **Site generation:** Block registry metadata injected → excellent
- **Edit prompt:** Provides current block state + schema reference → excellent

---

## Dynamic Input Analysis

| Endpoint | Input Source | Typical Size | Notes |
|----------|-------------|--------------|-------|
| generate-site | Form submission | 500–1000 words | `normalizeBusinessInput()` applied |
| product-description | API form | 50–200 chars | Name + category + features |
| rewrite-text | User text | 100–500 chars | Variable; context optional |
| generate-blog | Blog title/topic | 20–100 chars | Expands to 800–1200 word output |
| bulk-parse | CSV/paste input | 1–5 KB | Can be multi-product (50+ items) |
| edit-block | Natural language | 30–200 chars | Instruction + full block schema |
| extract-from-url | Web page | 2–20 KB | Scraped preprocessed text |

---

## Rate Limiting & Cost Controls

### Rate Limit Config (rateLimit.ts)
- **Backend:** Upstash Redis (distributed) + in-memory fallback
- **Default:** 20 requests/hour per user
- **Two-tier for site gen:** 5/min (burst) + 20/hour (sustained)
- **Implementation:** Checked at handler start; returns 429 on exceed

### Cost Tracking
- **Estimated costs defined in config.ts:**
  - `site-generation`: $0.04 per call (GPT-4o)
  - `product-description`: $0.0003 per call (GPT-4o-mini)
  - `url-extraction`: $0.001 per call (GPT-4o-mini)
  - Others: $0.0002–0.0005
- **Actual tracking:** NOT implemented (no DB logging of API spend)

---

## Error Handling & Fallback Patterns

| Route | Has Fallback | Mechanism |
|-------|-------------|-----------|
| openai-generator.ts | ✓ YES | Rule-based block generator if no key or AI fails |
| generate-meta.ts | ✓ YES | Template fallback on 429/quota error |
| extract-from-url.ts | ✓ YES | Returns scraped data without AI enrichment on error |
| products-bulk-parse.ts | ✗ NO | Fail-hard with error code |
| edit-block.ts | ✗ NO | Fail-hard with error message |
| All others | ✗ NO | Throw or return 500 |

**Model Retry Logic:** None. No try-catch that catches one model and retries another.

---

## Config.ts Summary

**Lines 1–153: AI Cost Optimization Module**

- Defines `selectModel(task)` → never called
- Rate limits per subscription tier (free/starter/pro/business)
  - Free: 1 site gen lifetime, 3 SEO/day
  - Pro: 20 site gen/month, 50 SEO/day
- Static system prompts for 6 task types (seo-generation, content-rewrite, etc.)
- Estimated costs table for billing/tracking
- **Strategic intent:** Excellent structure, but routing logic unused

---

## Key Observations & Recommendations

### Dead Code
1. ❌ `selectModel()` exported but never imported
   - **Action:** Either use it in all 10 routes, or delete

### Cost Leaks
2. ❌ `products-bulk-parse/route.ts` line 99: `gpt-4o` used for parsing
   - **Savings:** Switch to `gpt-4o-mini` → ~$0.015/request saved
   
3. ❌ `edit-block/route.ts` line 171: `gpt-4o` for iterative block edits
   - **Savings:** Switch to `gpt-4o-mini` → estimated 10–20% cost reduction

### Missing Instrumentation
4. ⚠️ No cost tracking database
   - Estimated costs defined but never logged
   - Cannot measure actual spending or identify heavy users

### Retry Gaps
5. ⚠️ No model fallback on error
   - If `gpt-4o` quota exceeded, no automatic downgrade to `gpt-4o-mini`
   - Only `generate-meta.ts` and `extract-from-url.ts` have any fallback

### Structured Outputs
6. ℹ️ All JSON endpoints use `json_object` mode
   - None use OpenAI Structured Outputs (`json_schema`) feature
   - Could add stricter validation if available

---

## Unresolved Questions

1. **Why is `selectModel()` exported but unused?**
   - Was this meant for future middleware routing?
   - Should it be imported in all 10 API endpoints?

2. **Are cost estimates (config.ts) accurate?**
   - Estimates assume ~4K input tokens for site gen; actual measurements unknown
   - No logging to validate

3. **Is `gpt-4o` actually necessary for site generation vs `gpt-4o-mini`?**
   - No A/B testing data provided
   - Could reduce cost 15x if quality acceptable

4. **Why is rate limiting set at 20/hour instead of per-plan?**
   - Config.ts defines plan-based limits; rate limit checks use flat 20
   - Mismatch between config intent and runtime enforcement

5. **Is prompt caching enabled on OpenAI client?**
   - Config doesn't show cache headers; unknown if utilized

---

## Summary Table: Quick Reference

| Metric | Value | Status |
|--------|-------|--------|
| Total endpoints | 10 | ✓ Complete |
| selectModel() usage | 0/10 | ❌ Dead code |
| gpt-4o calls | 2 (edit-block, bulk-parse) | ⚠️ Review needed |
| gpt-4o-mini calls | 8 | ✓ Good |
| Structured output adoption | 6/10 endpoints | ✓ Good |
| Fallback patterns | 3/10 | ⚠️ Weak |
| Rate limit enforcement | ✓ Yes (Upstash) | ✓ Good |
| Cost tracking DB | ✗ No | ❌ Missing |
| Model retry logic | ✗ No | ❌ Missing |

