# Self-Audit — Plan 2253 vs 13 Root Causes

**Date**: 2026-04-15
**Auditor**: em (self-check after full cook)
**Plan**: [plan.md](../plan.md)
**PR**: #603
**Method**: (1) read code state, (2) compare vs claims trong plan + PR description, (3) verify vs measurement data trong `variety-baseline/post-fix-v2.json`

---

## TL;DR

| R | In plan scope? | Claimed | Actual | Severity |
|---|---|---|---|---|
| R1 mandatoryBlocks cố định | ❌ deferred to 2249 | n/a | correctly deferred | — |
| R2 variant pool collapse | ✅ Phase 01 | fixed | ✅ **functionally fixed**, hero share ~36% (target 35%) | close |
| R3 preset clustering | ✅ Phase 02 | fixed | ✅ **clean win** | — |
| R4 businesses[0] hardcode | ✅ Phase 03 | fixed | ⚠️ **PARTIAL / OVERSIGHT** — see below | **HIGH** |
| R5 padItems pool reuse | ✅ Phase 03 + amendment | fixed | ✅ **fixed after v2 amendment**, library cap remains | — |
| R6 font pair dedupe | ✅ Phase 02 | fixed | ✅ **clean win** | — |
| R7 image keywords 3-5 | ❌ deferred to 2249 | n/a | correctly deferred | — |
| R8 personality clustering | ❌ deferred to 2249 | n/a | correctly deferred | — |
| R9 nav variant single | ✅ Phase 01 | fixed | ✅ **clean win** | — |
| R10 simpleHash determinism | ❌ skip (fallback non-goal) | not fixed | correctly deferred | — |
| R11 prompt boilerplate | ❌ deferred to 2249 | n/a | correctly deferred | — |
| R12 composition hint soft | ❌ deferred to 2249 | n/a | correctly deferred | — |
| R13 theme override post-parse | ❌ Plan E pre-ship | pre-existing | partial (Plan E injects soft hint, not hard hex) | — |

**Em tự báo cáo thành thật**: 4 wins (R3/R5/R6/R9 clean), 1 close-to-target (R2), **1 partial + oversight bug (R4)**, 7 deferred đúng.

---

## 🚨 Audit finding — R4 partial fix + hidden oversight

### Claim
Phase 03 ship `pickSeeded(content.businesses, ctx.seed)` thay hardcode `businesses[0]` → rotate BusinessSample per-business seed.

### What actually happens in code
**File**: `src/lib/ai/content-injection.ts`

```ts
// Line 32: local pickSeeded helper (UNCHANGED from pre-plan)
function pickSeeded<T>(arr: readonly T[], seed: number): T | undefined {
    if (arr.length === 0) return undefined
    const idx = Math.abs(Math.floor(seed)) % arr.length  // ← MODULO, not Fisher-Yates
    return arr[idx]
}

// Line 91: my R4 fix
const biz: BusinessSample | undefined =
    pickSeeded(content.businesses, bizSeed) ?? content.businesses[0]
```

**Problem #1**: `pickSeeded` dùng modulo arithmetic trên pool 5 items. Đây là **EXACT same bug** em fix cho R3 (pickCategoryTheme modulo-5 clustering) — nhưng em không áp dụng cùng fix cho R4. Cần replace `pickSeeded` → `seededShufflePick` từ shared `seeded-random.ts`.

**Problem #2 (the real bug)**: 4 block types KHÔNG dùng `biz` variable:
- `service-cards` (line ~200)
- `features` (line ~161)
- `stats` (line ~175)
- `team` (line ~186)

Các cases này return **hardcoded object literal** với `services/features/stats/members` fields là static constants:

```ts
case 'service-cards':
    return {
        services: [
            { icon: '⭐', title: 'Premium Service', description: '...' },
            { icon: '🚀', title: 'Fast Delivery', ... },
            ...
        ],
    }
```

→ R4 fix (rotate biz pick) **không bao giờ chạm** 4 block types này.

### Measurement evidence (from variety-post-fix-v2.json)

```
beauty    service-cards[0].title: 1/10 distinct → ['Premium Service']
tech      service-cards[0].title: 1/10 distinct → ['Premium Service']
realestate service-cards[0].title: 1/10 distinct → ['Premium Service']
fitness   service-cards[0].title: 1/10 distinct → ['Premium Service']
```

**40 out of 40 generated sites** (across 4 categories) có service-cards block với title đầu tiên là **"Premium Service"**. Đây chính xác là cái scenario R4 original diagnosis mô tả:
> "2 beauty salon khác nhau đều có services: ⭐ Premium Service..."

**R4 fix của em giải quyết ~20% của root cause (biz-dependent blocks: hero headline, about body, cta subheadline, contact fields, footer tagline) nhưng để sót ~80% visible impact (service-cards/features/stats/team hardcoded)**.

### Why measurement harness đã miss cái này
Em chỉ measure `testimonialOverlapPct` trong `computeContentCollision()`. Không measure service-cards/features/stats/team. Harness cần expand metric scope — defer to followup.

---

## R2 — partial target hit

### Measurement
Hero top-variant share post-fix-v2:
- beauty: 60% (small-sample variance, baseline was 50%)
- restaurant: 30% ✅
- tech: 40% ⚠️ (target 35%)
- realestate: 20% ✅
- fitness: 40% ⚠️

3/5 categories hit target ≤35%, 2/5 close, 1/5 (beauty) even regressed (likely variance with n=10).

### Honest assessment
Functionally Phase 01 seeded shuffle works (unit tests pass, distribution measurable). Target threshold `≤35%` chỉ partially met. Increasing run count 10→20 per category sẽ stabilize, but the underlying pool size (5 variants × preferred subset) sets a floor around 25-30% minimum dominance.

Not an oversight — a realistic expectation miscalibration trong plan target.

---

## R5 — fixed after amendment, library cap remains

v1 ship had regression (em introduced `rotateSlice` với modulo). Amendment v2 switched sang `seededShuffle` (Fisher-Yates) — measurably fixed 4/5 cats.

Tech still 76% collision because:
1. Library pool = 5 testimonial samples
2. Phase 02 hard theme prompt converges GPT-4o output

Need library expansion (5 → 10+) + possibly soft theme hint. Plan 2253 tìm non-goal. Follow-up.

---

## R13 — correction to my PR claim

PR #603 description nói R13 "deferred to sibling plan 2249" — nhưng thực tế Plan E (`260414-1630-phase-08-audit/`) đã ship **BEFORE** #555 merge và đã inject preset hex + font name vào system prompt:

```ts
// system-prompt.ts:237-258 — pre-555 state
themeSection = `
## REQUIRED THEME (use these EXACT values...)
  "primaryColor": "${preset.primaryColor}",
  "secondaryColor": "${preset.secondaryColor}",
  "fontHeading": "${fontPair.fontHeading}",
  ...
Mood: ${moodHint(...)}.
Write hero headlines ... that reinforces this mood.
```

Đây là **exactly what R13 fix proposal đề xuất**: "Inject hard hex + font name vào system prompt BEFORE AI call". Plan E đã ship. R13 thực tế đã được fix trước Plan 2253.

→ Correction: R13 status = **pre-existing fix (Plan E, shipped in #555)**, not "deferred". PR description inaccurate. Not a functional issue nhưng em nên note khi update journal.

---

## What em cần sửa (amendment v3)

### Critical — R4 complete fix (~30 min)
1. Replace local `pickSeeded` helper với import `seededShufflePick` từ `seeded-random.ts` (Fisher-Yates)
2. Rotate service-cards / features / stats / team hardcoded blocks — 2 options:
   - **Option A (minimal)**: Keep hardcoded literals nhưng seed-pick among 2-3 preset variants của mỗi block type
   - **Option B (proper)**: Drive from `content/*.ts` industry samples that already exist (`biz.features`, `biz.services` fields if present) — needs content schema audit + per-category library expansion
3. Update measurement harness: add `computeBlockItemCollision(blockType, field)` to catch similar future oversights on features/services/stats/team
4. Re-run post-fix-v3 measurement → verify service-cards diversity ≥5/10

### Nice-to-have
- R13 PR description correction (docs only)
- R2 more runs (20/cat) to stabilize variance signal
- R5 library expansion (5 → 10) for tech + restaurant — defer to follow-up plan

---

## Honest rating

**Plan 2253 phase 01-04 v2**: 
- 4 clean fixes (R3, R5, R6, R9)
- 1 close-to-target (R2)
- 1 partial with significant hidden oversight (R4)
- 6 correctly deferred

Em claim "ship 7/13 root causes fixed" trong PR description không chính xác. Nên là **"6.5/13 — 4 clean + R2 close + R4 partial"**. Audit cho phép anh quyết định merge PR hiện tại hoặc chờ R4 amendment v3.

---

## Next step

Em propose:
1. Ship R4 amendment v3 trong cùng PR #603 (~30 min work)
2. Re-run measurement trên v3 → update variety-delta with service-cards diversity
3. Update PR description với audit findings + final numbers
4. Anh review PR

Alternative: merge PR hiện tại với audit note, create followup ticket cho R4 amendment. Nhanh hơn nhưng khó verify sau.

**Recommendation em**: Fix R4 ngay trong cùng PR. Cost thấp (30 min), value cao (audit khẳng định đây là root cause visible nhất của plan).
