# PW1 exporter — sửa findings trước commit, 24/09/2026

Người yêu cầu duyệt xử lý các findings từ `pw1-precommit-review-20260924.md`.

## Nguyên nhân và sửa đổi

- Resolver SKU dùng Product ID làm chủ mã nên cho phép hai variant cùng Product chiếm một mã. Đặt trước các mã gốc sibling và kiểm tra tất cả mã đã cấp trước khi chọn hậu tố/index tiếp theo. Không còn loại Product hợp lệ vì collision do mapper tạo ra.
- Validator kiểm tra từng domain receipt nhưng thiếu ràng buộc cardinality theo Site emitted. Bổ sung đúng một receipt, kiểm field mapped đầy đủ/duy nhất và từ chối Store không emit, đồng bộ importer. Contract cũ không bị yêu cầu receipt mới.
- README còn exit semantics cũ và mô tả config là bản sao nguyên trạng snapshot cũ. Cập nhật outcome hiện hành, provenance theo run và domain PW1.

## Kiểm chứng nguyên nhân

- Trước sửa: fixture SKU chỉ xuất Product 100, loại Product 200; sau sửa xuất cả hai với warning đổi SKU đúng policy.
- Trước sửa: artifact có receipt domain lặp và hash mới vẫn valid; sau sửa bị từ chối `CLASSIFICATION_EVIDENCE_INVALID`.
- Thêm 14 regression cases: 2 SKU, 12 domain/compatibility. Test đơn vị nhập trực tiếp code nguồn, không mô phỏng lại thuật toán.
- Review độc lập không có finding P1/P2 mới. Kết quả kiểm tra toàn repo cuối ghi trong báo cáo review, gồm cả lỗi timer không ổn định ngoài phạm vi exporter nếu có.

## Phạm vi

Không thay schema DB, không ghi DB, không sửa CSV, không commit/push hoặc export lại PROD. Contract 1.10.5 giữ nguyên cấu trúc/policy; sửa thực thi uniqueness và receipt integrity của contract hiện hữu. Issue/PR được cập nhật riêng theo quyết định người dùng và phân biệt code đã push với code local.
