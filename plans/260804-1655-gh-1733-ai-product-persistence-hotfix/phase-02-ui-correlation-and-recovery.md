# Phase 02 — UI, Correlation and Recovery

**Status:** completed · **Priority:** P1 · **Migration:** No · **Depends:** Phase 01

## Goal

Make the review drawer reflect only server-verified outcomes and preserve the
Phase 1 correlation IDs through explicit recovery. Failed or ambiguous previews
remain retryable without false success or indefinite local loading.

## Files

**Modify**

- `src/components/dashboard/BulkCreateModal.tsx`
- `src/app/(dashboard)/products/actions.ts`
- `src/app/(dashboard)/products/page.tsx`
- `src/__tests__/unit/actions/save-product-action.test.ts`
- `src/__tests__/unit/dashboard/bulk-create-save.test.tsx`
- `src/__tests__/unit/dashboard/products-ai-open.test.tsx`
- `src/i18n/locales/en.json`
- `src/i18n/locales/ms.json`
- `docs/qa/F08-product-crud.md`

## Behavior

- Build on the Phase 1 plumbing that stores and forwards server `generationId`,
  preview operation ID, and SKU attempt.
- Preserve the server generation ID and client-issued preview operation ID across
  explicit user retries; reject a parse result that does not include the required
  server generation ID.
- Count/remove an item only for `result.ok === true`; never infer success from a truthy legacy document ID.
- On `ok:false`, keep the preview, show the actionable message and short/copyable reference ID, and do not invoke full-success callbacks or close the drawer.
- Retry only `SKU_CONFLICT` automatically within the current three-attempt limit. Category busy, verification failure, save failure, and network ambiguity require an explicit user retry with the same preview ID/slug.
- For mixed batches, remove only verified successes, retain failed items, and refresh Product list once.
- Freeze the slug base when the parsed preview is accepted; later Product-name edits must not change the full retry slug for that mounted preview.
- After full or partial verified success, select/refresh Draft state and clear search/category/sale/low-stock filters that could hide the committed Draft. Product refresh must not wait for an unrelated category refresh.
- `finally` clears local saving state for every settled action/network branch. No `Promise.race`, hidden retry, or claim that a network timeout rolled back the server write.

## Tests and Acceptance

Register TC-F08-04-123..125 as `[x] AUTO`:

- [x] Phase 1 correlation IDs are preserved unchanged through explicit retries.
- [x] Editing Product name after an ambiguous result preserves the original full retry slug.
- [x] Verified refresh clears stale visibility filters and displays the committed Draft.
- [x] Verification failure shows reference ID, no success toast/callback/close, and retains the preview.
- [x] Created and replayed outcomes count exactly once; mixed batches remove only verified items.
- [x] Category busy/save error/network rejection clears loading and offers an explicit safe retry.
- [x] Product refresh failure after verified commit does not resubmit or relabel the save as failed.
- [x] Verified rows are discoverable under Draft without requiring DB/log access.

## Verification

- `bulk-create-save.test.tsx`: 28/28 passed.
- `save-product-action.test.ts`: 92/92 passed.
- `products-ai-open.test.tsx`: 8/8 passed.
- Focused combined run: 128/128 passed.
- `git diff --check`: passed.
- Lint: exited 0 with existing warnings.
- Typecheck: blocked by missing installed modules in the current workspace; no
  Phase 2 type error was established by that environment-blocked run.
