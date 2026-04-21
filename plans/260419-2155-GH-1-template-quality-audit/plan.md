---
title: Template Quality Audit & Improvement
description: Giai thich 390 fixtures + fix 5 quality gap (footer mismatch, contact-form, content parity, logos, CI gate)
status: pending
priority: P1
effort: 8-13h (P0+P1 only: 4-5h)
branch: feat/GH-1-harness-template-drift-sync
tags: [template, quality, ai-gen, harness, audit]
created: 2026-04-19
---

## Vi sao co 390 fixtures? (VI tom tat)

Harness generator `scripts/test-harness/matrix.ts` chay 2 path song song, 5 seeds moi fixture:

1. **Blueprint path (280 fixtures)**: 56 `TemplatePreset` cung (batch1 + batch2 + batch3) x 5 composition seeds = 280. Preset source o `src/lib/ai/template-presets-batch{1,2,3}.ts`, aggregated trong `src/lib/ai/template-definitions.ts:231`.
2. **Legacy path (110 fixtures)**: 22 `(category, variant)` cells con `ComposerInputLegacy` x 5 seeds = 110. Matrix skip `premium` cells khi category da co blueprint (matrix.ts:101-122).

**Tong 280 + 110 = 390**. Moi category co ~30 fixtures (4 blueprint x 5 + 2 legacy variants x 5); blog/events/travel chi 20 do thieu 1 legacy variant.

**Chat luong hien tai**: 390/390 compose OK nhung co 800 drift findings im lang (660 unknown-variant + 140 unknown-block), 3 cat thieu business sample, client logos toan placeholder, harness chua enforce structural guard vao CI. Research: `research/researcher-01-generation-pipeline-390.md` + `research/researcher-02-quality-issues-and-levers.md`.

## Phases

| # | Phase | Priority | Effort | Status |
|---|-------|----------|--------|--------|
| 01 | Fix footer `mega` variant mismatch | P0 | 5m | pending |
| 02 | Register `contact-form` + 3 unknown blocks | P1 | 2h | pending |
| 03 | Fill content pool parity (blog/events/travel) | P2 (OPTIONAL) | 1h | pending |
| 04 | Curate client-logos library (84 logos) | P2 (OPTIONAL) | 3h | pending |
| 05 | Enforce `harness:check` quality gate in CI | P1 | 2h | pending |

**Critical path (ship-blockers)**: 01 -> 02 -> 05 (~4-5h, unlocks 336+ drift findings + prevents regressions).

**Optional polish (P2)**: 03 + 04 anh quyet dinh ship trong v1.0 hay de v1.1 (4h them).

## Dependencies

- Phase 01 khong phu thuoc gi, nen lam dau (5m diff).
- Phase 02 doc lap voi 01; co the parallel.
- Phase 05 can 01 + 02 done truoc de baseline drift giam xuong truoc khi bat gate.
- Phase 03 + 04 doc lap voi nhau va voi 01/02.

## Key files touched

- `src/lib/ai/template-presets-batch{1,2,3}.ts` (phase 01, 02 fixture refs)
- `src/blocks/footer/config.ts` (phase 01 alias OR rename)
- `src/blocks/contact/config.ts` or new `src/blocks/contact-form/` (phase 02)
- `src/lib/ai/pages-schema.ts` (phase 02 WHITELIST)
- `src/lib/ai/content/{blog,events,travel}.ts` (phase 03)
- `src/lib/ai/content/types.ts` + all 14 content files (phase 04)
- `.github/workflows/ci.yml` + `scripts/test-harness/cli.ts` (phase 05)

## Success criteria

- `npm run harness:gen` + `drift:check` report drift < 520 sau phase 01 (280 footer findings xoa).
- Sau phase 02: drift < 260 (xoa them 260 contact-form + map + content-block + timeline).
- Sau phase 05: PR voi label `run-harness` block khi structural guard FAIL.
- Moi fixture van compose OK (390/390).

## Research references

- `research/researcher-01-generation-pipeline-390.md` — 390 math, composition pipeline, guards.
- `research/researcher-02-quality-issues-and-levers.md` — 800 drift breakdown + top offenders + 10 levers.
