# Template Quality Rubric — Wix-Pro v1

> Machine-scorable rubric đánh giá 56 blueprint templates theo chuẩn Wix-professional.
> Reference: `plans/260418-1730-template-quality-rubric/`

## Tổng quan

- **8 dimensions**, tổng weight = **66**
- **35 criteria** measurable từ block data
- Score mỗi fixture 0-10/dimension, weighted avg = final score
- **Thresholds**: Pass ≥7, Warn 5-6.99, Fail <5
- **Pass goal**: ≥80% (44/56) templates đạt ≥7 weighted

## 8 Dimensions

### 1. Visual Richness — Weight 10

Visual variety — decorative blocks, imagery-heavy sections, variant diversity.

| # | Criterion | Pass pts |
|---|---|---|
| 1.1 | Hero uses non-default variant (split-image, fullscreen, overlay, ...) | 2 |
| 1.2 | Gallery / portfolio block present | 2 |
| 1.3 | Stats block present | 2 |
| 1.4 | Logo Cloud / Trust Bar present | 2 |
| 1.5 | ≥7 distinct block types on homepage | 2 |

**Example Pass**: Hero `split-image` + Gallery + Stats + Logo Cloud + 8 block types → **10/10**
**Example Fail**: Hero `centered` + 5 block types → **0/10**

---

### 2. Typography Hierarchy — Weight 9

Clear H1→H2→body hierarchy, theme font pairing, section labels.

| # | Criterion | Pass pts |
|---|---|---|
| 2.1 | Hero has non-empty headline | 2 |
| 2.2 | Exactly 1 hero block (single H1) | 2 |
| 2.3 | Theme specifies heading font | 1 |
| 2.4 | Theme specifies body font | 1 |
| 2.5 | Hero has subheadline | 1 |
| 2.6 | ≥70% content blocks have headline/sectionLabel | 2 |

---

### 3. Social Proof & Trust — Weight 9

Testimonials, logos, stats, trust signals.

| # | Criterion | Pass pts |
|---|---|---|
| 3.1 | Testimonials block present | 2 |
| 3.2 | Testimonials ≥3 items | 2 |
| 3.3 | Logo cloud ≥4 logos | 2 |
| 3.4 | Stats block ≥3 items | 2 |
| 3.5 | ≥1 testimonial có avatarUrl | 1 |

---

### 4. Micro-Interactions — Weight 8

Proxy metrics (live animations không measurable từ static data):

| # | Criterion | Pass pts |
|---|---|---|
| 4.1 | Nav variant rich (centered, mega-menu, transparent, sidebar) | 2 |
| 4.2 | Standalone CTA block present | 2 |
| 4.3 | Newsletter or contact form present | 2 |
| 4.4 | ≥8 distinct block types (interaction diversity proxy) | 2 |

---

### 5. Spacing & Rhythm — Weight 8

Block count trong range, không duplicate adjacent, theme spacing preset.

| # | Criterion | Pass pts |
|---|---|---|
| 5.1 | Homepage 6-16 blocks | 3 |
| 5.2 | Không có 2 blocks adjacent cùng type | 2 |
| 5.3 | Theme specifies spacingPreset | 3 |

---

### 6. Conversion Path Clarity — Weight 8

Multi-placement CTA, form lead capture.

| # | Criterion | Pass pts |
|---|---|---|
| 6.1 | Hero has CTA button | 2 |
| 6.2 | Mid-page CTA block present | 2 |
| 6.3 | Contact block present | 2 |
| 6.4 | Newsletter lead capture present | 1 |
| 6.5 | Nav has CTA button | 1 |

---

### 7. Content Authenticity — Weight 7

No Lorem, category-appropriate, substantial depth.

| # | Criterion | Pass pts |
|---|---|---|
| 7.1 | No 'Lorem Ipsum' anywhere | 2 |
| 7.2 | Hero headline ≥10 chars | 1 |
| 7.3 | Features block ≥3 items | 2 |
| 7.4 | FAQ ≥4 items | 2 |

---

### 8. Information Density — Weight 7

Block count balance + variety.

| # | Criterion | Pass pts |
|---|---|---|
| 8.1 | Homepage ≥7 blocks | 2 |
| 8.2 | Homepage ≤16 blocks | 2 |
| 8.3 | Distinct block types ≥ total/2 | 3 |

---

## Scoring Algorithm

```
Per dimension:
  earnedPoints = sum(criterion.passPoints if passed else 0)
  maxPoints = sum(criterion.passPoints)
  dimensionScore = (earnedPoints / maxPoints) × 10

Overall:
  weighted = sum(dimensionScore × dimension.weight) / totalWeight
  // totalWeight = 66

Status:
  weighted ≥ 7     → PASS
  5 ≤ weighted < 7 → WARN
  weighted < 5     → FAIL
```

## Check Types

| Type | Description | Example |
|---|---|---|
| `presence` | Block type exists (comma-separated = alternatives) | `{ type: 'presence', blockType: 'testimonials' }` |
| `count` | Array field has ≥ min items | `{ type: 'count', blockType: 'faq', field: 'items', min: 4 }` |
| `ratio` | Numerator / denominator ≥ min | (future) |
| `enum` | Block field value in whitelist | `{ type: 'enum', blockType: 'nav', field: 'variant', in: ['centered'] }` |
| `custom` | JS evaluator by name | `{ type: 'custom', evaluator: 'heroHasCta' }` |

## Files

| File | Purpose |
|---|---|
| `scripts/test-harness/rubric/rubric.schema.ts` | TypeScript types |
| `scripts/test-harness/rubric/rubric-v1.json` | Rubric definition (this doc source) |
| `scripts/test-harness/rubric/evaluators/*.ts` | Custom check implementations |
| `scripts/test-harness/rubric/scorer.ts` | Scoring engine |

## Usage

```bash
npm run harness:gen      # regenerate block matrix
npm run harness:score    # score against rubric
open .harness-out/rubric-report.html
```

## Versioning

- `v1` (2026-04-18): initial 8 dim × 35 criteria. Baseline for template fix program.
- Future v1.1: tune weights after baseline run. Future v2: add a11y + perf dimensions.

## Related

- Design standard baseline: `docs/standards/WEBSITE_TEMPLATE_STANDARDS.md`
- Design tokens: `docs/standards/DESIGN_TOKENS.md`
- AI gen guide: `docs/standards/AI_WEBSITE_GENERATION_GUIDE.md`
