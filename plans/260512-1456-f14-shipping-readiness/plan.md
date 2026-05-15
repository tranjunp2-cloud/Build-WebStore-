# Plan: F14 Shipping — Readiness for Dev

> **Created:** 2026-05-12 14:56 | **Branch:** `docs/F14-shipping-readiness`
> **Owner:** planner → docs-engineer → ui-ux-designer → planner
> **Goal:** Đưa F14 từ trạng thái "thiếu data" → "Ready for Dev" trước Wave 6 implementation.

---

## Context

F14 đã có PRD + Stories + QA nhưng:
- Thiếu Design (wireframe Settings/Checkout/Mobile)
- Thiếu Architecture (API contract, component tree)
- PRD inconsistency: traceability sai mapping, data model lệch scope, section numbering nhảy
- Stories chưa phủ hết QA TC (validate rate, live recalc, RM 0 order)

## Scope decisions (Wave 6 confirmed)

- ✅ Flat-rate only — **skip** estimated delivery days (`westDays`/`eastDays`)
- ✅ **Skip** multi-seller free shipping isolation — Cart store chưa hỗ trợ split theo seller
- ✅ **MYR only** — không cần multi-currency shipping config
- ⏳ Wave 7+: EasyParcel/Carrier API, tracking number live update

## Out of scope (this plan)

- ❌ Code implementation — chỉ doc readiness
- ❌ Test code — QA file đã sẵn, viết test khi vào Wave 6
- ❌ Migration script update — sẽ phụ thuộc decision §13 PRD

---

## Phases

| # | Phase | Status | File |
|---|-------|--------|------|
| 01 | Fix PRD inconsistencies | ✅ | [phase-01-fix-prd.md](phase-01-fix-prd.md) |
| 02 | Create design/wireframe doc | ✅ | [phase-02-create-design.md](phase-02-create-design.md) |
| 03 | Architecture + supplementary stories | ✅ | [phase-03-architecture-stories.md](phase-03-architecture-stories.md) |

## Dependencies

```
Phase 01 (PRD source of truth) → Phase 02 (design references PRD) → Phase 03 (architecture references both)
```

Sequential — không parallelize (Phase 02/03 phải đọc PRD đã fix).

## Definition of Done (plan-level)

- [ ] PRD §0 traceability đúng story ID/file
- [ ] PRD §10 Screen Layout không còn placeholder rỗng
- [ ] PRD §13 data model khớp `Sites.shippingConfig` schema thực tế
- [ ] `docs/design/F14-shipping-design.md` có 3 màn + mobile breakpoint
- [ ] `docs/architecture/F14-shipping.md` có API contract đủ 3 endpoint
- [ ] Stories file có thêm US-F14-04/05/06 phủ QA TC còn trống
- [ ] PR title: `docs(F14): readiness audit + design + architecture`

## Risk

- **Design quá chi tiết** → tốn thời gian không cần thiết cho Wave 6 (flat rate đơn giản). Mitigate: low-fi wireframe only, ref F19 settings layout pattern.
- **Architecture over-engineer** → API spec quá phức tạp cho flat rate. Mitigate: chỉ 3 endpoint, no caching layer, no rate-limit chuyên dụng.

## Reports

Save reports to `plans/260512-1456-f14-shipping-readiness/reports/`:
- `audit-260512-1449-prd-design-gap-audit.md` (existing, in `plans/reports/`)
- Phase outputs: `{type}-{date}-{slug}.md`
