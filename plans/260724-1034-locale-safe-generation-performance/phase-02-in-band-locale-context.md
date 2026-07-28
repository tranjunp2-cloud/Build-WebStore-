# Phase 02 - Produce Dynamic Locale Context In-Band

## Context Links

- [Plan](./plan.md)
- [Phase 01](./phase-01-freeze-contracts-and-baseline.md)
- Source: [page split](../../src/lib/ai/gen-page-split.ts)
- Source: [page schema](../../src/lib/ai/pages-schema.ts)
- Source: [structural strings](../../src/lib/ai/locale-structural-strings.ts)
- Source: [system prompt](../../src/lib/ai/system-prompt.ts)

## Overview

- Priority: P1
- Status: pending
- Effort: 0.75 day
- Goal: obtain dynamic-locale labels from the existing homepage GPT call and eliminate the blocking translator dependency.

## Requirements

### Functional

- Work for any BCP-47 locale accepted by the builder.
- Do not add `if locale === de/fr/es/...` logic.
- Keep dedicated existing dictionaries for locales that already have them.
- Treat AI-provided locale context as optional and schema-validated.
- Missing locale context must not fail generation or cause English insertion.

### Performance

- Add no OpenAI request.
- Add only a small optional object to the homepage JSON response.
- Do not add locale fields to subpage batch prompts.
- Do not await `ensureBlockStrings` in `generateSiteWithAI`.

## Architecture

Extend the homepage response with a transient object:

```ts
type GeneratedLocaleStrings = {
  navigation: { home: string; about: string; services: string; contact: string; blog: string }
  sections: Record<RequiredSectionKey, string>
  newsletter: { emailPlaceholder: string; subscribeLabel: string }
  blogList: {
    readArticleLabel: string
    uncategorizedLabel: string
    emptyStateLabel: string
  }
}
```

Resolution priority:

1. Dedicated local dictionary for supported static locale.
2. Valid `localeStrings` returned by the current homepage worker.
3. Valid warm cache already available from another feature/request.
4. `null`: preserve AI fields and use localized page/user data; never fall back to English.

`localeStrings` is orchestration metadata. It is not persisted as a new Payload field and needs no DB migration.

## Related Code Files

### Modify

- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/lib/ai/gen-page-split.ts` - request, validate, and retain homepage locale context through `mergeSplitParsed`.
- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/lib/ai/pages-schema.ts` - optional transient locale context schema.
- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/lib/ai/locale-structural-strings.ts` - validation/normalization and source resolution.
- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/lib/ai/openai-generator.ts` - consume in-band context; remove awaited translator.
- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/lib/ai/system-prompt.ts` - stop supplying English CTA examples to dynamic non-English locales.
- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/lib/ai/block-strings-translator.ts` - retain utility for other callers/cache, but remove generation-path ownership.

### Tests

- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/__tests__/unit/lib/ai/locale-structural-strings.test.ts`
- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/__tests__/unit/lib/ai/block-strings-translator.test.ts`
- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/__tests__/unit/lib/ai/openai-generator.test.ts`

## Implementation Steps

1. Define a strict transient schema matching the existing `LocaleStructuralStrings` consumer shape.
2. Add a concise homepage-only prompt section requiring all human-facing values in the requested locale.
3. Carry the object from `homeParsed` through split merge without copying it into every page.
4. Validate non-empty strings and reject an object that repeats known English defaults for a non-English locale.
5. Resolve structural strings using the priority above.
6. Remove `await structuralStringsPromise` and both `LOCALE_STRUCTURAL_STRINGS_UNAVAILABLE` throws.
7. Do not call `ensureBlockStrings` from the request path. A pre-existing warm cache may be read synchronously.
8. Change CTA prompt behavior:
   - English gets English industry examples.
   - Dedicated locale gets examples from its dedicated source.
   - Dynamic non-English gets a target-language instruction, no English example list.
9. Add source telemetry: `dedicated`, `in_band`, `warm_cache`, or `ai_preserved`. Telemetry cannot affect success/retry.

## Todo List

- [ ] Add transient locale-context schema.
- [ ] Emit it from homepage worker only.
- [ ] Resolve source without blocking translation.
- [ ] Remove English CTA suggestion fallback.
- [ ] Add dynamic/unknown locale tests.

## Success Criteria

- Cold `de`, `fr`, `es`, and unknown locale generation does not call the translator.
- Missing/invalid `localeStrings` does not fail generation.
- English CTA examples are absent from dynamic non-English prompts.
- Page worker count remains three.

## Risks

- Homepage model omits metadata: all consumers must preserve localized AI fields and avoid filling from English.
- Extra output tokens: keep the object compact, flat enough for JSON reliability, and homepage-only.
- Cache contamination: key by normalized locale and validate before injection.

## Security Considerations

- Locale metadata contains fixed UI strings only.
- Continue sanitizing model output before use; never evaluate generated keys/code.

## Next Steps

Phase 3 uses this context to make all local fallbacks locale-safe while restoring the original split orchestration.

