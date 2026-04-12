---
title: "AI Website Generation Pipeline — Variety Audit & Fix"
description: "Audit and fix why all AI-generated websites look identical despite 47+ blocks with 100+ variants"
status: pending
priority: P1
effort: 8-12d
branch: chore/cleanup-env-vars
tags: [ai, openai, templates, blocks, variety]
created: 2026-04-12
---

# AI Website Generation Pipeline — Variety Audit & Fix

## Problem
All AI-generated websites look identical despite 47+ blocks with 100+ variants available.

## Root Causes (5 issues)
1. **System prompt lacks variety instructions** — lists blocks but never tells AI to vary them
2. **Sanitization silently kills variety** — invalid variants collapse to same default
3. **Fallback generator is 100% deterministic** — hardcoded blocks + variants + content
4. **Template composer is deterministic** — 14/15 builder functions hardcode one variant
5. **User prompt is flat** — no style/mood/personality signal, same format every time

## Phases

| # | Phase | Status | Effort | Key Files |
|---|-------|--------|--------|-----------|
| 01 | [Audit & Diagnosis](phase-01-audit-diagnosis.md) | skipped | - | (user confirmed root causes) |
| 02 | [Fix System Prompt](phase-02-fix-system-prompt.md) | pending | 1-2d | system-prompt.ts |
| 03 | [Fix Sanitization](phase-03-fix-sanitization.md) | pending | 1d | openai-generator.ts |
| 04 | [Fix Fallback Generator](phase-04-fix-fallback-generator.md) | pending | 2-3d | generate-blocks.ts |
| 05 | [Fix Template Composer](phase-05-fix-template-composer.md) | pending | 2-3d | template-composer.ts, template-definitions.ts |

## Key Files
- `src/lib/ai/system-prompt.ts` — prompt builder (176 lines)
- `src/lib/ai/openai-generator.ts` — GPT-4o caller + sanitizer (561 lines)
- `src/lib/ai/generate-blocks.ts` — rule-based fallback (315 lines)
- `src/lib/ai/template-composer.ts` — deterministic composer (~1100 lines)
- `src/blocks/registry.ts` — block metadata + variant lists

## Success Metric
Generate 10 sites for same industry input → achieve >= 7 visually distinct layouts.

## Validation Summary

**Validated:** 2026-04-12
**Questions asked:** 4

### Confirmed Decisions
1. **Skip Phase 01 audit** — root causes đã rõ từ code review, nhảy thẳng vào fix
2. **Variant readiness unknown** — cần check trước khi random. Thêm bước verify variant render vào Phase 02
3. **Fix tất cả 5 phases** — cả AI path, fallback, và template composer
4. **Invalid variant → weighted by category** — mỗi category có preferred variants list, random trong đó

### Action Items
- [ ] Phase 01: BỎ — đánh dấu skipped
- [ ] Phase 02: Thêm bước verify tất cả variants render đúng trước khi enable random
- [ ] Phase 03: Đổi random fallback → weighted-by-category fallback (dùng CATEGORY_HERO_VARIANTS pattern đã có trong template-composer.ts)
- [ ] Tạo "variant whitelist" per block type — chỉ random từ variants đã verified render OK

## Related Docs (PHẢI ĐỌC trước khi implement)
- **PRD**: `docs/prd/F01-ai-builder-variety.md` — 20 FRs, 14 ACs, 5 risks
- **Variant Audit**: `plans/260412-2156-ai-gen-website-audit/scout/scout-variant-audit-report.md` — 140/142 safe

## Research
- [AI Pipeline Research](research/researcher-01-ai-pipeline.md)
- [Template System Research](research/researcher-02-template-system.md)
