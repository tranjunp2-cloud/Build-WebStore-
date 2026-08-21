# Scout 01 — existing QA surfaces

## Read files

- `src/app/studio/qa/page.tsx`
- `src/app/studio/qa/ProjectHealthClient.tsx`
- `src/app/api/admin/qa/project-health/route.ts`
- `src/app/api/admin/qa/runs/route.ts`
- `src/collections/QaTestRuns.ts`, `QaTestResults.ts`
- `src/lib/admin/qa/health-calculator.ts`, `target-registry.ts`, `contracts.ts`
- `docs/design/qa-control-center-ux.md`
- `docs/TEST_CONVENTION.md`

## Current state

- Current QA page is super-admin server rendered and already uses `dynamic = 'force-dynamic'`.
- `ProjectHealthClient` has filters plus a modal summary. It does not have keyboard focus trapping/return focus, mobile-specific inbox/detail layout, or loading/error fetch states.
- Health precedence protects against false green, and links route to approved internal admin metadata.
- The UX specification requires QA Inbox as landing surface, ordered actionable items, safe evidence before judgement, 375px layouts, labelled icon/text states, and keyboard-safe dialogs.
- Tests must map to the F40 QA test-case document and use browser E2E in `tests/*.spec.ts` for all new routes/pages.

## Implications

Implement a read-only server DTO, then compose Inbox/Health/Detail UI from it. Keep navigation/data real; omit later-story actions rather than shipping demo or static findings.
