# Phase 2 — Endpoint and operator actions

## Files

- Create `src/app/api/admin/generations/[id]/issue/route.ts`
- Modify `src/app/studio/generations/_components/generation-debug-detail.tsx`
- Modify listing component/type only where its read model exposes action
- Modify/add route, component and E2E tests

## API contract

`POST /api/admin/generations/:id/issue`

1. `dynamic = 'force-dynamic'`, `maxDuration = 60`, numeric ID validation and
   `withSuperAdmin` before any record lookup.
2. Load the generation plus bounded root lineage/recovery data using the same
   server serializer path as detail; never trust client incident fields.
3. Call the escalation service. Return `{ data: { id, created, href } }` with
   `201` for creation and `200` when deduped. Return safe domain `409` for an
   ineligible generation; no record-existence leak for unauthorized callers.
4. Catch only known unique constraint collisions, re-read by `dedupeKey`, and
   fail loudly/safely for all other errors.

## UI contract

1. Render primary **Tạo ticket Dev** only when server policy says ticket-eligible.
   Confirm copy states the ticket contains safe diagnostic context, not raw user input.
2. Disable after first submit; replace action with **Đang tạo ticket…**.
3. On created/deduped response, render **Mở ticket** linking to
   `/studio/issues?relatedType=generation&relatedId={generationId}` and explain
   whether an existing issue was reused.
4. Listing uses the same endpoint/action component. Never display a ticket CTA
   from client-side parsing of error strings.

## Success criteria

- Both listing and detail perform exactly one safe mutation and converge on the
  same issue.
- Keyboard focus, cancel and error states are accessible; a failed network call
  restores the actionable CTA.
