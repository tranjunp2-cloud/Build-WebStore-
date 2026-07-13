# Phase 05 — Single-Select Cleanup (#5, #12)

**PR:** 1 · **Migration:** No · **Priority:** P2 · **Status:** pending

## Context

- Reality: `CategorySelect.tsx` already behaves as SINGLE-select — `selectLeaf` (`:126-129`) does `onChange([cat.id])`, always replacing. Product form Zod `categoryIds: z.array(...).min(1)` (`schema.ts:27`) requires exactly ≥1 (UI only ever sets 1).
- DB: `Products.ts` category field (`:399-405`) is `hasMany: true` with admin desc "Hỗ trợ Multi-select" (misleading). `products_rels` stores category links.

## Overview

Make single-select the OFFICIAL, documented behavior. **No behavior change in code** (already 1-to-1). Only cosmetic/clarity: fix the misleading admin description. **Do NOT flip `hasMany` to false** — that requires a data-structure migration on `products_rels` (high risk, no functional benefit since UI already enforces 1).

## Key Insights

- **Trade-off (explicit):** Changing `hasMany: true → false` would change how Payload stores the relation (from `products_rels` join rows to a direct `category_id` column on products), requiring a data migration + backfill + risk of dropping existing links. **Decision: KEEP `hasMany: true` in DB**; UI + docs assert 1–1; do NOT enforce a hard max in schema (YAGNI). The array-of-one is a harmless storage detail.
- No i18n or DB change needed. Smallest possible diff.
- `categoryIds.min(1)` stays (product must have exactly one category; min(1) + UI-replace = exactly 1).

## Requirements

- Functional: none changed. Product keeps exactly one category via existing UI.
- Clarity: admin description no longer says "Multi-select".

## Related Code Files

**Modify:**
- `src/collections/Products.ts` — category field admin description (`:404`): change "Danh mục sản phẩm (Hỗ trợ Multi-select)" → e.g. "Danh mục sản phẩm (chọn 1 danh mục)". Leave `hasMany: true` unchanged (documented trade-off).

**Read for context:** `CategorySelect.tsx:126-143`, `schema.ts:27`.

**No migration, no delete, no i18n.**

## Implementation Steps

1. Edit only the `admin.description` string on the Products `category` field. Add a short inline code comment noting hasMany kept for storage-compat, UI enforces single.
2. Verify no other UI copy promises multi-select (grep `Multi-select` / `nhiều danh mục`). If product-form help text mentions multiple, align it.

## Todo

- [ ] Update Products category admin description to single-select wording
- [ ] Inline comment: hasMany kept intentionally (no migration)
- [ ] Grep for other "multi-select" category copy; align if found

## Success Criteria

- Admin panel + code no longer imply multi-category.
- No schema/migration diff. No functional change; existing product-form tests pass unchanged.

## Risk Assessment

| Risk | L×I | Mitigation |
|------|-----|-----------|
| Someone later "fixes" hasMany→false without migration | Low×High | Inline comment documents the deliberate choice; Phase 06 docs record it |
| Hidden multi-select copy elsewhere | Low×Low | Grep sweep in step 2 |

## Security

- None.

## Next Steps

- Phase 06 docs codify 1–n relation + removal of "max 10 categories".
