# Site-generation fixes A1/A2/A3/A4/A5 (#2103) — implementation report

Status: done. tsc clean; full vitest 17129 pass / 31 fail (30 in `issue-1701-approved-copy` = builder-ui label rename, not this work; the rest were fixed after the run).

## Design
- `generation-facts.ts` builds one FACTS object (form + contentBrief + tenant/site/account + enabled payments). Carried via AsyncLocalStorage (`generation-facts-scope.ts`) into `mapBusinessInfo()` -> `BusinessSample.facts`, so template-first, AI-first, page-split and fallback all read the same facts. Also passed to `buildUserPrompt` (FACTS section + grounding rules).
- `grounded-blocks.ts`: testimonials / stats / team / FAQ / logos / pricing built only from FACTS; `enforceGroundedBlocks` is the final guard for AI-written pages (replaces invented reviews/numbers/staff/logos/FAQ/plans, strips halal/JAKIM/GrabFood/discount claims unless the merchant stated them).
- Empty blocks are kept but carry no items; renderers (stats/team/faq/logo-cloud) render nothing. Testimonials = one invitation card marked by `title = TESTIMONIAL_INVITE_TITLE` (Pages schema has no spare field and `name` is required; the marker is editor-only, never printed).
- `placeholders` in the done event are computed in memory (`collectPlaceholders`); not persisted (Pages.ts blocks are typed Payload fields, no JSON slot).

## Notable decisions / findings
- Pre-existing bug fixed: `pickRecipe` XOR went negative for Date.now() seeds (fallback path) -> `recipes[-1]` -> composer crash -> legacy generateBlocks. Now `>>> 0`.
- Shared library mutation hazard avoided: `applyProductPricesToMenus` is non-mutating.
- Menu prices: merchant price -> else price of the product created for that item (only if products already resolved; page persist never waits on products) -> else blank.
- Slug sync test: tenant is now read once (FACTS) before generation.
- Builder preview: pages use `draft:true` (OK). The blog-list block fetches `/api/storefront/blogs` (published only), so AI posts are invisible in builder preview until first publish.
- Stock photos: `registerPixabayMediaSource` calls untouched (sourceProvider stamping preserved); only the alt text and the pool->product choice changed.

## TCs (TC-AIAUD-001..039)
001 buildStockAlt dedupes case/plural-insensitively | 002 subject prefix + 2-3 tags | 003 long repeated tags <=120 | 004 idempotent / empty tags | 005 pool-preupload uploads capped alt
006 issue input -> 3 products 65/48/120 | 007 clean names, non-price parens kept | 008 thousands sep, decimals, separators | 009 no price / dedupe / cap 20
010 menu prices 65/48/120 | 011 blank price then created-product price, merchant never overwritten, non-mutating | 012 library menu has no price/tag
013 facts merge form+tenant+site | 014 contentBrief real items, stats need 2 facts, year parsing | 015 prompt FACTS section + rules | 016 placeholders list | 017 enforceGroundedBlocks replaces invented | 018 claim scrub unless merchant stated
019/020 beauty + F&B generation claim-free (also via generateSiteWithAI) | 021 one invitation card | 022 real reviews verbatim | 023 stats from year + product count | 024 logos = enabled payments only, team = brand | 025 FAQ from facts | 026 library grep + packs empty | 027 no padding of real items
028 N listed -> N products, merchant names/prices | 029 no library top-up | 030 cap 20 / default 6 | 031 photo matching by relevance only
032 done event productIds + placeholders, active + stock 0 | 033 pages (and 404) created draft | 034 (covered by 032 placeholders shape) | 035 /products page + home products-featured + recipes
036 seeded blogs created draft | 037/037b/038 first publish promotes only seeded drafts, failure non-fatal, republish untouched | 039 empty renderers render nothing, invitation card has no stars/name/avatar
