# F40 đọc field evidence F42

## Triển khai F40 độc lập

Thay đổi này chỉ triển khai màn hình/API và adapter đọc dữ liệu của F40; không mang theo exporter, importer, migration schema hay lệnh chạy migration của F42. F40 có thể được triển khai trước F42, nhưng không thể tạo kết quả đối soát khi nguồn chưa sẵn sàng.

| Trạng thái nguồn | Hành vi báo cáo |
| --- | --- |
| Thiếu bảng/cột bắt buộc của website ledger F42 | API trả `503` với mã `F42_SOURCE_UNAVAILABLE`; UI báo nguồn chưa sẵn sàng và không hiển thị tổng website/kết quả như dữ liệu thật. Không diễn giải thành “0 website”. |
| Website ledger sẵn sàng, thiếu field evidence | Danh sách website vẫn có thể đọc được; tỷ lệ chưa có evidence giữ `null` ở backend. API field thiếu schema trả `503`; phần chi tiết báo chưa đọc được nguồn. |
| Schema đầy đủ nhưng chưa có generation hợp lệ | Không có tỷ lệ đã đo; hiển thị thiếu evidence, không tự Pass và không dùng dữ liệu mẫu thay thế. |
| Evidence đúng contract đã có | Đọc và phân loại trong phạm vi evidence hiện có; QC thủ công vẫn độc lập. |

Adapter dùng contract cục bộ `src/lib/admin/qa/f42-reader-contract.ts`, ghim `field-evidence-v26` / `qc-fields-v1` và registry hash. Nó không import mã exporter/importer F42. Khi producer đổi contract/registry, cần review và cập nhật adapter rõ ràng; không tự chấp nhận evidence không tương thích. Kiểm tra readiness chỉ đọc metadata schema, không tạo hoặc sửa bảng.

## Cách tester dùng

- Cột **Độ khớp website (%)** hiển thị % nổi bật và thanh tiến độ: đỏ dưới 85%, vàng từ 85% nếu chưa đạt toàn bộ phạm vi; xanh khi toàn bộ field nội dung được tính đều khớp (100%); trạng thái audit và QC được hiển thị riêng. Tỷ lệ chưa đầy đủ không được làm tròn lên 100%. Màu không tự cấp QC Pass. Thiếu evidence website hiển thị **—**, không có thanh tiến độ. % website = field nội dung khớp / tổng field website cần đối soát, gồm field chưa xác minh ở mẫu số. Xác nhận ảnh thủ công chỉ áp dụng cho phiên bản evidence hiện tại. Tỷ lệ này không lấy từ BE field evidence.
- Chọn thẻ kết quả tự động để lọc website lỗi, cần kiểm tra hoặc chưa đủ evidence. Kết luận QC thủ công là bộ lọc riêng.
- Cột **Số trang** chỉ hiển thị số trang, không lặp lại lỗi/cảnh báo. Bảng có tỷ lệ cột cố định; tên/đường dẫn dài được rút gọn để không đẩy lệch các cột.
- Tab trang trong So sánh ưu tiên nhãn menu PW2 duy nhất có URL khớp chính xác trang đích đã map; nếu không khớp hoặc nhãn mâu thuẫn thì dùng tên CMS PW2, rồi slug. Chưa có trang đích hiển thị “Chưa có trang PW2”. Không suy đoán từ vị trí menu: New page 1 không tự đổi thành Checkout. Thứ tự/mapping/URL không đổi.
- Mở Commerce/Settings: bảng Độ khớp dữ liệu tự lấy evidence của run VERIFIED mới nhất thuộc đúng source store. Không nhập ID/run.
- API `view=fields` chỉ hỗ trợ run mới nhất; truyền `run_id` sẽ trả 400, không âm thầm trả dữ liệu của run khác.
- Lọc từng trạng thái và phân trang 100 field. Bấm Làm mới evidence để đọc lại.
- Bảng mapping ID bên dưới vẫn là đối soát định danh riêng, không phải kết quả so sánh giá trị field.

## Ghi nhận kiểm chứng QC thủ công

- Mở **So Sánh → Đánh giá QC**, menu xổ xuống **Pass / Failed**. Chọn kết luận để lưu ngay, không mở trang/form riêng, không nhập ID/run hay ghi chú.
- Đây là đánh giá thủ công; API quick lưu ghi chú nguồn thao tác và để các checklist `false`, không tự xác nhận năm phạm vi đã kiểm tra. Failed không tự mang nghĩa lỗi P0. API form cũ vẫn giữ quy tắc riêng.
- Lưu yêu cầu website migrate `completed`, có committed attempt và phiên bản evidence hiện tại. Thiếu bảng field evidence tính % không tự khóa QC; thiếu evidence website thì vẫn chưa lưu được.
- Sau khi lưu, danh sách và chi tiết được tải lại. Đánh giá gắn với phiên bản evidence; khi phiên bản thay đổi phải kiểm tra lại. Không dùng kết luận cũ để xác nhận bản mới.

QC thủ công không phải tỷ lệ khớp tự động và không chứng minh toàn bộ commerce (giá, tồn kho, đơn hàng) đã đầy đủ. Phiên bản evidence website không thay thế bằng chứng đối soát commerce.

## Phép tính và giới hạn

### Báo cáo tự động theo luồng staging

Giữ cấu trúc thẻ tổng quan → lọc → danh sách lý do → So sánh. Kết quả tự động và QC thủ công không thay thế nhau: Pass do tester lưu không làm website tự động đạt; Failed thủ công cũng không được diễn giải thành P0 theo phần trăm.

- **Có lỗi:** có bằng chứng migration/audit/field lỗi được bộ phân loại xác định; mở So sánh để xem bằng chứng và vị trí sai lệch.
- **Cần kiểm tra:** bằng chứng cần kiểm tra lại hoặc còn cảnh báo; ngay cả các field hiện có khớp hết cũng chưa chứng minh toàn bộ website đạt.
- **Chưa đủ dữ liệu:** chưa có đối soát đủ phạm vi; không coi là tự động Pass hoặc suy diễn bằng phần trăm cũ.
- **Đạt tự động:** phải kiểm tra đủ 100% phạm vi bắt buộc và khớp đúng 100%, không còn sai lệch hoặc mục chưa xác minh. Cần hợp đồng nghiệm thu chứng minh đủ phạm vi; hợp đồng này chưa có nên phiên bản Phase 1 không tự cấp toàn website Pass. 100% trong tập field hiện có chưa đủ điều kiện.

Phạm vi Phase 1 là inventory website mà API hiện cung cấp, không phải tổng mọi store nguồn PW1 hay tất cả tenant PW2. Phase 2 mới mở rộng báo cáo theo inventory migration đầy đủ và phân trang/tổng hợp phía server cho quy mô trên 2.000 website. Không dùng tổng Phase 1 để tuyên bố đã bao phủ gần 3.000 website.

**Làm mới evidence** đọc nội dung website PW2 hiện tại để tính lại % website, dùng cache kiểm tra ảnh còn hạn và xác nhận tay còn hiệu lực. Nó không chạy migration, audit trình duyệt hoặc đối soát lại Commerce/BE.

Phần đối soát Commerce/BE riêng vẫn chỉ tính các dòng field thuộc `qc-fields-v1` của generation COMPLETE, contract `field-evidence-v26`, registry hash khớp phiên bản code, snapshot COMPLETE có sidecarVersion 3 và provenance `exporter_sidecar`. Không dùng synthetic fixture hay evidence cũ của run khác để thay thế.

Đã kiểm tra = (match + mismatch + missing + duplicate) / tổng dòng field QC được ghi nhận. Khớp = match / số dòng đã kiểm tra. `unsupported` và `unverified` vẫn ở mẫu số coverage. Mẫu số bằng 0 hiển thị “—”. Đây là coverage của các dòng evidence đã ghi nhận, không chứng minh tất cả trường cần migrate đều hiện diện trong inventory. Ngoài danh mục QC được đếm riêng. Issue mở không được ẩn bởi tỷ lệ khớp cao.

Kết quả dùng projection tại thời điểm importer xác minh, không đọc lại PW2 hiện tại để phát hiện drift. Không gọi tỷ lệ này là % giao diện, % website hoàn thiện hoặc QC Pass. Stock chỉ có on_hand theo rule F42; reserved/available/location còn chưa xác minh.

API dùng quyền Super Admin hiện có. Giá trị chỉ được hiển thị cho field nằm trong allowlist; dữ liệu khách hàng, fingerprint và credential không trả về trình duyệt.

## Điều kiện dữ liệu

Lúc kiểm tra DB local ngày 2026-10-05, `migration_evidence_generations` và `migration_field_evidence` chưa tồn tại. UI sẽ báo chưa có field evidence, không tự tạo phần trăm.

Operator F42 cần áp dụng schema bổ sung trên đúng DB đã được duyệt và ingest/build evidence từ artifact gốc có sidecar của đúng run. Tham khảo [runbook thuộc F42 tại commit đã đối chiếu](https://github.com/primeproduction/ech-prime-web-v2/blob/9d2d2de35/docs/runbooks/pw1-field-evidence-qc.md); tài liệu và công cụ F42 này không được đưa vào bản tách F40. F40 không tự chạy lại import, không seed dữ liệu giả và không tự thay đổi DB. Refresh sau khi evidence được tạo.

## Kiểm tra

TC-F40-MIG-LIVE-08 kiểm công thức với cả 6 trạng thái và browser flow đọc bảng field. E2E cần local fixture DB, Payload secret và ứng dụng đang chạy; test bị skip không được coi là pass.
