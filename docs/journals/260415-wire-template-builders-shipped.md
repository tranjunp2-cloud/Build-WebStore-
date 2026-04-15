---
date: 2026-04-15
branch: feat/F01-ai-gen-wire-template-builders
pr: '#618'
commit: 6bfa3c12
session_duration: ~1h (cook)
tags: [ai-gen, template-composer, content-quality, quick-win, shipped]
---

# 2026-04-15 — Wire Template Builders into AI Gap-Fill (Shipped)

Short-term content quality fix ship record. Follow-up to research journal
`260415-ai-gen-vs-template-composer-research.md`. Strategic rebuild plan
`plans/260415-0845-ai-gen-template-first-rebuild/` remains for post-v1.0.

---

## TL;DR

Delegated 5 content-injection gap-fill switch cases (`features / stats /
pricing / team / service-cards`) to `template-composer` hand-curated builders.
Zero content curation new — template composer already had ~280 Malaysia-
specific entries (JAKIM, MBBS UM, RM pricing, GrabFood). AI gen path never
consumed them. This PR wires the two code paths with try-catch fallback.

**Time**: 4h planned → **~1h actual** (scout pre-verified plumbing existed via
plan 2249 phase-07 — skipped 2 plumbing steps from original plan).

**Merged into**: PR #618 (open, pending review).

---

## What happened

### Research (earlier session)
- Compared AI gen output vs template composer content on 5 categories
- Identified 280 curated entries in `template-composer.ts` buildFeatures/
  buildStats/buildPricing/buildTeam/buildServiceCards
- AI gen gap-fill (`content-injection.buildBlockFromLibrary`) used a generic
  8-item global pool, never called composer builders
- Root cause: AI-first philosophy (plan 2253) vs template-first (Wix ADI)

### Scout (pre-cook)
- Grep confirmed `InjectionContext.userBiz` already plumbed via plan 2249
  phase-07 (user data threading)
- `mapBusinessInfo()` adapter already exported from `business-info-mapper.ts`
- `openai-generator.ts` already constructs `enforcerBizOverride` and passes as
  `enforcerCtx.userBiz` in both multi-page + single-page paths
- **Saved ~30 min cook time** by skipping "extend InjectionContext" + "propagate
  businessInfo" plumbing steps

### Cook (this session)
1. Added `export` keyword to 5 builders in `template-composer.ts`
2. In `content-injection.ts`:
   - Import 5 composer builders (aliased to avoid shadow)
   - Construct `mergedBiz: BusinessSample` from library default + `ctx.userBiz`
   - Rewrote 5 switch cases to try-delegate with legacy hardcoded fallback
3. Created `content-delegation.test.ts` with 15 test cases
4. Regression: 1518/1518 AI unit tests pass
5. Live smoke test: bibi Dental health gen returns curated content
6. Commit + push + PR #618
7. Finalize: project-manager synced plan status, docs-manager skipped all docs
   (internal wiring only, no user-facing architectural change)

---

## Live smoke evidence — bibi Dental

**Payload**: `{ name: 'bibi Dental', industry: 'health', products: ['Teeth Whitening', 'Dental Implants'] }`

| Block | Before (generic pool) | After (composer delegation) |
|---|---|---|
| `features[0]` | ⭐ Quality Service — Exceptional quality in every interaction | 🦷 Teeth Whitening Service |
| `features[1]` | 🚀 Fast Response — Quick turnaround | Expert Dental Implants |
| `stats` | Happy Customers / Years / Rating | Years Experience / **Patients Treated** / Specialist Doctors / Patient Rating |
| `team[0].name` | Team Lead | **Dr. Tan Wei Ming** |
| `team[0].bio` | Passionate about delivering great experiences | **MBBS (UM), 15 years experience in family medicine** |
| `pricing` plans | Starter / Pro / Enterprise | Basic Check-up / Comprehensive / Executive |
| `service-cards[0]` | ⭐ Premium Service — Our flagship offering | Teeth Whitening Service (product-derived) |

**User perception**: "Hand-curated professional Malaysian content" instead of
"generic AI template feeling".

---

## Files changed

### Code (3 files)
- `src/lib/ai/template-composer.ts` — 5 lines (add `export` keyword)
- `src/lib/ai/content-injection.ts` — +60/−19 lines (5 delegation cases with
  try-catch fallback, import 5 aliased builders, construct mergedBiz helper)
- `src/__tests__/unit/lib/ai/content-delegation.test.ts` — NEW, +180 lines,
  15 test cases

### Docs (2 files, separate commit)
- `plans/260415-0900-wire-template-builders-to-ai-gapfill/plan.md` — status
  shipped, added shipping log, PR link
- `plans/260415-0900-wire-template-builders-to-ai-gapfill/phase-01-wire-builders.md`
  — implementation status updated, 12 todos marked done

### Not changed (intentional)
- `src/collections/*` — zero schema changes
- `src/lib/ai/structure-enforcer.ts` — plumbing already correct
- `src/lib/ai/openai-generator.ts` — `enforcerBizOverride` already constructed
- `docs/prd/*`, `docs/qa/*`, `docs/architecture/*` — docs-manager ruled all SKIP
  (internal wiring, no user-facing arch change)

---

## What unlocked

### Content quality gap closed
5 block types now emit hand-curated Malaysia-specific content when AI gen
gap-fills. User perception of "template mẫu đẹp hơn AI gen" should reverse —
the same curated content template gallery uses is now reachable via AI gen
path.

### Validation of hybrid path
Plan 2253 (distribution fix) + Plan 2249 phase-07 (user data threading) +
this wire PR = AI gen path now matches template composer for the 5 most-
visible block types. Strategic rebuild to Wix template-first (long-term plan
`260415-0845`) remains the correct direction but is no longer blocking
pre-v1.0 ship.

---

## Scope that did NOT ship (deferred)

1. **Block-level AI override** — if AI generates features content itself
   (not gap-fill), delegation doesn't fire. AI still emits training-median
   content when it provides its own block. This was out of scope.
2. **Template library expansion** — still only ~280 entries. Long-term plan
   targets 100+ entries × 5 categories.
3. **Wizard picker flow** — still AI form only. Rebuild plan handles this.
4. **Non-English localization** — MS/VN composer content not curated.

---

## Open questions + follow-ups

1. **Measurement harness re-run**: should measure post-wire delta on
   `variety-baseline` → `variety-post-wire-v1` to quantify. Deferred to
   post-merge QA.
2. **`buildBlockFromLibrary` call contexts**: only gap-fill (when AI missing
   blocks). AI blocks em gen'd directly don't benefit. Possible followup —
   sanitizer replaces AI generic content với composer content even when
   block is present? Risky — AI copy may reference generic content downstream.
3. **Composer pricing coverage**: only 7/14 categories have curated pricing
   map. Other 7 fall to composer `defaultPlans` (curated RM defaults, still
   better than generic "Starter/Pro/Enterprise" pool).

---

## Related journals + plans

- `260415-ai-gen-vs-template-composer-research.md` — research + architecture gap
- `260414-session-ai-gen-deep-dive.md` — plan 2253 session
- `plans/260415-0900-wire-template-builders-to-ai-gapfill/` — this PR's plan dir
- `plans/260415-0845-ai-gen-template-first-rebuild/` — long-term rebuild (post-v1.0)
- `plans/260414-2253-ai-gen-variety-root-cause/` — distribution fix (merged)

## Related PRs

- #603 plan 2253 tactical variety fix (merged)
- #615 R1 skeleton variants wire (merged)
- #617 cleanup unused + force variant re-pick (open, merged into this branch)
- **#618 wire template builders** (this session, open)

---

## Lessons / reusable patterns

### Scout before cook saves time
Original plan estimated 4h. Scout pre-read found plumbing existed → 1h actual.
**Always scout before estimating effort on refactor tasks** — surface area is
often smaller than plan description suggests.

### Try-catch delegation pattern
```ts
case 'features': {
  try {
    return composerBuildFeatures(mergedBiz, category)
  } catch (err) {
    console.warn('[content-injection] composerBuildFeatures failed, falling back:', err)
  }
  // Legacy hardcoded fallback preserved — defensive
  // ... existing 40 lines
}
```
Zero-risk wiring pattern when delegating to a well-tested module. Keeps the
old path as defensive fallback on any downstream error. Reuse for other
delegation work.

### Aliased imports for shadow avoidance
```ts
import {
  buildFeatures as composerBuildFeatures,
  buildStats as composerBuildStats,
  // ...
} from './template-composer'
```
Makes delegation obvious in code review + avoids naming shadow if caller
has its own `buildFeatures` helper.

### Document composer-curated content as a reusable asset
Template composer's ~280 hand-curated entries is the highest-value content
asset in the codebase. Future work (rebuild plan) should preserve + expand
this, not rewrite from scratch.
