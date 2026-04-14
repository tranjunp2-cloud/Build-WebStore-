---
title: "AI Gen Test Harness — Visual Coverage for F01V"
description: "Matrix runner + visual gallery + structural assertions to catch empty-hole bugs in AI-generated sites"
status: in_progress
priority: P1
effort: 4-6d
progress: "4/6 phases + bug-fix round done (Sprint B1 complete)"
branch: feat/F01-ai-gen-variety-fix
tags: [testing, ai, variety, visual-regression, f01]
created: 2026-04-14
updated: 2026-04-14
---

# AI Gen Test Harness — Visual Coverage for F01V

## Problem
3694 unit tests pass nhưng user vẫn thấy site bị "huge black empty space" (Ben Ben restaurant case): hero + footer OK, middle blocks biến mất. Unit tests chỉ verify `blocks[]` là JSON valid — KHÔNG render DOM → không bắt được empty-hole bug. PM cần coverage tự động, visual report eyeball trong 5 phút.

## Overview
Thêm một test harness riêng (additive, không sửa source) chạy composer pipeline qua matrix 14 categories × 3 variants × N seeds, assert structural invariants (block count, signature blocks, ordering, min-content), render từng fixture qua Playwright, detect empty-region trong screenshot, và generate HTML gallery report để PM review.

## Phases (by file number)

| # | Phase | Status | Effort | Commit / Deliverable |
|---|-------|--------|--------|----------------------|
| 01 | [Harness Foundation & Fixture Matrix](phase-01-harness-foundation.md) | ✅ **done** | 1d | `735fa85` — matrix runner 390 fixtures ~90ms |
| 02 | [Structural Assertions (Ben-Ben Guard)](phase-02-structural-assertions.md) | ✅ **done** | 1d | `735fa85` — 6 guards + check.ts, caught 185 bugs |
| ⭐ | Bug-fix round *(unplanned, triggered by Phase 02)* | ✅ **done** | 0.5d | `8598e64` — 185 → 0 fails in template-composer.ts |
| 03 | [Visual Gallery (Playwright Render)](phase-03-visual-gallery.md) | 👉 **next** | 1-2d | Screenshots + empty-hole detector |
| 04 | [HTML Gallery Report](phase-04-html-report.md) | ⏳ pending | 0.5d | `.harness-out/report.html` self-contained |
| 05 | [Dev UX + CI Wiring](phase-05-dev-ux-ci.md) | ✅ **done** | 0.5d | `npm run harness:*` scripts + `ai-harness.yml` workflow + README |
| 06 | [QA TC Mapping & Gap Closure](phase-06-qa-mapping.md) | ✅ **done** | 0.5d | TC-F01-V.39..50 in QA §4.8 + PRD §17 DoD ticked |

## Execution order (NOT numeric — reordered 2026-04-14 for value)

```
Sprint B1 (daily-use quick wins, 0.5d)
  └─ Phase 05: Dev UX scripts        → anh + team dùng pnpm harness:* ngay
  └─ Phase 06: QA TC mapping         → unblock QA acceptance cho PR #555

Sprint B2 (visual coverage, 1.5d)
  └─ Phase 03: Playwright screenshots → bắt bug rendering-level
  └─ Phase 04: HTML gallery report    → anh review 390 templates trong 5 phút

Sprint B3 (optional stretch, 1d)
  └─ Phase 07 (future): AI path harness với mocked OpenAI response
  └─ Phase 08 (future): LLM-as-judge visual scoring
```

**Next up when `/cook` runs: Phase 03 — Visual Gallery (Playwright Render)** (xem `phase-03-visual-gallery.md`)

## Progress log
- **2026-04-14 morning**: Plan created, 5 decisions locked (pageExtensions, 5 seeds, label-only CI, forward-only, 30% threshold)
- **2026-04-14 midday**: Phase 01 shipped — matrix runner offline, 390 fixtures in 90ms
- **2026-04-14 afternoon**: Phase 02 shipped — 6 guards, caught 185 real bugs (`735fa85`)
- **2026-04-14 afternoon**: Bug-fix round (unplanned) — fixed all 185 fails in template-composer.ts (`8598e64`)
- **2026-04-14 afternoon**: 2 commits pushed to PR #555 (still OPEN, merges into staging)
- **2026-04-14 evening**: Execution order reshuffled — Phase 05 + 06 prioritised over 03 + 04
- **2026-04-14 night**: Sprint B1 complete — Phase 05 (`npm run harness:*` + `ai-harness.yml` + README) + Phase 06 (TC-V.39..50 + PRD DoD ticked + parent plan sync). `harness:quick` 1.88s, `harness:check` 1.54s, both well under 60s gate

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
