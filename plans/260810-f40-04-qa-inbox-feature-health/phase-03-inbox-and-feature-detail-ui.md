# Phase 03 — Accessible responsive Inbox and detail UI

## Context links

- Parent: [plan.md](plan.md); depends on [Phase 02](phase-02-protected-read-api.md).
- Docs: UX §§2, 4–7, 9; existing `ProjectHealthClient` and Studio tokens.

## Overview

- Date: 2026-08-10; Description: replace health-only landing with real Inbox and detail; Priority: P1; Implementation status: pending; Review status: pending.

## Key Insights

- Inbox must precede history and show actionable state, not demo data.
- Existing client lacks fetch state handling, mobile composition, and robust focus lifecycle.

## Requirements

- Row: target, reason, latest evidence freshness, suggested next action; ordered priority and `Load more 25`.
- Detail: failed TC-ID, fixture, expected/actual, PR/SHA, classification, safe evidence; visual baseline/current/diff/threshold only when persisted.
- 375px stacked/card view, 44px controls, no horizontal scroll; desktop split list/detail; icon + text states.
- Skeleton/error/filter-empty/expired/unknown states; keyboard drawer/dialog focus trap, Escape and focus return.

## Architecture

- Keep `/studio/qa` force-dynamic and super-admin guarded; split typed client components for Inbox, health list, detail/evidence and state primitives.
- Use existing Studio CSS tokens and server responses; no client-side state inference.

## Related code files

- `src/app/studio/qa/page.tsx`, `src/app/studio/qa/ProjectHealthClient.tsx`, `src/app/studio/studio.css`.

## Implementation Steps

1. Add labelled Inbox/Health navigation and URL-addressable selected target/filter state.
2. Render priority rows and controlled empty/error/loading states from API DTOs.
3. Implement detail drawer/page evidence and visual-review panels with expiry/unavailable states.
4. Add responsive CSS and keyboard/focus handling; respect reduced motion.
5. Wire functional Retest only if Phase 02 capability contract is enabled; otherwise scope sign-off is required before declaring AC-2 done.

## Todo list

- [ ] Implement Inbox and `Load more 25`.
- [ ] Implement evidence/detail/visual states.
- [ ] Audit 375/768/desktop and keyboard navigation.
- [ ] Verify no auto-ticket/finding action crosses F40-05 boundary.

## Success Criteria

- Tester can inspect actionable evidence without false green; UI is usable by keyboard and at 375px.

## Risk Assessment

- Dense detail can overwhelm mobile; mitigate with progressive disclosure and evidence links, not horizontal tables.

## Security Considerations

- Render evidence as trusted server-provided URL/text only; do not embed raw trace/log HTML or expose hidden privileged data.

## Next steps

- Prove ACs with real-browser E2E and staged data.
