# Phase 05 — Matching Engine (Rank Templates by User Answers)

## Context links
- **Parent**: [plan.md](./plan.md)
- **Depends on**: Phase 03 (templates populated, ≥50 minimum for ranking), Phase 04 (wizard answers to consume)

## Overview
- **Date**: 2026-04-15
- **Description**: Build ranking engine that scores templates against WizardAnswers and returns top-3 candidates. Pure algorithmic scoring, NO OpenAI calls (matching is AI's narrow task, not content generation). API endpoint consumed by Phase 04 Step 5 template gallery.
- **Priority**: P0
- **Implementation status**: pending
- **Review status**: not reviewed
- **Effort**: 3-5 days

## Key Insights
- **No LLM needed for matching** — simple weighted scoring outperforms LLM for this task. LLM adds latency + cost + unpredictability. Classic algorithm (filter → score → rank) is fast and deterministic.
- **Explainability matters** — user should see WHY template matches ("Modern brand for dental clinic"). Score breakdown helps debugging + user trust.
- **Diversity in top-3** — if top-3 are all variants of same template, defeats purpose. Penalize similarity in diversity pass.

## Requirements
- POST `/api/templates/rank` endpoint
- Input: `WizardAnswers` (from Phase 04 Zustand state)
- Output: `{ templates: TemplateEntry[3], scores: { [templateId]: { total, breakdown } } }`
- Scoring function weights:
  - Sub-niche exact match: +50 points
  - Category match (fallback if sub-niche has <3 templates): +20
  - Personality tag match: +15 per tag overlap
  - Tier fit (user free → free templates): +10 (filter hard if mismatch)
  - Freshness (newer = small boost): +5 max
- Diversity pass: after ranking, penalize top-3 if any two templates share ≥3 same tags → swap with next candidate
- Response time: <200ms P95 (no DB round-trips except 1 Payload find with populated fields)
- Caching: template list cached in memory (invalidated on publish from Phase 02)

## Architecture

### New files
```
src/app/api/templates/rank/route.ts                   # POST endpoint
src/lib/templates/matching/score.ts                   # scoring function
src/lib/templates/matching/diversify.ts               # top-3 diversity
src/lib/templates/matching/cache.ts                   # in-memory template cache
src/lib/templates/matching/types.ts
```

### Scoring algorithm
```ts
function scoreTemplate(template: TemplateEntry, answers: WizardAnswers): number {
  let score = 0
  const breakdown: Record<string, number> = {}

  // Hard filter — tier must match (free user can't see premium)
  if (!canAccessTier(answers, template.tier)) return -Infinity

  // Sub-niche exact match
  if (template.subNiche === answers.subNiche) {
    score += 50
    breakdown.subNicheExact = 50
  } else if (template.parentCategory === answers.category) {
    score += 20
    breakdown.categoryMatch = 20
  } else {
    return -Infinity  // hard filter — must match category at minimum
  }

  // Personality tag overlap
  const personalityTags = getPersonalityTags(answers.personality)  // 4-6 tags per personality
  const overlap = template.tags.filter(t => personalityTags.includes(t)).length
  score += overlap * 15
  breakdown.personalityTagMatch = overlap * 15

  // Freshness (linear decay over 6 months)
  const daysSincePublish = daysBetween(template.createdAt, new Date())
  const freshness = Math.max(0, 5 - daysSincePublish / 36)
  score += freshness
  breakdown.freshness = freshness

  return { score, breakdown }
}
```

### Diversity pass
```ts
function diversifyTop3(ranked: TemplateEntry[]): TemplateEntry[] {
  const result: TemplateEntry[] = [ranked[0]]
  for (const candidate of ranked.slice(1)) {
    const tooSimilar = result.some(picked =>
      tagOverlap(picked.tags, candidate.tags) >= 3
    )
    if (!tooSimilar) result.push(candidate)
    if (result.length === 3) break
  }
  return result
}
```

### Cache strategy
```ts
// In-memory cache, invalidated on Payload template publish hook
let templateCache: TemplateEntry[] | null = null
export async function getTemplatesFromCache() {
  if (!templateCache) {
    templateCache = await payload.find({
      collection: 'templates-v2',
      where: { status: { equals: 'published' } },
      limit: 500,
    })
  }
  return templateCache
}
// Invalidation: Phase 02 publish hook → templateCache = null
```

## Related code files
- Phase 01 `reports/template-entry-schema.md` — input data model
- Phase 02 `src/collections/TemplatesV2.ts` — Payload collection + hooks
- Phase 04 wizard state — client-side caller

## Implementation Steps
1. Scoring function + unit tests (1 day):
   - Implement with mocked template + answer fixtures
   - Cover: exact match, fallback, personality overlap, tier filter
2. Diversity pass (0.5 day):
   - Unit test: input 10 similar templates → output 3 distinct
3. In-memory cache + invalidation hook (0.5 day):
   - Reset cache on Phase 02 publish
4. API endpoint (0.5 day):
   - Payload auth check
   - Call scoring + diversity
   - Return top-3 with score breakdown
5. Wire into Phase 04 Step 5 gallery (0.5 day):
   - Replace stub with real API call
   - Display score breakdown for debug (dev only)
6. Performance tuning (0.5 day):
   - Measure P95 on 100-template cache
   - Optimize if >200ms
7. Integration test (0.5 day):
   - Full wizard → rank → top-3 render

## Todo list
- [ ] Scoring function + unit tests
- [ ] Diversity pass
- [ ] Cache + invalidation
- [ ] API endpoint
- [ ] Wire wizard gallery
- [ ] Performance tuning
- [ ] Integration test

## Success Criteria
- Unit tests: 15+ cases cover scoring edge cases
- P95 latency <200ms on 100-template cache
- Top-3 results show 3 distinct templates (diversity verified)
- Integration test: wizard answers → 3 matching templates rendered
- Dev-only debug panel shows score breakdown

## Risk Assessment
- **Scoring weights may be wrong** — wizard answers → top-3 may not feel right. Mitigation: A/B test weights in Phase 07, adjust based on user picks analytics.
- **Cache staleness** — publish hook may not fire cleanly. Mitigation: cache TTL 5min as backup, add manual refresh endpoint.
- **Small library** — 100 templates may yield same top-3 for many different answers. Mitigation: Phase 07 monitors diversity, scale library in Phase 08 if needed.

## Security Considerations
- API endpoint must validate user auth (free tier sees free templates only)
- Score breakdown dev-only (production returns templates but not internal scores)
- No PII in cache key (answers hashed)

## Next steps
- Phase 06 takes user's picked template + personalizes with businessInfo
- Phase 07 logs template picks for ranking model improvement
