---
title: "Current branch locale/performance impact analysis"
status: completed
created: 2026-07-24
---

# Current Branch Locale/Performance Impact Analysis

## Summary

The branch fixes real locale defects, but three new control-flow decisions can extend or fail the generation path independently of site completeness:

1. Full-page language detection now controls homepage and batch retries.
2. Dynamic structural-string translation is awaited after page GPT completion.
3. Blog seed/article language validation can run a second GPT attempt.

These are not required by PR #1658 and can erase its latency gain.

## Preserved Value

- `post-ai-swap.ts` keeps AI-generated blocks for non-English pages instead of replacing them with English composer content.
- `normalizeLocaleStructuralStrings` centralizes navigation, section, newsletter, and blog-list labels.
- Blog-list labels are persisted and rendered from block data.
- Blog prompts receive the requested locale and target three posts.
- CJK product slugs no longer collapse to unusable/duplicate values.
- Route-level final normalization catches strings introduced by later pipeline stages.

These changes remain in scope.

## Critical-Path Regressions

| Area | Current branch behavior | Impact |
|---|---|---|
| Homepage split | Wrong-locale detection triggers another full homepage call | Adds up to one serial long call |
| Subpage split | Wrong-locale detection triggers batch retry with up to 38s timeout | Adds a serial tail unrelated to structure |
| Final page guard | Detector mismatch throws `NON_ENGLISH_PAGE_GENERATION_FAILED` | Valid five-page generation can fail |
| Structural strings | `ensureBlockStrings` is awaited and retried | Cold dynamic locale adds another OpenAI dependency |
| Structural string failure | Throws `LOCALE_STRUCTURAL_STRINGS_UNAVAILABLE` | Main page generation succeeds but request still fails |
| Blog seeds | Detector mismatch causes second 12s GPT attempt | Adds serial latency before article fan-out |
| Blog articles | Each mismatch can cause a second 12s attempt | Extends blog grace/tail |

## English Leakage Still Present

- `system-prompt.ts` maps every CTA language except `ms`/`vi` to English suggestions.
- Composer fallback contains English content. It cannot be used verbatim for a non-English page.
- Renderer defaults such as `Read Article` and `Uncategorized` are safe only for true English/legacy sites; they cannot be the non-English fallback source.
- A localized page can still receive a hardcoded `About Us` label when local content injection fills a missing secondary hero CTA.

## Required Ownership Model

Human-facing text source priority for non-English generation:

1. Valid AI-generated field from the current page.
2. Valid in-band `localeStrings` returned by the homepage worker.
3. Localized page title/navigation label generated in the same five-page result.
4. User input already expressed in the target locale: business name, short description, services/products.
5. Neutral target-locale-safe value such as business name or page title.

English block defaults and English composer copy are never eligible sources.

## Call Budget

### Page generation

```text
normal: home + batch-1 + batch-2 = 3 parallel calls
structural batch failure: +1 bounded 10s retry for the failed batch
locale mismatch: +0 calls
dynamic locale strings: +0 calls
```

### Blog generation

```text
1 seed call
3 article calls started in parallel
language mismatch: +0 calls; use locale-safe fallback
```

## Scope Boundary

Do not touch:

- image pool construction/pre-upload/fulfilment;
- product/media overlap and row persistence;
- Pixabay throttling gate;
- imglib `after()` scheduling;
- route/client timeout policy;
- five-page, six-product, and three-blog completion counts.

