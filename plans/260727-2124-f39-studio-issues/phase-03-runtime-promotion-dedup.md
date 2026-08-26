# Phase 3: Implement Runtime Promotion and Deduplication

## Context Links

- [Implementation plan](./plan.md)
- [Live Errors UI](./phase-02-live-errors-ui.md)
- [DB lifecycle](../../docs/DB-LIFECYCLE.md)

## Overview

- **Priority:** P1
- **Status:** Sentry code complete; live DB and Vercel promotion gates pending
- **Effort:** 1h
- **Acceptance criteria:** AC-12–AC-16

## Architecture

`explicit submit → refetch selected provider record → sanitize and compute identity → create or return exact existing issue → existing lifecycle`

Exact runtime identity is `relatedType=runtime` plus `relatedId=<source>:<provider-key>`. PostgreSQL, not a query alone, closes the concurrency race.

## Requirements

### Functional

- Prefill existing issue fields from normalized evidence and allow operator review before submit.
- Return the existing issue for repeat/concurrent promotion.
- Preserve existing status, assignee, comments, and timeline behavior.

### Non-functional

- Add no evidence field, telemetry table, collection, or background write.
- Failed/cancelled promotion creates no partial issue.
- Collection changes have matching additive SQL and regenerated Payload types.

## Related Code Files

- **Modify:** `src/collections/TemplateIssues.ts`
- **Modify:** `src/app/api/admin/issues/route.ts`
- **Modify:** `src/app/studio/issues/_components/issue-types.ts`
- **Modify:** `src/app/studio/_components/modals/create-issue-modal.tsx`
- **Modify:** `src/app/studio/issues/_components/live-error-detail-drawer.tsx`
- **Modify:** `src/lib/admin/api-utils.ts` only to normalize proven Next 15 async route params required by existing issue detail/comments
- **Modify:** `scripts/db-setup.js`
- **Regenerate:** `src/payload-types.ts`
- **Create tests:** `src/__tests__/api/f39-runtime-promotion.test.ts`

## Implementation Steps

1. Add `runtime` to the Payload select, TypeScript union, modal relation support, and POST Zod contract. Add no new collection field.
2. Add a runtime-specific POST branch that accepts Sentry source, opaque provider ID, and allowed operator edits. Refetch the provider record server-side, then sanitize and compute its key; never trust browser-submitted host/path/status/message or cross-provider evidence as identity input.
3. Build title, normalized severity, `category=other`, and a description capped at the existing 10,000-character limit from sanitized evidence, tenant context, provider link, and suggested checks. Keep status `open`; do not auto-assign.
4. Set `relatedId=<source>:<provider-key>`. Runtime bypasses foreign-record lookup only after strict format/evidence validation.
5. Before index creation, fail closed if any duplicate runtime relation exists:

```sql
SELECT related_id, COUNT(*)
FROM template_issues
WHERE related_type = 'runtime'
GROUP BY related_id
HAVING COUNT(*) > 1;
```

6. Add an idempotent partial unique index:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS template_issues_runtime_related_id_uniq
ON template_issues (related_id)
WHERE related_type = 'runtime' AND related_id IS NOT NULL;
```

7. Extend the fail-closed verifier used by `--migrate-only` to assert that the index exists, is valid and unique, targets `template_issues(related_id)`, and has the exact runtime predicate. The general migration loop warns and continues, so index creation without this verifier is insufficient.
8. Query the exact runtime relation before create. If concurrent creation hits PostgreSQL `23505`, query and return the winner. Respond with `201, created:true` for the winner and `200, created:false` for an existing match.
9. Keep runtime promotion Sentry-only until the Vercel live spike proves a stable server-authoritative item-refetch contract. Reject Vercel promotion and ignore submitted cross-provider evidence rather than persisting an unverifiable match.
10. If provider refetch or create fails, keep the Live Error open and show refresh/retry. Never present a partial/unknown write as created.
11. Regression-test existing issue detail, update, comments, and timeline. If async route params reproduce the verified wrapper defect, fix normalization at `withSuperAdmin` and cover affected dynamic routes.

## Todo

- [ ] `runtime` relation works without a new field/table
- [x] Partial unique index preflight and migration are idempotent
- [x] `--migrate-only` fails if the runtime unique index is missing or invalid
- [x] First, repeated, and concurrent promotions produce one issue
- [x] Promotion identity comes from a server refetch, not browser-controlled fields
- [ ] Cancel/failure produces no row
- [x] Prefill contains sanitized evidence only
- [ ] Existing lifecycle regression passes
- [ ] Payload types and migration dry-run pass

## Success Criteria

- AC-12–AC-16 pass for the enabled Sentry path; Vercel promotion remains a release gate.
- Exact duplicate promotion returns/opens the existing issue.
- Other relation types remain non-unique and behavior-compatible.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Global uniqueness blocks valid existing relations | Regression | Use a `runtime`-only partial index |
| Query-before-create races | Duplicate issue | Catch `23505` and return winner |
| Shared auth wrapper change affects routes | Broad regression | Change only after reproduction; focused dynamic-route tests |

## Next Step

Run AC-mapped automated tests and real-provider staging smoke.
