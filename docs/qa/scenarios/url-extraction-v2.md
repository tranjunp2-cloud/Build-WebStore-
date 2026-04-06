# URL Extraction v2 — Scenario Report

Generated: 2026-04-06 | Dimensions: 10/12 | Total: 47 scenarios

## Summary
- Critical: 4 (#4 XSS in URL, #22 XSS in JSON-LD, #37 Playwright missing, #41 unauth API)
- High: 15
- Medium: 19
- Low: 6

## Top Risks for Implementation

1. **Playwright fallback** — must handle crash/timeout/missing gracefully (#10, #14, #37)
2. **JSON-LD security** — never eval, always try/catch (#20, #22)
3. **Image URL resolution** — relative URLs, lazy-loading attrs (#24, #25)
4. **Color validation** — only apply valid hex, skip garbage (#28)
5. **sectionOrder mapping** — filter unknown block types (#31)

## Full Scenario Table
(47 scenarios — see main conversation for complete table)
