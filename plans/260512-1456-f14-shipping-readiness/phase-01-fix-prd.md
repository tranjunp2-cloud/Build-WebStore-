# Phase 01 — Fix PRD inconsistencies

> **Priority:** P0 (BLOCKER for Phase 02/03) | **Status:** ⬜ Pending | **Size:** S
> **Owner:** docs-engineer | **Estimated:** 30 min

## Context Links
- PRD: [`docs/prd/F14-shipping.md`](../../docs/prd/F14-shipping.md)
- Stories: [`docs/stories/F14-shipping-stories.md`](../../docs/stories/F14-shipping-stories.md)
- QA: [`docs/qa/F14-shipping.md`](../../docs/qa/F14-shipping.md)
- Audit report: [`plans/reports/Explore-260512-1449-prd-design-gap-audit.md`](../reports/Explore-260512-1449-prd-design-gap-audit.md)
- Schema source: [`src/collections/Sites.ts:330`](../../src/collections/Sites.ts) (shippingConfig group)

## Overview
PRD F14 v1.1 có nhiều lệch lạc với stories file và code thực tế. Phase này dọn dẹp để PRD trở thành single source of truth cho Phase 02/03.

## Key Insights
- Stories file đã tồn tại (`F14-shipping-stories.md`) nhưng PRD §0 vẫn ghi "F12-shipping-stories.md chưa có" → confusion.
- US-F14-03 trong stories file là **Mobile UX**, không phải "Checkout by State AC" như PRD §0 mô tả.
- Schema `Sites.shippingConfig` chỉ có `westRate/eastRate/freeAbove` — không có `westDays/eastDays`.
- Wave 6 đã chốt: flat-rate only, MYR only, no multi-seller isolation.

## Requirements

### Functional
- F1.1: Update §0 Story Traceability — đúng story ID, file path, status
- F1.2: Update §4 Scope — bỏ "estimated delivery days per region"
- F1.3: Update §7 FR table — xoá FR-07, đánh lại số FR-08 (Mobile Numpad) → FR-07
- F1.4: Update §13 Data Model — xoá `westDays/eastDays` khỏi `shippingConfig`
- F1.5: Update §10 Screen Layout — bỏ section 10.x estimated days nếu có
- F1.6: Fix §14 → §17 numbering — thêm §15 API Spec (link sang architecture) + §16 Test Strategy (link sang QA)
- F1.7: Thêm BR-06: max shipping rate = RM 1,000 (1000_00 sen) — confirm theo TC-F14.15
- F1.8: Update BR-05: SST 6% computed on subtotal ONLY — explicit "excludes shipping fee"
- F1.9: Confirm Free shipping condition: `subtotal >= freeAbove` (TC-F14.08)
- F1.10: Update §18 Definition of Ready — mark "Stories approved" cần Stories status = Ready

### Non-functional
- N1.1: Giữ format markdown hiện tại (Vietnamese mix English)
- N1.2: Không xoá thông tin lịch sử (Wave 7+ scope giữ nguyên)
- N1.3: Update header version: 1.1 → 1.2, date: 2026-05-12

## Related Code Files
- **Modify:** `docs/prd/F14-shipping.md`
- **Read for context:** `src/collections/Sites.ts`, `docs/stories/F14-shipping-stories.md`, `docs/qa/F14-shipping.md`

## Implementation Steps
1. Read full PRD `docs/prd/F14-shipping.md` để nắm structure
2. Update §0 traceability table với US-F14-01/02/03 (status từ stories file)
3. Xoá warning block "F14 chưa có Story file riêng" — file đã có
4. §4 Scope: bỏ "estimated delivery days per region"
5. §7 FR table: xoá FR-07, renumber FR-08 → FR-07
6. §10 Screen Layout: confirm 3 section còn hợp lệ (Settings, Checkout, Mobile, States)
7. §13 Data Model: xoá `westDays`, `eastDays`
8. §13 API Endpoints: confirm 3 endpoint đúng (sẽ chi tiết hoá ở Phase 03)
9. §14 Dependencies giữ nguyên
10. Insert §15 API Spec → "See `docs/architecture/F14-shipping.md`"
11. Insert §16 Test Strategy → "See `docs/qa/F14-shipping.md`"
12. §17 9-Point Checklist giữ nguyên
13. §8 Business Rules: thêm BR-06 (max rate), refine BR-05 (SST excludes shipping)
14. Update header: version 1.2, date 2026-05-12
15. Lint markdown: `npx markdownlint docs/prd/F14-shipping.md` (nếu có config)

## Todo List
- [ ] §0 traceability fixed
- [ ] §4 Scope cleaned
- [ ] §7 FR renumbered
- [ ] §13 Data Model aligned with schema
- [ ] §8 BR-05/06 added/refined
- [ ] §15, §16 inserted (link out)
- [ ] §10 Screen Layout placeholders sẽ fill ở Phase 02 — note "TBD Phase 02"
- [ ] Header version bumped

## Success Criteria
- PRD đọc xuyên suốt, không còn note "Pending story" cho item đã có
- Schema field trong §13 = field trong `Sites.ts` (chỉ 3 field)
- Section numbering liên tục §0 → §19
- Reference path `[F14-shipping-stories.md]` đúng (không phải F12)

## Risk Assessment
- **Risk:** Edit conflict nếu có người khác đang sửa PRD. Mitigate: branch riêng, không touch concurrent.
- **Risk:** Xoá nhầm thông tin Wave 7+. Mitigate: chỉ touch field "estimated days" — Wave 7+ block giữ nguyên.

## Security Considerations
N/A — docs only.

## Next Steps
- Phase 02 cần PRD đã fix để fill `docs/design/F14-shipping-design.md` link references
- Phase 03 cần PRD §13 sạch để viết architecture API spec khớp schema
