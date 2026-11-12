---
title: PW1 → PW2 delta migration — lệnh `migrate:pw1:delta`
status: draft (đã review 27/10, hướng A)
created: 2026-10-27
release: 2026-10-28 (thứ 4)
feature: F42
---

# Plan — `migrate:pw1:delta`

Một lệnh đưa thay đổi của PW1 (snapshot 16/09 → lúc freeze) vào DB PW2 đã import. Không chạy hoặc sửa script migrate cũ.

```bash
npm run migrate:pw1:delta -- --old <csv-16/09> --new <csv-moi> [--as-of <ISO>] [--out <dir>] [--yes]
```

## Contract

**Outcome**
- DB PW2 phản ánh dữ liệu PW1 lúc freeze.
- Có báo cáo và `website-input.json`.

**Constraints**
- Nguồn chỉ là CSV.
- Mọi path đều là tham số. DB đích lấy từ `DATABASE_URI`.
- Ledger cũ chỉ được SELECT.
- Gọi hàm cũ như thư viện; không sửa file cũ, không gọi script cũ.
- Ledger riêng `pw1_delta_*`.
- `--out` mặc định `.migration/delta-runs/<run-id>`.

**Non-goals**
- Generate website.
- Chuyển media lên S3.
- Dump dev→prod.
- Đổi policy.

**Acceptance**
1. `--old X --new X` → 0 thay đổi, ngoài danh sách bản ghi dính `'` đã biết.
2. Chạy 2 lần → lần 2 không ghi.
3. Mỗi lần ghi có dòng `pw1_delta_map` và có trong báo cáo.
4. Số liệu khớp bậc độ lớn với scout 26/10.

## Hướng đã chốt (review 27/10, user chọn A)

Chạy lại **nguyên phía đọc** của luồng cũ bằng các hàm thư viện có sẵn. Cả 4 hàm đều không ghi DB:

```
createSnapshotConfig → exportMaster → prepareImportArtifact → loadImportArtifact/readImportStore → buildEntities
```

- Chạy cho cả `--old` và `--new`, cùng profile, cùng `snapshotId` của run 07/10, đọc từ `migration_runs.source_snapshot_id` trong DB đích (để giữ namespace và id dòng con). Không cần thư mục run cũ.
- So entity của 2 bên theo `ref` → NEW / CHANGED / GONE.
- Ledger cũ chỉ dùng để tìm `target_id` và `target_checksum`.
- Phần viết mới chỉ gồm: CLI, chuẩn hóa CSV, diff, writer, ledger delta, báo cáo.
- Từ 07/10 không có commit nào sửa `pw1-export/**`, `projection/artifact/credentials/source-scope.ts`, `configs/migration` → lần chạy mới tái lập được run cũ.

Lý do bỏ hướng "map lại theo store": exporter còn có các bước liên-store (`quarantineProductCollisions`, khép kín tham chiếu, actors), và importer còn lọc thêm (`createSelectedSourceScope`). Xem [review](reports/review-261027-0943-plan-review-before-cook.md).

## Phases

| # | Phase | File |
|---|---|---|
| 01 | CLI, chuẩn hóa CSV ra bản sao, kiểm tra đầu vào | [phase-01](phase-01-cli-csv-source-and-input-guards.md) |
| 02 | Gọi phía đọc luồng cũ như thư viện cho old/new | [phase-02](phase-02-reuse-old-read-pipeline-as-library.md) |
| 03 | Diff entity, phân loại, gate tái lập | [phase-03](phase-03-diff-classify-and-parity-gate.md) |
| 04 | Ledger delta, runtime, writer | [phase-04](phase-04-delta-ledger-runtime-and-writer.md) |
| 05 | Tóm tắt, y/N, báo cáo, `website-input.json` | [phase-05](phase-05-summary-confirm-reports-website-input.md) |
| 06 | Test + diễn tập trên bản copy DB dev | [phase-06](phase-06-tests-and-rehearsal.md) |

Thứ tự: 01 → 02 → 03 → (04 ∥ 05) → 06.

## Lịch
- **27/10:** làm phase 01–03, chạy gate tái lập trên DB_PROD (không cần file xuất mới).
- **28/10 sáng:** làm phase 04–05 (MVP), diễn tập.
- **28/10 chiều:** chạy thật sau khi freeze PW1.

## Quyết định
| # | Nội dung | Trạng thái |
|---|---|---|
| D1 | Bản ghi import còn dấu `'` đầu giá trị (30 entity trong CSV 27/10) | ✅ user chốt 27/10: luôn tự sửa (CHANGED quote fix), cả khi có `--old` — bản ghi đã claim luôn so với checksum ledger |
| D2 | Đầu vào chỉ là 2 bộ CSV; gọi hàm chuyển đổi cũ trong `src/lib/migration` như thư viện; không chạy hay sửa script cũ | ✅ user chốt 27/10 |
| D3 | `--as-of` | mặc định 2026-09-18 (giữ cách import trước); `--as-of` để đổi |
| D4 | Dữ liệu dev bị sửa sau import | ✅ không có; vẫn giữ kiểm tra `target_checksum` |
| D5 | Bỏ `--old-run`; `snapshotId` đọc từ `migration_runs` trong DB đích | ✅ |
| D6 | `--old` tùy chọn: mặc định chỉ dựng bộ CSV mới và so với checksum ledger (~25–30 phút); `--old` chạy lại gate tái lập + báo field đổi + chặn ghi đè PW2 đã sửa tay. Chặn ghi khi thay đổi (trừ quote fix) > 5% số claim, trừ khi `--allow-mass-change` | ✅ |
| D7 | Mật khẩu PW1 đổi sau 16/09 (trường bí mật, không nằm trong checksum): khi có `--old`, so `key_string`/hash users giữa 2 bộ CSV → cập nhật mật khẩu PW2 cho user đã migrate. Không `--old` → báo "chưa kiểm tra" | ✅ user chọn 1b 27/10 |

## Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Export toàn bộ 2 lần chậm hoặc tốn RAM | `--max-old-space-size=8192`; đo thời gian ngay ở gate hôm nay |
| Gate lệch | Dừng; in field khác đầu tiên; kiểm lại profile, snapshotId, asOf |
| File xuất mới thiếu dòng | Kiểm tra đầu vào ở phase 01 |
| Tiến độ | MVP phase 04 (xem file) |
| Advisory lock mất tác dụng qua Neon pooler (PgBouncer transaction mode) | Chạy với DATABASE_URI **direct** (host không có `-pooler`) |
| Ctrl+C giữa lúc apply | Store đang ghi rollback; run còn `APPLYING` trong `pw1_delta_runs`; bản sao CSV được xóa; chạy lại an toàn |
| Bản ghi PW1 đã xóa nhưng PW2 đã sửa tay (GONE conflict) | Không ẩn; chỉ báo trong `issues` của **lần chạy đó** (lần sau không liệt kê lại) → operator xử lý theo apply-result/tracking ngay sau mỗi lần chạy |
