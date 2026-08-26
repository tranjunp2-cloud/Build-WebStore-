# Phase 01 — Review workflow setup

## Context links

- Parent plan: `./plan.md`
- Journal: `docs/journals/260419-template-gen-similarity-analysis.md`
- Existing route: `src/app/test-harness/[fixtureId]/page.harness.tsx` (from plan 260419-2022)
- Matrix source: `.harness-out/matrix.json` (run `npm run harness:gen`)

## Overview

- **Date:** 2026-04-19
- **Description:** Set up browseable review UI so anh (PM) có thể rà hết 56 blueprint trong 1 chiều. Hiện `/test-harness/[fixtureId]` render 1 fixture tại 1 URL; cần trang "index" list 56 card preview + link qua full render.
- **Priority:** P0 (unblock triage phase)
- **Implementation status:** pending
- **Review status:** n/a

## Key Insights

- 56 blueprint nhưng harness:gen ra 390 fixtures (× 5 seeds mỗi blueprint). Triage chỉ cần 1 seed/blueprint = 56 review items (seeds chỉ xoay variant + shuffle 2-3 block → không đáng review riêng).
- `/dashboard/templates-health` đã có (plan 260419-2022) nhưng chỉ show drift badge, không có preview layout. Extend hoặc tạo trang riêng.
- Local dev `next dev` → `/test-harness/[fixtureId]` hoạt động ngon; cần index page list tất cả + thumbnail.

## Requirements

**Functional**
- New page `src/app/test-harness/page.tsx` (index): list 56 blueprint với: blueprint id, category, preset name, thumbnail hoặc block count, link `/test-harness/[fixtureId]`.
- Filter by category (restaurant, tech, beauty...) + search by name.
- Thumbnail: screenshot lazy từ full render (defer — dùng category icon + block count trước).
- Side-panel: checklist triage verdict (OK / minor / major) — save tạm vào localStorage (no backend cost).

**Non-functional**
- Render <2s cho 56 items.
- Không thêm deps mới (reuse shadcn Card + Table).

## Architecture

```
/test-harness (index, NEW)
  ├── reads .harness-out/matrix.json
  ├── groups by blueprint (dedupe seeds, take seed=0)
  ├── renders card grid: 56 items
  └── localStorage key: "template-triage-verdicts"

/test-harness/[fixtureId] (existing)
  └── full SiteRenderer output (no change)
```

## Related code files

**To create**
- `src/app/test-harness/page.tsx` (index route, <120 lines)
- `src/app/test-harness/_components/triage-panel.client.tsx` (verdict chips + localStorage, <80 lines)

**To read for context**
- `src/app/test-harness/[fixtureId]/page.harness.tsx` — existing single-fixture route
- `scripts/test-harness/types.ts` — MatrixReport type (Fixture, HarnessResult)

**To modify** — none

## Implementation Steps

1. Đọc `.harness-out/matrix.json`, filter `source === 'blueprint' && compositionSeed` = seed0 per blueprint → 56 unique items.
2. Create RSC `/test-harness/page.tsx`:
   - `force-dynamic`
   - Fetch matrix.json via `fs/promises.readFile`
   - Group + dedupe by `presetIndex`
   - Render shadcn Card grid (3 cols desktop, 1 mobile)
   - Each card: title = preset name, subtitle = category, meta = block count + variants dominant
3. Create client island `triage-panel.client.tsx`:
   - 3 radio buttons: OK / Minor / Major
   - Textarea: note
   - Save to `localStorage.setItem('template-triage-verdicts', JSON.stringify({[fixtureId]: {verdict, note}}))`
   - Show counter in page header: "OK 12 | Minor 5 | Major 3 | Pending 36"
4. Add link card → `/test-harness/[fixtureId]` (opens full render in new tab).
5. Manual smoke: `npm run dev` → http://localhost:3000/test-harness → 56 cards visible + triage panel usable.

## Todo list

- [ ] Index page `src/app/test-harness/page.tsx`
- [ ] Client triage island
- [ ] localStorage persistence verified
- [ ] Manual smoke local
- [ ] PM test-drive 5 minutes before Phase 02 kickoff

## Success criteria

- 56 blueprints all listed + clickable.
- Triage verdict persists across page reload (localStorage).
- Summary counter updates realtime.
- Page renders <2s.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `.harness-out/matrix.json` thiếu khi deploy staging | Low | Medium | Route chỉ dùng local dev; gate behind `NODE_ENV !== 'production'` |
| localStorage data mất khi clear cookies | Medium | Low | Add export JSON button — tiện backup triage log vào repo |

## Security Considerations

- Trang dev-only. Gate `if (process.env.NODE_ENV === 'production') notFound()`.
- No DB write, no auth needed (local dev).

## Next steps

- Unblock Phase 02 (triage 56).
- Optional: export triage JSON → dump vào `plans/260419-2231-GH-1-per-template-quality-fix/reports/triage-verdicts.json`.
