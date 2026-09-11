---
title: "Mock fixtures cho UI Soi CSDL 1-to-1"
status: completed
branch: feat/F40-migration-reconciliation-ui-ux
---

# Mục tiêu

Cung cấp dữ liệu minh họa an toàn, chỉ ở catalog mock, để QA nhìn được toàn bộ trạng thái UI của màn Soi CSDL 1-to-1.

## Phạm vi

1. Bổ sung fixture có các field: khớp có dữ liệu, cả hai trống, warning/error, null/mất dữ liệu.
2. Bổ sung bản ghi mất ở PW2 và bản ghi dư ở PW2 để xác nhận badge/empty state cấp record.
3. Giữ nguyên API, schema và dữ liệu live; fixture chỉ dùng trong catalog demo hiện có.
4. Bổ sung assertion unit cho fixture/status quan trọng.

## Kiểm chứng

- TypeScript, unit suite Field Inspector và kiểm tra catalog không phá scope trang.

## Kết quả

- Fixture phải được bật rõ ràng từ T001 qua query `ui_demo=1`; không pha vào dữ liệu live/fallback thông thường.
- UI hiện thông báo nguồn dữ liệu mẫu; fixture bao phủ khớp có dữ liệu, cả hai trống, thiếu/lệch, thiếu PW2 và dư PW2.
