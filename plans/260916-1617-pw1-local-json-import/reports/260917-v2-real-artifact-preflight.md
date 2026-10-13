# Artifact thật — prepare và dry-run v2, 2026-09-17

## Kết quả thực thi

- Đầu vào: published `pw1-prod-20260917-followup-001`, contract `8aacb2610d7ceacbe067da4c0e5b8717e0804601715e8d0158b6a619c6bfeae9`.
- Prepare v2 PASS: đã copy và kiểm tra toàn bộ publication (~2.60 GB), parse master 1,061,192,036 bytes và mapping report 641,772,688 bytes theo stream. Không giảm artifact hoặc sửa hash.
- Lần prepare trên `/tmp` dừng đúng `ARTIFACT_DISK_SPACE_INSUFFICIENT`: volume `/` chỉ còn khoảng2.2 GB. Chạy lại bằng output trên tmpfs `/dev/shm` còn khoảng13 GB và thành công. Đây là artifact test tạm, không phải nơi lưu bản gốc bền vững.
- Prepared manifest: `/dev/shm/pw1-real-v2-prepared-20260917/import-manifest.json`; chưa có credential sidecar hoặc creator binding thật.
- Dry-run Store205 trên clone `pw1_import_1886_v2_20260917`, temp cache `/dev/shm`: đọc đủ artifact/hash, báo2918sourceStores và1requestedStore.
- Kết quả **exit3 / ARTIFACT_BLOCKED**, không phải import thành công.
- Pending target check: `TARGET_USER_CREATOR_BINDING_REQUIRED`.
- Blocker codes: `SUBSCRIPTION_CANCEL_FLAG_ABSENT`, `SOURCE_FIELDS_UNRESOLVED`, `REPORT_ROW_UNRESOLVED`.
- `blockerCount=226485` là tổng occurrences diagnostic/derived-row thuộc selected hoặc global scope; không phải số Store và không phải raw exporter blocker count94929. Report rows với ownership global chưa được chứng minh không được bỏ qua.
- Private log: `/dev/shm/pw1-real-v2-prepared-20260917/dryrun-205.private.jsonl`.
- Sau dry-run, read-only SQL xác nhận `migration_runs` có **0** run cho sourceInstance `PW1PROD` trên clone. DB gốc chỉ được dump/read; mọi schema và synthetic business writes nằm trên clone.

## Điều kiện để chuyển sang apply dữ liệu thật

1. Reconcile từng unresolved field/disposition ở worktree-2 hoặc có classifier rule được duyệt và kiểm chứng rõ. Không bật blanket ignore warnings/global tables.
2. Làm rõ `SUBSCRIPTION_CANCEL_FLAG_ABSENT`; không tự suy false từ dữ liệu thiếu.
3. Chuẩn bị full Users CSV cùng snapshot trong directory0700/file0600 và cấu hình khóa private. Không gửi secret vào chat/issue hoặc arguments.
4. Cung cấp creator binding và typed approval evidence cho tài khoản đích hiện hữu; người vận hành chịu trách nhiệm quyết định identity. Không tạo tài khoản hay chọn target theo email tự động.
5. Chọn clone baseline mới trước apply thật, freeze code/schema/input/keys/bindings và chạy lại dry-run. Clone hiện tại chứa dữ liệu kiểm thử synthetic.
6. Cấp đủ disk cho publication+cache. `/dev/shm` chỉ dùng kiểm thử tạm, không là kế hoạch lưu trữ/recovery sau reboot.

## Giới hạn bằng chứng

Không chứng nhận import dữ liệu thật hoặc toàn bộ2799emittedStores. Không phải benchmark RSS/timing của pipeline3GB. Rehearsal synthetic được ghi riêng trong `260917-v2-regression-and-clone-evidence.md`; không thay thế source readiness.
