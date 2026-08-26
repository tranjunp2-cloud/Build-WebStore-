---
title: "Harness admin dashboard — rubric score integration"
description: "Port static rubric HTML → React admin page + score overlay on fixture render + index integration"
status: pending
priority: P2
effort: 8h
branch: fix/F01-wave2-wix-detailed
tags: [harness, rubric, admin, ui, f01]
created: 2026-04-18
---

# Harness Admin Dashboard — Rubric Integration

## Context

Vừa ship rubric scorer (plan `260418-1730-template-quality-rubric`). Output hiện tại:
- `npm run harness:score` → `.harness-out/rubric-report.json` + static `rubric-report.html` (5MB)
- Static HTML phải `open` riêng, không integrate với harness UI

User muốn:
1. **Score badge** overlay trên từng fixture render (`/test-harness/<id>`) — biết ngay template đó pass/fail
2. **Admin dashboard page** React (thay HTML tĩnh) với filter + sort + drill-down
3. **Index integration** — `/test-harness` thấy score column per fixture

Mục tiêu cuối: gen 1 template từ harness → **tự đánh giá theo rubric** ngay tại UI, không cần run CLI.

## Research

- `research/researcher-01-scorer-integration.md` — scorer refactor plan, route strategy, UX proposal, open questions

## Phases

| # | Phase | Effort | Status | File |
|---|---|---|---|---|
| 01 | Extract scorer library module | 1h | pending | [phase-01-scorer-lib.md](phase-01-scorer-lib.md) |
| 02 | Score badge overlay on fixture render | 2h | pending | [phase-02-score-badge.md](phase-02-score-badge.md) |
| 03 | Admin dashboard page `/test-harness/admin` | 3h | pending | [phase-03-admin-dashboard.md](phase-03-admin-dashboard.md) |
| 04 | Index integration — score column + status filter | 1h | pending | [phase-04-index-integration.md](phase-04-index-integration.md) |
| 05 | Polish, docs, remove static HTML | 1h | pending | [phase-05-polish.md](phase-05-polish.md) |

Total: **8h**. Critical path linear 01 → 02 + 03 + 04 parallel → 05.

## Architecture Decisions

1. **Hybrid scoring**: pre-computed JSON (admin/index fast load) + on-demand (fixture detail always fresh)
2. **Routes** (all gated `.harness.tsx`, ENABLE_HARNESS=1):
   - `/test-harness/admin` — dashboard (new, explicit route before `[fixtureId]`)
   - `/test-harness/<id>` — fixture render + score overlay (extend existing)
   - `/test-harness` — index + score column (extend existing)
3. **Scorer lib**: Extract `scoreFixture()` + `evaluateCriterion()` from CLI → `scripts/test-harness/rubric/scorer-lib.ts`. CLI keeps thin wrapper.
4. **Client/server split**: admin dashboard server component (SSR data), interactive filters client component

## Goal Deliverables

Sau khi complete:
- Badge góc dưới phải mỗi fixture render: `✓ 9.2/10 Pass` (click expand → 8 dims)
- `/test-harness/admin` dashboard: 390 cards với filter pass/warn/fail + category + sort by score
- `/test-harness` index: score column next to fixture id, status dot (🟢🟡🔴)
- `npm run harness:score` vẫn chạy (pre-compute step trước khi user mở dashboard)
- Static `rubric-report.html` removed (không còn cần)

## Out of Scope

- Rubric v1.1 tighten evaluators — separate plan
- Sub-page scoring (only homepage scored currently)
- Export score report to CSV/PDF
- Historical score tracking (time-series)
- Diff view (compare fixture A vs B)

## Open Questions (user confirm before implementation)

1. Score badge default state: collapsed (1 pill) hay auto-expand (full panel)?
2. Admin dashboard route gating: anyone với ENABLE_HARNESS=1 có thể truy cập (current), hay cần admin auth?
3. Stale detection: nếu matrix.json updated sau rubric-report.json → UI warn "re-run harness:score"?
