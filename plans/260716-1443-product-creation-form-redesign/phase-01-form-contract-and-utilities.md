# Phase 01 — Form Contract and Shared Utilities

## Context Links

- [Overview](./plan.md)
- `src/components/dashboard/product-form/schema.ts`
- `src/components/dashboard/product-form/ProductForm.tsx`
- `src/app/(dashboard)/products/new/page.tsx`
- `src/app/(dashboard)/products/[id]/page.tsx`
- `src/app/(dashboard)/products/actions.ts`
- `src/lib/products/publish-guard.ts`

## Overview

- Priority: P1
- Status: Pending
- Effort: 3h

Establish a correct shared form contract before changing layout. Status must round-trip in both create and edit flows. Content Strength calculation and domain display must be deterministic and testable.

## Key Insights

- `ProductFormValues.description` is currently a string. `textToLexical()` runs only before persistence.
- Payload already has `status: draft | active | archived`; no collection edit or migration is needed.
- `saveProductAction` already applies `productPublishBlocks()` when incoming status is Active.
- The shared form is used by both `/products/new` and `/products/[id]`; create-only status wiring is incomplete.
- Status recommendations must not duplicate or weaken the server publishing gate.

## Requirements

### Form status

- Add `status: z.enum(['draft', 'active']).default('draft')` to the client form schema.
- Add `status: 'draft'` to new-form default values.
- Hydrate edit form with persisted Draft/Active without treating Archived as Draft.
- Before implementation, trace schema parsing, default-value hydration, dirty-field behavior, and server-action update semantics for an existing Archived record. Lock one safe behavior based on evidence: (a) preserve Archived when status is untouched while allowing other edits, or (b) block the edit/status transition with explicit guidance. The two-choice UI must not silently coerce Archived to Draft/Active, and the plan must not assume preservation works until verified.
- Send status from both create and edit payloads.
- Keep server publishing gate authoritative.

### Content Strength calculation

Create a pure helper returning `score` and checklist state. Five equally weighted checks:

1. At least 3 uploaded images.
2. Trimmed name length between 25 and 100 characters inclusive.
3. Trimmed Description string length at least 100 characters.
4. At least one category ID.
5. Shipping complete: weight, length, width, and height are finite numbers greater than zero.

Rules:

- Score is advisory only: `passedChecks * 20`.
- Do not stringify or parse Lexical JSON in the widget.
- Treat `undefined`, empty strings, `NaN`, and non-positive shipping values as incomplete.
- Keep recommendation thresholds separate from Zod validation and `productPublishBlocks()`.

### URL preview domain

Resolve display prefix in this order:

1. Active primary custom domain.
2. Existing site domain.
3. Tenant slug plus configured platform domain.
4. `yourstore.com` display fallback.

Pass the resolved value into `ProductForm`; do not fetch domain data independently inside each sidebar widget. Normalize away protocol and trailing slash, then render:

```text
{domain}/products/{slug-or-placeholder}
```

Preview is muted text, not a clickable link before persistence.

## Related Code Files

### Modify

- `src/components/dashboard/product-form/schema.ts` — add status form field.
- `src/components/dashboard/product-form/ProductForm.tsx` — defaults and new domain prop.
- `src/app/(dashboard)/products/new/page.tsx` — provide domain context and submit status.
- `src/app/(dashboard)/products/[id]/page.tsx` — hydrate/preserve/submit status and provide domain context.

### Create

- `src/lib/products/content-strength.ts` — pure scoring helper and types.
- `src/lib/products/product-url-preview.ts` — small URL display normalizer if no suitable shared domain helper exists.

### Reuse

- `src/lib/products/publish-guard.ts` — authoritative Active gate; do not change its rules in this feature.

## Implementation Steps

1. Audit the existing site/tenant data available to create and edit pages before adding any request.
2. Extend the Zod form schema and default values with Draft/Active status.
3. Map status in both persistence paths.
4. Spike the full Archived round trip before writing edit mapping. Record whether omission/preservation is supported; otherwise specify an explicit blocking state. Add no fallback coercion.
5. Extract/reuse domain resolution at the nearest shared server/page boundary.
6. Implement pure Content Strength helper with no React dependency.
7. Ensure publish-gate structured errors still flow through `parseServerError()` and field highlighting.

## Todo List

- [ ] Add Draft/Active client schema.
- [ ] Add create defaults.
- [ ] Verify and implement the safe Archived round trip (preserve untouched or explicitly block); test that no coercion occurs.
- [ ] Pass resolved preview domain to shared form.
- [ ] Add pure Content Strength helper.
- [ ] Confirm Active server error mapping remains actionable.

## Success Criteria

- Create status defaults to Draft.
- Edit status matches persisted data.
- Active create/edit payloads reach the existing server gate.
- Archived products are preserved when safely supported, or edits are explicitly blocked; they are never accidentally downgraded or activated.
- Strength helper produces stable 0/20/40/60/80/100 scores.
- No Payload collection file or migration is changed.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Active product displayed/saved as Draft | Hydrate edit status and test round-trip. |
| Archived product silently changes status | Preserve unsupported persisted state or block edit transition explicitly. |
| Client scoring diverges from publish gate | Label score advisory and keep helpers separate. |
| Duplicate domain lookup | Resolve once at page/server boundary and pass a prop. |

## Security Considerations

- Do not trust client status validation; retain `saveProductAction` publishing gate.
- Domain preview must be rendered as text, not inserted as unsanitized HTML.
- Existing authentication and tenant-scoped server actions remain unchanged.
