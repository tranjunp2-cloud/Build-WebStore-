# Chạy migrate PW1 trên local

Chạy từ source, dùng `.env.local` và artifact đã prepare:

```bash
cd /home/liam/data/ech-prime-web-v2
export PW1_IMPORT_MANIFEST=/home/liam/migration-data/pw1/local-20260917/prepared-outcome-151-local/import-manifest.json
```

## Kiểm tra trước

```bash
npm run migrate:pw1:import -- --manifest "$PW1_IMPORT_MANIFEST" --store 205 --local-database primeweb --dry-run
```

Thấy `PREFLIGHT_PASSED` thì backup DB, chạy lại cùng lệnh và bỏ `--dry-run` để ghi.

## Chạy theo nhóm100store

```bash
npm run migrate:pw1:import -- --manifest "$PW1_IMPORT_MANIFEST" --all --group-size 100 --local-database primeweb --dry-run
```

Bỏ `--dry-run` để import: kiểm đủ một nhóm → cả nhóm pass → ghi/verify từng store → nhóm kế tiếp. Nhóm lỗi sẽ dừng; các nhóm đã hoàn thành được giữ lại. File nguồn vẫn phải được kiểm tra toàn vẹn trước khi bắt đầu nhóm1.

**Artifact này dùng mapping exporter 1.5.1. Vẫn có diagnostic chưa giải quyết; chia nhóm không tự bỏ qua chúng.** Chỉ chạy ghi với phạm vi đã kiểm tra đạt.

Thay `--all` bằng một trong các selector:

| Phạm vi | Tham số |
| --- | --- |
| Một store PW1 | `--store 205` |
| Danh sách | `--stores 100,101,205` |
| Khoảng ID | `--from-store 100 --to-store 200` |

`--group-size` mặc định100, nhận1..100. Đây là số store có trong selection, không phải khoảng100 ID. Store636 đã import trước đây còn projection conflict khi chạy mới.

## Xem log

Terminal in đường dẫn log ngay khi bắt đầu. Mặc định:

```text
/home/liam/migration-data/pw1/logs/<timestamp-session>/
  events-0001.jsonl  # tiến độ, source ID → target ID sau commit
  errors.jsonl       # mã lỗi + group/store/entity khi xác định được
  summary.json       # kết quả, số lượng, runId và bước xử lý tiếp
```

File events/errors tự tách khi lớn. Có thể đổi chỗ bằng `--log-dir /absolute/private/logs`. Log không nằm trong source và không chứa password/secret. Ledger DB là căn cứ xác nhận commit; summary còn RUNNING sau khi kill cần đối chiếu/resume.

## Resume khi bị ngắt

Lấy runId từ `BATCH_READY` hoặc `summary.json`:

```bash
PW1_BATCH_ID='json:THAY_BANG_UUID_THAT'
npm run migrate:pw1:import -- --resume "$PW1_BATCH_ID" --local-database primeweb
```

Nếu store100 là store chưa hoàn thành đầu tiên, có thể thêm `--from-store 100`. Resume tự dùng nhóm đã lưu; không thêm `--manifest`, `--group-size` hoặc `--dry-run`.

Giữ nguyên code/artifact/khóa/DB khi resume. Batch tạo bằng runner cũ không tự chuyển sang runner nhóm mới. Lỗi dữ liệu nguồn cần sửa master/code sẽ cần reconciliation, không ép resume bằng cách sửa ledger.

Thấy `VERIFIED` mới là hoàn tất. Nếu chỉ dry-run thì thành công là `PREFLIGHT_PASSED` và không ghi DB. CLI hiện chỉ hỗ trợ local.
