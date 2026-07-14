# GH-1621: Editor Publish Fails 409 — Portfolio Grid Projects Missing Required Title

**Date**: 2026-07-14 14:44 (corrected 15:30 after adversarial code review pre-PR; corrected again 17:15 after `/code-review #1629` post-PR — see both "Correction" sections below, read them before trusting the rest of this entry)
**Severity**: Critical (P0, blocks AI-generated sites from publishing)
**Component**: AI image injection pipeline + Payload page draft validation boundary
**Status**: Fixed, reviewed twice, all confirmed findings resolved, PR #1629 open against `staging`. Sanitizer runs at publish-time only (not every autosave) after Correction #2 below.

## Correction (260714 15:30, after adversarial code review — READ THIS FIRST)

The rest of this entry was written right after implementing the fix, based on GH-1621's own root-cause writeup (media-injector.ts padding). A `/code-review` pass on the pending diff — specifically the adversarial (Stage 3) reviewer — found that claim doesn't hold up against the current code, and I verified it myself before accepting it:

**`media-injector.ts`'s padding fix has exactly one caller in the whole repo: `generate-site/route.ts`.** That route creates pages with `_status: 'published'` directly (`route.ts:1051`, `:1101`, `:1231` — grep-confirmed, no `draft: true` passed anywhere). A non-draft Payload create runs **full required-field validation immediately** — the draft-validation-skip only applies to actual draft saves (`versions.drafts.autosave`). So if the old padding logic had ever produced a title-less `portfolio-grid.projects[]` item, `payload.create()` would have thrown a `ValidationError` **at generation time**, caught by the per-page try/catch, and that page would fail/skip generation — not silently succeed and only 409 later at a separate Publish click. That's the opposite of GH-1621's reported symptom (site 430 exists, page 3710 opens fine in the editor, only Publish fails).

On top of that: `generate-site/route.ts` already has its own **separate, pre-existing, untouched** portfolio-grid title fallback (`sanitizeBlocksForPayload`, `route.ts:2358-2365`, added 2026-07-10 in PR #1581) that runs *after* image injection, for both the homepage and every subpage. So even setting the draft-vs-published question aside, this route had a second independent guard the padding fix never touched.

**What this means:**
- The `media-injector.ts` change is still correct to keep — removing padding-with-empty-objects is good hygiene and protects any *future* caller of `planImageNeeds` that might not have generate-site's downstream safety net. It's defense-in-depth, not harmful.
- But it is **not a confirmed fix** for the actual Sentry incident. I (and the original debugger investigation, and GH-1621's own writeup) overclaimed this.
- The **`edit-block/route.ts` + `normalize-required-titles.ts` change — the one I initially treated as a "bonus" — is the one with a confirmed live mechanism.** `update_block`/`update_multiple_blocks` apply the AI's `changes` directly to an *already-existing* page with no validation step, and the editor then autosaves that as a draft (which *does* skip required-field validation). That's the actual "silent draft save, fails later at Publish" path GH-1621 describes.
- **Still unresolved, and now more important than before**: whether page 3710 was actually broken via `edit-block` (plausible, now the leading theory) or some other path neither review considered — nobody in this session had DB access to check page 3710's edit history. Don't close GH-1621 as "root-caused" without that check.

Two real gaps the adversarial review also found and got fixed in the same pass (not part of the original plan):
1. `normalizeChangesRequiredFields`'s portfolio-grid path had no string-shorthand handling (unlike its `service-cards` sibling) — a bare string AI response for a project would've been silently discarded in favor of a generic "Project N" fallback, losing real content. Fixed by moving string normalization into the shared `backfillItemTitles()` helper. (`normalize-required-titles.ts`)
2. The new portfolio-grid regression test in `media-injector.test.ts` asserted `title` was always non-empty on items whose titles were never touched by the code under test — a passing-either-way assertion that didn't prove what its own comment claimed. Rewritten to test what the function actually does (never pads, never touches `title`).

**The meta-lesson**: a GitHub issue that says "root cause (đã verify trong code)" with specific line numbers is still a claim, not a fact, until *you* verify it against current code — including tracing the full call chain (is this data path even reachable the way the writeup assumes?), not just confirming the cited lines exist. I verified the two code snippets GH-1621 cited were accurate, and treated that as "root cause confirmed" — but accurate-snippets is not the same as accurate-mechanism. The adversarial review step is what caught the gap; this is exactly why it's a mandatory stage, not a formality.

## Correction #2 (260714 17:15, after `/code-review #1629` on the pushed PR)

The PR (fix + audit + P0.2, all pushed and opened as #1629) went through a full `/code-review` — spec compliance + code-quality + adversarial, two independent reviewers on the full diff. This caught real, code-verified problems that survived the first review round because they were added *after* it. Not a formality either — this is the second time in one fix that a dedicated review pass found something a careful implementation pass missed.

**Critical: `property-card.properties[].title` was missed by my own "fully audited" claim.** It's in `BLOCK_IMAGE_SPEC` (`media-injector.ts`, `minCount: 3`) with a `required: true` title field in `Pages.ts` — the *exact* criterion the audit (Correction/Follow-up above) used to find team/doctor-profile/testimonials. I audited the table and still missed a row. Fixed: added to `REQUIRED_ARRAY_FIELDS`.

**The audit's scope boundary was itself wrong.** I used "blocks in `BLOCK_IMAGE_SPEC`" as the audit universe, because that's what GH-1621's own P1.4 item asked for. But `BLOCK_IMAGE_SPEC` is about *image injection* — it has nothing to do with which blocks have required text fields. Code review found `pricing.plans[].name`+`.price` and `faq.faqs[].question`+`.answer` are both required, both AI-editable (`aiVisible` not `false`), and both entirely outside `BLOCK_IMAGE_SPEC` (no image fields), so they were never going to be found by an audit scoped that way. Decision: **did not rush these in.** `pricing` has 2 required fields including `price` — a fabricated fallback price is actively misleading on a live storefront in a way a fabricated title/name isn't, and needs its own design decision (drop the plan? require price before allowing publish? something else). Documented as a known, out-of-scope gap in the module's own header comment and in the QA doc, recommending a separate issue rather than a rushed fourth pass at "now I've *really* audited everything."

**A real, code-review-confirmed data-loss bug in what I'd built for P0.2.** Two independent reviewers, unprompted, converged on the same root problem from different angles:
- Reviewer A: `sanitizeBlocksRequiredFields()` wired into *every* autosave silently rewrote blank fields on blocks the user wasn't even editing — the client never sees it happen (save response doesn't return the sanitized layout), so a user who clears a field mid-retype, then switches pages or reloads before finishing, comes back to fabricated placeholder content with zero indication anything changed.
- Reviewer B: traced the actual client behavior — `SettingsPanel`'s testimonial fields only commit to store state on `onBlur` (not per-keystroke), and autosave debounces ~3s from the last store change. A user who clears an existing quote to retype it, blurs to tab to another field, then keeps typing for 3+ seconds before blurring again, can have the *entire testimonial* (not just the quote) permanently dropped from the DB by an autosave that fires while they're still composing — invisible until they reload.

Both reviewers, independently, recommended the same fix: **don't run this on every autosave — run it once, at the moment a page's draft is actually promoted to published.** That's the one point where "the user is done editing and wants this live" is actually true. Implemented: removed the sanitizer entirely from `/api/sites/[siteId]/save/route.ts` (reverted to its pre-P0.2 state), added it to `/api/sites/[siteId]/publish/route.ts` instead — right after the existing `stripArrayItemIds`/`normalizeBlocksForPersistence` chain, applied to `data.layout` immediately before `payload.update(..., draft: false)`. This still satisfies P0.2's actual goal (whatever's in a draft by the time someone hits Publish gets sanitized, regardless of whether it got there via AI or manual editing) with none of the mid-edit mutation/loss risk, since nothing runs until the user has explicitly asked to go live.

**A regression in the exact fix pattern this PR itself established.** `sanitizeTestimonialItems` mapped any non-object item straight to `{}` before checking for a quote — so a bare-string AI response (`testimonials: ["Fantastic team, delivered early!"]`, the same no-shape-guidance situation already fixed for `portfolio-grid` via `toFieldObject`) got misread as "no quote" and silently discarded, throwing away real AI-generated content. The PR's own new test (`sanitizeTestimonialItems(['just a string', ...])` expecting the string dropped) *encoded and endorsed* this bug. Fixed: `sanitizeTestimonialItems` now uses the same `toFieldObject()` string-normalization as everything else before checking `quote`.

**`friendlyValidationLocation()`'s nested-array parsing was actively worse than the code it replaced, for a real block.** It assumed exactly one array level (`layout.<i>.<arrayField>.<itemIndex>.<fieldName>`, 5 segments) and used `segments.length >= 5` as the guard. `menu-food`/`menu-display`'s `categories[].items[].name` is genuinely two levels deep (7 segments) — the old guard read `segments[4]` ("items", the *nested array's field name*) as if it were the leaf field, producing a confidently wrong toast like `"Food Menu → Category 2 → items: This field is required."` The pre-PR fallback (`path.split('.').pop()`) would have correctly said `"name"`. Since this PR made the new message *win* over the old fallback whenever the server supplies one, this was a strict regression for that block, not just an imprecision. Fixed: tightened the guard to `segments.length === 5` exactly; anything deeper falls through to the field-name-only case, which is always correct (just less specific about which item) instead of confidently wrong.

**Also fixed, lower severity:** simplified `REQUIRED_ARRAY_FIELDS` back to one-rule-per-block (the `RequiredFieldRule[]` array-of-rules shape was unused speculative generality — every real entry has exactly one required field, testimonials' two-field case was already bespoke — and had a latent bug where a hypothetical second rule's `altFields` lookup could read an earlier rule's already-written fallback text as if it were real content); added `categories`/`testimonials`/`plans`/`faqs` to the pluralization label map (`ARRAY_ITEM_LABELS`) so a toast for those arrays doesn't misfire the naive `/s$/`-stripping fallback.

**The meta-lesson, again, sharper this time**: the first correction was "verify a claim before accepting it." This one is "verify your *own* claim before repeating it in a journal and a PR description." I wrote "audited every block... found 3 more vulnerable blocks" and treated that as closed. It wasn't a lie — I did audit, I did find 3 — but "audited every block [that matched my self-chosen boundary]" quietly became "audited every block" by the time it reached the PR body. A second, independent review pass — on code I'd already convinced myself was complete — is what caught it. This is the concrete case for adversarial review as a mandatory gate rather than a courtesy: the failure mode it catches isn't "sloppy work," it's "confident, careful work with an unexamined boundary."

---

## What Happened

Editor user clicks "Update" (Publish) on an AI-generated site → Sentry: `[Publish] Failed to promote page` (page 3710, site 430). Network response: HTTP 409 (Conflict) from `PATCH /api/sites/{siteId}/publish` with detailed Payload validation error: Portfolio Grid Block 7, Projects 5 and 6 missing required field `title`.

The site had been successfully saved to draft (editor shows no errors, autosaves every 5 seconds worked fine). Only Publish fails, which means the bad data silently passed through the entire AI generation pipeline and sat hidden in the page draft until the moment we tried to promote it to live.

**What makes this infuriating**: this isn't an edge case or a user input mistake. This is data the AI infrastructure itself created, and the draft autosave silently accepted it because Payload's draft validation is a no-op.

## The Brutal Truth

We're running a system where:
1. AI-generated content can contain schema violations
2. The system accepts and saves this corrupt data into drafts because drafts skip required-field validation
3. Developers only discover these violations hours (or days) later when a user tries to publish
4. By that time, three separate code paths have independently tried to patch around the same defect class, creating duplicated, divergent "backfill" logic that nobody sees holistically

This is a confidence killer. If I generate a site via AI, I have zero confidence it will publish on the first try.

## Technical Details

**The bug**: `src/lib/ai/media-injector.ts` (lines 24, 42, 129–148) — the `planImageNeeds()` function walks the block tree to identify which image fields need fetching. For each block type in `BLOCK_IMAGE_SPEC`, it declares:

```javascript
'portfolio-grid': {
  nestedArray: [{ arrayField: 'projects', itemField: 'image', minCount: 6 }],
}
```

The `minCount: 6` was originally intended **solely** for pool-size prefetch planning (used by `computePoolBucketSizes()` to avoid fetching too many images upfront). But the OLD padding code in `planImageNeeds()` was **also** using `minCount` to pad the array with empty objects (`{}`) to reach that count before image injection — a design mistake now 7+ months old. When the AI returns only 2 projects, the old code would:
1. Pad `projects[]` to 6 empty objects
2. Inject images into the first 2 items
3. Leave items 3–6 with ONLY an `image` field, no `title`

But `src/collections/Pages.ts` line 1211 marks the portfolio-grid's `projects[].title` as `required: true`:

```javascript
{ name: 'projects', type: 'array',
  fields: [
    { name: 'title', type: 'text', required: true },  // ← line 1211
    { name: 'description', type: 'textarea' },
    { name: 'image', type: 'upload', relationTo: 'media' },
    { name: 'category', type: 'text' },
    { name: 'linkUrl', type: 'text' },
  ],
}
```

**The validation gap**: Page drafts are saved via `versions.drafts.autosave` (5-second interval) which does NOT run Payload's required-field validation. So padded items with no `title` slide through undetected. Only when Publish runs — via `src/app/api/sites/[siteId]/publish/route.ts` (line 316–333, status logic):

```javascript
const allValidation = failureDetails.every((f) => (f.validationErrors?.length ?? 0) > 0)
return NextResponse.json(
  { success: false, error: { ... } },
  { status: allValidation ? 409 : 500 }  // ← line 333: 409 when ALL are validation errors
)
```

— does it run full schema validation, catch the missing `title`, and return HTTP 409.

**Affected blocks, not just portfolio-grid**: Because `BLOCK_IMAGE_SPEC` applies this same pattern to 10+ block types (gallery: `minCount: 6`, team: `minCount: 3`, products-grid: `minCount: 4`, etc.), **every block type with a `minCount` AND a Payload-required subfield** is vulnerable to the same silent-corruption pattern. The scope is:

- `gallery`: images[].image (no required subfield, safe)
- `portfolio-grid`: projects[].title (required → vulnerable) ✅ **this bug**
- `team`: members[].image (no required subfield, safe)
- `products-grid`: products[].title (if marked required → vulnerable)
- `products-featured`: products[].title (if marked required → vulnerable)
- `property-card`: properties[].title (if marked required → vulnerable)
- `doctor-profile`: doctors[].image (no required subfield, safe)
- And 5 more...

## What We Tried

### Prior partial fix (gh-912, commit ~2026-05-08)

The `src/lib/ai/pages-schema.ts` module exports `sanitizeBlocksForPayload()`, which includes a hardcoded `portfolio-grid` fallback (adds a synthetic title from `project.name` if `title` is missing). This function is called by `src/app/api/ai/apply-template/route.ts` to validate blocks before saving. **But it was never called by the main site generation flow** (`src/app/api/ai/generate-site/route.ts`), so the bug still got through there.

### Later redundant fix (commit 7dbb8d92, PR #1581)

`generate-site/route.ts` got its own **independently-maintained, locally-defined** `sanitizeBlocksForPayload()` function with its own `portfolio-grid` fallback branch — a duplicate of the one in `pages-schema.ts`. Great, now both routes have backfill, right? Wrong: **they're separate copies**. If someone later adds a required field to a different block type, they have to patch both functions separately. And they did.

### Third independent backfill (edit-block route, hardcoded)

`src/app/api/ai/edit-block/route.ts` has `normalizeChangesServices()` + `coerceServiceItems()` — a third, hardcoded-to-one-block-type backfill for service-cards only. Missing `portfolio-grid` entirely. This path wasn't even in scope for the prior two fixes.

**The lesson**: We patched the same defect THREE times, three different ways, in three different modules, and still had a gap. This is technical debt waiting to explode again.

## Root Cause Analysis

### The immediate cause
`src/lib/ai/media-injector.ts` padding logic treated `minCount` as a padding target rather than a pool-sizing hint. Separate concerns got conflated into one configuration value.

### Why it stayed hidden until Publish
1. Payload drafts skip required-field validation for performance (autosave is called every 5 seconds)
2. The bug only violates Payload schema, not the AI's Zod block schema (intentional drift between what AI generates and what Payload stores)
3. No validation hook between image injection and draft save
4. Tests for media-injector exist but don't exercise padding-to-required-field scenarios (coverage gap)

### Why three backfills exist instead of one
The codebase has NO centralized, single-source-of-truth for "when a Payload array-item field is required, how should it be backfilled?" Instead:
- `pages-schema.ts` hardcodes portfolio-grid + special case discovery
- `generate-site/route.ts` duplicates pages-schema.ts locally
- `edit-block/route.ts` hardcodes service-cards only

Each path was patched independently, by different developers, at different times, without realizing the others existed. The bug was noticed in the generate-site path (hitting AI users frequently) but the edit-block path wasn't tested the same way, so it slipped through.

## Lessons Learned

### 1. Draft validation is a false security blanket
When Payload skips required-field validation on drafts for performance reasons, we **must** add a synchronous validation step in between the AI pipeline and draft save, not rely on Publish to catch corruption. Otherwise, this exact pattern repeats for any new required array-item field.

**What to do**: Any code path that touches an array with required array-item fields (media-injector, apply-template, generate-site, edit-block) must run `normalizeChangesRequiredFields()` (or equivalent) **before** saving to draft, not after publishing. This is now non-negotiable for new required fields.

### 2. Consolidate backfill logic into one place, config-driven
Three independently-maintained functions is a code smell. The fix extracts a new module `src/lib/ai/normalize-required-titles.ts` (lines 1–60+) with a `REQUIRED_TITLE_ARRAYS` config map:

```javascript
const REQUIRED_TITLE_ARRAYS: Record<string, { field: string; fallbackPrefix: string }> = {
  'portfolio-grid': { field: 'projects', fallbackPrefix: 'Project' },
  // Add future blocks here, one config line. No code duplication.
}
```

When a new block type needs a required-field backfill, it gets ONE config entry, not three function rewrites.

**Future refactor** (tech debt, not urgent): The gold standard would be to read required fields **directly off the Payload collection schema** (or `src/blocks/block-registry.ts`) instead of maintaining a separate config map. That way adding `required: true` to Pages.ts automatically cascades to backfill logic. This requires rearchitecting how the AI layer references Payload schema.

### 3. minCount is not a padding target
`minCount` in `BLOCK_IMAGE_SPEC` serves **one purpose**: pool prefetch sizing in `computePoolBucketSizes()`. It should never be used for array padding. If a block needs to guarantee N items always present (for layout), that's a separate concern that should be handled by a different code path (e.g., a render-time default or a schema-level `initialValue`), not by the image pipeline.

**What changed**: The padding logic in media-injector is removed entirely. Now only injects images for items the AI actually generated (`count = items.length`, no padding). Render components already handle variable array lengths dynamically (verified in `src/blocks/portfolio-grid`, `gallery`, `team`), so removing padding doesn't break layout.

### 4. Test the gap between code paths
The fact that three backfills existed in parallel suggests testing doesn't adequately cross-check different code paths. Add integration-level tests (or Sentry monitor alerts) that exercise portfolio-grid specifically through each route:
- `/api/ai/generate-site` → AI site gen → draft save → check projects[].title always present
- `/api/ai/apply-template` → template application → same check
- `/api/ai/edit-block` (update_block action) → edit changes → same check

Test the RESULT (what's saved in draft), not just that the endpoint 200s.

## Follow-up (260714 16:10) — completed the full issue scope, not just the fix

After the Correction above, went back and did what GH-1621's own P1 item #4 asked for but hadn't been done yet: audit *every* block in `BLOCK_IMAGE_SPEC` against `Pages.ts`'s `required: true` fields, not just portfolio-grid.

**Found 3 more vulnerable blocks, same defect class, same edit-block entry point:**
- `team.members[].name` (required)
- `doctor-profile.doctors[].name` (required)
- `testimonials.testimonials[].quote` AND `.name` (both required)

All three already had a defensive fallback in `generate-site/route.ts`'s local sanitizer (same "double protection, not the live gap" situation as portfolio-grid) — but were completely unprotected on the confirmed-live `edit-block` path. Extended `normalize-required-titles.ts`'s config table (`REQUIRED_ARRAY_FIELDS`) to cover them — one line each, no new function needed, confirming the config-driven design from Lesson #2 above actually pays off in practice.

**`testimonials` needed a real design decision, not just a config entry.** It has two required fields, and `quote` has no safe generic fallback — inventing fake customer testimony text (`"Great service!"`) to satisfy a required-field constraint is worse than the validation error it replaces (a fabricated review is a trust/compliance problem; a blocked publish is just an inconvenience). Decision: items with no `quote` are **dropped entirely**, not backfilled. `name` still gets the normal generic-fallback treatment (a placeholder reviewer name is harmless). This is a deliberate exception to the "always backfill" pattern — noted here so nobody "fixes" it back to a uniform backfill without understanding why.

**Also implemented P0.2 from the issue** ("validate before draft save, or a sanitizer after media-injector") — this was flagged as not-yet-done in the Next Steps below until now. Added `sanitizeBlocksRequiredFields()` to `normalize-required-titles.ts` — walks a full page layout and applies the same per-block rules to every block at once — and wired it into `/api/sites/[siteId]/save/route.ts`, right after `normalizeBlocksForPersistence()`, before every `payload.update(..., draft: true)`. This closes a gap `normalizeChangesRequiredFields()` (the edit-block-specific entry point) couldn't: **manual editing.** `SettingsPanel.tsx`'s testimonials form lets a user blank out an existing `name`/`quote` via `onBlur` with no required-field enforcement in the UI — that's a second, independent way to produce the exact same silently-corrupt draft, with no AI involved at all. The save-route sanitizer is the one place that catches every path (AI generate, AI edit-block, manual UI edit) at once, which is exactly the "last line of defense" architecture Lesson #1 above argued for.

**Also found while auditing:** `BLOCK_IMAGE_SPEC` has 3 dead entries — `case-study`, `event-card`, `blog-posts` reference blockTypes that don't exist anywhere in `blockRegistry` or `Pages.ts` (never shipped, or removed and the spec entry never cleaned up). And `products-grid`/`products-featured`'s `nestedArray: [{arrayField: 'products', ...}]` spec references a `products` field that doesn't exist on those blocks' actual Payload schema (they pull products dynamically by `category`/`limit` instead of storing an inline array) — so that image-injection spec is a no-op for those two block types. Neither is a required-field vulnerability (nothing can ever populate those non-existent fields), just orphaned config worth cleaning up separately.

## Next Steps

**Current status**: PR #1629 open against `staging`, two full `/code-review` passes done (pre-PR and post-PR), all Critical/High/Medium findings from both fixed:
- P0.1: removed padding logic from media-injector.ts (defensive, not the confirmed live-gap fix — see Correction #1)
- P0.2: `sanitizeBlocksRequiredFields()` runs ONCE, at publish-time (`/api/sites/[siteId]/publish/route.ts`), NOT on every draft autosave — moved there in Correction #2 after review found the autosave-wiring version could silently mutate/drop content mid-edit
- Confirmed-live-gap fix: `normalize-required-titles.ts`, wired into edit-block/route.ts's `update_block`/`update_multiple_blocks` actions — covers portfolio-grid, service-cards, team, doctor-profile, property-card, testimonials
- P1.3: publish toast resolves block/item/page (`friendlyValidationLocation()`), including a fix for doubly-nested arrays (menu-food/menu-display) that the first PR version mis-parsed
- P1.4: audited `BLOCK_IMAGE_SPEC` blocks against `Pages.ts` required fields — found 4 vulnerable blocks total (team, doctor-profile, testimonials in round 1; property-card added in round 2 after code review caught the miss). `pricing`/`faq` identified as a real but out-of-`BLOCK_IMAGE_SPEC`-scope gap, documented, not rushed in — recommend a follow-up issue.
- 45+ new/updated unit + integration test cases across 7 test files
- Full repo test suite: 593 files, 10341 tests, 100% pass, zero regressions (re-verified after every round of changes, including the post-review rework)
- TypeScript: `tsc --noEmit` pass. Lint: 0 warnings.
- QA docs updated (docs/qa/F38-image-provider-multi-source.md + docs/qa/F01-ai-chat-builder.md)

**Only P1.5 and process items remain**:
1. **Merge**: PR #1629 open, mergeable, awaiting approval.
2. **Follow-up issue for `pricing`/`faq`**: not filed yet — both have required array-item fields outside this PR's audit scope; `pricing.plans[].price` specifically needs a design decision before any auto-backfill (a fake price is user-facing-harmful in a way a fake title isn't).
3. **Confirm actual mechanism for page 3710** (still open): check whether the page was ever edited via the in-editor AI chat or manual UI vs. generated once and never touched. Without this, GH-1621's specific Sentry incident should not be treated as fully root-caused — only "the confirmed defect class was found, closed everywhere it's reachable, and audited for siblings (twice)."
4. **P1.5 — Data backfill**: Site 430, page 3710 (and any other already-broken sites) still have corrupt data in production DB. Needs a separate migration/backfill step — requires DB access, not done this session.
5. **Live reproduction**: No manual repro run against real API keys. Unit + integration tests directly exercise every code path instead.

**Future refactors (tech debt, log for later)**:
1. **Consolidate all three-going-on-four backfill functions** (`pages-schema.ts`, `generate-site/route.ts` local, `normalize-required-titles.ts`) into one shared module, driven by reading required fields off the block registry (not separate config maps) — the repeated "audit missed a block" pattern across BOTH review rounds is exactly the failure mode this would prevent structurally instead of relying on manual audits
2. ~~Add draft-save validation hook that runs before every draft save~~ — attempted, reverted after review found it unsafe; **done correctly at publish-time instead** (`sanitizeBlocksRequiredFields()` in `/api/sites/[siteId]/publish/route.ts`)
3. **Unit test every AI code path** with portfolio-grid (and other blocks with required array-item fields) as regression guards — partially done; `generate-site`'s own local sanitizer still has zero dedicated tests
4. **Clean up dead `BLOCK_IMAGE_SPEC` entries** (`case-study`, `event-card`, `blog-posts` — nonexistent blockTypes; `products-grid`/`products-featured`'s `products` field — doesn't exist on those blocks' schema)
5. **File the `pricing`/`faq` follow-up issue** (see Next Steps #2)

## Verification Checklist

- [x] Removed padding logic from media-injector.ts (minCount reserved for pool sizing only)
- [x] `normalize-required-titles.ts` — config-driven, single-rule-per-block table (simplified after review flagged the array-of-rules shape as unused/latent-buggy), covers portfolio-grid, team, doctor-profile, property-card, service-cards, testimonials
- [x] Integrated into edit-block/route.ts before `update_block`/`update_multiple_blocks` apply changes
- [x] Integrated into publish/route.ts, once, right before promote (NOT into save/route.ts — reverted after review)
- [x] Unit + integration tests: 45+ new/updated cases across 7 files, all pass
- [x] Full test suite: 593 files / 10341 tests, 100% pass (re-verified after the post-review rework, not just the original implementation)
- [x] TypeScript strict mode: 0 errors. Lint: 0 warnings.
- [x] QA docs: TC-F01.PGRID-01 through TC-F01.PGRID-21 in docs/qa/F01-ai-chat-builder.md, TC-F38-RAW-26 in F38 doc
- [x] Verify rendering components handle variable array lengths (portfolio-grid, gallery, team all tested — no layout break)
- [x] Adversarial + code-quality review run TWICE: pre-PR (Correction #1) and post-PR on #1629 (Correction #2) — both rounds' findings fixed, not just acknowledged
- [x] Fixed round 1: portfolio-grid string-shorthand discarded, tautological media-injector test
- [x] Fixed round 2: property-card missing from audit (Critical), autosave-wiring data-loss risk (High ×2, moved sanitizer to publish-time), testimonials string-shorthand discarded (same bug class as round 1's portfolio-grid fix, missed for testimonials), doubly-nested-array toast mis-parse (Medium)
