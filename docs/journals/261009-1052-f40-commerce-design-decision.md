---
title: Quyết định thiết kế đối soát Commerce F40
date: 2026-10-09
---

# Quyết định thiết kế đối soát Commerce F40

## Bối cảnh

Tab Commerce hiện ghép field evidence F42 với phần mapping ledger riêng. Ảnh người dùng cung cấp cho thấy 74,8% field đã được kiểm tra và 100% khớp trong phần đã kiểm tra; đây chưa phải kết luận Commerce hoặc cutover toàn diện. F40-11 ban đầu soi field theo trang, còn F40-14 mở rộng sang toàn bộ lịch sử Product, Order, Discount và Customer của store.

## Việc đã làm

Đã đọc PRD, stories, các phase F40-14, kế hoạch field evidence F42, tài liệu bàn giao local, UI, reader, ledger provider và summary của producer. Đã so sánh ba hướng: chỉ sửa UI, triển khai toàn bộ một lần và bàn giao bằng chứng theo giai đoạn. Người dùng chấp thuận hướng ba tầng, bao phủ toàn bộ nguồn PW1 đã chọn trước khi exporter lọc. Báo cáo thiết kế nằm ở `plans/reports/261009-1052-f40-commerce-reconciliation-design.md`.

## Quyết định và tác động

Hiển thị riêng độ phủ nguồn, độ đúng phần import và quyết định QC; mỗi tầng có mẫu số, Store/run/snapshot, sáu trạng thái, chi tiết record/field và các gap chưa xử lý. QC website vẫn độc lập. F42 chịu trách nhiệm chứng minh dữ liệu và rule; F40 chịu trách nhiệm API đọc an toàn và UI; QC chốt field bắt buộc và ký nghiệm thu.

## Bước tiếp theo

Khi được yêu cầu, chuyển thiết kế đã duyệt thành kế hoạch triển khai theo phase, dependency F42/F40/QC và gate kiểm thử. Phiên này chưa triển khai code.
