---
title: Per-Template Quality Fix Pass
description: Audit + fix each of 56 blueprint templates visually for ship-ready v1.0 — quality over quantity
status: pending
priority: P1
effort: 3-5 dev-days (depends on severity triage)
branch: feat/GH-1-harness-template-drift-sync
tags: [template, quality, ai-gen, audit, v1.0]
created: 2026-04-19
---

## PM directive (2026-04-19)

"Hiện tại ít template nhưng gen chưa chuẩn — cần check từng template và fix."

Không expand preset pool thêm (4-tier roadmap defer — xem `memory/project_template_similarity_root_cause.md`). Focus: **56 blueprint hiện có, làm chuẩn trước ship v1.0**.

## Phạm vi

- **56 blueprint** (batch1=20, batch2=20, batch3=16) trong `src/lib/ai/template-presets-batch{1,2,3}.ts`
- Mỗi blueprint thành homepage 5-trang (1 home + 4 sub) × tiêu chuẩn 10-15 block/trang
- Review **visual quality** (không phải structural drift — đã có phase 02 drift validator plan khác lo)

## Success criteria

1. Mỗi blueprint có **triage verdict** (OK / minor / major) + ghi chú cụ thể
2. 100% `major` được fix (preset rewrite / variant swap / content replace) hoặc escalate hard-delete
3. 80%+ `minor` fix trong sprint này; còn lại defer ra backlog
4. Harness re-run: 56 blueprint render không có lỗi visual severity P1 (overflow, empty state, broken layout)
5. Before/after screenshot pair cho mỗi major fix để PM approve

## Phases

| # | Phase | Priority | Effort | Status |
|---|-------|----------|--------|--------|
| 01 | [Review workflow setup — make 56 browsable](./phase-01-review-workflow-setup.md) | P0 | 1h | pending |
| 02 | [Triage 56 blueprints — OK/minor/major verdict](./phase-02-triage-56-blueprints.md) | P1 | 3-4h | pending |
| 03 | [Fix majors — rewrite/swap problematic presets](./phase-03-fix-majors.md) | P1 | 1-2d | pending |
| 04 | [Fix minors — polish pass](./phase-04-fix-minors.md) | P2 | 0.5d | pending |
| 05 | [Validation — harness re-run + before/after proof](./phase-05-validation-proof.md) | P1 | 2h | pending |

## Dependencies

- Phase 02 đòi Phase 01 (cần tool browse trước khi triage)
- Phase 03/04 đòi Phase 02 (cần verdict trước khi fix)
- Phase 05 cuối — validate all fixes

## Out of scope (defer to separate plans)

- Expand preset pool từ 4 → 8-10/cat (tier 1 roadmap) — defer
- AI variant selection theo vibe — defer
- Nano Banana image generation per business — defer
- Fix 800 drift findings (plan 260419-2022 Phase 02 đã baseline)
- F13 Payment / subscription-tied template access

## Reference

- Root cause analysis: `docs/journals/260419-template-gen-similarity-analysis.md`
- Memory: `memory/project_template_similarity_root_cause.md`
- Existing drift data: `/dashboard/templates-health` (from plan 260419-2022)
- Harness output: `.harness-out/matrix.json` (run `npm run harness:gen`)
