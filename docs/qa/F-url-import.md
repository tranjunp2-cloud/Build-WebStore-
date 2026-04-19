# QA Test Plan: URL-to-Website AI Redesign

**Feature:** F-URL-IMPORT
**PRD:** `docs/prd/url-to-website.md`
**Scenarios:** `docs/qa/scenarios/url-to-website.md` (50 scenarios, 10 dimensions)
**Date:** 2026-04-05
**Author:** Claude AI (QA)

---

## 1. Test Strategy

### Test Types

| Type | Tool | Scope | Target |
|------|------|-------|--------|
| Unit | Vitest | URL scraper, SSRF validation, content extraction, AI prompt, Zod schemas | 80% coverage |
| Component | Vitest + RTL | BusinessInfoForm URL mode, toggle, auto-fill, confidence badge | Key interactions |
| Integration | Vitest | POST /api/ai/extract-from-url end-to-end (mocked fetch + OpenAI) | Happy + error paths |
| E2E | Playwright | Full flow: paste URL → extract → review → generate → site created | Happy path only |
| Security | Vitest | SSRF prevention, auth, rate limiting, content safety, XSS | All Critical scenarios |
| Performance | Manual | Extraction < 5s, timeout at 10s | NFR-01, NFR-02 |

### Coverage Targets
- **Unit:** ≥80% lines for new files (`url-scraper.ts`, `url-extraction-prompt.ts`)
- **Integration:** All 17 ACs covered
- **E2E:** 1 happy path (URL → extract → generate → site)

### Test Convention
- Follow `docs/TEST_CONVENTION.md`
- TC-ID format: `TC-URL-XXX`
- AAA pattern, `vi.mock()` at top, import from source

---

## 2. Risk Assessment

| Risk | Impact | Likelihood | Mitigation | Test Coverage |
|------|--------|------------|------------|---------------|
| SSRF bypass via redirect | Critical | Medium | DNS + IP check per hop | TC-URL-012, TC-URL-013 |
| XSS from scraped content in UI | Critical | Low | Server-side sanitize, never render raw | TC-URL-014 |
| OpenAI API failure | High | Medium | Graceful fallback to manual | TC-URL-024, TC-URL-025 |
| Rate limit bypass | High | Low | In-memory rate limiter tested | TC-URL-020, TC-URL-021 |
| Auth bypass | Critical | Low | Existing auth pattern reused | TC-URL-018, TC-URL-019 |
| Extraction quality too low | Medium | Medium | Confidence scoring + user review | TC-URL-028, TC-URL-029 |
| Backward compatibility broken | High | Low | Manual mode regression tests | TC-URL-040, TC-URL-041 |

---

## 3. Test Cases

### A. URL Input Validation (Unit)

#### TC-URL-001: Valid HTTPS URL accepted
- **Priority:** P1
- **Type:** Unit
- **AC Reference:** AC-02
- **Precondition:** url-scraper module loaded
- **Steps:**
  1. Call `validateUrl('https://example.com')`
  2. Check return value
- **Expected:** Returns URL object, no error thrown
- **Test Data:** `https://example.com`, `https://www.business.my`, `https://kedai-kopi.com.my`

#### TC-URL-002: HTTP URL accepted (non-HTTPS)
- **Priority:** P2
- **Type:** Unit
- **AC Reference:** AC-02
- **Steps:**
  1. Call `validateUrl('http://example.com')`
- **Expected:** Returns URL object (HTTP allowed)
- **Test Data:** `http://example.com`

#### TC-URL-003: Invalid URL format rejected
- **Priority:** P1
- **Type:** Unit
- **AC Reference:** AC-07
- **Steps:**
  1. Call `validateUrl('not-a-url')`
  2. Call `validateUrl('')`
  3. Call `validateUrl('abc')`
- **Expected:** Each throws Error with descriptive message
- **Test Data:** `''`, `'abc'`, `'ftp://x'`, `'javascript:alert(1)'`

#### TC-URL-004: Non-HTTP protocol rejected
- **Priority:** P1
- **Type:** Unit
- **AC Reference:** AC-07
- **Steps:**
  1. Call `validateUrl('ftp://files.com')`
  2. Call `validateUrl('file:///etc/passwd')`
- **Expected:** Error: 'Invalid protocol'
- **Test Data:** `ftp://`, `file://`, `data:`, `javascript:`

#### TC-URL-005: URL with credentials rejected
- **Priority:** P1
- **Type:** Unit / Security
- **AC Reference:** AC-06
- **Steps:**
  1. Call `validateUrl('https://admin:pass@evil.com')`
- **Expected:** Error: 'Credentials not allowed'
- **Test Data:** `https://user:pass@site.com`

#### TC-URL-006: Non-standard port rejected
- **Priority:** P2
- **Type:** Unit
- **AC Reference:** AC-06
- **Steps:**
  1. Call `validateUrl('https://evil.com:8080')`
- **Expected:** Error: 'Non-standard port'
- **Test Data:** `https://x.com:8080`, `https://x.com:3000`

#### TC-URL-007: URL > 2048 chars rejected
- **Priority:** P2
- **Type:** Unit
- **AC Reference:** AC-07
- **Steps:**
  1. Call extractFromUrlSchema.parse with URL > 2048 chars
- **Expected:** Zod validation error
- **Test Data:** `'https://example.com/' + 'a'.repeat(2040)`

### B. SSRF Prevention (Unit / Security)

#### TC-URL-008: Loopback IP blocked (127.0.0.1)
- **Priority:** P1
- **Type:** Unit / Security
- **AC Reference:** AC-06
- **Steps:**
  1. Mock DNS lookup to resolve to `127.0.0.1`
  2. Call `resolveAndValidate('evil.com')`
- **Expected:** Error: 'URL resolves to blocked IP range'
- **Test Data:** `127.0.0.1`, `127.0.0.2`

#### TC-URL-009: RFC1918 private IPs blocked (10.x)
- **Priority:** P1
- **Type:** Unit / Security
- **AC Reference:** AC-06
- **Steps:**
  1. Mock DNS to resolve to `10.0.0.1`
  2. Call `resolveAndValidate('target.com')`
- **Expected:** Error: blocked IP range
- **Test Data:** `10.0.0.1`, `10.255.255.255`

#### TC-URL-010: RFC1918 private IPs blocked (172.16-31.x)
- **Priority:** P1
- **Type:** Unit / Security
- **AC Reference:** AC-06
- **Steps:**
  1. Mock DNS to resolve to `172.16.0.1`
- **Expected:** Error: blocked IP range
- **Test Data:** `172.16.0.1`, `172.31.255.255`

#### TC-URL-011: RFC1918 private IPs blocked (192.168.x)
- **Priority:** P1
- **Type:** Unit / Security
- **AC Reference:** AC-06
- **Steps:**
  1. Mock DNS to resolve to `192.168.1.1`
- **Expected:** Error: blocked IP range
- **Test Data:** `192.168.0.1`, `192.168.255.255`

#### TC-URL-012: Redirect to private IP blocked
- **Priority:** P1
- **Type:** Unit / Security
- **AC Reference:** AC-06
- **Precondition:** Target URL redirects (302) to private IP
- **Steps:**
  1. Mock fetch to return 302 → `http://192.168.1.1/admin`
  2. Call `fetchWithSafeguards('https://evil.com')`
- **Expected:** Error: redirect to blocked IP, scrape aborted
- **Test Data:** Redirect chain: evil.com → 192.168.1.1

#### TC-URL-013: Link-local IP blocked (169.254.x)
- **Priority:** P2
- **Type:** Unit / Security
- **AC Reference:** AC-06
- **Steps:**
  1. Mock DNS to resolve to `169.254.1.1`
- **Expected:** Error: blocked IP range

#### TC-URL-014: IPv6 loopback blocked (::1)
- **Priority:** P2
- **Type:** Unit / Security
- **AC Reference:** AC-06
- **Steps:**
  1. Mock DNS to resolve to `::1`
- **Expected:** Error: blocked IP range

### C. Fetch Safeguards (Unit)

#### TC-URL-015: Timeout after 10s
- **Priority:** P1
- **Type:** Unit
- **AC Reference:** AC-08
- **Steps:**
  1. Mock fetch to hang for 15s
  2. Call `fetchWithSafeguards('https://slow-site.com')`
- **Expected:** AbortError after 10s, error message: "Could not access website"
- **Test Data:** Simulated 15s delay

#### TC-URL-016: Response > 5MB rejected
- **Priority:** P1
- **Type:** Unit
- **AC Reference:** NFR-03
- **Steps:**
  1. Mock fetch to return Content-Length: 6000000
  2. Call `fetchWithSafeguards('https://huge-site.com')`
- **Expected:** Error: response too large
- **Test Data:** Content-Length: 6MB

#### TC-URL-017: Non-HTML Content-Type rejected
- **Priority:** P1
- **Type:** Unit
- **AC Reference:** AC-09
- **Steps:**
  1. Mock fetch to return Content-Type: application/pdf
  2. Call `fetchWithSafeguards('https://site.com/doc.pdf')`
- **Expected:** Error: "URL does not point to a web page"
- **Test Data:** `application/pdf`, `image/png`, `application/json`

### D. Authentication & Rate Limiting (Integration)

#### TC-URL-018: Unauthenticated request → 401
- **Priority:** P1
- **Type:** Integration
- **AC Reference:** AC-16
- **Steps:**
  1. POST /api/ai/extract-from-url without auth token
- **Expected:** 401 Unauthorized
- **Test Data:** No cookie, no Authorization header

#### TC-URL-019: Expired JWT → 401
- **Priority:** P1
- **Type:** Integration / Security
- **AC Reference:** AC-16
- **Steps:**
  1. POST with expired JWT token
- **Expected:** 401 Unauthorized

#### TC-URL-020: Rate limit — 5 requests OK
- **Priority:** P1
- **Type:** Integration
- **AC Reference:** AC-12
- **Steps:**
  1. Send 5 valid extraction requests in 1 minute
- **Expected:** All 5 succeed (200)

#### TC-URL-021: Rate limit — 6th request → 429
- **Priority:** P1
- **Type:** Integration
- **AC Reference:** AC-12
- **Steps:**
  1. Send 6 extraction requests in 1 minute
- **Expected:** 6th returns 429 with retry message

### E. Content Extraction (Unit)

#### TC-URL-022: Meta tags extracted correctly
- **Priority:** P1
- **Type:** Unit
- **AC Reference:** AC-03
- **Steps:**
  1. Provide HTML with `<title>`, `<meta name="description">`, `<meta property="og:image">`
  2. Call `extractMetadata(html)`
- **Expected:** ScrapeResult.meta contains title, description, ogImage
- **Test Data:** HTML with OG tags for Malaysian restaurant

#### TC-URL-023: Main content extracted via Readability
- **Priority:** P1
- **Type:** Unit
- **AC Reference:** AC-03
- **Steps:**
  1. Provide HTML with article content
  2. Call `extractMainContent(html)`
- **Expected:** content.mainText contains article body, headings extracted
- **Test Data:** Business landing page HTML (500+ chars body)

#### TC-URL-024: preprocessForAI truncates to ~6500 chars
- **Priority:** P2
- **Type:** Unit
- **AC Reference:** NFR-04
- **Steps:**
  1. Provide HTML with 50000 chars body
  2. Call `preprocessForAI(html)`
- **Expected:** Output ≤ 6500 chars, meta header preserved
- **Test Data:** Large HTML page

#### TC-URL-025: Scripts/styles stripped before AI processing
- **Priority:** P1
- **Type:** Unit
- **AC Reference:** FR-03
- **Steps:**
  1. Provide HTML with `<script>`, `<style>`, `<svg>`, comments
  2. Call `preprocessForAI(html)`
- **Expected:** No script/style content in output

### F. AI Extraction (Unit / Integration)

#### TC-URL-026: Valid content → full BusinessInfo extracted
- **Priority:** P1
- **Type:** Unit
- **AC Reference:** AC-03
- **Steps:**
  1. Mock GPT-4o-mini to return valid JSON
  2. Call extraction with rich preprocessed text
- **Expected:** All 4 BusinessInfo fields populated, confidence='high'
- **Test Data:** `{ businessName: "Kedai Kopi ABC", industry: "restaurant", ... }`

#### TC-URL-027: Minimal content → partial extraction + low confidence
- **Priority:** P1
- **Type:** Unit
- **AC Reference:** AC-14
- **Steps:**
  1. Mock GPT-4o-mini to return only businessName
  2. Call extraction with sparse text
- **Expected:** confidence='low', warnings array non-empty

#### TC-URL-028: AI returns invalid JSON → Zod fallback
- **Priority:** P1
- **Type:** Unit
- **AC Reference:** AC-13
- **Steps:**
  1. Mock GPT-4o-mini to return non-JSON string
  2. Call extraction
- **Expected:** Graceful error, fallback to empty form with warning

#### TC-URL-029: AI returns non-enum industry → default to 'business'
- **Priority:** P2
- **Type:** Unit
- **AC Reference:** AC-03
- **Steps:**
  1. Mock AI to return `industry: "automotive"`
  2. Validate with Zod schema
- **Expected:** Defaults to 'business' or closest match

#### TC-URL-030: Language detection — Malay content
- **Priority:** P2
- **Type:** Unit
- **AC Reference:** AC-03, FR-12
- **Steps:**
  1. Provide Malay content (`<html lang="ms">`)
  2. Extract via AI
- **Expected:** detectedLanguage = 'ms'
- **Test Data:** Malay business page HTML

#### TC-URL-031: Language detection — English content
- **Priority:** P2
- **Type:** Unit
- **AC Reference:** FR-12
- **Steps:**
  1. Provide English content (`<html lang="en">`)
- **Expected:** detectedLanguage = 'en'

#### TC-URL-032: Theme colors extracted when present
- **Priority:** P2
- **Type:** Unit
- **AC Reference:** FR-04
- **Steps:**
  1. Provide content with `<meta name="theme-color" content="#FF5722">`
  2. AI extracts suggestedTheme
- **Expected:** suggestedTheme.primaryColor = '#FF5722' (or AI-derived)

### G. Content Safety (Unit)

#### TC-URL-033: Unsafe content in scraped text → blocked
- **Priority:** P1
- **Type:** Unit
- **AC Reference:** AC-11
- **Steps:**
  1. Provide scraped text containing blocked terms (from content-safety.ts)
  2. Call `checkBusinessInfoSafety()`
- **Expected:** { safe: false }, 400 error
- **Test Data:** Text containing "gambling", "drugs" etc.

#### TC-URL-034: Blocked domain (localhost) → rejected
- **Priority:** P1
- **Type:** Unit
- **AC Reference:** AC-10
- **Steps:**
  1. Call `checkUrlSafety('http://localhost/admin')`
- **Expected:** { safe: false, message: 'This URL is not allowed.' }
- **Test Data:** `localhost`, `127.0.0.1`, `0.0.0.0`

#### TC-URL-035: Safe content + safe domain → allowed
- **Priority:** P1
- **Type:** Unit
- **AC Reference:** AC-02
- **Steps:**
  1. Call safety checks with normal business content
- **Expected:** { safe: true }

### H. UI — Toggle & Form (Component)

#### TC-URL-036: Toggle between Manual and URL mode
- **Priority:** P1
- **Type:** Component
- **AC Reference:** AC-01
- **Steps:**
  1. Render BusinessInfoForm
  2. Click "From URL" tab
  3. Verify URL input visible, form fields hidden
  4. Click "Manual" tab
  5. Verify form fields visible, URL input hidden
- **Expected:** Toggle works, correct content shown per mode

#### TC-URL-037: URL input validates format client-side
- **Priority:** P1
- **Type:** Component
- **AC Reference:** AC-07
- **Steps:**
  1. Enter "not-a-url" in URL input
  2. Click Extract
- **Expected:** Validation error shown, no API call made

#### TC-URL-038: Extract button shows loading state
- **Priority:** P1
- **Type:** Component
- **AC Reference:** AC-02
- **Steps:**
  1. Enter valid URL
  2. Click Extract
  3. Observe button state
- **Expected:** Button disabled, loading spinner shown, text changes to "Extracting..."

#### TC-URL-039: Successful extraction auto-fills form
- **Priority:** P1
- **Type:** Component
- **AC Reference:** AC-03, AC-05
- **Steps:**
  1. Mock API to return extraction result
  2. Enter URL + click Extract
  3. Wait for response
- **Expected:** Form switches to Manual view, fields pre-filled, confidence badge shown
- **Test Data:** Mock response: `{ businessName: "Test", industry: "tech", ... }`

#### TC-URL-040: User can edit auto-filled fields
- **Priority:** P1
- **Type:** Component
- **AC Reference:** AC-04
- **Steps:**
  1. Auto-fill form from extraction
  2. Change businessName to "New Name"
  3. Change industry to "restaurant"
- **Expected:** Fields editable, new values reflected in state

#### TC-URL-041: Failed extraction shows error + manual fallback
- **Priority:** P1
- **Type:** Component
- **AC Reference:** AC-08, AC-13
- **Steps:**
  1. Mock API to return 500 error
  2. Enter URL + click Extract
- **Expected:** Toast error message, "Try manual entry" link visible, clicking it switches to Manual tab

#### TC-URL-042: Confidence badge displays correct color
- **Priority:** P2
- **Type:** Component
- **AC Reference:** AC-14
- **Steps:**
  1. Mock extraction with confidence='high' → green badge
  2. Mock extraction with confidence='medium' → yellow badge
  3. Mock extraction with confidence='low' → red badge + warning banner
- **Expected:** Correct color + text per confidence level

#### TC-URL-043: Double click Extract prevented
- **Priority:** P2
- **Type:** Component
- **AC Reference:** AC-02
- **Steps:**
  1. Click Extract
  2. Immediately click Extract again
- **Expected:** Second click ignored (button disabled during loading)

#### TC-URL-044: Switch to Manual during extraction cancels it
- **Priority:** P2
- **Type:** Component
- **AC Reference:** AC-01
- **Steps:**
  1. Click Extract (loading starts)
  2. Click Manual tab
- **Expected:** Extraction cancelled, Manual form shown (empty)

### I. Backward Compatibility (Component / E2E)

#### TC-URL-040B: Manual mode works exactly as before
- **Priority:** P1
- **Type:** Component
- **AC Reference:** AC-15
- **Steps:**
  1. Render BusinessInfoForm in Manual mode (default)
  2. Fill businessName, industry, shortDescription, products
  3. Click Generate
- **Expected:** Form submits with same payload as before, no regressions

#### TC-URL-045: Existing generate-site API accepts form data without businessUrl
- **Priority:** P1
- **Type:** Integration
- **AC Reference:** AC-15, NFR-06
- **Steps:**
  1. POST /api/ai/generate-site with traditional businessInfo (no businessUrl, no source)
- **Expected:** 200 OK, site generated (backward compatible)

### J. Analytics & Tracking (Integration)

#### TC-URL-046: Source tracking — URL mode
- **Priority:** P2
- **Type:** Integration
- **AC Reference:** AC-17
- **Steps:**
  1. Extract from URL → generate
  2. Check payload sent to generate-site
- **Expected:** `businessInfo.source === 'url'`, `businessInfo.businessUrl` present

#### TC-URL-047: Source tracking — Manual mode
- **Priority:** P2
- **Type:** Integration
- **AC Reference:** AC-17
- **Steps:**
  1. Fill form manually → generate
  2. Check payload
- **Expected:** `businessInfo.source === 'form'` or undefined (backward compatible)

### K. Error Messages i18n (Component)

#### TC-URL-048: Error messages in English (locale=en)
- **Priority:** P2
- **Type:** Component
- **AC Reference:** AC-08
- **Steps:**
  1. Set user locale to EN
  2. Trigger extraction error (timeout)
- **Expected:** Error in English: "We couldn't access this website..."

#### TC-URL-049: Error messages in Bahasa Melayu (locale=ms)
- **Priority:** P2
- **Type:** Component
- **AC Reference:** AC-08
- **Steps:**
  1. Set user locale to MS
  2. Trigger extraction error (timeout)
- **Expected:** Error in MS: "Kami tidak dapat mengakses laman web ini..."

### L. End-to-End (E2E)

#### TC-URL-050: Full happy path — URL → extract → review → generate → site created
- **Priority:** P1
- **Type:** E2E
- **AC Reference:** AC-01 → AC-05
- **Precondition:** User logged in, has tenant
- **Steps:**
  1. Navigate to /builder/new
  2. Click "From URL" tab
  3. Paste `https://example-business.com`
  4. Click "Extract"
  5. Wait for auto-fill (< 5s)
  6. Review extracted fields (businessName, industry, etc.)
  7. Edit industry if needed
  8. Click "Generate Website"
  9. Wait for SSE streaming generation
  10. Verify site created with correct content
- **Expected:** Site created, redirected to editor, blocks rendered correctly
- **Test Data:** Real business URL (staging only)

---

## 4. Traceability Matrix

| AC | Test Cases | Coverage |
|----|-----------|----------|
| AC-01 | TC-URL-036, TC-URL-044 | ✅ Full |
| AC-02 | TC-URL-001, TC-URL-038, TC-URL-043, TC-URL-050 | ✅ Full |
| AC-03 | TC-URL-022, TC-URL-023, TC-URL-026, TC-URL-039 | ✅ Full |
| AC-04 | TC-URL-040 | ✅ Full |
| AC-05 | TC-URL-050 | ✅ Full |
| AC-06 | TC-URL-005, TC-URL-008, TC-URL-009, TC-URL-010, TC-URL-011, TC-URL-012, TC-URL-013, TC-URL-014 | ✅ Full |
| AC-07 | TC-URL-003, TC-URL-004, TC-URL-006, TC-URL-007, TC-URL-037 | ✅ Full |
| AC-08 | TC-URL-015, TC-URL-041, TC-URL-048, TC-URL-049 | ✅ Full |
| AC-09 | TC-URL-017 | ✅ Full |
| AC-10 | TC-URL-034 | ✅ Full |
| AC-11 | TC-URL-033 | ✅ Full |
| AC-12 | TC-URL-020, TC-URL-021 | ✅ Full |
| AC-13 | TC-URL-028, TC-URL-041 | ✅ Full |
| AC-14 | TC-URL-027, TC-URL-042 | ✅ Full |
| AC-15 | TC-URL-040B, TC-URL-045 | ✅ Full |
| AC-16 | TC-URL-018, TC-URL-019 | ✅ Full |
| AC-17 | TC-URL-046, TC-URL-047 | ✅ Full |

**Coverage: 17/17 ACs = 100%**

---

## 5. Test Data Requirements

| Data | Purpose | Source |
|------|---------|--------|
| Valid business HTML (EN) | Happy path extraction | Fixture file |
| Valid business HTML (MS) | Language detection | Fixture file |
| Minimal HTML (title only) | Low confidence test | Fixture file |
| Empty HTML body | Edge case | Fixture file |
| HTML with blocked terms | Content safety | Fixture file |
| HTML > 5MB | Size limit | Generated |
| Binary content (PDF header) | Content-Type check | Fixture file |
| Valid ExtractionResult JSON | Mock AI response | Fixture |
| Partial ExtractionResult JSON | Low confidence mock | Fixture |
| Invalid JSON string | AI failure mock | Fixture |

---

## 6. Test Environment

| Environment | Purpose | Tools |
|-------------|---------|-------|
| Local | Unit + Component tests | Vitest + RTL |
| CI (GitHub Actions) | All unit + integration | Vitest |
| Staging | E2E with real URLs | Playwright |
| Manual | Performance, mobile, a11y | Browser DevTools |
