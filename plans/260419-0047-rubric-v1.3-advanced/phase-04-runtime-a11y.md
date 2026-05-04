# Phase 04 — Runtime A11y via axe-core in Harness Render

## Context links
- Parent: [plan.md](plan.md)
- Largest phase (4h)

## Overview
Date: 2026-04-19
Description: Integrate `@axe-core/playwright` vào `harness:render` step. Audit rendered HTML per fixture → persist violations to matrix.json / separate a11y-report.json. Rubric reads pre-computed counts.
Priority: P2
Status: pending

## Key Insights
- Current harness: Playwright renders fixtures for visual screenshot (scripts/test-harness/render/harness.spec.ts)
- Add audit step after page load: `await axe.analyze()` collects WCAG violations (impact: minor/moderate/serious/critical)
- Persist counts per fixture → matrix.json augmented với `a11yViolations`
- Rubric evaluators read từ block-data path (matrix) → no re-audit during scoring

## Requirements
- Install `@axe-core/playwright`
- Update `harness.spec.ts` — run axe after navigation + persist violations
- matrix.json enhanced với per-fixture a11y data
- 3 new rubric criteria in Accessibility dim:
  - `no-serious-a11y-violations` (pass if serious+critical count = 0)
  - `no-moderate-a11y-violations` (pass if moderate count ≤2)
  - `a11y-violations-total-lt-5` (pass if total violations <5)

## Architecture

```
harness:gen      (compose matrix.json)
  ↓
harness:render   (Playwright screenshot + axe audit) ← NEW axe integration
  ↓
harness:score    (read audit results from matrix)
```

```ts
// scripts/test-harness/render/harness.spec.ts
import AxeBuilder from '@axe-core/playwright'

test(`render + audit ${fixture.id}`, async ({ page }) => {
  await page.goto(url)
  await page.screenshot(...)
  
  const axeResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze()
  
  const counts = {
    critical: axeResults.violations.filter(v => v.impact === 'critical').length,
    serious: axeResults.violations.filter(v => v.impact === 'serious').length,
    moderate: axeResults.violations.filter(v => v.impact === 'moderate').length,
    minor: axeResults.violations.filter(v => v.impact === 'minor').length,
    total: axeResults.violations.length,
  }
  
  // Persist to .harness-out/a11y-report.json (separate file to avoid bloat matrix.json)
  a11yReport[fixture.id] = { counts, violations: axeResults.violations.map(v => ({ id: v.id, impact: v.impact, helpUrl: v.helpUrl })) }
})
```

```ts
// scorer-lib.ts - read a11y report per fixture
export function readA11yReport(): Record<string, A11yFixtureData> | null {
  const p = path.resolve(REPO_ROOT, '.harness-out/a11y-report.json')
  if (!fs.existsSync(p)) return null
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

// evaluator reads a11yCounts from context:
noSeriousA11yViolations: ({ fixtureId, a11yReport }) => {
  const data = a11yReport?.[fixtureId]
  if (!data) return { pass: true, reason: 'no audit data (skip)' }  // graceful
  const bad = data.counts.critical + data.counts.serious
  return { pass: bad === 0, reason: `${bad} serious/critical violations` }
}
```

## Related code files
- `scripts/test-harness/render/harness.spec.ts` (extend với axe)
- `scripts/test-harness/rubric/scorer-lib.ts` (readA11yReport + pass into ctx)
- `scripts/test-harness/rubric/evaluators.ts` (3 new)
- `scripts/test-harness/rubric/rubric-v1.3.json` (3 criteria in Accessibility)
- `package.json` (add @axe-core/playwright dep)

## Implementation Steps
1. `npm install @axe-core/playwright --save-dev`
2. Extend harness.spec.ts với axe audit per fixture + write a11y-report.json
3. Run full render (21min, 390 fixtures) để verify axe works + check average violation counts
4. scorer-lib.ts: readA11yReport + pass vào scoreFixture ctx
5. evaluators.ts: 3 new evaluators đọc a11yReport
6. rubric-v1.3.json: add criteria trong Accessibility
7. Re-score → verify new a11y criteria work

## Todo list
- [ ] Install dep
- [ ] Extend harness spec với axe
- [ ] Run full render pass (long — 21 min)
- [ ] Verify a11y-report.json structure
- [ ] scorer-lib readA11yReport
- [ ] evaluators 3 new
- [ ] Rubric v1.3 criteria
- [ ] Re-score + report

## Success Criteria
- `@axe-core/playwright` successfully audits each fixture
- a11y-report.json generated với per-fixture violation counts
- New criteria signal meaningful (pass/fail distribution)
- Accessibility dim reflects runtime findings (in addition to static checks)

## Risk Assessment
- **High**: axe-core may flag rendering issues that aren't "real" (harness offline context có SVG placeholders, decorative colors, etc. may falsely violate rules). Tune via `.withRules()` to exclude image-alt-text (since SVG fallback is documented placeholder).
- **Medium**: runtime +30-60s per fixture for audit → total render may double (~40min). Consider sampling: audit 1 seed per preset (56 audits) instead of all 390.
- **Low**: dep version compatibility với Playwright 1.59.

## Security Considerations
- axe-core runs in browser context — sandboxed
- No user input path

## Next steps
- Plan complete. v2 ideas: Lighthouse perf scores, LCP/CLS checks.
