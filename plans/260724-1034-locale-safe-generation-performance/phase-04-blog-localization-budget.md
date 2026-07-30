# Phase 04 - Localize Blogs Without Retry Tail

## Context Links

- [Plan](./plan.md)
- [Phase 03](./phase-03-restore-critical-path.md)
- Source: [blog seed generator](../../src/lib/ai/generate-blog-seeds.ts)
- Source: [blog preparation](../../src/lib/ai/seed-blog-posts.ts)
- Source: [blog-list renderer](../../src/blocks/blog-list/index.tsx)

## Overview

- Priority: P1
- Status: pending
- Effort: 0.5 day
- Goal: preserve exactly three localized generated posts and labels without detector-driven GPT retries or default-English injection.

## Requirements

### Functional

- Exactly three posts are prepared and persisted for a new tenant.
- Titles, excerpts, article content, category label, empty state, and read-article CTA use the target locale.
- No default English blog is appended.
- Wrong-language AI output is rejected and replaced by locale-safe content derived from localized inputs.
- Renderer remains compatible with legacy English blocks.

### Performance

- One seed GPT request maximum.
- One article GPT request per post, all three started in parallel.
- Detector mismatch adds zero GPT requests.
- Keep existing Pixabay gate, thumbnail fallback tiers, media lock, and route overlap unchanged.

## Architecture

Detector remains a validation signal after each response:

```text
seed call
  -> valid target-locale seeds: use
  -> wrong/invalid/short result: fill to 3 from localized products/services/business input

3 article calls in parallel
  -> valid target-locale article: use
  -> wrong/invalid/failed article: use escaped localized title + excerpt fallback
```

The fallback does not translate. It reuses target-locale input already present in the generation request. It contains no English prose template.

## Related Code Files

### Modify

- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/lib/ai/generate-blog-seeds.ts` - remove language-correction retry loops; return/throw after one call.
- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/lib/ai/seed-blog-posts.ts` - exact-three locale-safe fill and article fallback.
- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/blocks/blog-list/index.tsx` - resolve legacy defaults by site locale without overriding persisted labels.
- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/lib/ai/post-ai-swap.ts` - persist blog-list labels from resolved locale context.

### Tests

- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/__tests__/unit/lib/ai/generate-blog-seeds.test.ts`
- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/__tests__/unit/lib/ai/seed-blog-posts.test.ts`
- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/__tests__/unit/blocks/blog-list-locale.test.tsx`
- `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-3/src/__tests__/api/ai.test.ts`

## Implementation Steps

1. Replace seed retry loop with one schema-validated request.
2. Validate target language once. On mismatch, return a typed failure to `prepareBlogPosts`.
3. Build exactly three fallback seeds from localized services/products, then business name/short description.
4. Keep neutral slugs (`post-1`, etc.) when localized titles cannot be safely ASCII-slugged; do not use English titles.
5. Replace article retry loop with one call.
6. Keep three article calls parallel and independent.
7. On article mismatch/failure, build escaped HTML from localized seed title/excerpt only.
8. Preserve the existing thumbnail flow and `pixabayGate`; do not move it onto the page GPT critical path.
9. Renderer label resolution:
   - persisted block label wins;
   - resolved site-locale structural label is next;
   - English literal is allowed only when site locale is English or missing legacy data.
10. Add tests proving no fourth/default post and no second OpenAI call on mismatch.

## Todo List

- [ ] Remove seed/article correction retries.
- [ ] Guarantee exactly three locale-safe seeds.
- [ ] Keep three article calls parallel.
- [ ] Make renderer defaults site-locale aware.
- [ ] Preserve thumbnail scheduling.

## Success Criteria

- New `vi`, `fr`, `es`, `de`, and unknown-locale sites persist exactly three localized posts.
- Wrong-language fixtures cause fallback, not a retry or terminal generation failure.
- `Read Article`/`Uncategorized` appear only on true English/legacy-English sites.
- Blog call budget is one seed plus three articles.

## Risks

- Locale-safe fallback article is shorter: correctness and latency take priority; track fallback rate and improve prompt quality separately.
- Localized input may itself contain English product names: preserve proper names, but do not add new English prose.

## Security Considerations

- Continue HTML escaping deterministic fallback content.
- Preserve existing Payload tenant/site scoping and post-create sanitization.

## Next Steps

Phase 5 verifies correctness and latency together before merge or staging rollout.

