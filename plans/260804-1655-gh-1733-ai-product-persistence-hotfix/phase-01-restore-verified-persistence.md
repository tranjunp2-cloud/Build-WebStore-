# Phase 01 — Restore Verified Persistence

**Status:** completed · **Priority:** P1 · **Migration:** No

## Goal

Restore the known GH-1410 auto-commit path for AI Product creation without dropping GH-1588 category protection. Return success only after an exact independent read confirms the committed Draft.

## Files

**Modify**

- `src/lib/payload/category-row-lock.ts`
- `src/app/(dashboard)/products/actions.ts`
- `src/app/api/ai/products-bulk-parse/route.ts`
- `src/components/dashboard/BulkCreateModal.tsx`
- `src/__tests__/unit/payload/category-row-lock.test.ts`
- `src/__tests__/unit/actions/save-product-action.test.ts`
- `src/__tests__/unit/dashboard/bulk-create-save.test.tsx`
- `src/__tests__/api/ai.test.ts`
- `docs/qa/F08-product-crud.md`

## Persistence Path

1. Restore `withActiveCategoryRowLock` to the implementation immediately before commit `a9a721b4e`:
   - acquire the per-Payload-pool mutation gate;
   - open a dedicated pool client and `BEGIN`;
   - set the existing two-second `lock_timeout`;
   - select the active tenant category `FOR KEY SHARE`;
   - call the Product operation without a Payload transaction request;
   - commit the lock transaction after the Product operation settles;
   - rollback/release on every error.
2. Because no `req.transactionID` reaches `saveProduct`, retain its existing `disableTransaction:true` create and independent `findByID` verification from GH-1410.
3. After the lock helper returns, run an authoritative tenant-scoped `payload.find` outside any transaction and require exact Product ID, stable slug, `status:'draft'`, `aiReviewPending:true`, non-deleted state, and the requested category.
4. Produce a correlated discriminated outcome:

```ts
type AiProductSaveResult =
  | { ok: true; productId: string | number; outcome: 'created' | 'replayed'; referenceId: string; /* Phase 1 legacy Product fields */ }
  | { ok: false; code: AiSaveErrorCode; message: string; retryable: boolean; referenceId: string }
```

   Phase 1 intentionally retains the serialized Product fields and legacy `id` on
   success because the current drawer still checks `res.id`. Existing SKU/category
   busy/save failures also remain thrown so the drawer's established retry and
   partial-batch behavior is not regressed. Phase 2 changes the consumer to
   `result.ok`, settles those expected failures into the minimal union, and then
   removes this compatibility shape.

5. Preserve the existing stable-slug replay lookup. A matching committed row returns `replayed`; a category mismatch remains terminal.

## Bounded Waits

- Add a mutation-gate acquisition timeout (target: five seconds) with safe removal of the timed-out waiter and FIFO handoff for remaining waiters.
- Keep the existing two-second database category lock timeout and map it to `CATEGORY_BUSY_RETRY`.
- Do not add a client timeout or race an already-started Product write. Product/network rejection remains an unknown outcome and is reconciled by the same stable slug on retry.

## Correlation and Logging

- `products-bulk-parse` generates and returns `generationId` with the previews.
- Each save generates `referenceId`; UI passes validated `{generationId, operationId, skuAttempt}` where `operationId` must match the stable slug suffix.
- Log each attempt with tenant ID, user ID, generation/reference/operation IDs, attempt, category ID, variant count, duration, stage, outcome, and normalized cause.
- Never log Product name, SKU values, description, prompt, raw payload, or full user object.
- Capture handled persistence verification failures directly in Sentry; avoid duplicate console-capture events.

## Tests and Acceptance

Register TC-F08-04-120..122 as `[x] AUTO`:

- [x] Restored lock holds through auto-committed Product operation and always releases client/gate.
- [x] Gate and row-lock timeouts settle with retryable codes.
- [x] Create calls `disableTransaction:true`; missing independent read returns `PERSISTENCE_VERIFY_FAILED` with reference ID.
- [x] Wrong ID/tenant/slug/status/review/category/deleted row cannot return success.
- [x] Same stable slug replays the same ID and does not call create twice.
- [x] Generation/reference telemetry is correlated and PII-safe.
- [x] Manual `saveProductAction` behavior is unchanged.

## Verification — 2026-08-05

- Static implementation review: PASS after fixing end-to-end correlation metadata and replay-failure observability.
- Focused Vitest: 3 files, 122/122 tests passed (`category-row-lock`, `save-product-action`, `bulk-create-save`).
- `npx next lint --no-cache`: PASS with repository-existing warnings only.
- `src/__tests__/api/ai.test.ts`: blocked at collection by missing `pinyin-pro` in root-owned `node_modules`; no assertion failed. Dependency sync was attempted and rejected with `EACCES`.
- `npm run typecheck`: blocked only by declared packages missing from the same root-owned install plus the downstream implicit-any caused by unresolved `pdfjs-dist`; no Phase 1 file error was reported.
- No collection schema, migration, environment variable, or new route was added.
