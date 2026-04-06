# Scenario Analysis: URL-to-Website AI Redesign

**Feature:** F-URL-IMPORT
**Date:** 2026-04-05
**Dimensions:** 10/12 (skipped: Scale, Compliance)
**Total scenarios:** 50

## Scenarios by Dimension

### 1. User Types (5 scenarios)

| # | Scenario | Severity | Expected |
|---|----------|----------|----------|
| 1 | Unauthenticated user calls extract endpoint | Critical | 401, no scrape |
| 2 | Free tier user extracts URL — no credit deduction | High | Extraction OK, aiGenerationsCount unchanged |
| 3 | Super-admin extracts URL | Medium | Same rate limit (5/min) |
| 4 | User without tenant extracts URL | High | Auto-create tenant or return extraction without tenant |
| 5 | Bot hammering extract endpoint | High | Rate limit blocks after 5/min |

### 2. Input Extremes (9 scenarios)

| # | Scenario | Severity | Expected |
|---|----------|----------|----------|
| 6 | Empty string URL | High | Zod rejects, 400 |
| 7 | URL > 2048 chars | Medium | Zod rejects, 400 |
| 8 | Unicode/IDN domain | Medium | Punycode resolve works |
| 9 | URL with query params & fragments | Low | Works, strip fragment |
| 10 | URL with embedded credentials | Critical | validateUrl() rejects |
| 11 | Binary file URL (PDF/ZIP) | Medium | Content-Type check rejects |
| 12 | XSS payload in URL path | Critical | URL sanitized server-side |
| 13 | Page with 0 text content | Medium | confidence=low, warning |
| 14 | HTML >5MB | High | Size limit rejects |

### 3. Timing (5 scenarios)

| # | Scenario | Severity | Expected |
|---|----------|----------|----------|
| 15 | Double click Extract | Medium | Button disabled during extraction |
| 16 | Navigate away during extraction | Low | AbortController cancels |
| 17 | Slow site (8-9s response) | Medium | Show progress text |
| 18 | Switch to Manual tab during extraction | Medium | Cancel extraction |
| 19 | Concurrent extractions (2 tabs) | Medium | Rate limiter handles |

### 4. State Transitions (5 scenarios)

| # | Scenario | Severity | Expected |
|---|----------|----------|----------|
| 20 | Re-extract after editing fields | Medium | Fresh extraction replaces |
| 21 | Generation fails after extraction | High | Form preserved, retry OK |
| 22 | Close browser → reopen | Medium | Zustand persist or fresh form |
| 23 | Low confidence → switch Manual → fill → generate | Low | source='form' |
| 24 | Already has site → extract new URL → generate | High | Existing site updated |

### 5. Environment (4 scenarios)

| # | Scenario | Severity | Expected |
|---|----------|----------|----------|
| 25 | Mobile Safari paste URL | Medium | Paste works on mobile |
| 26 | Slow 3G connection | Medium | Clear loading state |
| 27 | Screen reader navigation | Medium | ARIA labels on toggle |
| 28 | User locale = MS | Medium | Errors in Bahasa Melayu |

### 6. Error Cascades (6 scenarios)

| # | Scenario | Severity | Expected |
|---|----------|----------|----------|
| 29 | OpenAI API down | High | Graceful error + manual fallback |
| 30 | OpenAI returns malformed JSON | High | Zod catches, empty form + warning |
| 31 | DNS resolution fails | Medium | Clear error message |
| 32 | Redirect to private IP | Critical | Block redirect, SSRF error |
| 33 | Target returns 403 | Medium | Clear error + manual fallback |
| 34 | Cheerio/Readability throws | Medium | Fallback to raw text |

### 7. Authorization (3 scenarios)

| # | Scenario | Severity | Expected |
|---|----------|----------|----------|
| 35 | Expired JWT | Critical | 401 + redirect login |
| 36 | CSRF attack on extract endpoint | High | SameSite cookies block |
| 37 | Cross-user data leak | Critical | Stateless, no leak possible |

### 8. Data Integrity (4 scenarios)

| # | Scenario | Severity | Expected |
|---|----------|----------|----------|
| 38 | AI returns non-enum industry | Medium | Default to 'business' |
| 39 | Colors in wrong format | Low | Normalize or use defaults |
| 40 | HTML entities in businessName | Medium | Decode entities |
| 41 | Unsupported locale detected | Medium | Default to 'en' |

### 9. Integration (4 scenarios)

| # | Scenario | Severity | Expected |
|---|----------|----------|----------|
| 42 | OpenAI 429 rate limit | High | Retry with backoff or error |
| 43 | OGS package breaking change | Low | Pin version |
| 44 | HTTP URL (not HTTPS) | Low | Allow but warn |
| 45 | Target has strict CSP | Low | Server-side fetch ignores |

### 10. Business Logic (5 scenarios)

| # | Scenario | Severity | Expected |
|---|----------|----------|----------|
| 46 | Extract competitor URL | Low | No restriction |
| 47 | Non-business site (Wikipedia) | Medium | confidence=low, warning |
| 48 | Same URL multiple times | Medium | Rate limit handles |
| 49 | Theme color suggestion UX | Medium | Show swatches, user chooses |
| 50 | Extract → publish → re-extract → generate | High | Published → draft, new content |

## Summary

| Severity | Count |
|----------|-------|
| Critical | 6 |
| High | 10 |
| Medium | 23 |
| Low | 11 |
| **Total** | **50** |
