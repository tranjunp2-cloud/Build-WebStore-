---
title: "Rubric v1.3 — decorative detect + uniqueness + textColor + runtime a11y"
description: "4 advanced rubric checks để differentiate templates ở layer cao hơn structural"
status: pending
priority: P2
effort: 8h
branch: fix/F01-wave2-wix-detailed
tags: [rubric, a11y, uniqueness, axe-core, f01]
created: 2026-04-19
---

# Rubric v1.3 — Advanced Quality Checks

## Context

v1.2 avg 9.21/10 sau 3 waves (base + a11y + next-wins). 4 remaining differentiators identified:

| # | Check | Current gap | Why v1.3 |
|---|---|---|---|
| 1 | Image-coverage decorative detect | 67% — tech templates không có imagery (intentionally minimal) | Reward decorative primitives (gradient-blob, shapes) as visual richness signal |
| 2 | Cross-fixture uniqueness | 0% measured | Detect copy-paste headlines across 390 fixtures (content duplication = red flag) |
| 3 | textColor semantic contrast | Not checked | Current only checks primary vs surface — should check body text color too |
| 4 | Runtime a11y (axe-core) | Not checked | Actual WCAG violations in rendered HTML (catches what static check misses) |

v1.3 adds **rubric as full quality signal** — static data (v1/1.1/1.2) + runtime rendering (v1.3).

## Research

Skip formal researchers — scope well-defined từ prior session context. Architecture decisions documented inline trong phase files.

## Phases

| # | Phase | Effort | Status | File |
|---|---|---|---|---|
| 01 | Image-coverage decorative-primitive detect | 1h | pending | [phase-01-decorative-detect.md](phase-01-decorative-detect.md) |
| 02 | Cross-fixture uniqueness dimension | 2h | pending | [phase-02-uniqueness-dim.md](phase-02-uniqueness-dim.md) |
| 03 | textColor body-text WCAG contrast | 1h | pending | [phase-03-text-color-contrast.md](phase-03-text-color-contrast.md) |
| 04 | Runtime a11y — axe-core trong harness render | 4h | pending | [phase-04-runtime-a11y.md](phase-04-runtime-a11y.md) |

Total: **8h**. Phases 01-03 independent, can parallel. Phase 04 largest (requires Playwright integration + spec extension).

## Architecture Decisions

1. **Decorative as signal** (P01): composer outputs có `decorativePrimitives` array trên blocks (gradient-blob, shape-blob, grid-pattern). Rubric accepts ≥2 decorative types as "visual richness". Not a replacement for images — supplement.

2. **Uniqueness dim** (P02): NEW dimension weight 6. Scorer must receive ALL 390 fixtures (architecture change from per-fixture isolate). Hash hero headlines + compare — flag fixtures với duplicate headline.

3. **textColor contrast** (P03): Add `theme.textColor` field (default `#111` light, `#fff` dark). Evaluator checks textColor vs surface ≥4.5:1. Separate criterion trong Accessibility dim.

4. **Runtime a11y** (P04): Extend `npm run harness:render` — after Playwright screenshots, run `@axe-core/playwright` audit → persist violations to matrix.json. Evaluator reads pre-computed violation counts per fixture.

## Expected Outcome

| Metric | v1.2 | v1.3 target |
|---|---|---|
| Dimensions | 10 | **11** (+ Uniqueness) |
| Criteria | 54 | **~60** |
| Weight | 97 | **~108** |
| Avg weighted | 9.21 | **8.5-9.0** (adds rigor) |

Pass rate expected drop from 100% → ~85% — fixtures failing uniqueness or a11y violations surface real issues.

## Open Questions

1. **Uniqueness threshold**: how similar = "copy"? Exact match only, or Levenshtein distance?
2. **axe-core scope**: homepage only, or all sub-pages? (performance cost ~30s per fixture for full site)
3. **textColor fallback**: if theme doesn't define → infer from colorMode (light=#111, dark=#fff) or fail criterion?
4. **v1.3 as default**: switch `DEFAULT_RUBRIC_VERSION = 'v1.3'` immediately after baseline, or keep v1.2 as stable?

## Out of Scope

- Rubric v2 full runtime quality (Lighthouse perf scores, LCP, CLS)
- Template auto-fix tooling (suggest rewrites to pass rubric)
- Cross-fixture branding consistency (category colors, tone voice)
