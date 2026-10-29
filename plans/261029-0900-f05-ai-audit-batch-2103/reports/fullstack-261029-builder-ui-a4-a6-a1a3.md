# Builder UI: A4 client, A6, A1/A3 UI (#2103)

Status: done, uncommitted. tsc: only unrelated error in src/components/agent/agent-panel-labels.ts (other agent). vitest src/__tests__/unit/builder 19 files / 360 tests green; api/industries green.

## Changes
- A4: new `src/app/(builder)/builder/new/builder-draft-save.ts`; autosave + manual save send `isDraft:true` + `base` (from `editor-data.draftVersion`, then `x-draft-version`). 409 DRAFT_CHANGED = save error, newer revision kept for next save. Save route untouched.
- A6: option cards use pointer events, only `pointerType==='mouse'` previews; clears on grid leave, card leave, click, form focus. Labels: restaurant "Restaurant / dine-in", fnb "Café / bakery / desserts" (+ms).
- A1: link import tab back (label "Your website, Instagram or Facebook link"); optional buyingMethods/serviceArea/shopFacts (schema + store + form + recovery; sent inside businessInfo); ExtractionReview i18n + testimonial/FAQ counts.
- A1/A3: store `productIds`/`placeholders` from SSE done (defensive); completion view placeholder list + "Finish your shop" CTA -> `/products?todo=products_ai_review`.

## TCs (TC-AIAUD-040..059): see test names in src/__tests__/unit/builder/{business-info-form-preview-and-facts,builder-draft-save,builder-no-user-edits-save-guard,builder-completion,extraction-review}.
