# Phase 5: Testing

> Parent: [plan.md](plan.md) | Depends on: Phase 1-4

## Overview

| Field | Value |
|-------|-------|
| Date | 2026-04-05 |
| Priority | P2 |
| Status | pending |
| Review | pending |
| Effort | ~4h |

## Test Files

| File | Type | Coverage |
|------|------|----------|
| `src/__tests__/unit/ai/url-scraper.test.ts` | Unit | SSRF prevention, URL validation, content extraction |
| `src/__tests__/unit/ai/url-extraction.test.ts` | Unit | AI extraction prompt, response parsing |
| `src/__tests__/unit/builder/business-info-form-url.test.tsx` | Component | URL input mode, toggle, auto-fill |
| `src/__tests__/integration/extract-from-url.test.ts` | Integration | Full API endpoint flow |

## Key Test Cases

### url-scraper.test.ts
```
TC-URL-01: Valid URL → returns ScrapeResult with meta + content
TC-URL-02: Private IP (127.0.0.1) → throws SSRF error
TC-URL-03: Private IP (10.x.x.x) → throws SSRF error
TC-URL-04: Private IP (192.168.x.x) → throws SSRF error
TC-URL-05: Non-HTTP protocol (ftp://) → throws error
TC-URL-06: URL with credentials (user:pass@) → throws error
TC-URL-07: Non-standard port → throws error
TC-URL-08: Timeout (>10s) → throws timeout error
TC-URL-09: Response > 5MB → throws size limit error
TC-URL-10: Non-HTML content-type → throws error
TC-URL-11: Minimal content → confidence = 'low'
TC-URL-12: Rich content → confidence = 'high'
TC-URL-13: preprocessForAI truncates to ~6500 chars
```

### url-extraction.test.ts
```
TC-EXT-01: Valid scraped content → returns BusinessInfo fields
TC-EXT-02: Empty content → returns defaults with low confidence
TC-EXT-03: Malay content → detectedLanguage = 'ms'
TC-EXT-04: English content → detectedLanguage = 'en'
TC-EXT-05: AI returns invalid JSON → Zod fallback to defaults
TC-EXT-06: Content safety blocked → returns 400
```

### business-info-form-url.test.tsx
```
TC-UI-01: Toggle between Manual and URL mode
TC-UI-02: URL input validates format before submit
TC-UI-03: Extract button shows loading state
TC-UI-04: Successful extraction auto-fills form fields
TC-UI-05: Failed extraction shows error toast
TC-UI-06: Confidence badge displays correctly
TC-UI-07: User can edit auto-filled fields
TC-UI-08: Form submit includes businessUrl in payload
```

## Implementation Pattern

Follow `docs/TEST_CONVENTION.md`:
- TC-ID naming from above
- AAA pattern (Arrange, Act, Assert)
- `vi.mock()` at top of file
- Import from source, never re-implement logic

## Todo

- [ ] Create url-scraper.test.ts (13 test cases)
- [ ] Create url-extraction.test.ts (6 test cases)
- [ ] Create business-info-form-url.test.tsx (8 test cases)
- [ ] Mock fetch, OpenAI, cheerio as needed
- [ ] Run `vitest run` — all pass
- [ ] Coverage > 80% for new code

## Success Criteria

- [ ] All 27 test cases pass
- [ ] No existing tests broken
- [ ] Coverage > 80% for new files
- [ ] SSRF tests cover all private IP ranges
