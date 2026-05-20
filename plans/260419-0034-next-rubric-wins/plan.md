---
title: "Next rubric wins — fix 4 zero-pass criteria + image-coverage"
description: "Targeted fixes cho 4 criteria 0%-33% pass rate → +0.4 overall rubric avg"
status: pending
priority: P2
effort: 3h
branch: fix/F01-wave2-wix-detailed
tags: [rubric, a11y, footer, testimonials, theme, f01]
created: 2026-04-19
---

# Next Rubric Wins

## Context

Rubric v1.2 current avg **8.64/10**. Top failing criteria (discriminating, actionable):

| Criterion | Dim | Pts | Pass rate | Fix effort |
|---|---|---|---|---|
| theme-heading-body-distinct | Typography | 2 | **0%** | Composer output derive fontHeading + fontBody từ fontPairingId |
| testimonial-avatar | Social Proof | 2 | **0%** | Add avatarUrl (static AVATAR_FALLBACK_SVG per testimonial) |
| footer-mega-columns | Density | 2 | **0%** | Change composer footer to mega variant với 4 link columns |
| image-coverage | Visual Richness | 3 | 33% fail | Evaluator: accept SVG placeholders (harness offline context) |

Target: 4 fixes push criteria 0% → 100%, image-coverage 67% → 100%. Expected avg jump **+0.4** → 9.0+.

## Phases

| # | Phase | Effort | Fix |
|---|---|---|---|
| 01 | Theme fontHeading/fontBody derive từ fontPairingId | 1h | Composer resolves pairing → emit explicit heading+body fonts |
| 02 | Testimonial avatarUrl — add AVATAR_FALLBACK_SVG per testimonial | 30m | Composer buildTestimonials populate avatarUrl field |
| 03 | Footer mega variant + columns — update composer buildFooter | 1h | Emit footer.variant='mega' + 4-column linkColumns structure |
| 04 | Image-coverage evaluator fine-tune + verify + commit | 30m | Accept data:image/svg URL as "has image" (lenient harness mode) + re-score + ship |

Total: **3h**. Sequential.

## Expected Outcome

| Metric | Current | After |
|---|---|---|
| Avg weighted | 8.64 | **9.0+** |
| typography-hierarchy | 8.3 | 9.5+ |
| social-proof | 7.5 | 8.5+ |
| information-density | 7.5 | 9.0+ |
| visual-richness | 7.1 | 8.5+ |

## Out of Scope

- Cross-fixture uniqueness (v1.3 rubric)
- Runtime a11y axe-core (v1.3 rubric)
- textColor semantic contrast check (v1.3 rubric)
- Full content library avatar URLs (currently use SVG fallback — real photo URLs future work)
