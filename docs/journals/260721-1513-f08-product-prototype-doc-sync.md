---
date: 2026-07-21 15:13
severity: medium
component: F08 Products CRUD documentation
status: resolved
---

# F08 Product Prototype Documentation Sync

## What Happened

We synchronized the F08 PRD, stories, design, and architecture documents with the approved Add Product prototype. We also produced the implementation plan at `plans/260716-1443-product-creation-form-redesign/`, which remains untracked. This session changed documentation only; no product code, schema, migration, tests, or QA artifacts were changed.

## The Brutal Truth

The documentation had drifted far enough to describe a different form: modal-oriented structure, vague variant behavior, and no reliable contract for sticky navigation or fixed actions. That is frustrating because ambiguity here does not stay harmless—it becomes four slightly different implementations and a week of avoidable rework. The sync fixed the written contract, but it did not prove the UI works.

## Technical Details

The contract now specifies an approximately 70/30 desktop main/sidebar layout, four sticky tabs (`Basic Info`, `Pricing & Stock`, `Shipping & Delivery`, `More Information`), and fixed bottom actions (`Cancel`, `Save draft`, `Publish`) with reserved content space. Content Strength is advisory: five equal 20-point checks for at least three images, a 25–100 character trimmed name, a description of at least 100 trimmed characters, a selected category, and four finite positive shipping dimensions.

Slug editing is summary-first: create may auto-generate from name, but manual edits must never be overwritten. Category selection is searchable L1 → L2 → L3 and leaf-only. Variants are the stable-key Cartesian product of at most two option groups; surviving SKU/price/stock values must persist, bulk apply patches only selected fields, and images map exclusively by Option 1.

## What We Tried

- Updated all four F08 sources together instead of patching one document and leaving contradictions elsewhere.
- Rejected schema/API expansion: this prototype is explicitly UI-only.
- Rejected silently mapping persisted `Archived` records to `Draft` or `Active`.

## Root Cause Analysis

The earlier documents were written around an outdated interaction model and lacked state-preservation invariants. The real mistake was treating visual redesign language as sufficient specification for destructive form state.

## Lessons Learned

Document identity, persistence, and boundary rules beside the wireframe. A polished mockup without those contracts is not implementation-ready.

## Next Steps

- Implementation owner: trace Archived hydration, dirty-state parsing, and submit behavior before coding; choose preserve-when-untouched or explicitly block editing.
- Product/frontend owner: implement only after the untracked plan is reviewed and committed.
- QA owner: no action from this sync; QA and test execution were explicitly excluded and require a separate task.
