# Phase 02 — Score Badge Overlay on Fixture Render

## Context links
- Parent: [plan.md](plan.md)
- Depends on: Phase 01 (scorer-lib)
- Reuses: existing `src/app/test-harness/[fixtureId]/harness-render.tsx` (page nav badge pattern)

## Overview
Date: 2026-04-18
Description: Mỗi fixture render (template-first + AI-first) hiện score badge góc phải dưới. Collapsed = weighted total. Expanded = 8-dim breakdown + 35-criteria drill.
Priority: P1
Implementation status: pending
Review status: not started

## Key Insights
- Score badge là SSR (server component) — score computed on-demand per request, always fresh
- Overhead: ~50ms per fixture scoring. Acceptable vs value ("always fresh" beats 10min stale cache)
- UX pattern: click/hover-expand, not always-open (avoid clutter)

## Requirements
- Fixed position bottom-right (đối xứng page-nav badge hiện tại ở bottom-center)
- Collapsed: pill `✓ 8.9/10 Pass` (color by status: green pass, amber warn, red fail)
- Expanded: panel 320×auto với:
  - Header: fixture id + weighted score big + status tag
  - 8 dimension bars (name + weight + score bar + score number)
  - Collapsible per-dimension → show 4-7 criteria với ✓/◐/✗ + reason
  - Footer: link admin dashboard + "Re-score" button (force refresh)
- Mobile (<768px): drawer from bottom instead of floating panel

## Architecture

```
src/app/test-harness/[fixtureId]/
  ├── page.harness.tsx                (minor — pass score to render helper)
  ├── harness-render.tsx              (minor — invoke ScoreOverlay)
  └── score-overlay.tsx               (NEW — client component for collapse/expand)

src/app/test-harness/ai/[category]/
  ├── page.harness.tsx                (similar — AI score works same)
  └── ai-render.tsx                   (add ScoreOverlay)
```

Client component `score-overlay.tsx` nhận score prop từ server, manage collapse state via `useState`. Server passes FixtureScore JSON as data attribute or prop.

Score panel styling: inline CSS (same pattern em đã dùng cho page-nav badge) để survive theme/mode switching.

## Related code files
- `src/app/test-harness/[fixtureId]/harness-render.tsx`
- `src/app/test-harness/ai/[category]/ai-render.tsx`
- `scripts/test-harness/rubric/scorer-lib.ts` (from Phase 01)
- `scripts/test-harness/rubric/rubric.schema.ts` (FixtureScore type)

## Implementation Steps
1. Create `src/app/test-harness/_components/score-overlay.tsx` (client component)
   - Props: `{ score: FixtureScore }`, `{ showDetails: boolean }` state
   - Render collapsed pill + onClick toggles, shows expanded panel
2. Update `harness-render.tsx`:
   - Import scorer-lib, compute `score = scoreFixture(...)` from block data + load rubric
   - Pass score to ScoreOverlay component
3. Update `ai-render.tsx` similarly — score AI-gen result at render time
4. CSS: inline styles, position fixed bottom-right (page nav badge stays at bottom-center)
5. Test on 3 fixtures (high/medium/low score) — visual check
6. Mobile responsive check

## Todo list
- [ ] score-overlay.tsx client component
- [ ] Wire into harness-render.tsx (template-first)
- [ ] Wire into ai-render.tsx (AI-first)
- [ ] Inline styles, fixed position
- [ ] Mobile drawer variant
- [ ] Visual QA 3 fixtures
- [ ] Commit

## Success Criteria
- Badge visible at bottom-right on every fixture (template + AI)
- Collapsed = 1 pill, ~200×40px
- Click expand → 8 dimensions visible, click dim → criteria details
- Status color matches (green/amber/red)
- No layout shift, no overlap với page nav badge

## Risk Assessment
- **Low**: client component state is simple (show/hide)
- **Medium**: z-index conflicts với fixture content (video-background, modals). Use z-index 9999 + aria-label.
- **Low**: Score computation per render adds latency — cache per fixtureId in Next server cache? Not needed v1 (50ms negligible).

## Security Considerations
- Score overlay shows internal rubric scoring — harness route only (ENABLE_HARNESS=1), production never exposed.
- No user input in score path.

## Next steps
- Phase 03: Admin dashboard page to browse all scores together.
