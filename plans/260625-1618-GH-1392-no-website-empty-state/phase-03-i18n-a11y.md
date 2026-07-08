# Phase 03 — i18n + responsive + a11y polish

## Overview
Priority: P1 · Status: pending · Effort: 1h
Empty state is reused across many pages now — verify i18n (EN+BM), responsiveness (375→1920), and a11y.
Mostly verification: keys + component already exist. Small fixes only.

## Key insights
- i18n keys exist: `t.dashboard.empty.{title,description,cta}` in `en.json:885-889` (and `ms.json` per scout).
  Component reads them via `useI18n()` — no new key wiring.
- `DashboardEmptyState` is already responsive (rocket 200→256px, `max-w-[448px]`, full-width CTA). Issue wants
  ~140px on mobile + 16px side padding — current 200px floor is close; tune only if QC flags.

## Requirements
- i18n: EN + BM present, no raw key leakage. Confirm BM wording with localization owner (placeholder copy in issue).
- Responsive: centered 375–1920, CTA full-width with side padding on mobile.
- a11y: rocket `alt` meaningful (currently "Rocket launch illustration" — acceptable; issue suggests
  "No website illustration"), CTA keyboard-focusable (it's a `<Link>` → inherently focusable), text contrast ≥ 4.5:1.

## Related code files
- VERIFY/EDIT `src/i18n/locales/en.json` (`dashboard.empty.*` exists — verify).
- VERIFY/EDIT `src/i18n/locales/ms.json` (`dashboard.empty.*` — confirm BM copy present & correct).
- VERIFY/EDIT `src/components/dashboard/DashboardEmptyState.tsx` — only if a11y/responsive gaps found.

## Implementation steps
1. Grep both locale files for `dashboard.empty` — confirm all 3 keys in EN + MS, no missing/placeholder.
2. If BM copy is placeholder, flag to localization owner; use issue's interim strings if none.
3. a11y pass: ensure rocket `alt` is descriptive; CTA reachable + visible focus ring (add `focus-visible:ring`
   if not inherited from theme). Verify muted-foreground/foreground contrast on dark bg ≥ AA.
4. Responsive spot-check at 375 / 768 / 1920 (covered by phase-04 QA matrix).

## Todo
- [ ] Verify EN + BM `dashboard.empty.*` keys complete
- [ ] a11y: alt text + focus-visible on CTA + contrast check
- [ ] Responsive spot-check 375/768/1920
- [ ] Confirm BM copy ownership (or note as follow-up)

## Success criteria
- Switching locale shows translated empty state, no raw keys.
- CTA focus ring visible on keyboard tab; rocket has meaningful alt.
- Empty state stays centered & legible across breakpoints.

## Risks
| Risk | L×I | Mitigation |
|------|-----|------------|
| BM copy unofficial | M×L | Keys already shipped for dashboard; reuse same strings — no new translation risk. Confirm async. |
| Contrast fail on light theme | L×M | Component uses theme tokens (`--muted-foreground`); audit both themes during QA. |

## Next steps
- Phase 04 includes the responsive/a11y manual matrix.
