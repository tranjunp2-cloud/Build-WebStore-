# Phase 3 — Automated and manual verification

## Automated coverage

- TC-F41-21: Super Admin creates a ticket and response contains safe generation,
  trace, incident location and retry lineage.
- TC-F41-22: sequential + concurrent duplicate request returns one issue;
  changed signature returns a new issue.
- TC-F41-23: listing and detail ticket flow replaces CTA with Open ticket;
  retryable/success/input-invalid records cannot create Dev ticket.
- TC-F41-29: fixtures for input/page/component/quota/system never include raw
  form values, prompt, token, header, stack or PII in issue persistence/API/UI.
- RBAC: anonymous/admin/end-user get safe denial without existence leak.
- Migration: `npm run db:migrate` twice; validate partial unique index exists.

## Required quality gates

1. Read `docs/TEST_CONVENTION.md` before adding tests; map only AUTO TCs.
2. Run targeted unit/API/component tests, `npx tsc --noEmit`, `npm run lint`,
   `git diff --check`, then `$ck:code-review`.
3. Add/extend Playwright flow in `tests/f41-generation-attention.spec.ts` (or
   the existing F41 E2E suite) because this introduces a mutation route and a
   new tracker action.

## Manual staging gate

Use only `e2e-f41-*` tenant data. Trigger a ticket-only generation, double-click
from listing and detail in two sessions, verify one Issue & Feedback record, then
inspect its rendered description for safe context and absence of restricted data.
