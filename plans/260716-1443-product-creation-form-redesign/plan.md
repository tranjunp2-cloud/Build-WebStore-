---
title: "Product Creation Form 70/30 UI/UX Redesign"
description: "Restructure create/edit product forms into a responsive 70/30 layout with sticky section navigation, a compact status sidebar, and real-time content-strength guidance."
status: pending
priority: P1
effort: 12h
branch: feat/audit-redesign-solution-add-product
tags: [feature, frontend, products, ux, i18n]
blockedBy: []
blocks: []
created: 2026-07-16
---

# Product Creation Form 70/30 UI/UX Redesign

> **Implementation status: Not started.** This plan and its linked HTML prototype define the approved contract only. Production code, localization, automated tests, and QA remain pending for subsequent phases/issues; no phase or implementation checklist is complete in this documentation PR.

## Overview

Reorganize the shared Product form into an approximately 70/30 responsive layout. Keep all product input sections in the main column and reserve the compact sticky sidebar for Product Content Strength and Product Status only. Add four sticky anchor tabs for navigating the long form. Support both create and edit flows without changing the Payload product schema.

## Locked Decisions

1. Layout is approximately 70/30 and may use the agreed three-column grid (`main: col-span-2`, `sidebar: col-span-1`) when it matches the production container; exact ratios must be visually verified.
2. Sidebar contains only Product Content Strength and Product Status, remains sticky on desktop, and stacks below main content before it becomes cramped.
3. Description remains a plain string in React Hook Form. Lexical conversion continues only at persistence boundaries.
4. Status works in both create and edit flows. UI exposes Draft and Active only. An existing Archived value is an unsupported UI state: implementation must first verify whether it can be preserved on an otherwise valid edit or whether the edit/transition must be blocked. It must never be silently coerced to Draft or Active.
5. Content Strength is advisory. It never blocks Draft save, Active publish, or form submission.
6. Shipping remains responsive: 1 column mobile, 2 columns medium, 4 columns only when the main column is wide enough.
7. URL preview uses the real resolved storefront domain when available; `yourstore.com` is display-only fallback.
8. No collection/schema or SQL migration is required.
9. Main-column navigation has four labels: `Basic Info`, `Pricing & Stock`, `Shipping & Delivery`, and `More Information`.
10. `More Information` anchors to Specifications and stays active through both Specifications and SEO Settings.
11. The fixed bottom action bar remains visible while scrolling and must not cover the final fields.
12. Slug uses compact progressive disclosure: keep the URL row collapsed/summary-first by default, expose editing through the explicit slug control, retain live storefront preview, and never overwrite a manually edited slug through name auto-sync. An AI slug proposal may replace it only after explicit user acceptance.
13. Variants remain implemented by the existing split `MasterFieldsSection` + `VariantOptionsSection` (optionally inside a thin visual wrapper). Do not recreate the retired monolithic variant editor.
14. Reactive variant generation is the Cartesian product of at most two option groups, while all stricter existing production caps (values, combinations, images, and validation) remain authoritative.

## Cross-Plan Dependencies

| Related plan | Relationship | Notes |
|---|---|---|
| [GH-1525 Product Detail + List UX](../260708-1525-product-detail-list-ux/plan.md) | Related, not blocking | Its completed phases already produced `MasterFieldsSection` and `VariantOptionsSection`; reuse them. Pending list work is disjoint. |
| [F08 Category Integrity](../260710-1625-f08-category-integrity/plan.md) | Related, not blocking | This plan preserves the existing single-select `CategorySelect` behavior. |

## Phases

| Phase | Name | Status |
|---|---|---|
| 1 | [Form contract and shared utilities](./phase-01-form-contract-and-utilities.md) | Pending |
| 2 | [Responsive layout and section composition](./phase-02-layout-and-sections.md) | Pending |
| 3 | [Tests, localization, and responsive QA](./phase-03-tests-and-qa.md) | Pending |

## Scope

### In scope

- Shared create/edit Product form layout.
- Draft/Active field lifecycle.
- URL slug preview.
- Product Content Strength widget.
- Sticky anchor navigation with smooth scroll and active-section tracking.
- Searchable three-level Category dialog.
- Image ALT add/edit popover flow.
- Compact media/ALT disclosure and variant image grouping behavior from the approved prototype.
- Fixed bottom action bar.
- Section extraction/recomposition.
- EN/MS localization.
- Unit/component tests and responsive manual QA.

### Out of scope

- Payload collection field changes or database migrations.
- Replacing the current Description textarea with a Lexical editor.
- Archived status selection.
- Changing server publishing-gate rules.
- Changing Category data integrity or hierarchy behavior.
- Persisting Content Strength scores.

## Success Criteria

1. Create and edit forms render correctly at 375px, 768px, 1024px, and wide desktop sizes.
2. Existing product status hydrates correctly and Draft/Active changes persist through `saveProductAction`.
3. Active publish failures retain form state and show actionable missing-field feedback.
4. Content Strength updates in real time without blocking submission.
5. URL preview follows the storefront domain resolution order and updates with the slug.
6. Category remains single-select.
7. Existing variant, SKU, image ALT, AI description, and SEO generation behavior remains intact, including production caps.
8. Sticky tabs scroll to the correct section and keep the correct active state for click-driven and manual scrolling.
9. Specifications and SEO remain separate cards under one `More Information` navigation state.
10. Typecheck, lint, targeted unit tests, and Product E2E flow pass.
11. Variant rows reactively represent the stable-key Cartesian product of up to two option groups: surviving rows retain user-entered values; Option 1 controls image grouping; Option 2 never renders an image control; bulk apply has documented scope and precedence.
12. Existing Archived products cannot be silently changed merely by opening or saving this form.
