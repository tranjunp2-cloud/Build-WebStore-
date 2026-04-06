# Research: Server-Side URL Scraping for AI Website Builder

> Date: 2026-04-05 | Context: Next.js 15 + Docker standalone on DigitalOcean

---

## 1. HTML Parsing Libraries Comparison

| Library | Size | Speed | JS Rendering | Docker-friendly | Best for |
|---------|------|-------|-------------|-----------------|----------|
| **cheerio** | ~2MB | 8x faster than jsdom | No | Yes | Static HTML, meta tags |
| **jsdom** | ~15MB | Moderate | Partial | Yes | DOM API needed, basic JS |
| **puppeteer** | ~400MB+ (Chromium) | Slow | Full | No (browser binary) | SPA, JS-heavy sites |
| **playwright** | ~400MB+ (browsers) | Slow | Full | No (browser binary) | Cross-browser, E2E |
| **node-fetch + cheerio** | ~2MB | Fast | No | Yes | Lightweight combo |

**Recommendation: `cheerio` + native `fetch`** (Next.js 15 has built-in fetch).
- No browser binary = Docker image stays small (~200MB vs ~600MB with Puppeteer).
- 90%+ of business websites serve meaningful content in static HTML (meta tags, headings, text).
- For the 10% SPA cases: graceful degradation (extract whatever is available).

---

## 2. Metadata & Content Extraction Packages

### Tier 1 — Recommended

| Package | Weekly DL | What it does | Dependencies |
|---------|-----------|-------------|--------------|
| **open-graph-scraper** | ~114K | OG tags, Twitter Cards, meta | cheerio (built-in) |
| **metascraper** | ~54K | OG + JSON-LD + RDFa + fallbacks | Plugin-based, cheerio |
| **@extractus/article-extractor** | ~8K | Full article body + meta | @mozilla/readability, sanitize-html |

### Tier 2 — Specialized

| Package | Purpose |
|---------|---------|
| **css-color-extractor** | Parse CSS strings for hex/rgb/hsl colors |
| **color-thief** (node) | Dominant colors from images (logo analysis) |
| **@mozilla/readability** | Mozilla's algorithm for main content extraction |

### Recommended Stack

```
open-graph-scraper    → OG/Twitter/meta tags (primary)
@mozilla/readability  → Main content text extraction (fallback)
css-color-extractor   → Brand colors from inline/linked CSS
color-thief           → Dominant colors from logo/hero images
```

`metascraper` is more powerful but plugin-heavy (15+ plugins). For our use case (extract business info, not build a search engine), `open-graph-scraper` + `@mozilla/readability` covers 95% of needs with fewer deps.

---

## 3. SSRF Prevention (Critical)

User-provided URLs are a top attack vector. Must implement defense-in-depth:

### URL Validation Layer

```typescript
function validateUrl(input: string): URL {
  const url = new URL(input); // throws on invalid
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid protocol');
  if (url.username || url.password) throw new Error('Credentials not allowed');
  if (url.port && !['80', '443', ''].includes(url.port)) throw new Error('Non-standard port');
  return url;
}
```

### DNS Rebinding / Private IP Protection

```typescript
import { lookup } from 'dns/promises';

const BLOCKED_RANGES = [
  /^127\./,            // loopback
  /^10\./,             // RFC1918
  /^172\.(1[6-9]|2\d|3[01])\./,  // RFC1918
  /^192\.168\./,       // RFC1918
  /^169\.254\./,       // link-local
  /^0\./,              // current network
  /^::1$/,             // IPv6 loopback
  /^fc00:/i,           // IPv6 ULA
  /^fe80:/i,           // IPv6 link-local
];

async function resolveAndValidate(hostname: string): Promise<string> {
  const { address } = await lookup(hostname);
  if (BLOCKED_RANGES.some(r => r.test(address))) {
    throw new Error('URL resolves to blocked IP range');
  }
  return address;
}
```

### Fetch with Safeguards

- **Timeout**: 10s max (AbortController)
- **Max response size**: 5MB (check Content-Length header, stream with size limit)
- **No redirects to private IPs**: Validate each redirect hop
- **Content-Type check**: Only proceed if response is `text/html`

### NPM Helpers

- `ssrf-req-filter` — Blocks requests to private IPs (use as fetch agent)
- Manual validation preferred over library (libraries have had bypasses, e.g., `nossrf`)

---

## 4. Content Extraction Strategy

### Phase 1: Meta Tags (fast, reliable)
```
URL → fetch HTML → open-graph-scraper → { title, description, og:image, og:type, site_name }
```

### Phase 2: Main Content (business info)
```
HTML → @mozilla/readability → { textContent, excerpt, byline }
→ Parse headings (h1-h3) for service/product names
→ Extract nav links for site structure
```

### Phase 3: Brand Colors
```
HTML → extract inline <style> + linked CSS URLs
→ css-color-extractor → all colors
→ Rank by frequency → top 3-5 = brand palette
Also: og:image or logo → color-thief → dominant colors
```

### Phase 4: Logo Detection
```
Priority order:
1. <link rel="icon"> or <link rel="apple-touch-icon"> (high-res)
2. og:image (if square-ish aspect ratio)
3. <img> with src/alt containing "logo"
4. First <img> inside <header> or <nav>
```

---

## 5. Rate Limiting & Abuse Prevention

| Control | Value | Implementation |
|---------|-------|---------------|
| Per-user rate limit | 5 scrapes / minute | Redis + sliding window (existing infra) |
| Per-IP rate limit | 10 scrapes / minute | Middleware or API route |
| Global concurrency | 10 concurrent scrapes | Semaphore / queue |
| URL cooldown | Same URL cached 1 hour | Redis cache key = hash(url) |
| Max URL length | 2048 chars | Zod validation |
| Blocklist | Competitor URLs, localhost variants | Config-driven |

### Implementation Approach

Use existing Redis (already in stack for Payload sessions). Middleware pattern:

```typescript
// Pseudocode for rate limiting
const key = `scrape:${userId}:${minute}`;
const count = await redis.incr(key);
if (count === 1) await redis.expire(key, 60);
if (count > 5) return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
```

Cache successful scrapes to avoid redundant fetches:
```typescript
const cacheKey = `scrape:result:${sha256(url)}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);
// ... scrape ... then:
await redis.setex(cacheKey, 3600, JSON.stringify(result));
```

---

## 6. Recommended Architecture

```
[User Input: URL]
    │
    ▼
[Zod Validation] → reject invalid URLs
    │
    ▼
[Rate Limit Check] → 429 if exceeded
    │
    ▼
[Cache Check] → return cached if fresh
    │
    ▼
[SSRF Validation] → DNS resolve + IP check
    │
    ▼
[fetch() with AbortController] → 10s timeout, 5MB limit
    │
    ▼
[open-graph-scraper] → meta/OG/Twitter tags
[cheerio parse] → headings, nav, logo, inline CSS
[@mozilla/readability] → main content text
[css-color-extractor] → brand colors
    │
    ▼
[Normalize & Structure] → ScrapeResult object
    │
    ▼
[Cache Result] → Redis 1hr TTL
    │
    ▼
[Return to AI Builder] → feed into template selection / content generation
```

---

## 7. Final Recommendations

| Decision | Choice | Rationale |
|----------|--------|-----------|
| HTML fetching | Native `fetch` | Built into Next.js 15, no extra deps |
| HTML parsing | `cheerio` | Fast, lightweight, Docker-friendly |
| OG/meta extraction | `open-graph-scraper` | Most popular, batteries-included |
| Content extraction | `@mozilla/readability` | Industry standard (used by Firefox) |
| Color extraction | `css-color-extractor` + `color-thief` | CSS colors + image dominant colors |
| SSRF prevention | Custom middleware (DNS + IP check) | Libraries have had bypasses |
| Rate limiting | Redis sliding window | Reuse existing Redis infra |
| Caching | Redis with 1hr TTL | Avoid redundant scrapes |

**Install footprint**: ~5MB total (vs ~400MB+ if using Puppeteer). Docker image stays lean.

**Packages to add**:
```bash
npm i open-graph-scraper @mozilla/readability css-color-extractor color-thief-node
# cheerio already likely in deps via open-graph-scraper
```
