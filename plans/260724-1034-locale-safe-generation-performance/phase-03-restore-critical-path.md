# Phase 03 - Restore Split Critical Path and Safe Fallbacks

## Context Links

- [Plan](./plan.md)
- [Phase 02](./phase-02-in-band-locale-context.md)
- Source: [page split](../../src/lib/ai/gen-page-split.ts)
- Source: [generator](../../src/lib/ai/openai-generator.ts)
- Source: [post-AI swap](../../src/lib/ai/post-ai-swap.ts)
- Source: [content injection](../../src/lib/ai/content-injection.ts)
- Source: [template composer](../../src/lib/ai/template-composer.ts)

## Overview

- Priority: P1
- Status: pending
- Effort: 1 day
- Goal: restore PR #1658 call topology while retaining every locale correctness fix and every intended block/CTA.

## Requirements

### Functional

- Page validity is structural: required slug, page count, parseable block data, unique slugs.
- Language detector output is diagnostic only.
- Non-English fallback may reuse composer layout, never composer human-facing English copy.
- Preserve GPT blocks for non-English pages.
- Preserve CTA count and links. Localize labels; do not delete buttons.
- Blog page hero `/about` CTA label comes from target-locale About page context.

### Performance

- Normal: three parallel page calls.
- Structurally invalid subpage batch: one main-model retry capped at the existing 10 seconds.
- Failed homepage: immediate deterministic fallback, no locale-specific retry.
- Locale mismatch: log only, zero retry and zero throw.
- No change to route timeout, `maxDuration`, media, product, or blog scheduling.

## Architecture

Separate three concerns:

1. **Structural validator** decides whether a page/batch can enter the pipeline.
2. **Locale observer** records likely language mismatch for QA/telemetry.
3. **Locale-safe materializer** fills only missing local fields without English.

For non-English composer fallback, use composer blocks as shape only:

```text
composer layout
  -> remove human-facing composer text as a source
  -> fill from in-band localeStrings
  -> fill from generated page titles/navigation
  -> fill from localized business/services/products input
  -> preserve required field/CTA cardinality
```

Field priority:

`existing AI value > localeStrings > generated page title/nav > user locale input > business/page name`.

## Related Code Files

### Modify

- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/lib/ai/gen-page-split.ts` - structural-only retries/fallback and non-blocking locale observation.
- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/lib/ai/openai-generator.ts` - remove final language-detector throw; pass locale context through all stages.
- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/lib/ai/post-ai-swap.ts` - keep non-English AI blocks and normalize only local structural fields.
- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/lib/ai/content-injection.ts` - locale-aware CTA/label completion without changing block cardinality.
- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/lib/ai/template-composer.ts` - expose structure-only materialization path for non-English fallback.
- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/app/api/ai/generate-site/route.ts` - retain final persistence normalization using the resolved locale context.

### Tests

- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/__tests__/unit/lib/ai/gen-page-split.test.ts`
- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/__tests__/unit/lib/ai/post-ai-swap.test.ts`
- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/__tests__/unit/lib/ai/content-injection-hero.test.ts`
- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/__tests__/api/ai.test.ts`

## Implementation Steps

1. Remove `pageMatchesLocale`/`outputMatchesLocale` from retry, fallback, and exception decisions.
2. Delete both `NON_ENGLISH_PAGE_GENERATION_FAILED` terminal paths.
3. Keep detector invocation only after success for structured warning/metric output.
4. Restore failed-batch selection to structural incompleteness/invalidity only.
5. Keep one parallel retry wave for failed structural batches with a 10-second cap.
6. Remove the non-English homepage retry. Use deterministic fallback immediately when the homepage call is unusable.
7. Add a locale-safe materializer for non-English composer fallbacks.
8. Thread resolved locale context through sanitizer, block builder, post-AI swap, content injection, and final route normalization.
9. For every block field that currently has an English literal fallback, implement source priority rather than locale branches.
10. Hero-specific rule:
    - keep existing primary and secondary CTA entries;
    - keep their URLs;
    - use About page title or `navigation.about` for `/about`;
    - never use hardcoded `About Us` for non-English;
    - never remove secondary CTA to avoid translation.
11. Ensure repeated normalization is idempotent and cannot overwrite a valid localized AI field.

## Todo List

- [ ] Make retry decisions structural only.
- [ ] Remove terminal locale detector errors.
- [ ] Build locale-safe composer materializer.
- [ ] Thread locale context through every local mutation stage.
- [ ] Preserve hero CTA cardinality and links.
- [ ] Add idempotence and call-count tests.

## Success Criteria

- A detector false positive cannot add a call or fail generation.
- A structurally valid non-English response persists as five pages.
- A structurally failed scope falls back without visible English.
- Hero/blog hero retains all CTA buttons with localized labels.
- Normal page generation is three calls; only one bounded structural retry is possible.

## Risks

- Scrubbing composer copy can leave required fields empty: materializer tests must enumerate every supported human-facing field touched by composer fallback.
- Later route normalization can reintroduce English: assert output after the final persistence normalization, not only immediately after GPT.
- Mixed proper nouns confuse detector: detector is intentionally non-authoritative.

## Security Considerations

- Preserve existing block/schema validation and HTML sanitization.
- Do not trust AI-provided URLs; existing link sanitization remains authoritative.

## Next Steps

Phase 4 applies the same non-blocking locale policy to the three-post blog pipeline.

