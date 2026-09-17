---
title: "F40 Soi CSDL 1-to-1 UI/UX clarity"
status: completed
branch: feat/F40-migration-reconciliation-ui-ux
---

# Mục tiêu

Làm tab **Soi CSDL 1-to-1** dễ quét cho Tester, đồng thời không để catalog/mock hiện tại bị hiểu là bằng chứng PW2 thật.

## Phạm vi

1. Thay KPI “Độ khớp” bằng summary theo trạng thái: cần xem, thiếu PW2, khớp có dữ liệu và cả hai trống/chưa xác minh.
2. Thêm filter trạng thái, mặc định ưu tiên record cần xem; giữ filter theo loại dữ liệu và tìm kiếm.
3. Chuyển record thành accordion: header nêu kết quả, chỉ mở bảng field khi cần kiểm tra.
4. Giảm thông tin lặp ở field khớp, chỉ hiện hướng dẫn sửa ở field có vấn đề; phân biệt rõ “cả hai trống” với “khớp có dữ liệu”.
5. Cải thiện responsive, accessibility và empty state.

## Không làm

- Không thay đổi mapping/database logic hay tự nhận cột PW2 là dữ liệu thật.
- Không thay đổi schema/API.

## Kiểm chứng

- Unit test helper phân loại trạng thái dữ liệu.
- E2E hiện có vẫn kiểm tra scope theo trang; bổ sung assertions cho filter/accordion nếu fixture E2E khả dụng.
- `npm run typecheck`, QA unit suite, review code.

## Kết quả

- Hoàn tất UI trạng thái, accordion, bảng 4 cột, empty state và các nhãn a11y.
- TypeScript và unit suite Field Inspector đều pass; E2E đã bổ sung kịch bản cho filter/accordion (cần account E2E mới thực thi được).
