# Phase 03 — Studio review workflow and health integration

## Overview

Priority: P1. Add the smallest usable reviewer experience to the existing QA Control Center.

## Related files

- Modify `src/app/studio/qa/page.tsx` and `src/app/studio/qa/ProjectHealthClient.tsx`.
- Modify `src/app/api/admin/qa/project-health/route.ts` if its loader must include finding links.
- Reuse `/api/admin/qa/findings` projections and existing safe evidence endpoint.

## Steps

1. Server-load bounded finding summaries together with Project Health; avoid N+1 result/run
   queries and keep SSR/API health projections equivalent.
2. Add a QA Inbox/review modal or panel in the existing page: target, lifecycle/owner,
   TC-ID, expected/actual, run/PR/SHA and signed evidence link only.
3. Add clearly separated actions: dismiss/cancel (no remote call), open confirmation dialog,
   confirm promotion, and display retry-safe progress/error state.
4. On successful promotion, refresh the local record and show linked GitHub issue. On failure,
   keep the review open with a generic retry message.
5. Add accessible dialog semantics, focus/close behavior and labels needed by Playwright.
6. Link active findings from target health detail without making unknown/verified data Critical.

## Done

- [x] Reviewer cannot create an issue until a confirmation step.
- [x] Cancel visibly leaves finding with no GitHub link.
- [x] Successful confirmation displays one linked issue and no raw evidence.
- [x] Existing Project Health filtering/detail behavior remains intact.
