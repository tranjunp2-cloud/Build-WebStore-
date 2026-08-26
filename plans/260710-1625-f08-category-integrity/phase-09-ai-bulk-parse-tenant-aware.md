# Phase 09 — AI Bulk-Parse Tenant-Aware Category (GH-1588 Scope 02)

**PR:** 2 · **Migration:** No · **Priority:** P1 · **Status:** completed · **Depends:** PR-1 merged

## Context

- `src/app/api/ai/products-bulk-parse/route.ts` — system prompt (`:66`, `:98`) forces AI to pick from a HARD-CODED English enum of 13 values (Fashion, F&B, Beauty, …) with rule "category name MUST be in English". This ignores the tenant's real Categories.
- Consumer `src/components/dashboard/BulkCreateModal.tsx` (`:340-361`): tries to match the AI's category string to an existing category by name; if not found it **auto-creates** a new category (`saveCategoryAction({ name: prod.category })`) → junk English categories polluting the tenant tree.

## Overview

Make the AI choose from the tenant's REAL categories: fetch tenant categories, inject `{id, breadcrumbs/name}` list into the prompt, instruct AI to return a real `categoryId` (or null if no good match). Map that id directly onto the created product. Remove the hard-coded enum + auto-create junk path.

## Key Insights

- `withAuth` gives `user` → derive tenantId (first tenant, same pattern as `Categories.beforeChange`). Fetch active categories for that tenant (`deletedAt exists:false`).
- Prompt gets a compact list: `id` + `breadcrumbs` (breadcrumbs already encode hierarchy "Fashion > Shirts"). Ask AI to return `categoryId` matching one of the provided ids, or `null`.
- Consumer change: use a canonical returned `categoryId` directly (no name-match, no auto-create). If it is null/stale, show the existing Category selector in `BulkCreateModal` and block Approve until the merchant selects one. Do not change ProductForm/manual validation or the global publish guard.
- Token budget: max_tokens 3000 + large category lists could overflow. Cap injected list (e.g. top N or all if small); most tenants have < 100 categories → fine. Truncate/guard if huge.
- Keep dummy fallback (no API key) but change dummy to return `categoryId: null` instead of English strings.

## Requirements

- Functional: AI returns `categoryId ∈ tenant categories ∪ {null}`. Every approved AI draft is created with exactly one current tenant category. No junk category creation.
- Contract: migrate the AI route/modal fully to `categoryId`; discard the legacy category-name field.

## Architecture / Data Flow

```
POST bulk-parse:
  tenantId = resolve(user)
  cats = payload.find categories {tenant, deletedAt exists:false} -> [{id, breadcrumbs}]
  systemPrompt += "Choose categoryId from this list or null: [{id, path}...]"
  AI -> products[].categoryId (real id | null)
BulkCreateModal:
  canonical AI match is preselected; null/stale result requires merchant selection
  fresh selected-ID validation -> buildSavePayload; no name-match, no auto-create
```

## Related Code Files

**Modify:**
- `src/app/api/ai/products-bulk-parse/route.ts` — resolve tenantId; fetch tenant categories; inject list into prompt; replace enum rules (`:66`, `:98`) with "return categoryId from provided list or null"; update dummy fallback to `categoryId: null`. Guard prompt size.
- `src/components/dashboard/BulkCreateModal.tsx` — replace name-match + auto-create block (`:340-361`) with direct `categoryId` use (validate it exists in fetched categories; else null). Update `ParsedProduct` type (`:33` `category: string`) → `categoryId?: string|number|null`. Update `buildSavePayload` (`:120`, `:182`) accordingly.

**Read for context:** `Categories.beforeChange` tenant logic (`Categories.ts:95-135`), `BulkCreateModal.tsx:120-185`.

**No migration.**

## Implementation Steps

1. Resolve tenantId in route from `user`.
2. `payload.find` categories (tenant, non-deleted), map to `{id, path: breadcrumbs || name}`; cap list size.
3. Rewrite prompt category section: provide the list; require `categoryId` (exact id from list) or `null`; drop "MUST be English" + enum.
4. Update dummy fallback objects to `categoryId: null`.
5. In BulkCreateModal: change type + consumption; canonicalize against categories already loaded for the tenant; remove auto-create.
6. Render the existing single-select Category control per AI draft, disable Approve while any item is unresolved, and revalidate all selected IDs before media/product writes.
7. Block AI parsing when the tenant has no active category and link the merchant to Category management.
8. Keep partial-save modal state mounted during pending/failed product-list refreshes, ignore stale refresh responses, and only clear the prompt belonging to the completed AI session.
9. Update API, modal unit, and Playwright tests for the new shape and required-selection flow.

## Todo

- [x] Resolve tenantId + fetch tenant categories in route
- [x] Inject category list into prompt; remove hard-coded enum
- [x] Dummy fallback → categoryId null
- [x] BulkCreateModal: canonical categoryId, required selector, no auto-create
- [x] Update `ParsedProduct` type + `buildSavePayload`
- [x] Abort before save side effects if any selected category becomes unavailable
- [x] Canonicalize/deduplicate selected IDs and reject malformed IDs before Payload lookup
- [x] Update AI + bulk-create unit tests
- [x] Block parsing with a Category-management CTA when no active category exists
- [x] Preserve unsaved modal drafts across pending/failed refreshes, ignore stale responses, and preserve newer prompt text across older-session completion

## Success Criteria

- AI output category maps to a real tenant category ID or null.
- Null/stale results cannot be approved until the merchant selects an existing category.
- No new junk category and no uncategorized AI-created product is saved.
- Existing manual Add/Edit Product validation remains unchanged.
- A tenant with zero active categories cannot start parsing and is directed to Category management.
- Partial saves retain unsaved drafts in the modal even if refresh fails; stale partial responses cannot overwrite the final list; an older AI session cannot clear newer prompt text.

## Risk Assessment

| Risk | L×I | Mitigation |
|------|-----|-----------|
| Large category list blows token budget | Low×Med | Cap list; breadcrumbs are short; monitor max_tokens |
| AI returns invalid/hallucinated id | Med×Med | Canonicalize to null and require merchant selection before Approve. |
| Category disappears during review | Med×High | Fresh selected-ID lookup; clear unavailable selection and abort before all save side effects. |
| Failed/stale product refresh or an older AI completion destroys current review/input state | Med×High | Keep background failures non-fatal, apply only the latest refresh response, and clear only the submitted prompt snapshot. |
| Consumer type change breaks other callers | Med×Med | Grep `ParsedProduct` / `prod.category` usages before changing |

## Security

- Category fetch scoped to the requesting user's tenant → no cross-tenant leakage into prompt. Rate limit unchanged (5/hr).

## Next Steps

- Phase 10 tests + QA.
