---
title: "Fix 35 harness structural-fail từ wave 2 render"
description: "Root-cause + 2-phase fix cho stats:cards=0/3 (18) + features:grid-4=3/4 (17)"
status: pending
priority: P2
effort: 2h
branch: fix/F01-wave2-wix-detailed
tags: [harness, content-library, variant-validation, f01]
created: 2026-04-18
---

# Fix 35 harness structural-fail

## Context

Harness full chạy trên nhánh `fix/F01-wave2-wix-detailed` (local, 390 fixtures × 2 viewports, 21.4m render):

- **191 clean pass** (49%)
- **35 structural-fail** (9%) — chủ đề plan này
- **182 visual-hole** (47%) — runtime TypeError khi render, plan riêng

35 fails KHÔNG phải regression wave 2 (wave 2 chỉ thêm variants cho cta/team/about/stats/newsletter/faq — không đụng content library). Đây là pre-existing issue bị expose khi harness mở rộng coverage lên 390 fixtures (từ quick mode 12).

Plan fix trước khi merge PR để:
1. Clean baseline harness (0 fail) → wave 2 regression sau này phát hiện dễ
2. Content quality tốt hơn cho legacy composer path (8 categories thiếu stats)

## Root Cause

### Group 1 (18 fails) — `stats:cards=0/3`

| Fixture pattern | Category | Path |
|---|---|---|
| `*-legacy-starter-seed*` | beauty, restaurant, fnb, education, realestate, fitness, creative, business | legacy |
| `*-legacy-professional-seed*` | same | legacy |

**Cause:**
- `src/lib/ai/content/{beauty,restaurant,fnb,education,realestate,fitness,creative,business}.ts` — **KHÔNG có `stats:` array** (xác nhận bằng grep)
- Chỉ `tech.ts` có stats (3 items) — KHÔNG fail
- Legacy composer (`composeTemplate`) tạo stats block với variant=`cards` (weighted picker), data array rỗng
- `variant-validation.ts` → `VARIANT_MIN_CONTENT` KHÔNG có entry cho `stats` → `enforceMinContent` không downgrade → stats render empty

### Group 2 (17 fails) — `features:grid-4=3/4`

| Fixture pattern | Category | Path |
|---|---|---|
| `tech-blueprint-*-seed*` | tech | blueprint |
| `business-blueprint-*-seed*` | business | blueprint |
| `ecommerce-blueprint-*-seed*` | ecommerce | blueprint |

**Cause:**
- Blueprint hard-code variant `grid-4` (cần 4 items)
- Content source cho các category này return 3 features
- `enforceMinContent` có rule `features.grid-4 = 4` nhưng blueprint path có thể bypass sanitizer (cần verify)

## Fix Approach: Layered (guard + content)

### Phase 1 — Guard hardening (15 min, P0)

**Purpose:** Insurance — ngăn regression tương lai + auto-downgrade khi data thiếu.

**File 1: `src/lib/ai/variant-validation.ts`**

Thêm `stats` vào `VARIANT_MIN_CONTENT`:
```ts
stats: {
  grid: 3,
  cards: 3,
  'chart-bars': 3,
  row: 2,
  highlight: 1,
  'inline-text': 1,
},
```

**File 2: `src/lib/ai/openai-generator.ts` (line 1239)**

Thêm `stats` vào `contentArrays`:
```ts
const contentArrays = ['testimonials', 'features', 'items', 'images', 'plans', 'members', 'logos', 'stats']
```

→ Khi stats block có 0 items, `enforceMinContent` downgrade `cards` → `highlight` (min 1) hoặc `inline-text`. Pass harness.

**Trade-off:** Khi variant fallback, visual không còn "cards" nữa — nhưng vẫn render được thay vì empty. Nếu ai muốn `cards` thì phải fix content (Phase 2).

### Phase 2 — Content backfill (1.5h, P1)

**Purpose:** Restore intended variant quality — để stats renders đúng `cards`/`grid`/`chart-bars`.

**2a. Add stats arrays to 8 category content files**

Cho mỗi file, thêm 3+ stats items:
- `src/lib/ai/content/beauty.ts`
- `src/lib/ai/content/restaurant.ts`
- `src/lib/ai/content/fnb.ts`
- `src/lib/ai/content/education.ts`
- `src/lib/ai/content/realestate.ts`
- `src/lib/ai/content/fitness.ts`
- `src/lib/ai/content/creative.ts`
- `src/lib/ai/content/business.ts`

Template (copy shape từ `tech.ts:139`):
```ts
stats: [
  { value: '500+', label: 'Happy Customers' },
  { value: '15yr', label: 'Industry Experience' },
  { value: '98%', label: 'Satisfaction Rate' },
  { value: '24/7', label: 'Support Available' },
],
```

Content phải phù hợp category (beauty → clients, treatments, years; restaurant → dishes served, years, awards...).

**2b. Add 1 more feature item to tech/business/ecommerce content**

Verify bằng grep: `grep -A100 "features:" src/lib/ai/content/{tech,business,ecommerce}.ts` — nếu chỉ có 3 items thì thêm 1 item thứ 4 để match grid-4 blueprint.

Alternative nếu viết 1 feature mới khó: change blueprint variant từ `grid-4` → `grid-3` — nhưng sẽ break visual intent của blueprint designer.

## Critical Files

| File | Purpose | Change |
|---|---|---|
| `src/lib/ai/variant-validation.ts` | VARIANT_MIN_CONTENT rules | Add `stats` entry |
| `src/lib/ai/openai-generator.ts:1239` | contentArrays in sanitizer | Add `'stats'` |
| `src/lib/ai/content/{beauty,restaurant,fnb,education,realestate,fitness,creative,business}.ts` | Category content library | Add `stats: [...]` array (≥3 items) |
| `src/lib/ai/content/{tech,business,ecommerce}.ts` | Features arrays | Add 4th feature item (verify count first) |

## Verification

Sau mỗi phase chạy:

```bash
# Regenerate matrix + check (không cần render)
npm run harness:gen
npm run harness:check

# Check summary giảm fail
cat .harness-out/structural-report.json | node -e "
const r = require('fs').readFileSync(0, 'utf8') && require('./.harness-out/structural-report.json');
console.log('pass:', r.summary.pass, '| warn:', r.summary.warn, '| fail:', r.summary.fail);
"
```

**Success criteria:**
- Phase 1 done: fails drop from 35 → <5 (auto-downgrade catches most)
- Phase 2 done: fails = 0, `stats:cards` renders actual 3+ item cards
- Unit tests still pass: `npm test` → 6016/6016
- Typecheck clean: `npm run typecheck`

## Risks / Notes

- **Phase 1 alone** = workaround. Stats render as `highlight`/`inline-text` (simpler) instead of `cards`/`grid`. PM-visible quality hit. Acceptable cho short term.
- **Phase 2 content** cần tính chất category-appropriate — không copy-paste cùng stats cho 8 categories. Research các site thật trong ngành để lấy realistic numbers.
- **Features grid-4 trade-off**: nếu thêm feature item cần viết tiêu đề + mô tả tốt, không "đắp thêm cho đủ".
- Không đụng wave 2 variants (cta/team/about/newsletter/faq) — out of scope.

## Out of Scope (plan riêng)

- **182 visual-hole fails** (runtime TypeError khi render): `TypeError: Cannot read properties of undefined (reading 'split'/'label')`. Cần investigate block components với data wave 2 có field missing. Plan riêng vì root cause khác hẳn.
- **272 signature-blocks warnings**: category không có đủ mandatory blocks trong composition. Liên quan tới `CATEGORY_REQUIREMENTS.mandatoryBlocks` vs blueprint output.

## Next Steps

1. User review plan → approve
2. Execute Phase 1 (15 min) → re-run harness:check → expect <5 fails
3. Execute Phase 2 (1.5h nếu 8 categories) → re-run → expect 0 fails
4. Commit: `fix(f01): stats variant guards + content backfill for 8 categories`
5. Re-run harness full (21 min) để verify visual-hole count không tăng
6. Merge wave 2 PR
