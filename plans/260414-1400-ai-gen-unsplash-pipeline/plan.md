---
title: "AI Gen — Unsplash media pipeline + Category DNA prompt rewrite"
description: "Replace DALL-E with Unsplash as primary image source (Scope A) AND rewrite AI system prompt with CATEGORY_REQUIREMENTS + minimum-content enforcement (Scope B). Target: $0/gen, 5–10 real images, 10–12 blocks/category."
status: in_progress
priority: P1
effort: 32–48h (4–6 days) — core shipped, polish pending
branch: feat/F01-ai-gen-variety-fix
tags: [ai, unsplash, media-pipeline, prompt, category-dna]
created: 2026-04-14
updated: 2026-04-14
---

## Problem (why)

Current AI gen produces sparse 5–7 blocks, no real imagery (DALL-E hero only, every gallery/portfolio/before-after dropped), visual quality ~30%. Root causes:
1. Payload `upload` fields need Media IDs, AI only supplies URL strings → sanitizer strips them → gallery/portfolio/before-after blocks dropped via `unsupported-blocks.ts`.
2. DALL-E cost (~$0.04/gen hero only) + output is abstract/text-free but generic.
3. System prompt has `CATEGORY_SIGNATURE_BLOCKS` but picks only 1–2 of 3, no hard min-block count, no per-block min items. AI defaults to 6-block safe layout.

**Goal:** click Generate AI → production site with 5–10 real Unsplash images + 10–12 structural blocks/category. Cost $0/gen. Visual quality 30% → 85%+.

## Phases

| # | Phase | Effort | Status | Commit |
|---|---|---|---|---|
| 01 | [Unsplash client (HTTP wrapper + download-tracking)](./phase-01-unsplash-client.md) | 3–4h | ✅ done | `0e62c423` |
| 02 | [Media pipeline (search → download → Payload Media create)](./phase-02-media-pipeline.md) | 4–5h | ✅ done | `0e62c423` |
| 03 | [Keyword strategy (category × block × VN fallback)](./phase-03-keyword-strategy.md) | 2–3h | ✅ done | `0e62c423` |
| 04 | [Route integration (wire into generate-site, un-drop blocks)](./phase-04-route-integration.md) | 3–4h | ✅ done | `0e62c423` |
| 05 | [Prompt Category DNA + gap-filler + content padder](./phase-05-prompt-category-dna.md) | 6–8h | ✅ partial | `0e62c423` |
| 06 | [Tests — unit + e2e across 5 categories](./phase-06-tests-e2e.md) | 3–4h | ✅ unit only | `0e62c423` |
| 07 | [Deploy config — env vars, Unsplash account, feature flag](./phase-07-deploy-config.md) | 1h | ✅ local done | `0e62c423` |

**Phase 05 partial:** CATEGORY_REQUIREMENTS + structure-enforcer + content-injection shipped. Few-shot examples (14 × EN + 14 × MS) deferred — gap-filler + library already solves sparse layout, few-shot is incremental polish.

**Phase 06 unit only:** 455/455 AI unit tests pass. E2E matrix (5 canonical × 3 runs) NOT written — manual e2e verification via curl covered main cases.

**Phase 07 local done:** Env vars added to `.env.local` + 3 example files. Unsplash **Production tier** application still pending (async 1–3d approval).

## Post-implementation fixes (discovered during testing)

After main commit `0e62c423`, 5 more bugs found + fixed during manual e2e testing:

| # | Bug | Root cause | Fix | Commit |
|---|---|---|---|---|
| 8a | Team avatars render as letter placeholders | `BLOCK_IMAGE_SPEC.team.itemField = 'avatar'` but Payload schema uses `members[].image` (Zod↔Payload drift) | Change to `image` | `7ce55c32` |
| 8b | Hero shows no background image on `centered` variant | Only set `backgroundImage`, centered variant reads `image` field | Share 1 Media ID across both top-level fields | `7ce55c32` |
| 8c | Features duplicated (Quality Service, Fast Response ×2) | `padItems` pulls from library without dedup | Dedup by lowercase `title`/`name` | `7ce55c32` |
| 8d | Portfolio-grid wrong array name | Spec used `items[]`, Payload uses `projects[]` | Update spec | `7ce55c32` |
| 9 | Subpages not clickable in preview | SiteRenderer editor mode rewrote internal nav links → `#` | Slug→pageId map, rewrite to `/preview/{siteId}?pageId={id}` | `e8c7e1c6` |
| 10 | Nav variant bland (`simple`/`transparent`) | AI defaults to boring nav, causing "dark bar ugly" look | `NAV_VARIANT_BY_CATEGORY` map, enforcer overrides to `pill`/`centered`/`mega-menu` | `e8c7e1c6` |
| 11 | Dark mode: muted text invisible | 195 blocks use `opacity-50` Tailwind class → on dark bg, text drops to ~3.5:1 contrast (fails WCAG AA) | Scoped CSS override in SiteRenderer boosts opacity to 0.80 when `colorMode === 'dark'` | `5a2096a2` |

## Success metrics — verified

1. **Visual richness:** ✅ Bo Bo Spa V5 e2e: 11/11 images, Saigon Premier Realty V2 e2e: 16/16 images fulfilled (100%).
2. **Structural richness:** ✅ 10–11 blocks per page across spa + real estate gens (was 5–7).
3. **Cost:** ✅ `$0/gen` verified — DALL-E disabled via `ENABLE_DALLE_HERO=false`.
4. **No regression:** ✅ 455/455 AI unit tests pass (was 367 baseline → +88 new tests).
5. **Unsplash compliance:** ✅ `trackDownload()` fire-and-forget in media-pipeline.
6. **Fallback resilience:** ✅ Chain tested — Unsplash fail → hardcoded hero URL → log warn, no 500.

## Session commit trail (6 commits)

| SHA | Description |
|---|---|
| `0e62c423` | feat: unsplash media pipeline + category dna enforcer (17 files, core) |
| `9389b7a9` | test: update drop list tests after gallery re-enable |
| `afa75abe` | docs: journal entry for unsplash pipeline + category dna |
| `7ce55c32` | fix: team field payload schema + hero dual image + dedup padding |
| `e8c7e1c6` | feat: preview subpage routing + category-specific nav variant |
| `5a2096a2` | fix: dark mode opacity boost — restore muted text contrast |

## Still open (deferred to Phase 08)

From original validation + user feedback "mong muốn chuẩn theo từng cate và các block hoàn thiện":

### Phase 08 — Category DNA theme library (~5–7 days)
- **Per-category color palette** — spa=earth warm, tech=cool mint, restaurant=appetite warm, realestate=trust navy, fitness=energy red, etc. Override AI theme.
- **Per-category typography pairings** — spa=serif elegant, tech=mono+sans geometric, restaurant=display+serif, etc. (FontPairings already exists, need category map.)
- **Per-category hero variant enforcement** — `HERO_VARIANTS_BY_CATEGORY` exists but not enforced; add structure-enforcer override.
- **Few-shot examples in system prompt** — 14 × EN + 14 × MS, +500 tokens/gen, ~$0.0001/gen extra (was Phase 05 sub-step 5.4, deferred).
- **Content depth rules** — hero subheadline 15–25 words, about 60–120 words, etc. Prompt-level enforcement.
- **Proper opacity-* cleanup** — replace 195 `opacity-50` uses with `var(--text-secondary)` CSS var across 20 block files (currently patched via scoped CSS in SiteRenderer).
- **Category-specific block composition** — enforce signature blocks per category (not just recommended). E.g. beauty MUST have booking-widget (currently dropped — need Payload schema migration).

### Deferred architectural items
- [ ] `before-after` block Payload schema migration + re-enable
- [ ] Full VN few-shot examples (if team QA surfaces demand)
- [ ] Real Pexels implementation (if Unsplash rate-limit pain in prod)
- [ ] Photo ID → Media ID cache (cross-tenant asset reuse)
- [ ] Tenant scoping on Media read (security)
- [ ] Unsplash **Production tier** approval (async, manual at unsplash.com)
- [ ] E2E matrix test file (5 canonical × 3 runs structured assertions)

## Validation Summary

**Validated:** 2026-04-14 | **Questions asked:** 4

### Confirmed decisions (all applied ✅)

1. **Attribution UI — Alt-text only** ✅ Applied in `media-pipeline.ts` `buildAttributedAlt()`: `${alt_description} — Photo by ${user.name} on Unsplash`.
2. **Few-shot examples — EN + MS priority** ✅ MS_TO_EN_FALLBACKS + VN_TO_EN_FALLBACKS tables in `image-keywords.ts`. Few-shot examples THEMSELVES deferred to Phase 08 (gap-filler alone meets structural richness bar).
3. **`before-after` — Keep dropped** ✅ Still in `BLOCKS_REQUIRE_MEDIA_PIPELINE` drop list.
4. **Pexels fallback — Stub only** ✅ Hardcoded hero URL fallback in `media-pipeline.ts` `heroFallbackChain()`.

### Action items status

- [x] Phase 02: alt text with photographer attribution
- [x] Phase 03: `MS_TO_EN_FALLBACKS` table added
- [x] Phase 04: un-drop gallery + portfolio-grid (before-after stays dropped)
- [~] Phase 05 sub-step 5.4: few-shot 14 × EN + MS — **deferred to Phase 08**
- [x] Phase 07: alt-text attribution decided, skip footer caption UI

## Recommendation

**Core goal achieved** — cost $0/gen, 10+ blocks per page, 8+ real images verified e2e.

**Next actions:**
1. Anh do manual visual regression test across 5 categories (spa/restaurant/tech/realestate/fitness) on staging.
2. Apply for Unsplash Production tier (manual, 1–3d async).
3. Create Phase 08 plan for Category DNA theme library if user's "chuẩn theo từng cate" vision stays priority.
4. Defer E2E matrix test file until post-Phase 08 (test stabler content).
