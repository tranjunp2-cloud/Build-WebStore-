---
title: "F33 Discount Dashboard UI"
description: "Custom seller dashboard pages for discount management (S1 list, S2 form, S4 usage history) at (dashboard)/discounts/ — same pattern as /orders and /customers."
status: complete
priority: P2
effort: 5h
branch: staging
tags: [f33, discounts, dashboard, ui, seller]
created: 2026-06-01
---

# F33 — Discount Dashboard UI

Custom Next.js dashboard pages for seller discount management. Backend APIs are fully done. This plan covers only the frontend dashboard UI.

**NOT Payload admin cells** — the real seller interface is the `(dashboard)/` route group, same as `/orders`, `/customers`, `/products`.

## Screens

| ID | Screen | Route | Phase |
|----|--------|-------|-------|
| S1 | Discount list + CSV export | `/discounts` | 1 |
| S2 | Create / Edit form | `/discounts/new`, `/discounts/[id]` | 2 |
| S4 | Usage history (read-only, all discounts) | `/discounts/usage-history` | 2 |

## Phases

| # | Phase | Status | Effort |
|---|-------|--------|--------|
| 1 | [S1 — Discount list page](phase-01-s1-discount-list.md) | complete | 2h |
| 2 | [S2+S4 — Create/Edit form + usage history](phase-02-s2-s4-form-and-history.md) | complete | 3h |

## API contract (done)

| Method | Endpoint | Used by |
|--------|----------|---------|
| GET | `/api/v1/discounts` | S1 list |
| POST | `/api/v1/discounts` | S2 create |
| GET | `/api/v1/discounts/[id]` | S2 edit |
| PATCH | `/api/v1/discounts/[id]` | S2 edit |
| DELETE | `/api/v1/discounts/[id]` | S1 delete action |
| GET | `/api/v1/discounts/export` | S1 export button |
| GET | `/api/v1/discounts/[id]/usage-history` | S4 |

## File ownership

| Phase | Owns (write) |
|-------|--------------|
| 1 | `src/app/(dashboard)/discounts/page.tsx`, `_components/discounts-*`, `src/components/dashboard/Sidebar.tsx`, `src/components/editor/EditorMenuDrawer.tsx` |
| 2 | `src/app/(dashboard)/discounts/new/`, `src/app/(dashboard)/discounts/[id]/`, `src/app/(dashboard)/discounts/usage-history/`, `_components/discount-form-*`, `_components/discount-usage-*` |

## Success criteria

- `/discounts` renders list with status/type/value/usage cells and Export CSV button.
- Create/Edit form validates, saves, shows error on duplicate code.
- Usage history tab renders read-only rows sorted by usedAt desc.
- Sidebar shows "Discounts" nav item between Orders and Customers.
- `npm run build` / typecheck passes. No DB migration needed.
