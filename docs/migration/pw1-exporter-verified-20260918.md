# Phần exporter đã xác minh trước commit — 18/09/2026

## Phạm vi đã kiểm tra

- Giữ trạng thái Product, Blog và discount theo mapping đã chốt; giá trị ngoài miền vẫn có diagnostic.
- Không nhúng sites.pw1_source vào master; giữ archive CSV và bằng chứng phân loại. Giữ validation artifact lịch sử theo đúng version/hash.
- Tách trạng thái xuất thành công, đầy đủ dữ liệu và xác minh import. Thêm handoff theo Store; không tự bỏ blocker.
- Profile DEV tách namespace, không áp dụng Store hoãn riêng của PROD.
- Description Product và content chính Blog giữ nguyên chuỗi nguồn trong Lexical text; không cam kết hiển thị HTML tương đương. content_ms Blog vẫn ở CSV.
- Thiếu author Blog dùng owner duy nhất đã emit của cùng tenant.
- Product thiếu giá/stock bị cách ly; giá và stock bằng 0 vẫn hợp lệ.
- Phục hồi option từ selection hợp lệ của SKU nguồn; giữ ownership/parent checks, không sinh SKU/tổ hợp và không tự chọn SKU thắng khi trùng.

## Kiểm tra chạy lại trước commit

- Exporter: 494 tests / 32 files pass, gồm unit migration và integration artifact/CLI/config/wrapper.
- Importer local: 243 tests / 11 files pass, gồm exact contract 1.7.0 và các artifact lịch sử.
- TypeScript exporter: npx tsc --noEmit pass.
- Hash master mapping khớp constant exporter; contract importer hiện tại hỗ trợ cùng hash.
- Review độc lập tập trung outcome/archive/backward compatibility và catalog/content/EAV.
- Không ghi DB, không sửa hoặc xóa CSV nguồn.

Các đối soát dữ liệu thật đã thực hiện trước đó là kiểm tra field/mapper, không phải full export mới: Product descriptions 45,224 PROD + 23,386 DEV; Blog content 6,723 PROD + 2,108 DEV. Audit EAV phục hồi 21 Product PROD và 95 DEV, không có Product trước đó hợp lệ bị regression ở bước EAV. Các số này không chứng nhận toàn Product/Store đã import được.

## Chưa hoàn tất

- Chưa chạy lại full export PROD/DEV và chưa apply DB bằng artifact 1.7.0.
- Quy tắc bỏ Product thiếu giá/stock đã được nối đủ exporter/importer trong 1.8.0 (xem cập nhật bên dưới); các lỗi Order/quan hệ độc lập vẫn giữ.
- Blog category inactive, identity/lifecycle, slug trùng, Order/refund/discount và các conflict nguồn còn lại vẫn theo tracking riêng.
- DEV policy cần importer chấp nhận riêng; không đổi hash để vượt gate.
- Thay đổi repository importer và báo cáo chi tiết chứa giá trị nguồn không nằm trong commit code exporter này.


## Cập nhật sau review — 1.8.0

- Hoàn thiện policy loại Product thiếu giá/stock: warning có ID/reason, Product và catalog child rows chỉ giữ CSV với bằng chứng riêng. Không còn blocker chỉ vì các dòng này không map vào master.
- Kiểm tra SKU→Product bằng parent ownership; nguồn cũ với SKU direct Store vẫn được đọc theo contract cũ. Bản ghi đã soft-delete được giữ nhất quán trong bằng chứng loại trừ.
- Importer chỉ chấp nhận exact contract 1.8.0; kiểm tra metadata loại trừ, matching Product warning, Store/parent, không có operational contribution và Product không còn trong master. Không miễn diagnostic khác.
- Regression: 513 exporter tests / 33 files, 257 importer tests / 12 files pass; TypeScript cả hai repository pass. Có test giá trị Order lịch sử, zero, số sai, SKU khác Store, parent giả, thiếu root, sai reason, Product vẫn emit và SKU đã xóa.
- CSV audit toàn nguồn trước Store identity gates: PROD 256 Product (246 không có SKU, 9 không còn SKU live owned, 1 thiếu stock); DEV 541 (442 / 24 / 75). Đây không phải số Product đã export/import. Hash nguồn trước/sau không đổi.
- Artifact thật do exporter tạo từ fixture đã qua validate → importer prepare/load: không có Product-family blockers; các blocker không liên quan của fixture vẫn còn. Chưa ghi DB hoặc chạy full export PROD/DEV.
- Review độc lập phát hiện và đã sửa: disposition child soft-delete, bằng chứng parent SKU→Product, report mô tả nhầm bỏ Product thành hoãn Store.
