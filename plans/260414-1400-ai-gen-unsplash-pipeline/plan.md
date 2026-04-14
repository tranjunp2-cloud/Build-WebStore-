---
title: "AI Gen — Unsplash media pipeline + Category DNA prompt rewrite"
description: "Replace DALL-E with Unsplash as primary image source (Scope A) AND rewrite AI system prompt with CATEGORY_REQUIREMENTS + minimum-content enforcement (Scope B). Target: $0/gen, 5–10 real images, 10–12 blocks/category."
status: pending
priority: P1
effort: 32–48h (4–6 days)
branch: feat/F01-ai-gen-variety-fix
tags: [ai, unsplash, media-pipeline, prompt, category-dna]
created: 2026-04-14
---

## Problem (why)

Current AI gen produces sparse 5–7 blocks, no real imagery (DALL-E hero only, every gallery/portfolio/before-after dropped), visual quality ~30%. Root causes:
1. Payload `upload` fields need Media IDs, AI only supplies URL strings → sanitizer strips them → gallery/portfolio/before-after blocks dropped via `unsupported-blocks.ts`.
2. DALL-E cost (~$0.04/gen hero only) + output is abstract/text-free but generic.
3. System prompt has `CATEGORY_SIGNATURE_BLOCKS` but picks only 1–2 of 3, no hard min-block count, no per-block min items. AI defaults to 6-block safe layout.

**Goal:** click Generate AI → production site with 5–10 real Unsplash images + 10–12 structural blocks/category. Cost $0/gen. Visual quality 30% → 85%+.

## Phases

| # | Phase | Effort | Status |
|---|---|---|---|
| 01 | [Unsplash client (HTTP wrapper + download-tracking)](./phase-01-unsplash-client.md) | 3–4h | pending |
| 02 | [Media pipeline (search → download → Payload Media create)](./phase-02-media-pipeline.md) | 4–5h | pending |
| 03 | [Keyword strategy (category × block × VN fallback)](./phase-03-keyword-strategy.md) | 2–3h | pending |
| 04 | [Route integration (wire into generate-site, un-drop blocks)](./phase-04-route-integration.md) | 3–4h | pending |
| 05 | [Prompt Category DNA + gap-filler + content padder + few-shot](./phase-05-prompt-category-dna.md) | 6–8h | pending |
| 06 | [Tests — unit + e2e across 5 categories](./phase-06-tests-e2e.md) | 3–4h | pending |
| 07 | [Deploy config — env vars, Unsplash account, feature flag](./phase-07-deploy-config.md) | 1h | pending |

**Total:** 22–29h hands-on + Unsplash production-tier approval wait 1–3d async.

## Success metrics

1. **Visual richness:** every gen has hero + ≥4 gallery + ≥3 team/testimonial avatars + about image = **≥8 real Unsplash images**.
2. **Structural richness:** ≥10 blocks/page for all 14 categories (measured on 5 canonical inputs × 3 runs).
3. **Cost:** $0/gen in default config (`ENABLE_DALLE_HERO=false`). DALL-E stays behind flag.
4. **No regression:** existing 367 AI tests stay green.
5. **Unsplash compliance:** every used photo triggers `/photos/{id}/download` endpoint hit (license-mandatory).
6. **Fallback resilience:** Unsplash down → Pexels → pre-curated Payload Media → placeholder. No 500s.

## Related docs

- `research/researcher-01-unsplash-api.md` — endpoints, auth, rate limits, license, retry patterns
- `research/researcher-02-payload-media-pipeline.md` — current DALL-E flow, Zod↔Payload mismatch, existing Unsplash fallback prior art
- `research/researcher-03-prompt-category-dna.md` — current system-prompt state, proposed CATEGORY_REQUIREMENTS, gap-filler, padder, few-shot
- `docs/AI_WEBSITE_GENERATION_GUIDE.md` — end-user guide (update post-land)
- Sibling plan `plans/260412-2156-ai-gen-website-audit/` — phase-06 already landed `unsupported-blocks.ts` + fallback unification
- Sibling plan `plans/260414-0914-ai-model-optimization/` — model swap (no conflict, different lines)

## Validation Summary

**Validated:** 2026-04-14
**Questions asked:** 4

### Confirmed decisions

1. **Attribution UI — Alt-text only** — photographer name embedded trong `<img alt>` attribute. Invisible to user nhưng satisfies Unsplash ToS + SEO-friendly. **Effort: 0 min** (auto từ Unsplash API `alt_description` + `user.name`).
   - Phase 02 implication: `uploadBufferToMedia` phải pass `alt: "${photo.alt_description} — Photo by ${photo.user.name} on Unsplash"`.
   - Phase 07 implication: bỏ Attribution UI decision (no footer caption needed).

2. **Few-shot examples — EN + MS priority, VN for QA** ⚠️ User override plan recommendation:
   - **Target market = Malaysia (MY)**. Production languages = English + Malay (MS).
   - Vietnamese = internal QA only, NOT production content.
   - **Scope revised:** 14 categories × 2 langs (EN primary, MS secondary). VN few-shot files defer to followup (team manually translates if needed).
   - **Effort impact:** Phase 05 sub-step 5.4 reworks — was `14 × EN`, now `14 × EN + 14 × MS`. Rough estimate: +3-4h (AI-assisted MS translation of EN examples).
   - **Language detection:** already supported via `BusinessIntent.language` (en|ms|vi) per Plan A Phase 03 research. System prompt selects matching language's few-shot at runtime.
   - **Image keywords (Phase 03) implication:** add MS→EN fallback table bên cạnh VN→EN (not replace).

3. **`before-after` block — Keep dropped** — no action. Out of scope this plan. Defer to followup when Payload schema migration is prioritized. Phase 04 only re-enables `gallery` + `portfolio-grid`.

4. **Pexels fallback — Stub only** — ship V1 fast. Fallback chain = Unsplash → Pexels stub (returns `[]`) → hardcoded Unsplash URL (hero only). Promote Pexels to real impl ONLY if QA surfaces actual Unsplash rate-limit pain. Phase 02 sub-step 8 unchanged.

### Action items (revise phase files BEFORE coding)

- [ ] **Phase 02 (media pipeline):** Update `uploadBufferToMedia` signature/call sites to include photographer attribution in alt: `${alt_description} — Photo by ${photographer} on Unsplash`
- [ ] **Phase 03 (keyword strategy):** Add `MS_TO_EN_FALLBACKS` table (Malay → English keyword map, ~20 entries) alongside `VN_TO_EN_FALLBACKS`. Detect language from `ctx.language` param.
- [ ] **Phase 05 (prompt/category DNA):**
  - Sub-step 5.4: write 14 EN few-shot examples + 14 MS translations (bilingual). Effort +3-4h → **Phase 05 total = 9-12h** (was 6-8h).
  - Sub-step 5.4: VN translations NOT required, leave as gaps (fall back to EN example + `language: 'vi'` at runtime — AI translates content on-the-fly).
  - `getFewShotExample(category, language)` lookup supports en|ms, falls back to en if ms missing.
- [ ] **Phase 04 (route integration):** No change — `before-after` already not in re-enable list (only `gallery` + `portfolio-grid`).
- [ ] **Phase 07 (deploy config):** Remove step 6 (attribution UI decision) — already decided alt-text approach. Update AI guide doc to mention alt-text strategy.
- [ ] **plan.md effort update:** Total 25-33h → **28-37h** (+3-4h for MS few-shot).

### Flagged for followup plan

- `before-after` block Payload schema migration + re-enable
- Full VN few-shot examples (if team QA surfaces demand)
- Real Pexels implementation (if Unsplash rate-limit becomes pain)
- Photo ID → Media ID cache (cross-tenant asset reuse)
- Tenant scoping on Media read (security)

### Recommendation

**Proceed to implementation** with 5 action items above applied BEFORE cooking. The 4 decisions unblock all critical phases. The MS bilingual scope is a moderate effort bump (+3-4h) but critical for MY market positioning — can't defer without damaging V1.
