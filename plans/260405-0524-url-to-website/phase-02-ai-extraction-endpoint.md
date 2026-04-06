# Phase 2: AI Extraction Endpoint

> Parent: [plan.md](plan.md) | Depends on: [Phase 1](phase-01-url-scraper-lib.md)

## Overview

| Field | Value |
|-------|-------|
| Date | 2026-04-05 |
| Priority | P1 |
| Status | pending |
| Review | pending |
| Effort | ~4h |

## Key Insights

- Two-step approach: new extraction endpoint (GPT-4o-mini) → existing generate-site (GPT-4o)
- GPT-4o-mini for extraction = $0.001/call (10x cheaper than GPT-4o)
- Use `json_object` response format + Zod validation (same pattern as openai-generator.ts)
- Zero changes to existing generate-site pipeline

## Requirements

1. New endpoint `POST /api/ai/extract-from-url`
2. Accept `{ url: string }` body
3. Scrape URL (Phase 1) → send to GPT-4o-mini → return `ExtractionResult`
4. Auth required, rate limited (5/min per user)
5. Content safety check on scraped content

## Architecture

```
POST /api/ai/extract-from-url
    │
    ├── Auth (getCurrentUser)
    ├── Rate limit (5/min)
    ├── Zod validate { url }
    │
    ├── scrapeUrl(url) → ScrapeResult    [Phase 1]
    │
    ├── checkBusinessInfoSafety(scrapeResult.content)
    │
    ├── GPT-4o-mini:
    │   ├── System prompt: "Extract business info from website content"
    │   ├── User prompt: preprocessedText (meta + body)
    │   └── Response: JSON { businessInfo, theme hints, language, confidence }
    │
    ├── Zod validate AI response → ExtractionResult
    │
    └── Return ExtractionResult to client
```

## Related Code Files

| File | Relevance |
|------|-----------|
| `src/app/api/ai/generate-site/route.ts` | Pattern: auth + rate limit + AI call |
| `src/lib/ai/openai-generator.ts` | Pattern: GPT call + JSON parse + Zod validate |
| `src/lib/ai/system-prompt.ts` | Pattern: system prompt building |
| `src/lib/validations/ai.ts` | Add new Zod schema here |
| `src/lib/ai/config.ts` | May need new model config |

## Implementation Steps

### 1. Add Zod schema to `src/lib/validations/ai.ts`
```typescript
export const extractFromUrlSchema = z.object({
  url: z.string().url().max(2048),
})

export const extractionResultSchema = z.object({
  businessName: z.string().default(''),
  industry: z.string().default(''),
  shortDescription: z.string().default(''),
  products: z.string().default(''),
  suggestedTheme: z.object({
    primaryColor: z.string().optional(),
    secondaryColor: z.string().optional(),
    siteType: z.string().optional(),
  }).optional(),
  detectedLanguage: z.enum(['en', 'ms', 'vi']).default('en'),
  confidence: z.enum(['high', 'medium', 'low']).default('medium'),
})
```

### 2. Create extraction system prompt
```typescript
// src/lib/ai/url-extraction-prompt.ts
export function buildExtractionPrompt(preprocessedText: string): {
  system: string
  user: string
} {
  return {
    system: `You extract structured business information from website content.
Output JSON matching this exact schema:
{
  "businessName": "string — business/company name",
  "industry": "string — one of: business, ecommerce, restaurant, tech, health, education, realestate, fitness, creative, beauty, blog",
  "shortDescription": "string — 1-2 sentence business description",
  "products": "string — comma-separated products/services offered",
  "suggestedTheme": {
    "primaryColor": "#hex — dominant brand color if detectable",
    "secondaryColor": "#hex — accent color if detectable",
    "siteType": "string — same enum as industry"
  },
  "detectedLanguage": "en|ms|vi — based on content language",
  "confidence": "high|medium|low"
}
Rules:
- If field not detectable, use empty string (never null)
- Detect language from <html lang> first, then content analysis
- For industry, pick closest match from enum list
- For colors, only include if clearly present in meta/styles
- confidence: high = 4/4 fields filled, medium = 2-3, low = 0-1`,
    user: preprocessedText,
  }
}
```

### 3. Create API route
```typescript
// src/app/api/ai/extract-from-url/route.ts
export const dynamic = 'force-dynamic'

// POST handler:
// 1. parseRequest(req, extractFromUrlSchema)
// 2. getCurrentUser() → 401 if not auth
// 3. checkRateLimit(userId, 5) → 429
// 4. scrapeUrl(url) → ScrapeResult
// 5. checkBusinessInfoSafety on scraped text
// 6. OpenAI GPT-4o-mini call with extraction prompt
// 7. Parse + validate response with extractionResultSchema
// 8. Return { success, data: ExtractionResult, scrapeConfidence }
```

### 4. GPT-4o-mini call pattern
```typescript
import { openai } from '@ai-sdk/openai'
// Use generateText from @ai-sdk/openai or direct OpenAI SDK
// model: 'gpt-4o-mini'
// temperature: 0.3 (low for extraction accuracy)
// max_tokens: 1000
// response_format: { type: 'json_object' }
```

## Todo

- [ ] Add `extractFromUrlSchema` to `src/lib/validations/ai.ts`
- [ ] Create `src/lib/ai/url-extraction-prompt.ts`
- [ ] Create `src/app/api/ai/extract-from-url/route.ts`
- [ ] Wire up: auth → rate limit → scrape → safety → AI extract → validate → respond
- [ ] Handle errors: scrape fail, AI fail, validation fail
- [ ] Test with real URLs (staging)

## Success Criteria

- [ ] `POST /api/ai/extract-from-url { url: "https://example.com" }` returns valid ExtractionResult
- [ ] Auth required (401 without token)
- [ ] Rate limited (429 after 5 calls/min)
- [ ] Content safety check blocks unsafe content
- [ ] GPT-4o-mini used (not GPT-4o)
- [ ] Response validated by Zod schema
- [ ] Graceful error messages for scrape failures

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| GPT-4o-mini extraction quality too low | Low | Medium | Test with 10+ real URLs; upgrade to GPT-4o if needed |
| Scraped content too short for useful extraction | Medium | Low | Confidence score + user fallback to manual form |
| API key cost spike from abuse | Low | Medium | Rate limiting (5/min) + auth required |

## Security Considerations

- Endpoint requires authentication
- Scraped content passes through content safety filter
- URL goes through SSRF validation (Phase 1)
- Rate limiting prevents abuse
- No scraped content stored in DB (stateless extraction)
