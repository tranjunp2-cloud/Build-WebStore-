---
title: "Phase 02 — Stabilize Public Discovery Routes"
status: completed
effort: 3h
---

# Phase 02 — Stabilize Public Discovery Routes

## Context Links

- PR #1559 — existing public route implementation
- Issue #1312 — owner of score aggregation and unified SEO Health
- Parent plan: [plan.md](./plan.md)

## Overview

Verify and minimally harden `robots.txt`, `sitemap.xml`, and `llms.txt` as tenant-safe public contracts. Define facts that #1312 can score without duplicate score logic or self-fetching public routes. Implementation and formal unit validation are complete.

## Key Insights

- Route existence alone does not prove published/reachable semantics.
- Sitemap and `llms.txt` failures must be independent so #1312 can withhold only 5 or 1 point.
- Custom-domain and tenant resolution are security boundaries, not only SEO concerns.

## Requirements

- Published storefront: robots, sitemap, and `llms.txt` return valid content for the resolved site.
- Unpublished/missing storefront: sitemap and `llms.txt` return the approved not-found behavior; robots retains the platform crawler invariant without leaking private content.
- `llms.txt` uses `text/plain; charset=utf-8`, valid Markdown, an H1, and up to 10 unique real public URLs with homepage first and deterministic round-robin coverage across available pages, products, and blogs, plus optional contact/hours only from the same site. A homepage-only published site is valid; never fabricate URLs to meet a count.
- Sitemap includes only current public content and excludes private, deleted, hidden/no-index, inactive, checkout, admin, and order URLs.
- Preserve short bounded caching and bounded/parallel Payload queries.
- Do not make score code call the application's own HTTP routes.

## Architecture

Public routes resolve one authorized storefront context, query only that tenant/site, and serialize deterministic text/XML. They expose these handoff facts to #1312:

| Fact | Value/meaning | Score owner |
|---|---|---|
| `approvedAiCrawlersAllowed` | Platform invariant `true` | #1312 awards 9 |
| `sitemapPresent` | Published and route available | #1312 awards 5 |
| `llmsTxtReachable` | Published and route available | #1312 awards 1 |

#1312 must derive trusted facts from shared predicates/configuration or direct data access; it must not use fragile internal network requests.

## Related Code Files

### Modify only when a verified gap exists

- `src/app/sites/[slug]/robots.txt/route.ts`
- `src/app/sites/[slug]/sitemap.xml/route.ts`
- `src/app/sites/[slug]/llms.txt/route.ts`
- `src/middleware.ts`
- `src/lib/seo/canonical.ts`
- `src/__tests__/unit/seo/ai-crawlers-robots.test.ts`
- `src/__tests__/unit/seo/llms-txt.test.ts`
- `src/__tests__/unit/seo/sitemap-route.test.ts`
- `src/__tests__/unit/seo/public-discovery-middleware.test.ts`
- `src/__tests__/unit/seo/public-discovery-route-matrix.test.ts`

### Must not modify

- `src/lib/seo/local-seo-score.ts`
- `src/app/api/sites/[siteId]/local-seo-score/route.ts`
- US-F37-04 Dashboard score components/tests

## Implementation Steps

1. Build a route matrix for published, unpublished, missing, legacy-false, platform-hosted, and custom-domain storefronts.
2. Audit each route's site/tenant filters, status handling, content type, cache headers, and query limits.
3. Add route-import unit regressions before changing behavior; fix only demonstrated contract gaps.
4. Verify sitemap URL filtering and `llms.txt` URL/contact/hours ownership with multi-tenant fixtures.
5. Document the 9/5/1 handoff and independent failure semantics in code-level contract comments or the architecture docs owned by the merged #1677 baseline.
6. Run focused tests and inspect the response bodies for accidental private or cross-site data.

## Todo

- [x] Approve published/unpublished/missing status matrix.
- [x] Verify platform-subdomain and active custom-domain resolution.
- [x] Verify sitemap inclusion/exclusion rules.
- [x] Verify `llms.txt` MIME, Markdown, real public URLs, optional data, sanitization, and cache.
- [x] Provide #1312 with the 9/5/1 route-fact contract and failure matrix.

## Completion Evidence

- Pre-review targeted discovery suite: 6 files, 62/62 tests passed.
- Pre-review full unit suite: 661 files, 11,111/11,111 tests passed.
- Typecheck passed; lint passed with 0 errors and 139 pre-existing warnings.
- `git diff --check` and migration check passed.
- Review hardening passed: custom-domain request headers and safe slug serialization fixed; deterministic balanced 10-URL `llms.txt` contract and narrow Payload field projections verified (22/22 then 27/27 focused tests).
- Known deferred risk: multi-site-per-tenant disambiguation remains in `OPEN_BLOCKERS`; current product supports one published site per tenant.

## Success Criteria

- All route matrix cases have deterministic automated coverage.
- Cross-tenant fixture values never appear in another storefront's sitemap or `llms.txt`.
- A failure in one discovery endpoint does not change another endpoint's behavior.
- No score helper/API file is changed and no internal HTTP self-fetch is introduced.

## Risk Assessment

- Existing tests may encode stale 500-versus-404 behavior; settle expected status from merged docs before editing assertions.
- Multi-site resolution may be broader than #1311; record unresolved ambiguity rather than selecting an arbitrary site.
- Expanding content queries can cause N+1 or oversized responses; keep limits and parallel access explicit.

## Security Considerations

- Treat slug/host resolution as untrusted input and use established tenant/domain lookup paths.
- Escape or serialize generated XML/Markdown safely; never leak drafts, private routes, customer/order data, or another tenant's contact details.
- Do not trust forwarded host headers outside the existing validated middleware contract.

## Next Steps

Hand the stable route matrix to Phase 03 for docs/TC-ID reconciliation and real-browser validation, and to #1312 for score integration.
