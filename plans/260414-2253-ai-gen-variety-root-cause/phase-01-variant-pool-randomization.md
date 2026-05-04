# Phase 01 — Variant Pool Randomization

## Context links
- **Parent**: [plan.md](./plan.md)
- **Fixes**: R2 (CATEGORY_VARIANT_WEIGHTS pool cố định), R9 (NAV_VARIANT_BY_CATEGORY single), R10 (template-composer simpleHash determinism)
- **Dependencies**: none — independently shippable
- **Research**: [researcher-01-block-variant-similarity.md §1-3](./research/researcher-01-block-variant-similarity.md)

## Overview
- **Date**: 2026-04-14
- **Description**: `pickWeightedVariant()` hiện random trong 1 pool cố định per (category × blockType). Pool giống nhau cho mọi restaurant → thống kê 1-2 variant dominant thắng (~60% share của 1 hero variant). Phase này thay pure `Math.random()` bằng seeded shuffle dựa trên business name + rotate pool order để mỗi business có distribution khác.
- **Priority**: P1
- **Implementation status**: pending
- **Review status**: not reviewed
- **Effort**: 2h

## Key Insights
- Pure `Math.random()` không cho reproducibility nhưng vẫn collapse về dominant variants do pool thứ tự cố định
- Seeded shuffle (Fisher-Yates với seed từ `hashBusinessName`) phân bố đều hơn mà vẫn deterministic
- `NAV_VARIANT_BY_CATEGORY` cần thành mảng 3-4 option thay vì single, pick theo seed

## Requirements
- `pickWeightedVariant(blockType, validVariants, category, seed)` nhận thêm `seed` arg
- Output distribution: khi gen 20 businesses khác nhau cùng category, không variant nào chiếm >35%
- Deterministic: same business name → same variant pick (reproducibility khi regen)
- `NAV_VARIANT_BY_CATEGORY` từ `string` → `string[]` (3-4 variants)
- `template-composer.selectVariant()` nhận thêm entropy từ `businessDescription` hash, không chỉ business name

## Architecture

### Decisions
- **Seeded shuffle helper**: Tạo `src/lib/ai/seeded-random.ts` (hoặc reuse `generate-blocks.ts:createSeededRandom`). Export `seededShuffle<T>(arr, seed)` + `seededPick<T>(arr, seed)`.
- **Pass seed through**: `pickWeightedVariant` caller chain (sanitizeBlockData) cần propagate `themeSeed` (đã có trong openai-generator.ts). Add optional `seed?: number` param, default to `Math.random()` nếu absent.
- **Nav variant rotation**: Đổi `NAV_VARIANT_BY_CATEGORY: Record<string, string>` → `Record<string, string[]>` với 3-4 variants per category. Update `structure-enforcer.ts:86` dùng `seededPick(variants, seed)`.
- **Compound seed for composer**: `selectVariant(blockType, seed, category)` → `selectVariant(blockType, seed ^ hashString(businessDescription ?? ''), category)`. XOR thêm entropy.

### Trade-offs
- **Pro**: Deterministic + distribution đều, không phá backward compat (fallback random nếu seed absent)
- **Con**: Mất hoàn toàn `Math.random()` variance trong cùng 1 business (nhưng đó là good — user regen phải được kết quả stable)

## Related code files
- `src/lib/ai/openai-generator.ts:452-722` (CATEGORY_VARIANT_WEIGHTS + pickWeightedVariant)
- `src/lib/ai/openai-generator.ts:920-940` (call site trong sanitizeBlockData)
- `src/lib/ai/category-requirements.ts:129-144` (NAV_VARIANT_BY_CATEGORY)
- `src/lib/ai/structure-enforcer.ts:86` (nav override site)
- `src/lib/ai/template-composer.ts:43-65` (selectVariant + simpleHash)
- `src/lib/ai/seeded-random.ts` (NEW)

## Implementation Steps
1. Tạo `src/lib/ai/seeded-random.ts` với `createSeededRandom(seed)`, `seededShuffle<T>(arr, seed)`, `seededPick<T>(arr, seed)`, `hashString(s)` helpers
2. Refactor `pickWeightedVariant(blockType, validVariants, category?, seed?)` — add seed param, dùng `seededShuffle(preferred, seed)[0]` thay vì `Math.random()`
3. Update call sites trong `sanitizeBlockData()` để pass `themeSeed` (đã có từ openai-generator.ts)
4. Đổi `NAV_VARIANT_BY_CATEGORY` type → `string[]`, backfill 3-4 variants mỗi category (14 cats)
5. Update `structure-enforcer.ts` nav override logic dùng `seededPick(variants, seed)`
6. Update `template-composer.selectVariant()` — compound seed với `hashString(businessDescription)` XOR
7. Unit test: `src/__tests__/unit/lib/ai/variant-pool.test.ts` — 20 fake business names → variant distribution entropy ≥1.5 bits

## Todo list
- [ ] Create seeded-random.ts helper
- [ ] Refactor pickWeightedVariant to accept seed
- [ ] Update NAV_VARIANT_BY_CATEGORY to array
- [ ] Update structure-enforcer nav override
- [ ] Update template-composer selectVariant compound seed
- [ ] Propagate themeSeed through sanitizeBlockData call chain
- [ ] Unit test variant distribution entropy
- [ ] Run full AI test suite (expect 455 pass + new tests)

## Success Criteria
- Unit test: 20 distinct business names → `Set(variant picks).size ≥ 4` per block type
- No regression in existing 455 AI unit tests
- Regen cùng business name → identical output (reproducibility)
- Manual verify: gen 5 beauty salons different names → ≥3 distinct hero variants rendered

## Risk Assessment
- **Seed collision**: 2 business names có cùng djb2 hash → same variant. Mitigation: djb2 32-bit, collision rate negligible
- **Breaking call sites**: adding optional seed param shouldn't break, but test coverage ensures no caller regressions
- **Fallback path**: fallback composer dùng template-composer.selectVariant → compound seed thay đổi output cho user đã có site. Mitigation: same input → still same output (deterministic)

## Security Considerations
- N/A — pure refactor of random source, no user input path changes, no PII

## Next steps
- Phase 04 (variety measurement harness) baseline TRƯỚC phase này để quantify delta sau khi ship
- Sibling plan 2249 Phase 04 (layout recipes) sẽ consume `seeded-random.ts` helpers — keep API stable for cross-plan reuse
