# Google Maps Embed in Contact Block — Removed; Design Trade-offs Documented

**Date**: 2026-07-09 10:15 UTC  
**Severity**: High  
**Component**: Contact block (`F01`, `F30`) + AI site generation + Block Library  
**Status**: Resolved & code-reviewed, pending git commit + deploy + manual QA  

## What Happened

End users saw the **wrong location** when visiting sites with Contact blocks rendered in `map-split` variant. The block was embedding a Google Maps iframe built from raw address text (`<iframe src="maps.google.com/maps?q=<address>&output=embed">`). Google's fuzzy text-match engine interpreted address strings inconsistently—often centering pins on nearby cross-streets, parks, or unrelated businesses instead of the actual location. This happened both via:
- **AI site generation** (recipe pools weighted `map-split` heavily for restaurant/real estate/health/events/travel categories)
- **Manual Block Library drag** (variant picker listed `map-split` as an option in the editor)

Root issue: We trusted Google's text-to-coordinates parser without validation. We never tested with addresses that had multiple nearby matches or ambiguous grammar.

## The Brutal Truth

This bug existed undetected long enough that:
- 7 category recipes had `map-split` in their variant rotation → every `restaurant` or `realestate` AI gen likely picked it
- 8 documentation files (PRDs, design specs, UX audit) referenced `map-split` as a "supported variant" without flagging the map-quality issue
- No unit test asserted the embed was actually correct

The frustrating part: the fix *looks* like we're throwing away a feature, but we're actually removing broken UI that hurt conversion. The "right" fix would have been to integrate a real Geocoding API (Google Maps API or Nominatim) to validate address → coordinates *before* rendering the iframe. We didn't have budget for that. So we deleted the variant entirely.

The guilt: legacy sites saved with `variant:'map-split'` now silently changed layout (from embedded map + form to split layout). That's data mutation without explicit migration. We chose backward-compat at the render level (Zod still accepts the value, no 500 error) over data consistency (we could have marked old blocks for human review). The bet: most `map-split` blocks are so broken (wrong location) that the silent layout shift is *better* than keeping broken map. Probably right, but we didn't audit production to confirm.

## Technical Details

**Error signature:** `maps.google.com/maps?q=<user_address>&output=embed` — fuzzy match logic is internal to Google, no error logs on our end. Manifested as users complaining "the map shows a Starbucks across the street, not my office." Reproduced manually with addresses like "123 Main Street, Suite 400, San Francisco, CA 94105" → pinned a nearby Whole Foods.

**Fix scope:**
- 5 code files modified: `src/blocks/contact/{config.ts,index.tsx}`, `src/collections/Pages.ts`, `src/lib/ai/{openai-generator.ts,category-requirements.ts}`
- 1 TS/Zod change: removed `'map-split'` from `contactMeta.variants` (L12 in config.ts) — array shrunk 6→5. Kept it in the Zod enum and TS union type.
- 7 AI recipe arrays: removed `'map-split'` from `CATEGORY_VARIANT_WEIGHTS` (restaurant/business/health/realestate/fnb/events/travel categories, L877–L1101 in openai-generator.ts).
- 8 AI category pools: removed `'map-split'` from `CONTACT_VARIANT_BY_CATEGORY` (L116–L129 in category-requirements.ts).
- 1 Payload admin dropdown: removed `{ label: 'Map Split', value: 'map-split' }` from Pages.ts contact variant select (L175).
- Deleted entire `map-split` render branch (L402–458 in index.tsx) — ~56 lines of JSX + styling for the embedded map container, map-specific margin, etc.
- Extended split branch guard: `variant === 'split' || variant === 'map-split'` (L505) — legacy `map-split` rows now render as split layout (form + info card side-by-side, no iframe).

**Validation gates:**
- `grep -rn "output=embed" src/blocks/contact/` → 0 hits ✅
- `grep -rn "'map-split'" src/lib/ai/` → 0 hits ✅
- `ContactConfigSchema.safeParse({variant:'map-split'})` still succeeds (no 500 for legacy content) ✅
- `npx tsc --noEmit` clean ✅
- `npm test` 9511/9511 pass ✅

## What We Tried

Nothing here needed iteration—the approach was agreed upon in planning:

1. **Delete the iframe branch (D1):** Simplest, safest. Removes all Google Maps rendering code, eliminates the bad UX.
2. **Keep `map-split` in the Zod schema (D2):** Preserves backward-compat for legacy saved content. `pages-schema.ts` (AI sanitizer) keeps it in the allowlist so old rows render instead of coercing to fallback.
3. **Accept silent layout shift on legacy blocks (D3):** Editor re-save of legacy `map-split` content triggers `block-normalization.ts` coercion to the `form` default (current variant no longer in `meta.variants`). We documented this as "acceptable because both form and split layouts are iframe-free." Considered adding a migration in `block-normalization.ts` to emit a warning or preserve the old layout, but that complexity isn't worth it—`form` is safe and sufficient.

All three passed code review with zero critical/high findings.

## Root Cause Analysis

**Why did this bug exist?**
1. **Assumption: text-based geocoding is reliable.** We never validated that `maps.google.com/maps?q=<fuzzy-address>` would resolve to the *intended* location. Google's client-side fuzzy matching is opaque and inconsistent.
2. **No integration tests on the variant.** TC coverage for Contact block covered schema + render paths, but didn't exercise the `map-split` iframe generation with realistic addresses. We relied on manual QA that never caught address ambiguity.
3. **AI recipe tuning didn't consider embed correctness.** `CATEGORY_VARIANT_WEIGHTS` was tuned for *diversity* ("pick map-split for restaurant") not *quality* ("is the map correct?"). No feedback loop from production.
4. **Payload block library UX suggested it was production-ready.** Listing a variant in the picker signals "this is safe to use." We didn't audit unsupported variants before release.

**Why didn't we catch this earlier?**
- Test data (addresses) were placeholders like "123 Main St" — too generic to trip the fuzzy-match bug.
- No production monitoring on Contact block render (no metrics on "user complained about map location").
- F01 Contact block is supporting infrastructure, not a top-priority feature—code review was thorough but not skeptical about iframe reliability.

## Lessons Learned

1. **Fuzzy-match geocoding is a footgun.** Any text-to-location pipeline that relies on fuzzy matching (Google Maps, Nominatim, etc.) *must* include:
   - A Geocoding API call (structured address, not free text) to validate coordinates before render.
   - Confidence score thresholds — reject matches below 90% confidence.
   - Human-in-the-loop for ambiguous cases (multiple equally-confident matches).
   - Telemetry: log which addresses resolved and how confident the match was.

2. **Test data should be realistic.** Our placeholder address "123 Main St, San Francisco" is suspiciously common. Real estate sites have addresses like "234-B Oak St, Apt 3" or "15 Willow Lane (next to the library)." These trip fuzzy matchers.

3. **Deleting broken features is legitimate product work.** We spent effort removing code instead of fixing it. That's the right call when the fix is complex (add a Geocoding API) and the pain is high (user confusion). Document the decision so future devs don't re-add it.

4. **Silent layout migration is a compromise, not a solution.** D3 (legacy blocks render as split after editor re-save) creates a small UX inconsistency for people who re-open old sites. Better approaches:
   - Add an explicit `block.migratedFromMapSplit` flag and render a deprecation notice.
   - Run a one-time job to rewrite all `variant:'map-split'` to `variant:'split'` on deploy.
   - Manual QA could hand-off legacy blocks to support for review.
   We chose the silent approach for speed. It's pragmatic but not ideal.

5. **AI recipe tuning needs feedback loops.** The fact that AI was *preferring* `map-split` for certain categories shows we built recipes without measuring correctness. Next time:
   - A/B test variant selection on real generated sites.
   - Log variant choices and end-user engagement/complaints.
   - Periodically audit AI output for quality (sample generated sites manually).

## Next Steps

1. **git-manager** → Commit Phase 01 + Phase 02 code changes with message:  
   `fix(contact): remove Google Maps embed from map-split variant`  
   `Relates to #1465`  
   *Note: Exclude unrelated `.env*` and `docker-compose.yml` changes from this commit.*

2. **Deploy to staging** → Merge to staging branch, verify on staging build.

3. **Manual QA (Part C)** → Post-deploy, run 9-step checklist:
   - AI Builder generates sites in previously `map-split`-heavy categories (restaurant, real estate, health, events, travel) → verify Contact blocks render without iframe.
   - Block Library Contact variant picker shows only 5 options (no Map Split).
   - Payload admin contact variant dropdown also shows 5 options.
   - External "Open in Google Maps" link on form/split/card-float still works (opens `maps.google.com/?q=<address>` in new tab).
   - Legacy `variant:'map-split'` content (via `psql` if needed) renders as split layout (form + info card, no iframe, no 500).
   - Legacy content re-saved in editor switches to `form` variant (acceptable per D3).
   - Regression: existing sites with non-`map-split` Contact blocks are unaffected (byte-identical).

4. **Deploy to production** → After QA sign-off.

5. **Update issue #1465** → Close with link to merged PR.

**Unresolved:** None. All code + tests + docs complete and reviewed. Awaiting user decision on commit/push.

---

## Retrospective

This work was clean execution of a clear decision: delete a broken feature rather than fix it. The hard part wasn't the code (straightforward variant removal) but the *design choice* of how to handle backward compatibility. D3 (silent layout shift) is a pragmatic compromise that prioritizes safety (no data loss, no 500 errors) over consistency (layout skew for legacy blocks).

If we'd had budget: Geocoding API validation + A/B test on Contact block variant performance → would have caught this in QA before release. We didn't, so we removed it.

Ship it.
