# Phase 1: URL Scraper Library

> Parent: [plan.md](plan.md)

## Overview

| Field | Value |
|-------|-------|
| Date | 2026-04-05 |
| Priority | P1 — Foundation for all other phases |
| Status | pending |
| Review | pending |
| Effort | ~4h |

## Key Insights

- `cheerio` + native `fetch` = ~2MB footprint, no browser binary needed for Docker
- `open-graph-scraper` handles OG/Twitter/meta extraction out of the box
- `@mozilla/readability` extracts main content text (same algo as Firefox Reader View)
- SSRF prevention is critical — user-provided URLs can target internal services
- Pre-processing HTML before sending to AI saves ~70% tokens

## Requirements

1. Create `src/lib/ai/url-scraper.ts` — standalone, testable module
2. Fetch URL with SSRF protection (DNS resolve + IP blocklist)
3. Extract: meta tags, OG data, main content text, headings, nav links
4. Pre-process HTML for AI consumption (strip scripts/styles, truncate)
5. Return structured `ScrapeResult` object

## Architecture

```
[URL string]
    │
    ├── validateUrl() → protocol, port, credentials check
    │
    ├── resolveAndValidate() → DNS lookup → block private IPs
    │
    ├── fetchWithSafeguards() → AbortController 10s, 5MB limit, Content-Type check
    │
    ├── extractMetadata() → open-graph-scraper → { title, description, og:image, site_name }
    │
    ├── extractMainContent() → @mozilla/readability → { textContent, excerpt }
    │
    ├── extractStructure() → cheerio → { headings[], navLinks[], contactInfo }
    │
    └── preprocessForAI() → strip tags, collapse whitespace, truncate 6500 chars
```

## Related Code Files

| File | Relevance |
|------|-----------|
| `src/lib/ai/openai-generator.ts` | Pattern reference for AI utilities |
| `src/lib/ai/content-safety.ts` | Safety check pattern |
| `src/lib/rateLimit.ts` | Rate limit pattern |

## Implementation Steps

### 1. Install dependencies
```bash
npm i open-graph-scraper @mozilla/readability cheerio
npm i -D @types/jsdom  # readability needs JSDOM types
```

### 2. Create types
```typescript
// src/lib/ai/url-scraper.ts

export type ScrapeResult = {
  url: string
  meta: {
    title: string
    description: string
    ogImage: string | null
    siteName: string | null
    locale: string | null
    themeColor: string | null
  }
  content: {
    headings: string[]          // h1-h3 text
    mainText: string            // readability extracted text (truncated)
    excerpt: string             // short summary
    navLinks: { label: string; url: string }[]
  }
  raw: {
    preprocessedText: string    // for AI consumption
    charCount: number
  }
  confidence: 'high' | 'medium' | 'low'
  warnings: string[]
}
```

### 3. Implement SSRF prevention
```typescript
const BLOCKED_IP_RANGES = [
  /^127\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./, /^169\.254\./, /^0\./, /^::1$/, /^fc00:/i, /^fe80:/i,
]

async function resolveAndValidate(hostname: string): Promise<void> {
  const { address } = await dns.promises.lookup(hostname)
  if (BLOCKED_IP_RANGES.some(r => r.test(address))) {
    throw new Error('URL resolves to blocked IP range')
  }
}

function validateUrl(input: string): URL {
  const url = new URL(input)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid protocol')
  if (url.username || url.password) throw new Error('Credentials not allowed')
  if (url.port && !['80', '443', ''].includes(url.port)) throw new Error('Non-standard port')
  return url
}
```

### 4. Implement fetch with safeguards
- AbortController with 10s timeout
- Check Content-Length < 5MB before reading body
- Verify Content-Type is text/html
- Follow redirects (max 3), re-validate each hop

### 5. Implement content extraction pipeline
- `open-graph-scraper` for meta/OG tags
- `cheerio` for headings (h1-h3), nav links, inline styles
- `@mozilla/readability` for main content text
- `preprocessForAI()` → combine meta header (500 chars) + body text (6000 chars)

### 6. Implement confidence scoring
- **high**: title + description + mainText > 500 chars
- **medium**: title exists + some mainText
- **low**: only URL hostname available

## Todo

- [ ] Install npm packages
- [ ] Create `src/lib/ai/url-scraper.ts`
- [ ] Implement `validateUrl()` + `resolveAndValidate()`
- [ ] Implement `fetchWithSafeguards()`
- [ ] Implement `extractMetadata()` via open-graph-scraper
- [ ] Implement `extractMainContent()` via @mozilla/readability
- [ ] Implement `extractStructure()` via cheerio
- [ ] Implement `preprocessForAI()`
- [ ] Implement confidence scoring
- [ ] Export `scrapeUrl(url: string): Promise<ScrapeResult>`

## Success Criteria

- [ ] `scrapeUrl('https://example.com')` returns valid ScrapeResult
- [ ] Private IPs (127.0.0.1, 10.x, 192.168.x) are blocked
- [ ] Invalid URLs throw descriptive errors
- [ ] Timeout after 10s
- [ ] Response > 5MB rejected
- [ ] Non-HTML content-type rejected
- [ ] Confidence score reflects content quality

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| SSRF bypass | Medium | High | DNS resolve + IP check + no redirect to private |
| Scrape blocked by target (403/captcha) | High | Low | Graceful fallback, clear user message |
| Large HTML causes memory issues | Low | Medium | 5MB limit + streaming response check |
| Readability fails on non-article sites | Medium | Low | Fallback to cheerio text extraction |

## Security Considerations

- NEVER follow redirects to private IP ranges
- NEVER pass raw HTML to AI without preprocessing
- URL domain + scraped content MUST pass content safety check
- Log scrape attempts for abuse monitoring
- Consider adding domain blocklist (competitors, known bad sites)
