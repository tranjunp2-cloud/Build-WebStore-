# Product description — giữ nguyên nguồn (18/09/2026)

## Quyết định và implementation

Theo yêu cầu user, giữ toàn bộ chuỗi CSV products.description và description_ms, không kiểm tra/loại nội dung bên trong. Exporter 1.6.0 ghi vào description / descriptionBM dưới dạng Lexical root → paragraph → một text node. Text bằng nguyên chuỗi CSV đã decode: không trim, decode HTML entity, chuẩn hóa xuống dòng, bỏ thẻ/attribute hoặc truncate. Empty string được giữ; null/missing không tạo document.

Đây là envelope lưu nguyên HTML dưới dạng text, không phải HTML được render hoặc chuyển thành rich text hoàn chỉnh. Workflow rich text riêng cần đọc text gốc để xử lý sau. Không trích ảnh trong description thành media downloads. Gallery Product, Blog và Pages giữ kiểm tra hiện tại.

Không còn sinh các PRODUCT_DESCRIPTION_* diagnostics hoặc RAW_VALUE_UNVERIFIED trên hai field này trong lần export mới. Không xóa diagnostics khỏi artifact cũ. Product vẫn có thể bị quarantine vì lỗi giá/SKU/category/identity ngoài description.

Importer đã nhận exact version/hash 1.6.0, giữ khả năng đọc contract cũ và không bỏ gate khác. Không thay schema collection/DB.

## Kiểm chứng

- Exporter: 471 tests/32 files pass; bổ sung kiểm tra CSV quoting + CRLF + HTML qua full artifact pipeline.
- Importer: suite 239 tests pass trước khi thêm case 1.6.0; focused v3 contract 66 tests pass gồm prepare/load version mới và kiểm tra false outcome bị từ chối.
- Dữ liệu thật, kiểm tra riêng mapper và JSON round-trip: PROD 45,224 Product rows / 90,448 description fields; DEV 23,386 Product rows / 46,772 description fields. Tất cả khớp nguyên văn, không tạo media/diagnostic description, SHA-256 CSV trước/sau không đổi.
- Field-level check bao gồm cả Product chưa đủ điều kiện export; số trên không phải số Product đã có trong master.
- Chưa chạy lại full export PROD/DEV hoặc apply DB. Cần export lại để có master với nội dung nguyên văn; không dùng báo cáo 1.5.1 để kết luận lỗi description vẫn còn trên code 1.6.0.

Bằng chứng phiên làm việc: `/tmp/pw1-description-real-check.json`, `/tmp/pw1-description-*.log` (tạm, có thể mất sau cleanup).
