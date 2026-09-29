---
date: 2026-09-24
status: researched-no-implementation
scope: exporter-1.10.3-and-current-local-importer
---
# Đối chiếu exporter và importer PW1

## Kết luận

Artifact `pw1-prod-1103-20260924/artifact` dùng exporter 1.10.3, contract `fe5b368a1e40d5a02b373170684a3d2b5ec3188373c69359300b8c5fc7c0507f`. Có 2.913 Store emitted, 5 Store excluded, không có Store bị chặn mapping. Các lần thử thực tế đã qua prepare, artifact integrity và schema gates. Blocker đang xác nhận là full importer chưa dùng fallback thiếu credentials đã có trong users runner. Không có bằng chứng cần export lại để giải quyết lỗi này.

## Bằng chứng

- Exporter `docs/migration/pw1-export-gap-check-20260924.md`: audit importer trên toàn bộ artifact có 0 diagnostic disposition BLOCKED; 44.521 TARGET_CHECK_REQUIRED là kiểm tra cần thực hiện ở importer/DB, không phải 44.521 lỗi mapping.
- Hai diagnostic nguồn còn lại cùng liên quan một orphan role record 5753. Importer đã xác minh không thuộc dependency của tập Store được chọn. Không tạo User/role giả.
- Exporter master mapping dòng 238 loại password/key_string khỏi JSON, chỉ ra reset/đăng ký lại ở PW2. `source-registry.ts` SECRET_FIELDS cũng loại các trường này. Credentials riêng qua CSV/sidecar vẫn là khả năng bổ sung của importer, không phải nội dung thiếu trong master.
- Audit trực tiếp CSV cùng snapshot và User refs trong 10 masters: 2.957 User; 2.929 có cả password hash/key_string; 28 thiếu cả hai; 0 thiếu một phần; 0 thiếu dòng CSV. User 87 / Store 31 thiếu cả hai. Đây chỉ là kiểm tra hiện diện, chưa chứng minh 2.929 credential giải mã và xác thực đều thành công. Không ghi hoặc in giá trị secret.
- Audit dùng `sourceKey()` thật trên 157.449 document thuộc WRITABLE: 0 collision giữa collection/Store sau sửa namespace thumbnail. Chưa chứng minh mọi unique constraint, projection hoặc write hook đều pass.
- Lần full gần nhất pass preflight Stores 1–30, dừng Store 31/User 87 với VERIFIABLE_CREDENTIAL_REQUIRED. Nhóm 100 chưa apply; DB xác nhận 1 system user, 0 tenant/site/product.

## Các gap đã tiếp nhận — không mở lại

| Nhóm | Trạng thái hiện tại |
| --- | --- |
| Quyền staff/editor, gồm User 87 | Exporter đã emit editor; importer secondary-editor proof đã nhận với bằng chứng/policy |
| Product invalid, inactive category, duplicate/variant/SKU cases | Exclusion/remapping policies và receipt verification đã có |
| Order invalid, historical coupon, omitted payment | Có policy và source proof; không tạo coupon/payment giả |
| Address fallback/overflow và metadata kỹ thuật | Contract 1.10.3 và approved-source-scope/fields đã được nhận |
| Social/library media và model settings ngoài scope | Có proof và disposition tương ứng |
| Blog/media trùng source row | Đã sửa target diagnostic selector; thumbnail normalized thành blog_post_thumbnail cho registry/ledger |

Page/Menu không nằm trong phạm vi thực thi nghiệp vụ của lượt này. Các kiểm tra target uniqueness, creator binding, subscription/payment evidence vẫn phải chạy, không miễn chỉ vì exporter thành công.

## Phần cần triển khai tiếp

1. Dùng chung chính sách credential cho users/full: đủ hai trường thì giữ xác minh/decrypt; cả hai thiếu thì password ngẫu nhiên không công bố, keyString=null và passwordResetRequired=true. Credential thiếu một phần, hỏng hoặc mismatch vẫn chặn. Không thay credentials của User đang được reuse.
2. Đồng bộ cả hai preflight calls trong `runner.ts` (214,248) và hai nhánh tạo User trong `writer.ts` (270,276). Không chỉ sửa preflight vì writer vẫn đang giới hạn fallback ở executionScope foundation. Tái dùng `user-auth.ts:9–24`.
3. Full report cần tổng số và source User/Store IDs cần reset; cờ ledger đã có ở `writer.ts:286`. Không log email/password/key. Đây là evidence migration, không phải trạng thái reset trực tiếp trên tài khoản; không tự gửi email reset.
4. Bổ sung regression full scope cho đủ/thiếu/partial/invalid credentials, reuse không reset, report counts và nhất quán preflight/write; cập nhật README/contract/QA từ users-only sang chính sách dùng chung sau khi code được triển khai.
5. Chạy lại full bằng run mới vì writerHash đổi. Không chứng nhận full readiness trước khi qua toàn bộ preflight/apply/verify.

Không cần thêm secrets vào master, nới schema nghiệp vụ hay bỏ các guard còn lại.

## Tài liệu/helper phụ cần đồng bộ

- Exporter `pw1-conflict-decisions-20260923.md` còn trạng thái lịch sử policy pending, trong khi `policy-boundary.ts` có PENDING_POLICY_KEYS rỗng. Đánh dấu nội dung lịch sử đã được thay thế; không yêu cầu duyệt lại các policy đã chốt.
- Importer helper `exportReview()` chưa truyền approved-scope giống exporter; không tìm thấy caller runtime importer. Có thể đồng bộ riêng, không phải nguyên nhân run bị chặn.
- Tài liệu exporter ghi không copy auth; README importer lại hỗ trợ credential sidecar. Cần mô tả rõ hai luồng: master không chứa secrets; importer có thể giữ password khi CSV hợp lệ hoặc tạo tài khoản cần reset khi cả hai trường vắng.

## Giới hạn và việc chưa xác minh

Chưa xác thực toàn bộ credential có dữ liệu, chưa apply nhóm business đầu tiên, chưa kiểm chứng runtime password-reset cho 28 tài khoản trên. Không khẳng định đây là blocker cuối cùng. Lượt scout chỉ đọc source/artifact/CSV và tạo báo cáo này; không import/reset DB hoặc đổi code.
