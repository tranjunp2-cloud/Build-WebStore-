# Phase 02 — Cross-Fixture Uniqueness Dimension

## Context links
- Parent: [plan.md](plan.md)
- Requires scorer architecture change

## Overview
Date: 2026-04-19
Description: NEW dimension "Content Uniqueness" (weight 6) — detect copy-paste headlines/subheadlines/CTAs across 390 fixtures. Templates using identical hero copy = content sloppiness.
Priority: P2
Status: pending

## Key Insights
- Scorer currently evaluates fixtures independently — no cross-fixture context
- Need aggregation pre-pass: collect all hero headlines, count occurrences, flag duplicates
- Per-fixture criterion: fixture's headline/subheadline hash is unique (count=1) or common (count>N)
- Thresholds: unique = pass, duplicated ≥3 times = partial, duplicated ≥5 times = fail

## Requirements
- Scorer accepts optional `uniquenessContext` with pre-computed hash counts
- `scoreAll` does 2-pass: (1) aggregate hashes, (2) score with context
- New criteria in Uniqueness dim:
  - `hero-headline-unique`: headline hash count ≤2
  - `hero-subheadline-unique`: subheadline hash count ≤2
  - `cta-label-unique`: CTA labels distribution healthy (not all 390 say "Get Started")

## Architecture

```ts
// scorer-lib.ts
interface UniquenessContext {
  headlineCounts: Map<string, number>   // normalized headline → occurrence count
  subheadlineCounts: Map<string, number>
  ctaCounts: Map<string, number>
}

export function buildUniquenessContext(matrix: MatrixReport): UniquenessContext {
  const ctx = { headlineCounts: new Map(), subheadlineCounts: new Map(), ctaCounts: new Map() }
  for (const result of matrix.results) {
    const hero = result.blocks.find(b => b.blockType === 'hero')
    const h = normalize(hero?.data?.headline)
    if (h) ctx.headlineCounts.set(h, (ctx.headlineCounts.get(h) ?? 0) + 1)
    // ...similar for subheadline + cta labels
  }
  return ctx
}

// EvalContext extension
export interface EvalContext {
  // ...existing
  uniqueness?: UniquenessContext
}

// scoreAll: build context once, pass to every scoreFixture
const uniq = buildUniquenessContext(matrix)
matrix.results.map(r => scoreFixture({ ...args, uniqueness: uniq }))
```

Evaluators:
```ts
heroHeadlineUnique: ({ blocks, uniqueness }) => {
  const hero = blocks.find(b => b.blockType === 'hero')
  const h = normalize(hero?.data?.headline)
  if (!h || !uniqueness) return { pass: false, reason: 'no context' }
  const count = uniqueness.headlineCounts.get(h) ?? 0
  if (count <= 2) return { pass: true, reason: `${count} occurrences` }
  if (count <= 4) return { pass: false, partial: true, reason: `${count} duplicates (partial)` }
  return { pass: false, reason: `${count} duplicates` }
}
```

## Related code files
- `scripts/test-harness/rubric/scorer-lib.ts` (extend scoreAll + EvalContext)
- `scripts/test-harness/rubric/evaluators.ts` (3 new)
- `scripts/test-harness/rubric/rubric-v1.3.json` (new dim)

## Implementation Steps
1. Define `UniquenessContext` type + `buildUniquenessContext` helper in scorer-lib
2. Pass uniqueness into `scoreFixture` calls in `scoreAll`
3. Add 3 evaluators: heroHeadlineUnique, heroSubheadlineUnique, ctaLabelUnique
4. Normalize function: lowercase + trim + collapse whitespace + remove business name
5. Add Uniqueness dim (weight 6) to v1.3 spec
6. Regen + score → verify duplicate patterns surface

## Success Criteria
- Uniqueness dim avg 5.0-7.0 (real signal, not ceiling)
- ≥10 fixtures fail uniqueness (indicates real copy-paste patterns to fix)
- Top offenders listed in delta report

## Risk Assessment
- Medium: normalization logic — business-name-rich headlines differ even if template identical. Strip biz name substring before hash.
- Low: perf — O(N×fields) pre-pass on 390 fixtures = <50ms

## Security Considerations
- None

## Next steps
- Phase 03: textColor contrast
