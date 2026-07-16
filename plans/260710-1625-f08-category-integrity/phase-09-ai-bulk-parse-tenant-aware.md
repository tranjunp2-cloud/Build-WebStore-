# Phase 09 — AI Bulk-Parse Tenant-Aware Category (#16)

**PR:** 2 · **Migration:** No · **Priority:** P2 · **Status:** pending · **Depends:** PR-1 merged

## Context

- `src/app/api/ai/products-bulk-parse/route.ts` — system prompt (`:66`, `:98`) forces AI to pick from a HARD-CODED English enum of 13 values (Fashion, F&B, Beauty, …) with rule "category name MUST be in English". This ignores the tenant's real Categories.
- Consumer `src/components/dashboard/BulkCreateModal.tsx` (`:340-361`): tries to match the AI's category string to an existing category by name; if not found it **auto-creates** a new category (`saveCategoryAction({ name: prod.category })`) → junk English categories polluting the tenant tree.

## Overview

Make the AI choose from the tenant's REAL categories: fetch tenant categories, inject `{id, breadcrumbs/name}` list into the prompt, instruct AI to return a real `categoryId` (or null if no good match). Map that id directly onto the created product. Remove the hard-coded enum + auto-create junk path.

## Key Insights

- `withAuth` gives `user` → derive tenantId (first tenant, same pattern as `Categories.beforeChange`). Fetch active categories for that tenant (`deletedAt exists:false`).
- Prompt gets a compact list: `id` + `breadcrumbs` (breadcrumbs already encode hierarchy "Fashion > Shirts"). Ask AI to return `categoryId` matching one of the provided ids, or `null`.
- Consumer change: use returned `categoryId` directly (no name-match, no auto-create). If null → leave product uncategorized (or default) — but product-form requires ≥1 category (Zod min(1)); decide: allow null at bulk stage and require merchant to assign before publish, OR skip category. **Decision: pass through null; BulkCreateModal leaves category empty and merchant assigns before publish** (matches existing draft-first flow). Confirm with product publish-guard.
- Token budget: max_tokens 3000 + large category lists could overflow. Cap injected list (e.g. top N or all if small); most tenants have < 100 categories → fine. Truncate/guard if huge.
- Keep dummy fallback (no API key) but change dummy to return `categoryId: null` instead of English strings.

## Requirements

- Functional: AI returns `categoryId ∈ tenant categories ∪ {null}`. Product created with that id. No junk category creation.
- Backward-compat: if downstream still expects `category` string, keep both or migrate consumer fully.

## Architecture / Data Flow

```
POST bulk-parse:
  tenantId = resolve(user)
  cats = payload.find categories {tenant, deletedAt exists:false} -> [{id, breadcrumbs}]
  systemPrompt += "Choose categoryId from this list or null: [{id, path}...]"
  AI -> products[].categoryId (real id | null)
BulkCreateModal:
  categoryId = prod.categoryId (validated against fetched cats) -> buildSavePayload
  no name-match, no auto-create
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
5. In BulkCreateModal: change type + consumption; validate returned id against the tenant category set; remove auto-create branch.
6. Ensure product creation still satisfies publish flow (draft with null category allowed; merchant assigns before publish).
7. Update AI tests (`src/__tests__/api/ai.test.ts`, bulk-create utils test) for new shape.

## Todo

- [ ] Resolve tenantId + fetch tenant categories in route
- [ ] Inject category list into prompt; remove hard-coded enum
- [ ] Dummy fallback → categoryId null
- [ ] BulkCreateModal: direct categoryId, validate, drop auto-create
- [ ] Update `ParsedProduct` type + `buildSavePayload`
- [ ] Confirm draft-with-null-category allowed by publish-guard
- [ ] Update AI + bulk-create unit tests

## Success Criteria

- AI output category maps to a real tenant category id or null.
- No new junk categories created during bulk import.
- Bulk-created products either carry a valid tenant category or remain uncategorized draft (merchant assigns pre-publish).
- Existing bulk-parse tests updated & green.

## Risk Assessment

| Risk | L×I | Mitigation |
|------|-----|-----------|
| Large category list blows token budget | Low×Med | Cap list; breadcrumbs are short; monitor max_tokens |
| AI returns invalid/hallucinated id | Med×Med | Validate returned id against fetched set; fallback null |
| Null category breaks publish (Zod min(1)) | Med×Med | Confirm draft allows null; require assign before publish; documented decision |
| Consumer type change breaks other callers | Med×Med | Grep `ParsedProduct` / `prod.category` usages before changing |

## Security

- Category fetch scoped to the requesting user's tenant → no cross-tenant leakage into prompt. Rate limit unchanged (5/hr).

## Next Steps

- Phase 10 tests + QA.
