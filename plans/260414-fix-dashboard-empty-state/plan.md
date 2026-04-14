---
title: "Fix dashboard empty state for failed site generation"
description: "Dashboard shows broken UI when site generation fails mid-way — add generationStatus field and check it"
status: done
priority: P0
effort: 2h
branch: staging
tags: [F03, dashboard, empty-state, bug-fix]
created: 2026-04-14
---

# Fix Dashboard Empty State for Failed Site Generation

## Problem

Dashboard chỉ check `totalDocs > 0` từ sites collection để quyết định show empty state hay full dashboard. Khi site generation fail giữa chừng (sau khi tạo site record nhưng trước khi tạo pages), user thấy dashboard với data trống/broken thay vì empty state hoặc recovery UI.

## Root Cause

- `generate-site/route.ts`: tạo site record trước, tạo pages sau — nếu pages fail, site record vẫn nằm trong DB
- `OverviewView.tsx`: chỉ count sites, không check site có content hay generation có hoàn tất
- `Sites.ts`: không có field nào track generation status

## Solution

Thêm `generationStatus` field vào Sites collection, set status trong generate flow, và update dashboard logic để filter theo status.

## Phases

| Phase | Title | Status | File |
|-------|-------|--------|------|
| 01 | Add `generationStatus` field + migration | **done** | [phase-01](phase-01-generation-status-field.md) |
| 02 | Update generate-site route to set status | **done** | [phase-02](phase-02-update-generate-route.md) |
| 03 | Update dashboard empty state logic | **done** | [phase-03](phase-03-dashboard-logic.md) |
| 04 | apply-template status + smart failed logic | **done** | [phase-04](phase-04-apply-template-status.md) |
| 05 | Polish failed UI — softer tone + 2 CTAs | **done** | [phase-05](phase-05-failed-ui-polish.md) |

## Files Changed

| File | Phase | Change |
|------|-------|--------|
| `src/collections/Sites.ts` | 01 | Add `generationStatus` select field |
| `scripts/db-setup.js` | 01 | Add migration for new column |
| `src/app/api/ai/generate-site/route.ts` | 02 | Set generating/completed/failed |
| `src/components/dashboard/views/OverviewView.tsx` | 03 | Filter by generationStatus, show recovery UI |
| `src/app/(dashboard)/sites/page.tsx` | 03 | Filter sites list, show failed badge |
| `src/components/dashboard/DashboardGenerationFailed.tsx` | 03 | New recovery UI component |
| `src/app/api/ai/apply-template/route.ts` | 04 | Add generationStatus + smart catch |
| `src/app/api/ai/generate-site/route.ts` | 04 | Smart failed logic (partial success) |

## Verified — Không cần sửa

| File | Lý do |
|------|-------|
| `src/components/dashboard/views/AnalyticsView.tsx` | Check analytics data (views/clicks=0), không check site existence |
| `src/components/dashboard/AnalyticsEmptyState.tsx` | Analytics-specific, không liên quan site generation |
| `src/components/dashboard/views/SEOView.tsx` | SEO data check, independent of generation status |

## Out of Scope

- Re-generate flow (delete-before-create → create-before-delete) — separate PR
- Transaction/rollback logic
- Pages collection changes
