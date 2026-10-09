# Phase 01 — Route-Level Layout Normalization

## Context Links

- Existing filter plan: [F08 PR-2 — Storefront Category Filter](../260714-1538-f08-category-filter-products-grid/plan.md)
- Persistence point: [src/app/api/ai/generate-site/route.ts](<worktree-1>/src/app/api/ai/generate-site/route.ts:1016)
- Fallback `/products` page builder: [src/app/api/ai/generate-site/route.ts](<worktree-1>/src/app/api/ai/generate-site/route.ts:2129)

## Overview

Add one helper in `generate-site` that rewrites generated `products-grid` blocks before page persistence. The helper must enforce page-slug-aware `showCategoryFilter` defaults and restore missing `headline`, `subheadline`, and `limit` fields for template-first output.

## Key Insights

- `showCategoryFilter` already exists in block schema + Payload. No schema work needed.
- AI pages schema currently strips `showCategoryFilter`, so setting it upstream in AI/template generators is unreliable.
- `template-composer` currently emits `products-grid` with `variant/count/items` only, so template-first generation can persist without `headline/subheadline/limit`.
- `pageDefinition.slug` is stable enough because generate-site canonicalizes subpage slugs before persistence.
- Post-create `layout-sync` update path only patches navigation/footer links; it does not create or move `products-grid`, so this fix should stay in the pre-create normalization path.
- This PR does not require changing `template-composer`; route-level normalization is the only required guard rail.

## Requirements

- `/products` page: every `products-grid` persisted with `showCategoryFilter: true`
- Any other page: every generated `products-grid` persisted with `showCategoryFilter: false` or missing
- Any generated `products-grid` missing `headline`/`subheadline`: restore localized defaults before save using `resolveBlockContent('products', locale, brand)`
- Any generated `products-grid` missing `limit` but carrying `count`: normalize to persisted `limit`
- No changes to non-generated pages, non-`products-grid` blocks, or editor-created blocks

## Architecture

Flow:
1. Build `sanitizedLayout`
2. Pass through `normalizeGeneratedProductsGridBlocks(sanitizedLayout, pageDefinition.slug, locale, brandName)`
3. Persist normalized layout with `payload.create({ collection: 'pages' ... })`

Pseudocode:

```ts
function normalizeGeneratedProductsGridBlocks(layout, pageSlug, locale, brandName) {
  const shouldEnable = pageSlug === '/products'
  const defaultProductsContent = resolveBlockContent('products', locale, brandName).content
  return layout.map((block) => (
    block.blockType === 'products-grid'
      ? {
          ...block,
          showCategoryFilter: shouldEnable,
          headline: block.headline ?? defaultProductsContent.headline,
          subheadline: block.subheadline ?? defaultProductsContent.subheadline,
          limit: block.limit ?? block.count ?? 6,
        }
      : block
  ))
}
```

## Related Code Files

- Modify: `src/app/api/ai/generate-site/route.ts`
- Read-only reference: `src/lib/ai/pages-schema.ts`
- Read-only reference: `src/lib/ai/add-section-content/index.ts`
- Follow-up only: `src/lib/ai/template-composer.ts`

## Implementation Steps

1. Add a small pure helper near other route-local helpers in `generate-site/route.ts`
2. Reuse existing locale-aware block-content defaults instead of introducing ad hoc copy
3. Apply helper immediately after `sanitizedLayout` is produced
4. Persist the normalized layout in both primary create path and image-FK retry path
5. Keep 404 page path untouched

## Todo List

- [x] Add helper for slug-aware `products-grid` normalization
- [x] Reuse localized products default content for missing headline/subheadline
- [x] Map template-first `count` into persisted `limit` when needed
- [x] Wire helper into page create flow
- [x] Verify retry create path uses normalized layout too
- [x] Confirm no extra mutation for pages without `products-grid`

## Success Criteria

- Generated home/about/contact pages with `products-grid` do not start with category filter on
- Generated `/products` page with `products-grid` starts with category filter on
- Generated `products-grid` no longer loses `headline/subheadline` in template-first flow after persistence
- Persisted `products-grid` uses `limit`, not transient `count`, when defaults are needed
- No schema/migration/editor changes required

## Risk Assessment

- Main risk: touching wrong persistence point and leaving one create path inconsistent
- Secondary risk: restoring copy with the wrong locale or introducing a new hard-coded string source
- Third risk: accidentally mutating shared layout arrays; helper should return cloned blocks

## Security Considerations

- No auth surface change
- No new public API
- No user-provided flag trusted from client

## Next Steps

- Phase 02 adds regression tests for both slug-aware filter defaults and restored products-grid content defaults
