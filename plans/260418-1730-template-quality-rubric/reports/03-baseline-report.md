# Phase 03 — Baseline Scoring Report

Date: 2026-04-18
Rubric: `wix-pro-v1` (8 dims, 35 criteria, weight 66, pass ≥7)

## Overall Summary

| Metric | Value |
|---|---|
| Total fixtures | 390 |
| Pass (≥7) | 390 (100%) |
| Warn (5-6.9) | 0 |
| Fail (<5) | 0 |
| Avg weighted | **8.27 / 10** |

## Per-Dimension Average

| Dimension | Weight | Avg Score | Status |
|---|---|---|---|
| typography-hierarchy | 9 | **10.0** | ceiling — rubric too easy |
| spacing-rhythm | 8 | **10.0** | ceiling — theme-backed, easy pass |
| information-density | 7 | **10.0** | ceiling |
| content-authenticity | 7 | 9.3 | near ceiling |
| micro-interactions | 8 | 8.5 | good |
| social-proof | 9 | 7.5 | **gap (no logo cloud, 0 avatars)** |
| visual-richness | 10 | **6.9** | **BIGGEST GAP** |
| conversion-path | 8 | **4.7** | **CRITICAL GAP — hero CTA missing** |

## Top 5

1. realestate-blueprint-realestate-0-corporate-trust (5 seeds all 9.2)

## Bottom 5

1. business-legacy-starter (all 7.3)
2. creative-legacy-starter (all 7.3)

All 100% pass threshold, but 3 dimensions at ceiling indicate **rubric calibration is lenient**.

## Key Findings

### 1. Rubric calibration issues (v1.1 todo)

- **Typography 10/10 across all**: themeHasHeadingFont + themeHasBodyFont check `fontPairingId` fallback — 100% pass. Tighten by requiring explicit fontHeading + fontBody strings.
- **Spacing 10/10**: `spacingPreset` present in all themes from composer. Not measuring actual padding/rhythm.
- **Density 10/10**: Block count 6-16 + variety ≥half — both trivially true.

### 2. Real gaps surface despite ceiling noise

- **Conversion path 4.7/10 (worst)**: Hero CTA missing from most templates, mid-CTA underused. This matches user feedback "templates looking weak".
- **Visual richness 6.9/10**: 0/390 have Logo Cloud (matches researcher-02 finding). Block variety limited.
- **Social proof 7.5/10**: Testimonials present but 0 avatars, logo cloud absent.

## Recommendations for Phase 04/05

**High priority (biggest ROI):**
1. **Conversion path fixes** (dim weight 8, avg 4.7 → target 8):
   - Add hero CTA to all 56 blueprints
   - Ensure mid-CTA block present in homepage
   - Nav CTA wiring (currently ~50%)
2. **Visual richness** (dim weight 10, avg 6.9 → target 8.5):
   - Add Logo Cloud (0/56) — Phase 04 item 4.1
   - Stats presence (28/56 → 56/56)
   - Gallery where missing
3. **Social proof** (dim weight 9, avg 7.5 → target 8.5):
   - Testimonial avatars schema + fallback — Phase 04 item 4.3
   - Logo cloud items ≥4

**Secondary (rubric v1.1):**
- Tighten typography check (require explicit fontHeading not fallback)
- Tighten spacing check (measure actual rhythm, not just preset presence)
- Tighten density check (weight by block-type balance)

## Phase 04 Target Projection

After Phase 04 execution:
- Visual richness: 6.9 → ~8.5 (Logo Cloud adds 2 pts to 390 fixtures)
- Social proof: 7.5 → ~8.5 (avatar slot + logos ≥4 pts)
- Conversion path: 4.7 → ~7.5 (hero CTA + mid-CTA ubiquity)
- **Overall avg: 8.27 → ~9.0**

Phase 05 adds category-specific niceties (Before-After, Map, Case Studies) — marginal scoring gain but significant qualitative improvement.

## Files

- Raw data: `.harness-out/rubric-report.json` (1.2 MB)
- Dashboard: `.harness-out/rubric-report.html` (5.2 MB, opens in browser)
- Rubric spec: `scripts/test-harness/rubric/rubric-v1.json`
- Human doc: `docs/standards/TEMPLATE_QUALITY_RUBRIC.md`
