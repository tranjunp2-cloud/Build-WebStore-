# Phase 02 — Responsive Layout and Section Composition

## Context Links

- [Overview](./plan.md)
- [Phase 01](./phase-01-form-contract-and-utilities.md)
- `src/components/dashboard/product-form/ProductForm.tsx`
- `src/components/dashboard/product-form/GeneralInfoSection.tsx`
- `src/components/dashboard/product-form/DescriptionSeoSection.tsx`
- `src/components/dashboard/product-form/ShippingDimensionsSection.tsx`

## Overview

- Priority: P1
- Status: Pending
- Effort: 6h
- Depends on: Phase 01

Recompose the shared form into a responsive main/sidebar layout while preserving all current behaviors.

## Architecture

```text
ProductForm
├── Header
├── responsive 7fr / 3fr content grid
│   ├── Main column
│   │   ├── Sticky anchor tabs (4 items)
│   │   ├── Basic Info
│   │   │   ├── Media / Images
│   │   │   ├── Product Name
│   │   │   ├── Compact URL Slug disclosure + preview
│   │   │   ├── Category dialog trigger
│   │   │   └── Product Description
│   │   ├── Pricing & Stock
│   │   ├── Shipping & Delivery
│   │   └── More Information
│   │       ├── Specifications
│   │       └── SEO Settings
│   └── Sidebar
│       ├── Product Content Strength
│       └── Product Status
└── Fixed bottom action bar
```

Use an approximately 70/30 grid only when enough width exists. The implementation may use the agreed three-column composition where it better matches the existing Tailwind layout:

```tsx
className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start"
// Main: lg:col-span-2; Sidebar: lg:col-span-1 sticky top-6
```

The desktop sidebar is sticky and contains only two short cards so it remains within the viewport. Disable sticky behavior when the layout stacks. Verify it never collides with the fixed action bar.

### Sticky anchor navigation

- Render a full-width sticky tab row at the top of the main column.
- Use four tabs and mappings:
  - `Basic Info` → `#section-general`
  - `Pricing & Stock` → `#section-variants`
  - `Shipping & Delivery` → `#section-shipping`
  - `More Information` → `#section-specifications`
- Use smooth programmatic scrolling with a measured offset derived from the sticky navigation height.
- Track the active tab during manual scrolling. A section becomes inactive as soon as its bottom passes the sticky navigation boundary.
- During click-driven smooth scroll, keep the clicked tab active until the target is reached so observers do not restore the previous tab mid-animation.
- Treat Specifications and SEO Settings as one active `More Information` range even though they remain separate cards.
- Add enough trailing scroll space so the final group can align below the sticky navigation.

## Functional Requirements

### Basic Info

- Keep Media / Images as the first subsection inside the card.
- Keep Product Name.
- Move URL Slug directly below Product Name using the prototype's compact disclosure contract: summary/preview is always legible, the editable field is revealed by an explicit control, and disclosure state is presentation-only (it must not clear or mutate the value).
- Show muted storefront URL preview in the compact row and while expanded.
- Preserve name-to-slug auto-generation for create mode.
- Once the user manually edits the slug, subsequent name edits must not overwrite it; verify existing behavior and add a dirty/touched guard if necessary. A later AI slug proposal may replace the manual slug only after an explicit accept/apply action, after which the accepted value remains manual/touched.
- Place Category below URL Slug.
- Keep Description as a plain textarea with “Write with AI”. Show the live character count inside the bottom-right corner of the textarea.

### Media

- Preserve maximum 5 images and the existing validation/fallback semantics.
- Use an upload icon above the Upload text; do not show a plus icon.
- Keep the media area compact after upload: thumbnails remain the primary surface and ALT editing is disclosed per image rather than reserving a permanent full editor.
- Show `+ Add Alt text` on images without ALT; show a compact truncated ALT summary plus pencil/edit affordance when ALT exists.
- Open the same compact anchored popover for add/edit, with a 125-character textarea, counter, helper text, Cancel, and Save. Cancel restores the persisted/form value; Save updates only that image; closing must not accidentally commit draft text.
- Show the general ALT helper only when uploaded images are present and the compact ALT controls are relevant.

### Pricing & Stock

- Reuse existing `MasterFieldsSection` and `VariantOptionsSection` in one visual card. If composition needs a component, create only a thin wrapper; do not add or resurrect a monolithic `VariantsInventorySection` that duplicates their state/effects.
- Preserve completed GH-1525 behavior, including SKU regeneration and master-field locking.
- Keep Price, Compare price, SKU, and Inventory in the non-variant state.
- Add an accessible tooltip beside Compare price explaining that it is the original struck-through price used to communicate a discount.
- When Has Variants is enabled, hide the master price/stock fields and reveal Variant Tiers configuration.
- Support a maximum of two option groups in the UI. Variant rows reactively equal the Cartesian product of the non-empty option values, subject to all existing stricter production caps and validation; this redesign must not raise any current limit.
- Give each logical combination a canonical stable key derived from option-group identity/value identity (not array index or display order). On value rename/removal/reorder, reconcile by stable key: retain price/SKU/inventory/image data for surviving logical rows, initialize only new rows, and remove only combinations that no longer exist.
- Group variant rows by Option 1. Render the shared image selector/uploader once at the Option 1 group level and apply that image to rows in that group. Option 2 refines combinations but must never render its own image control.
- Bulk Apply must name its scope before implementation: it applies the chosen fields to all currently generated visible combinations (including rows across Option 1 groups), never changes option names/values/images, and never affects future combinations. Explicit per-row edits made after bulk apply win; a later confirmed bulk apply overwrites only the fields selected in that operation.

### Shipping & Delivery

- Keep responsive layout: 1 column by default, 2 columns at medium width, 4 only at a verified wide breakpoint.
- Do not use unconditional `grid-cols-4`.
- Keep Weight required and dimensions behavior unchanged.

### Product Content Strength

- Use `useWatch` with only the five relevant field groups.
- Call the pure Phase 01 helper.
- Render score, progress bar, and accessible checklist.
- Use semantic progress attributes (`role="progressbar"`, min/max/current).
- Do not trigger form validation or submission.

### Status

- Expose Draft and Active.
- Make copy clear that Active publishes to the storefront.
- Update save-button label according to action, e.g. “Save Draft” versus “Publish Product”; edit may use “Save Changes” with visible status.
- Keep pending and disabled states while saving.

### Category picker

- Keep Category in Basic Info, not the sidebar.
- Use singular placeholder `Select category...`.
- Open a dialog with a full-width `Search category...` field and search icon.
- Present three visible hierarchy columns (L1 → L2 → L3), selected states, selected breadcrumb, Cancel, and Confirm.
- Preserve leaf-only single-select behavior and error anchor `id="categoryIds"` in production code.

### Specifications

- Keep existing dynamic Key/Value Attributes behavior in a full-width main-column card.
- Preserve add/remove actions and the 20-row limit. Rows need stable client keys: editing/removing/reordering one row must not shift another row's key/value state or focus because an array index was reused as identity.

### SEO Settings

- Extract Meta Title, Meta Description, and existing AI Optimization behavior.
- URL Slug no longer appears here.
- Preserve current limits and error rendering.
- Render Meta Title and Meta Description as two separate full-width rows.

## Related Code Files

### Modify

- `src/components/dashboard/product-form/ProductForm.tsx`
- `src/components/dashboard/product-form/GeneralInfoSection.tsx`
- `src/components/dashboard/product-form/ShippingDimensionsSection.tsx`
- `src/components/dashboard/product-form/AttributesSection.tsx`
- `src/components/dashboard/product-form/DescriptionSeoSection.tsx` — retire after behavior is fully extracted.

### Create

- `src/components/dashboard/product-form/MediaSection.tsx`
- `src/components/dashboard/product-form/ProductContentStrength.tsx`
- `src/components/dashboard/product-form/StatusSection.tsx`
- `src/components/dashboard/product-form/SearchOptimizationSection.tsx`
- `src/components/dashboard/product-form/ProductFormAnchorNav.tsx` if navigation logic is clearer as a focused component/hook.

### Delete after verification

- `src/components/dashboard/product-form/DescriptionSeoSection.tsx` only after all Description and SEO AI actions are preserved in their new owners.

## Implementation Steps

1. Extract sections behavior-preservingly before changing the outer grid.
2. Move Description AI logic with Description; move SEO AI logic with SEO.
3. Add Status sidebar component and keep Category in Basic Info.
4. Add Content Strength widget using the pure helper.
5. Recompose `ProductForm` into main/sidebar grid with only Strength and Status in the sidebar.
6. Add four-tab sticky anchor navigation, measured scrolling offset, click lock, and active-range tracking.
7. Add/retain Category dialog and image ALT popover interactions.
8. Extend the existing split variant components with reactive two-option Cartesian reconciliation, stable row keys, Option 1 image groups, and the documented bulk-apply contract.
9. Ensure specification rows also use stable field-array identity.
10. Adjust shipping breakpoint based on actual main-column width.
11. Verify fixed action bar stacking, trailing scroll space, error focus, and sticky offsets.
12. Remove obsolete section only after imports and tests confirm parity.

## Todo List

- [ ] Extract Media.
- [ ] Extract Description and SEO without losing AI actions.
- [ ] Reuse/wrap the existing split variant components without recreating a monolith.
- [ ] Implement reactive Cartesian rows (maximum two option groups) while preserving production caps and stable row data.
- [ ] Group images by Option 1, omit image controls from Option 2, and implement documented bulk-apply scope/precedence.
- [ ] Add Status sidebar and keep Category in Basic Info.
- [ ] Add Content Strength widget.
- [ ] Apply responsive approximately 70/30 grid using the verified three-column composition.
- [ ] Add four-tab sticky anchor navigation and active-state tracking.
- [ ] Implement/verify Category hierarchy dialog.
- [ ] Implement/verify image ALT add/edit popover.
- [ ] Add Compare price tooltip.
- [ ] Tune Shipping responsive breakpoints.
- [ ] Verify fixed save bar and sticky behavior.

## Success Criteria

- Layout stacks cleanly before sidebar controls become cramped.
- All existing form behaviors survive section extraction.
- Content Strength updates without visible input lag.
- Status copy and submit button communicate Draft versus Active behavior.
- Sidebar never hides behind the fixed save bar.
- Clicking any anchor scrolls to the correct card and keeps the clicked tab active throughout smooth scrolling.
- Manual scroll changes the active tab immediately after the previous section passes the sticky boundary.
- More Information remains active across both Specifications and SEO Settings.
- Variant row reconciliation retains surviving row edits and never leaks state between stable keys.
- Option 1 owns group imagery; Option 2 has no image control; confirmed bulk apply follows its explicit scope and precedence.
- Keyboard navigation follows a logical main-to-sidebar order.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| AI Description/SEO action lost during split | Move handlers with their fields and add regression tests. |
| Four shipping inputs become too narrow | Use responsive breakpoint verified against actual container width. |
| Sticky widget overlaps fixed save bar | Bound height/offset or disable sticky at affected viewport sizes. |
| Slug auto-generation overwrites manual edit | Track touched/dirty state and stop auto-sync after manual change. |
| Observer restores the previous active tab during smooth scroll | Lock the clicked target until the target offset is reached or the scroll settles. |
| Final anchor cannot reach the sticky offset | Add bounded trailing scroll space and test the final section. |
| Reactive Cartesian regeneration destroys entered row data | Reconcile against canonical stable keys and test add/remove/rename/reorder transitions. |
| New wrapper duplicates existing variant effects | Keep `MasterFieldsSection` and `VariantOptionsSection` as state owners; wrapper is layout-only. |

## Accessibility and Performance

- Keep visible labels and error associations.
- Ensure custom Category select remains keyboard reachable; do not regress existing behavior.
- Progress state must not rely on color alone.
- Subscribe with targeted `useWatch`, not the entire form object.
- Memoize derived checklist only if profiling shows meaningful rerenders; avoid premature optimization.
