# Phase 01 — Khóa contract và môi trường

- Status: in_progress
- Priority: P1
- Budget: 1h; phụ thuộc dữ liệu/DB/credential sẵn có.
- Depends on: không có implementation phase trước.

## Mục tiêu

Biến các điều kiện chưa rõ thành manifest/preflight có thể kiểm tra; bảo đảm developer không tự chọn policy ghi đè để chạy được.

## Công việc theo thứ tự

- [x] Ghi baseline `git status`, inventory tracked/untracked ở current checkout và worktree. Không reset/stash/restore thay đổi người dùng. Chụp content hashes các module định port, không chỉ HEAD.
- [x] Chọn bản sao DB hiện hữu được phép ghi để rehearsal; giữ app/cron/outbound thật ngoài DB này. Đọc identity host/database/schema, version/index và ledger; ghi target fingerprint không chứa URI/secret. Nếu không có clone, không dùng DB đang hoạt động làm chỗ fault injection.
- [x] Xác nhận publication followup-001: 2918 source Stores, 2799 emitted, 118 blocked, 1 deferred; `--all` chỉ chọn emitted Stores. Master/hash/partition được kiểm tra qua prepare thật; xem phase04.
- [ ] Kiểm tra credential sidecar sẵn có. Nếu hiện chỉ có CSV worktree, lập bước đóng gói local bằng primitive mã hóa hiện hữu; không copy credential vào master. Việc tạo sidecar phải xong trước create User phụ thuộc credential.
- [x] Lập baseline conflict cho legacy foundation: mapping namespace `stores/sites/users/media/store_favicon/store_logo` và target identity. Không nhận diện ownership chỉ bằng email/slug/URL.
- [x] Đóng contract Product slug: runtime/index global khác mapping tenant; chọn xử lý riêng đã duyệt hoặc block các Product chịu ảnh hưởng. Continuation phase05 đã triển khai tenant/slug uniqueness và kiểm tra trên clone; chưa deploy live. Nếu chỉ kiểm chứng tập không collision, ghi rõ giới hạn và validator vẫn theo index thực.
- [x] Quy định timestamp missing theo collection: preserve khi có; technical import timestamp nếu schema bắt buộc phải được đánh dấu non-source; trường lịch sử bắt buộc thiếu thì block. Không mượn timestamp tùy tiện từ record khác.
- [ ] Chốt collection matrix và expected CREATE/REUSE/conflict counts. Unsupported collection nonempty phải block trước business write; empty-unverified phải hiện riêng.
- [x] Chốt danh sách field UPDATE nếu thật sự cần; mặc định danh sách rỗng. Credential/global role/membership ngoài scope/publish/domain/plan không được tự đưa vào allowlist.
- [ ] Chọn exact eight-hour scope theo gate. Không có policy cho conflict thì tiếp tục xây CLI độc lập, đánh dấu rehearsal Store bị block.

## Related files / action map

Root `.`; worktree `<worktree-1>`.

| Path | Action lúc implementation | Mục đích |
|---|---|---|
| `./docs/migration/pw1-pw2-master-field-mapping.md` | Read; sửa chỉ khi rule đã được chốt | Thống nhất slug/timestamp/disposition, không remap business ngầm |
| `./docs/migration/stores-205-285-pw2-current-schema-collection-only.json` | Read-only | Fixture snapshot; không sửa để che lỗi writer |
| `<worktree-1>/src/lib/migration/pw1-pw2/` | Read/inventory | Chọn primitives và dependencies, tránh copy runner/default cũ |
| `$PW1_ROOT/<snapshot-id>/` | Create khi được triển khai, ngoài Git | Artifact0700/file0600; cần quyền filesystem riêng |
| `./docs/qa/F42-pw1-pw2-layer1.md` | Read | TC traceability; không tự tuyên bố AUTO/pass |

## Quyết định đường nghiệm thu trước khi vào Phase 02

<!-- Review R4: real master acceptance cannot be replaced with synthetic success -->
Chọn và ghi một trong hai kết quả sau trong cuối giờ1:

- Có ít nhất một Store của **master thật** với foundation tương thích trên bản sao trung thực của DB hiện hữu, và toàn bộ selected Stores có đường giải quyết conflict rõ trước MAN-LOCAL-02.
- Cả205/285 còn conflict không có policy UPDATE: đánh dấu real-master acceptance BLOCKED. Có thể hoàn thiện CLI và kiểm thử synthetic riêng nhưng không được gọi nhiệm vụ migrate đã hoàn tất. Không sửa foundation clone tùy ý rồi báo đó là bằng chứng cho DB gốc. Bất kỳ reconciliation được duyệt phải có diff/before-image/evidence riêng và tính vào ngân sách.

## Gate G1

Có input hợp lệ, clone DB riêng, manifest policy, credential readiness và danh sách conflict. Không còn quyết định ngầm. Điều kiện chưa được giải quyết được ghi BLOCKED, không chuyển thành SKIP.

## Rủi ro / fallback

Worktree có file chưa tracked; DDL DB đã có nhưng source current thiếu; phải inventory thực tế. Nếu quá1h do conflict/schema, không tiêu hết3h nghiệm thu: báo phạm vi chưa khả thi và ưu tiên CLI/preflight/reuse foundation trước, không gọi toàn migration hoàn tất.

## Cập nhật implementation

Hạ tầng clone và contract đã có; G1 cho master thật chưa đóng. Các checkbox mở vẫn yêu cầu input/policy nguồn thực, không lấy fixture synthetic thay thế.

## Cập nhật thực thi 2026-09-17

[Regression cuối](reports/260917-v2-regression-and-clone-evidence.md): 81 tests/8 files, typecheck và synthetic clone 2 Stores/18 entities PASS sau strict evidence/alias fixes (sau đó focused19/19 và typecheck PASS, gồm 1 path-guard case mới; tổng82 distinct tests qua các lượt, không phải full82 rerun). Không thay nghiệm thu nguồn thật. [Real prepare PASS; dry-run205 BLOCKED](reports/260917-v2-real-artifact-preflight.md): 226485 occurrences selected/global, 3 blocker codes, 0 PW1PROD runs. G5 real actor/credentials BLOCKED; G6 actual apply NOT_RUN. Checkbox mở giữ các phần nghiệm thu/fault case chưa chứng minh.
