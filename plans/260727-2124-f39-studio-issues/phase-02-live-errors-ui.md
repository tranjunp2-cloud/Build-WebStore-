# Phase 2: Add Live Errors UI

## Context Links

- [Implementation plan](./plan.md)
- [Provider read contracts](./phase-01-provider-read-contracts.md)
- [F39 PRD: UI contract](../../docs/prd/F39-studio-log-issue-tracking.md#9-ui-contract)

## Overview

- **Priority:** P1
- **Status:** Code and component tests complete; browser/staging verification pending
- **Effort:** 2h
- **Acceptance criteria:** AC-01–AC-11, AC-16

## Architecture

`/studio/issues` keeps the current tracked issue state and adds a temporary Live Errors state. The browser calls Sentry and Vercel independently and stores no provider evidence beyond the current view.

## Requirements

### Functional

- Add `Tracked issues` and `Live errors` views without a new route.
- Support `All`, `Sentry`, and `Vercel` filters and per-source retry.
- Show safe list/detail evidence, tenant attribution, guidance, provider link, and promotion action.

### Non-functional

- Tracked Issues remains usable during one-source or total provider failure.
- No interval, polling, background fetch, or persistence occurs.
- `/studio/generations` remains unchanged.

## Related Code Files

- **Modify:** `src/app/studio/issues/_components/issues-list.tsx`
- **Modify:** `src/app/studio/issues/_components/issue-types.ts`
- **Create:** `src/app/studio/issues/_components/live-errors-view.tsx`
- **Create:** `src/app/studio/issues/_components/live-error-detail-drawer.tsx`
- **Modify only if server props require it:** `src/app/studio/issues/page.tsx`

## Implementation Steps

1. Add top-level `Tracked issues` and `Live errors` controls inside the current page; preserve tracked filters, selection, counts, refresh, detail, comments, status, assignment, and timeline behavior.
2. Fetch Sentry and Vercel with two independent requests only when Live Errors opens or the operator refreshes/retries.
3. Model loading, empty, success, unavailable, and last-fetch time per source. Do not collapse an unavailable response into an empty list.
4. Keep Tracked Issues available when one or both sources fail.
5. Render only normalized fields: source, severity, occurrence time, summary, host, tenant/`Unknown`, route, method/status, release/deployment, and provider link.
6. Use a Live Error detail drawer within the existing Issues visual shell for safe evidence, `Suggested next checks`, escalation condition, and `Create tracked issue`.
7. Fetch provider detail only when an item opens. Preserve list evidence if detail becomes unavailable.
8. Retry each source/detail independently with explicit user action; add no magic wait or automatic retry.
9. Mark rows as related only when two loaded DTOs share the same exact non-empty request/trace ID.
10. Close/review/filter actions must not call any write endpoint.

## Todo

- [x] Tracked Issues behavior and state are preserved
- [x] Both provider lists and filters render
- [x] Empty, partial failure, total failure, detail failure, and retry states render
- [x] `Unknown` attribution is explicit
- [x] DOM contains no excluded fields
- [x] No write occurs without promotion
- [x] No `/studio/logs` or Generations change exists

## Success Criteria

- AC-01–AC-11 and AC-16 UI behavior is implemented and covered by focused component tests; browser/staging verification remains pending.
- Total provider failure does not disable tracked issue work.
- The latest provider timestamp and latest manual fetch time are visible.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Shared component state mixes live/tracked records | Wrong actions/data | Separate discriminated view state |
| Detail refetch fails | Operator loses context | Preserve safe list snapshot and show retry |
| UI accidentally starts polling | Scope/privacy drift | Fetch only on view open/manual action |

## Next Step

Wire the promotion action to the existing issue workflow with DB-enforced identity.
