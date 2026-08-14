# Phase 04 — Studio manual-run and history experience

## Context

- UX §4–§9 and issue #1746. Current `/studio/qa` has Health/retest primitives but no target/profile preflight or unified history.

## Implementation steps

1. Use SSR only for initial safe target/history context; hydrate small focused client components for target picker, preview/confirmation dialog, active status and history filters. Keep files under the project 200-line guideline by extracting focused components rather than extending one large client file.
2. Keep exactly three primary tabs: Inbox, Health and Run history. This follows UX handoff §4/§6 over the older mobile illustrative mention of Findings. The manual-run CTA is contextual from Health/detail and Run history; do not add a Findings/Impact primary tab or a Run All button.
3. Target picker searches active registry targets only. Profile selection is Smoke/Regression. Selecting either calls server preflight and renders test types, TC IDs, prerequisite/fixture/capacity, duration, staging and first blocking recovery action.
4. Confirmation dialog has one primary action (`Run n checks`), sends one idempotency key, disables while pending, uses `aria-describedby` for impact/context, Escape close and focus restoration.
5. History filter state is URL-addressable (seven-day default/time, target, pack/test, state/result, PR/SHA/profile/cursor). Render active and terminal state with icon + text, safe evidence expiry metadata, `Load more 50` pagination, `aria-live=polite`; poll active data no faster than 15 seconds.
6. Cancel is displayed only for `canCancel`; requires confirmation and refreshes status without claiming completion on an ambiguous cancellation.
7. At 375px retain 44px controls/no horizontal overflow; use a filter dialog/bottom-sheet pattern rather than a horizontal filter bar.

## Success criteria

- No raw CI details, internal lease fields or GitHub credentials appear in DOM/network payload.
- Keyboard can operate picker, profile, dialog, filters, pagination and cancel; screen readers receive labels for preflight reason and state.

## Execution status — 2026-08-13

The Studio manual-run/history surface is implemented in the working tree. It remains in verification pending authenticated browser, accessibility and 375px mobile checks.
