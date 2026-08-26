---
date: 2026-08-04
session: gh-1588-phase-02-category-guard
---

# Journal: 2026-08-04 — GH-1588 Phase 2 Category Guard

## Context

Phase 2 addressed the bulk-generation bug where an allowlisted category ID could still be semantically unrelated to the generated product.

## What Happened

- Replaced allowlist-only acceptance with an exact-set, fail-closed production guard.
- Kept one bounded contextual rule for `serum` → `skincare`.
### Pre-commit follow-up — 2026-08-05

- Made finite qualifier comparison fail closed when both sides specify material, color, size, or numeric qualifiers; partial overlap now rejects while one-sided broad categories and reviewed aliases remain valid.
- Replaced generic suffix-based singularization with a finite reviewed plural map, preventing collisions such as `Canvas` → `Canva` and `News` → `New`.
- Expanded the corpus to 44 synthetic fixtures, including partial-qualifier and unreviewed-plural collision regressions.
- Final focused verification passed: 132/132 matcher/API tests, TypeScript typecheck, and scoped lint.

## Reflection

The adversarial cases were more valuable than adding permissive heuristics: they narrowed the matcher to behavior that can be explained and reviewed. The strict contract can produce false nulls, but that is safer than assigning an unrelated category and is observable in Phase 3.

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Use exact-set matching and fail closed | Category assignment must be supported by bounded product-name evidence | Unsupported or ambiguous proposals become `null` |
| Retain only the bounded `serum`/`skincare` rule | Preserve the reviewed positive case without broad semantic guessing | Small explicit exception surface |
| Remove loose overlap and equivalence | Adversarial fixtures showed false-positive paths | Higher precision with an accepted false-null tradeoff |
| Require exact qualifier-set agreement when both sides specify a finite qualifier group | Shared identity tokens must not hide conflicting or partially overlapping qualifiers | Rejects `Plastic Shoes` → `Leather Shoes` and `Red Green Shirts` → `Red Blue Shirts`; broad `Shoes` remains eligible |
| Singularize only reviewed plural tokens | Generic trailing-`s` removal changes valid singular words | Prevents unreviewed word collisions; unlisted plural/singular pairs fail closed |

## Next Steps

- Monitor the strict false-null tradeoff during Phase 3.
- Complete TC-F08-04-124 with authenticated staging validation.
