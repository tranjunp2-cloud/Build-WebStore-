---
date: 2026-09-14
session: discount-mapping-findings-fix
scope: research-artifact-only
---

# Nhật ký sửa mapping Discount

## Bối cảnh và thay đổi

Sửa join nguồn và timestamps Discount; theo yêu cầu, phần hook ngày hiệu lực chỉ ghi gap, không sửa runtime/schema.

## Kiểm chứng

7 Discount có createdAt từ code và updatedAt max code/parent. So sánh CSV độc lập xác nhận chỉ timestamps thay đổi; Customer/Order và startsAt/expiresAt giữ nguyên. Manifest pin nguồn và giữ crosswalk/raw timestamps; backup trước khi ghi. Replay không thay đổi; 171 migration tests passed, gồm 10 Discount.

## Nhận xét và quyết định

Đúng timestamp lịch sử không đồng nghĩa đúng ngày hiệu lực khi import. Giữ gap PW2_DISCOUNT_DAY_BOUNDARIES tách riêng giúp không vô tình coi repair artifact là đã sửa hook.

## Còn lại

Discount giữ inactive; cần xử lý hook biên ngày và khác biệt end exclusive/inclusive trước kích hoạt. Chưa import DB, không đổi schema/runtime.

Chi tiết backup/bằng chứng: [report Discount](../../plans/reports/260914-1612-discount-mapping-findings-fix.md).
