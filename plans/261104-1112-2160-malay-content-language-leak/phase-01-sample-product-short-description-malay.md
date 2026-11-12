# Phase 01 — Sample product short description in BM

**Priority:** P2 · **Status:** done

## Context
- `src/lib/ai/generate-sample-products.ts:106-198` (`generateSampleProductsAI`)
- Storefront reads `shortDescription` only: `blocks/products-grid/ProductCard.tsx:100`, `blocks/products-featured/index.tsx:189`, `app/sites/[slug]/products/[productSlug]/page.tsx:210,373`
- `src/collections/Products.ts:401-410` — `description` = EN, `descriptionBM` = BM (keep)
- Prompt is caller-composed (`ai-platform/actor-scope.ts:92`), no platform-side language rule

## Root cause
`language === 'ms'` → `targetLanguage = null` → no "write in X" line. Schema asks `shortDescription` with no language → model writes EN.

## Change (minimal)
In `generateSampleProductsAI`:
- Add a BM-only instruction when `language === 'ms'`:
  `Write "shortDescription" in Bahasa Melayu (Malaysia). Keep "description" in English; "descriptionBM" is its Bahasa Melayu translation.`
- Schema hint: `"shortDescription":"max 100 chars, Bahasa Melayu"` when `ms` (keeps JSON contract, nudges model).
- No change for `en`, `auto`, other locales (they already get `targetLanguage` line).
- Merchant names untouched (listed path already keeps names).

## Not changed (explicit)
- `descriptionBM` contract, `toProduct`, `mergeListedProduct`, persistence (`generate-site-service.ts:2191`).
- `imageKeyword` stays English (Pixabay).

## Tests — `src/__tests__/unit/lib/ai/sample-products-image-fallback.test.ts` pattern (mock `task-client.runTask`, `runWithAiActor`)
New file `src/__tests__/unit/lib/ai/sample-products-language-prompt.test.ts`:
- TC-TF-028a: `prepareSampleProducts(info, 'ms')` → captured `user` prompt contains BM shortDescription instruction + `descriptionBM` field.
- TC-TF-028b: `'en'` → no Bahasa instruction (regression).
- TC-TF-028c: `'vi'` → still "Write product names and customer-facing descriptions in Vietnamese"; no `descriptionBM`.

## Todo
- [x] prompt change
- [x] tests
- [x] typecheck

## Success
Prompt for `ms` requires BM `shortDescription`; en/vi prompts byte-identical to before.

## Risk
- Model may still drift → prompt-level fix only; no post-check (YAGNI; consistent with other locales).
- Token budget: unchanged field count.
