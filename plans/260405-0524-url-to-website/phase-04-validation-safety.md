# Phase 4: Validation & Safety

> Parent: [plan.md](plan.md) | Depends on: [Phase 1](phase-01-url-scraper-lib.md)

## Overview

| Field | Value |
|-------|-------|
| Date | 2026-04-05 |
| Priority | P2 |
| Status | pending |
| Review | pending |
| Effort | ~2h |

## Requirements

1. Update `generateSiteSchema` in `ai.ts` to accept optional `businessUrl`
2. Add URL domain safety check to `content-safety.ts`
3. Add scraped content safety check (reuse existing `checkBusinessInfoSafety`)

## Implementation Steps

### 1. Update Zod schema — `src/lib/validations/ai.ts`
```typescript
// Add to existing generateSiteSchema
export const generateSiteSchema = z.object({
  businessInfo: z.object({
    businessName: z.string().min(1),
    industry: z.string().min(1),
    products: z.string().min(1),
    shortDescription: z.string().min(1),
    businessUrl: z.string().url().optional(),  // NEW
    source: z.enum(['form', 'url']).optional(), // NEW
  }),
  extraInstructions: z.string().optional(),
  language: z.enum(['en', 'ms', 'vi', 'auto']).optional(),
})
```

### 2. Add URL domain check — `src/lib/ai/content-safety.ts`
```typescript
const BLOCKED_DOMAINS = [
  'localhost', '127.0.0.1', '0.0.0.0',
  // Add competitor domains if needed
]

export function checkUrlSafety(url: string): { safe: boolean; message: string } {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.toLowerCase()
    if (BLOCKED_DOMAINS.some(d => hostname === d || hostname.endsWith(`.${d}`))) {
      return { safe: false, message: 'This URL is not allowed.' }
    }
    return { safe: true, message: '' }
  } catch {
    return { safe: false, message: 'Invalid URL format.' }
  }
}
```

### 3. Apply safety to scraped content
Reuse existing `checkBusinessInfoSafety()` on extracted text content before sending to AI.

## Todo

- [ ] Update `generateSiteSchema` with `businessUrl` + `source`
- [ ] Add `checkUrlSafety()` to content-safety.ts
- [ ] Add `BLOCKED_DOMAINS` list
- [ ] Wire safety check into extract-from-url endpoint

## Success Criteria

- [ ] Schema accepts both form-only and form+URL payloads
- [ ] Blocked domains rejected with clear error
- [ ] Unsafe scraped content blocked before AI call
- [ ] Existing form-only flow unaffected
