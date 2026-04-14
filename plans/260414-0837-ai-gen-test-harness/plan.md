---
title: "AI Gen Test Harness — Visual Coverage for F01V"
description: "Matrix runner + visual gallery + structural assertions to catch empty-hole bugs in AI-generated sites"
status: pending
priority: P1
effort: 4-6d
branch: feat/F01-ai-gen-variety-fix
tags: [testing, ai, variety, visual-regression, f01]
created: 2026-04-14
---

# AI Gen Test Harness — Visual Coverage for F01V

## Problem
3694 unit tests pass nhưng user vẫn thấy site bị "huge black empty space" (Ben Ben restaurant case): hero + footer OK, middle blocks biến mất. Unit tests chỉ verify `blocks[]` là JSON valid — KHÔNG render DOM → không bắt được empty-hole bug. PM cần coverage tự động, visual report eyeball trong 5 phút.

## Overview
Thêm một test harness riêng (additive, không sửa source) chạy composer pipeline qua matrix 14 categories × 3 variants × N seeds, assert structural invariants (block count, signature blocks, ordering, min-content), render từng fixture qua Playwright, detect empty-region trong screenshot, và generate HTML gallery report để PM review.

## Phases

| # | Phase | Status | Effort | Key Deliverable |
|---|-------|--------|--------|-----------------|
| 01 | [Harness Foundation & Fixture Matrix](phase-01-harness-foundation.md) | pending | 1d | Matrix runner + `.harness-out/matrix.json` |
| 02 | [Structural Assertions (Ben-Ben Guard)](phase-02-structural-assertions.md) | pending | 1d | `structural-report.json` w/ pass-fail per fixture |
| 03 | [Visual Gallery (Playwright Render)](phase-03-visual-gallery.md) | pending | 1-2d | Screenshots + empty-hole detector |
| 04 | [HTML Gallery Report](phase-04-html-report.md) | pending | 0.5d | `.harness-out/report.html` self-contained |
| 05 | [Dev UX + CI Wiring](phase-05-dev-ux-ci.md) | pending | 0.5d | `pnpm harness:*` scripts + optional workflow |
| 06 | [QA TC Mapping & Gap Closure](phase-06-qa-mapping.md) | pending | 0.5d | 38 TCs mapped + new render-level TCs |

## Success Metrics (reuse PRD F01V §5)
- **Ben-Ben guard**: 0 fixture trong matrix có rendered viewport empty-region >30% height
- **Signature block coverage**: 100% fixtures có đủ `CATEGORY_DNA.signatureBlocks[]` cho category đó
- **Variety reuse**: Hero variant ≥5/10 per category, features ≥3/10 — đo từ cùng matrix
- **Performance**: full matrix `pnpm harness:all` <10 min local, `harness:quick` <1 min
- **Report usability**: PM review <5 phút, click filter theo category/status

## Critical Decisions (LOCKED 2026-04-14)
1. **Primary driver = `composeFromBlueprint()` / `composeTemplate()`** (template path, offline, zero OpenAI cost). OpenAI path là Phase 07 stretch goal dùng mocked recorded response.
2. **Harness route tách khỏi production/staging build** — file đặt `page.harness.tsx`; `next.config.ts` chỉ include `.harness.tsx` vào `pageExtensions` khi env `ENABLE_HARNESS=1`. Build prod/staging **không thấy file** → 0 bloat, 0 risk lộ route. Local dev: `ENABLE_HARNESS=1 pnpm dev`.
3. **No DB** — pass `blocks[]` trực tiếp qua `SiteRenderer` via harness route.
4. **Matrix 5 seeds default** — 14 cat × 3 variants × 5 seeds = 210 fixtures × 2 viewports = 420 screenshots. Chấp nhận ~12 phút full run (vượt budget 2 phút, OK).
5. **Empty-hole threshold 30% trust v1** — pixel histogram heuristic, iterate khi thấy false positive. Không pre-calibration.
6. **CI: label-only trigger, artifact only** — trigger bằng label `run-harness` trên PR, không nightly cron, không upload S3. Artifact retention 14 ngày.
7. **Forward-only coverage** — không snapshot baseline state trước F01V fix. Mục tiêu = ngăn regression tương lai.
8. **Reuse existing** `BROKEN_VARIANTS`, `enforceMinContent`, `CATEGORY_SIGNATURE_BLOCKS`, `CATEGORY_DNA` — không duplicate. Additive only, không touch `src/lib/ai/` hay `src/components/site-renderer/`.

## Related Docs
- PRD: `docs/prd/F01-ai-builder-variety.md` (14 AC, 20 FR)
- QA Plan: `docs/qa/F01-ai-builder-variety.md` (38 TC)
- Context Guide: `docs/standards/AI_WEBSITE_GENERATION_GUIDE.md`
- Parent plan: `plans/260412-2156-ai-gen-website-audit/plan.md` (Phase 02-05 done)
- Research: `plans/260414-0837-ai-gen-test-harness/research/researcher-01-test-coverage-gap.md`, `research/researcher-02-gen-and-render-pipeline.md`

## Open Questions (resolved)
All 5 open questions resolved 2026-04-14 — see Critical Decisions section above. Plan status: **ready to implement**.
