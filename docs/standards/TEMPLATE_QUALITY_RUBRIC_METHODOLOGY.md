# Template Quality Rubric — Methodology

> Giải thích rubric **dựa vào đâu** (sources) và **cách tính** (scoring algorithm).
> Companion doc cho `TEMPLATE_QUALITY_RUBRIC.md` (spec listing dimensions + criteria).

## 1. Sources

| Source | Độ tin cậy | Dùng cho dimensions |
|---|---|---|
| **`docs/standards/WEBSITE_TEMPLATE_STANDARDS.md`** (328 lines, team baseline) | Authoritative | Visual Richness, Typography, Social Proof, Conversion, Density — tất cả block presence + ordering |
| **Wix 900+ templates benchmark** (researcher plan 260418-1730) | High | Dimension weights + Wix-professional acceptance criteria |
| **Envato Elements 50K+ templates** | High | Visual variety + CTA patterns |
| **Shopify theme store** | High | E-commerce block expectations |
| **WCAG 2.1 AA guidelines** | Authoritative | Accessibility dim (v1.2+) |
| **Empirical scoring data** (390 fixtures matrix.json) | High | Ceiling detection — identify criteria với 100% pass (no signal) |

### Nguyên tắc evidence-based

Mỗi criterion phải có:
- **Source citation** (standard file + section, hoặc WCAG reference)
- **Measurable check** (from block data, không rely vào subjective judgment)
- **Discriminating power** (≥1 fixture fail AND ≥1 fixture pass) — verify sau mỗi run

## 2. Scoring Algorithm

### Step 1 — Per criterion

```ts
type EvalResult = { pass: boolean, partial?: boolean, reason?: string }

function evaluateCriterion(c: Criterion, blocks, theme, allBlocks, category): CriterionResult {
  const result = evaluator(blocks, theme, allBlocks, category)  // {pass, partial, reason}
  
  const points = result.pass 
    ? c.passPoints                                // full credit
    : result.partial 
      ? (c.partialPoints ?? Math.floor(c.passPoints / 2))  // half credit
      : 0                                         // fail
  
  const status = result.pass ? 'pass' : result.partial ? 'partial' : 'fail'
  return { criterionId: c.id, status, points, maxPoints: c.passPoints, reason: result.reason }
}
```

### Step 2 — Per dimension

```ts
function scoreDimension(dim: Dimension, ctx): DimensionScore {
  const criteriaResults = dim.criteria.map(c => evaluateCriterion(c, ctx))
  const earnedPts = criteriaResults.reduce((s, r) => s + r.points, 0)
  const maxPts = criteriaResults.reduce((s, r) => s + r.maxPoints, 0)
  const score = (earnedPts / maxPts) * 10     // normalize to 0-10
  return { id: dim.id, score, earnedPts, maxPts, criteria: criteriaResults }
}
```

### Step 3 — Weighted total

```ts
function weightedScore(dimensions: DimensionScore[], rubric: Rubric): number {
  const totalWeight = rubric.dimensions.reduce((s, d) => s + d.weight, 0)
  return dimensions.reduce((s, d) => s + d.score * d.weight, 0) / totalWeight
}
```

### Step 4 — Status

```
weighted ≥ 7       → pass  (🟢)
5 ≤ weighted < 7   → warn  (🟡)
weighted < 5       → fail  (🔴)
```

### Numeric Walkthrough — Fixture `beauty-blueprint-beauty-rose-petal-seed0` under v1.1

```
Visual Richness (weight 12):
  hero-variant-diverse      → pass    → 2/2
  gallery-present           → pass    → 2/2
  stats-present             → fail    → 0/2
  logo-cloud-present        → pass    → 2/2
  image-coverage            → fail    → 0/3  (SVG placeholder)
  features-have-icons       → pass    → 2/2
  earnedPts = 8, maxPts = 13
  dimScore = 8/13 × 10 = 6.2

Typography (weight 12):
  ... (6 criteria pass) ... → 10.0

Social Proof (weight 10):                → 7.0
Micro-Interactions (weight 9):           → 10.0
Spacing (weight 10):                     → 10.0
Conversion (weight 10):                  → 10.0
Content (weight 8):                      → 10.0
Density (weight 8):                      → 7.5

Weighted total:
  (6.2×12 + 10×12 + 7×10 + 10×9 + 10×10 + 10×10 + 10×8 + 7.5×8) / 79
  = 647.4 / 79
  = 8.2   → PASS
```

## 3. Ceiling-Beating Strategy

**Problem**: criteria với 100% pass rate cung cấp ZERO discrimination signal — nếu tất cả templates đều pass, criterion không giúp tìm ra template yếu.

**Giải pháp**: 3 approaches mỗi khi phát hiện ceiling:

### A. Remove
Drop nếu criterion không còn useful (e.g., `nav-has-cta`: 100% nav đã có ctaButton → zero signal).

### B. Tighten
Replace với stricter threshold (e.g., `contentDepth300` → `contentDepth500`, `variety-unique-75` → `variety-unique-85`).

### C. Replace
Swap với stricter version measuring different aspect (e.g., `themeHasSpacingPreset` → `spacingRhythmTokenOnly` check padding trong preset scale).

### Detection rule
Sau mỗi baseline run, flag criteria với:
- pass rate ≥95% across 390 fixtures → **ceiling candidate**
- pass rate ≤5% → **unreachable candidate** (may need relax or template fix)
- pass rate 30-70% → **healthy discriminator** (keep as-is)

## 4. Version Evolution

| Version | Date | Dims | Criteria | Weight | Baseline avg | Ceiling dims |
|---|---|---|---|---|---|---|
| v1 | 2026-04-18 | 8 | 35 | 66 | **8.96** | 3 (typography, spacing, density) |
| v1.1 | 2026-04-18 | 8 | 47 | 79 | **8.36** | 3 (spacing, conversion, content) |
| v1.2 | 2026-04-18 | 10 | ~58 | 97 | **~5.8-6.5** (target) | 0 |

### Delta v1 → v1.1
- +12 criteria, +13 weight
- Tighten theme font check, variety 50%→75%, content 150→300 chars
- Add image-coverage, testimonial-avatar, testimonials-have-ratings, hero-cta-pair, etc.

### Delta v1.1 → v1.2
- +2 dimensions (Accessibility 8, Category DNA 10)
- +11 criteria, +18 weight
- Remove 6 ceiling criteria
- Tighten 5 existing criteria
- Lower pass threshold? **Remains at 7** (explicit signal > optics)

## 5. Contributing New Criteria

### Template cho criterion mới

```json
{
  "id": "kebab-case-id",
  "label": "Short human-readable label (≤60 chars)",
  "check": { "type": "custom", "evaluator": "camelCaseEvaluatorName" },
  "passPoints": 1-3,
  "partialPoints": 0-1
}
```

### Review checklist (trước khi merge)

- [ ] **Source citation** trong criterion label hoặc doc (WEBSITE_TEMPLATE_STANDARDS §X, WCAG Y.Z)
- [ ] **Evaluator pure** (no fs/network, deterministic)
- [ ] **Unit tested** với 2+ fixtures (1 pass, 1 fail)
- [ ] **Discriminating power** verified — run scorer, pass rate trong 20-80% range
- [ ] **Name uniqueness** — evaluator key không collision với older versions
- [ ] **Doc update** — TEMPLATE_QUALITY_RUBRIC.md reflects new criterion

### Anti-patterns

- ❌ Vague labels ("good typography", "proper spacing") — cần measurable
- ❌ Criteria measuring same thing (duplicate signal, weight dilution)
- ❌ Criteria failing on known edge cases không phải template bug (e.g., blog templates skip Features)
- ❌ Criteria relying on runtime state (scroll position, animation timing) — static data only

## 6. Limitations

Rubric có inherent limitations — không replace manual design review:

1. **Visual quality subjective** — rubric đo structural compliance, không đo aesthetic taste
2. **Copy quality** — "good" copywriting không measurable automated
3. **Real-time behavior** — animation smoothness, interaction flow cần user testing
4. **Category fit** — Malaysian SME context requires domain expertise beyond rubric
5. **Cross-fixture uniqueness** — v1/v1.1 scorer evaluates fixtures independently (v1.3+ sẽ add)

## 7. Workflow

```
┌─────────────────────────────────────────────────────────────┐
│  1. Template authors edit `src/lib/ai/template-presets-*.ts` │
│  2. `npm run harness:gen`  → matrix.json (block data)       │
│  3. `npm run harness:score` → rubric-report-vX.json         │
│  4. View /test-harness/admin or score overlay on fixture    │
│  5. Fix low-scoring templates based on criteria detail      │
│  6. Repeat 2-5                                              │
└─────────────────────────────────────────────────────────────┘
```

## 8. Related Docs

- `docs/standards/TEMPLATE_QUALITY_RUBRIC.md` — rubric spec (dimensions + criteria listing)
- `docs/standards/WEBSITE_TEMPLATE_STANDARDS.md` — original template standards
- `docs/standards/DESIGN_TOKENS.md` — design token architecture
- `docs/standards/AI_WEBSITE_GENERATION_GUIDE.md` — AI gen pipeline context
- `scripts/test-harness/rubric/` — code (rubric JSON + scorer + evaluators)
- `plans/260418-1730-template-quality-rubric/` — v1 creation plan
- `plans/260418-2000-rubric-v1.1-stricter/` — v1.1 tightening plan
- `plans/260418-2326-rubric-v1.2-methodology/` — v1.2 (this methodology + a11y + category DNA)
