---
date: 2026-07-20
session: gh-1588-products-grid-fix-review
---

# Journal: 2026-07-20 — GH-1588 Products Grid Fix Review

## Context

Review the generate-site products-grid normalization against repository review and test conventions.

## What Happened

- Review found unexplained `any` usage, missing TC-ID/AAA structure, and no regression coverage for image-reference retry.
- Added TC-TF-025 through TC-TF-027, typed generated-site fixtures, and a slug-targeted one-shot Payload failure.
- The retry test also verifies Malay copy, category-filter defaults, legacy `count` migration, and image cleanup.
- Initial single-page fixture failed because canonicalization treats the first page as homepage; adding a real homepage fixed the fixture.

## Reflection

Testing the persistence boundary exposed a fixture invariant that a helper-only test would have missed. The focused API regression gives stronger coverage without adding a brittle browser test for an existing route.

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Keep API-level Vitest coverage | Existing route and persistence behavior are best exercised with mocked Payload | No new Playwright dependency or flaky browser flow |
| Target retry failure by page slug | Multi-page generation must fail only on `/products` | Reliable coverage of the intended fallback branch |
| Verify Malay copy in retry test | Closes locale and retry residual risks together | Broader coverage with one focused test |

## Next Steps

- Commit the generate-site normalization, tests, QA mapping, and this journal when ready.
