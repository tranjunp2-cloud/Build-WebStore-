# Phase 04 — Tester UI, security và validation

## Overview

Priority P1. Present the Commerce and Settings results in the existing Migration Inspector without a technical dashboard overload.

## UI specification

```text
[ Đối soát Commerce ] [ Đối soát Settings ]

Commerce: [ Tổng quan ] [ Products ] [ Orders ] [ Discounts ] [ Customers ]
Settings: [ Tổng quan ] [ Profile ] [ Team ] [ Email ] [ Payment ] [ Delivery ] [ Domain ] [ Integrations ]

Products  1,248 PW1 | 1,245 PW2 | 3 thiếu | 2 lệch
[Tất cả] [Chỉ lỗi] [Thiếu] [Lệch] [Trùng] [Chưa xác minh] [Tìm mã/tên]

Mã / Tên | PW2 | Dữ liệu | Lỗi / thiếu gì
SKU-002  | Thiếu | — | Không thấy sản phẩm trên PW2
```

- Mỗi tab tính năng hiển thị count PW1/PW2, thiếu/dư/lệch/trùng/chưa xác minh; không trộn record của tính năng khác vào bảng.
- Row click mở side panel theo section: toàn bộ field được mapping, record con và quan hệ (ví dụ Product → SKU/variants, images, categories, SEO; Order → line items, payment, fulfillment, refund). Field chưa có target equivalent phải là `Không hỗ trợ`, không phải pass.
- Registry mapping versioned quyết định danh sách section/field; UI không hard-code danh sách field của migration thật. Fixture chỉ dùng để duyệt UI và luôn có nhãn Dữ liệu mẫu.
- No `KHỚP 100%` if mapping is unverified or any required field fails.
- Green = match; amber = unverified/warning; red = missing/duplicate/mismatch; gray = not scanned.
- Settings rows use the exact same table pattern, not nested side navigation.
- Responsive: table provides horizontal scroll and detail panel becomes full-screen at 375px.

## Related files

- Modify: `src/app/studio/qa/migration-diff/MigrationDiffClient.tsx` or extract focused child components.
- Create: `src/app/studio/qa/migration-diff/CommerceReconciliationPanel.tsx`
- Create: `src/app/studio/qa/migration-diff/SettingsReconciliationPanel.tsx`
- Create: `src/app/studio/qa/migration-diff/ReconciliationDetailPanel.tsx`
- Add E2E specs and QA matrix entries from phases 02/03.

## Implementation steps

1. Add the two tabs and summary cards; preserve existing visual/block/field inspector flows.
2. Reuse one generic paginated reconciliation table and one detail drawer to avoid four duplicated tables.
3. Add loading, empty, API error, disabled scan button and success/error toast states.
4. Ensure only super-admin can open API/UI; redirect unauthorized user using existing guard.
5. Execute unit, API and Playwright cases on desktop and 375px.
6. Run typecheck, relevant QA suite, diff check and security review before PR.

## Todo

- [ ] Build shared table/detail components.
- [ ] Wire Commerce and Settings tabs to paginated API.
- [ ] Validate responsive/error/empty/security states.
- [ ] Add test evidence and update docs.

## Success criteria

- A Tester can answer within one screen: migrated correctly, missing, mismatch, duplicate or unverified.
- Existing Migration Inspector behavior does not regress.
