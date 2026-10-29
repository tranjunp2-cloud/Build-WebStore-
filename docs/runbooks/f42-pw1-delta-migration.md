# Runbook: migrate dữ liệu PW1 mới sau snapshot (`migrate:pw1:delta`)

> US-F42-09 (#2045). Đưa dữ liệu PW1 mới hoặc đã đổi sau lần import gốc vào PW2 từ một bộ CSV export mới hơn.
> Lệnh không chạy hay sửa script migrate cũ; bảng `migration_*` chỉ được đọc. Ledger riêng: `pw1_delta_runs`, `pw1_delta_map`, `pw1_delta_credentials`.

## 1. Chuẩn bị

| Việc | Ghi chú |
|---|---|
| **Backup DB đích ngay trước khi chạy** | Lệnh **không có rollback**. Neon: tạo branch hoặc ghi lại mốc PITR. Local: `pg_dump -Fc`. |
| `DATABASE_URI` trỏ đúng DB đích đã import | Neon phải dùng URI **direct**, không phải host `-pooler`. Lệnh từ chối URI pooler (`POOLED_DATABASE_URI`) vì advisory lock không giữ được qua PgBouncer. |
| `PW1_APP_KEY`, `SSO_ENCRYPTION_KEY` (64 ký tự hex) | Cần khi có user mới hoặc đồng bộ mật khẩu. Thiếu thì lệnh dừng trước khi ghi (exit 2). |
| Bộ CSV export PW1 mới (`--new`) | Thư mục chứa `<bảng>_<yyyymmddhhmm>.csv`, cùng một mốc thời gian. |
| Bộ CSV đã dùng để import (`--old`, nên có) | Bật parity gate, báo field đổi, đồng bộ mật khẩu PW1. |
| Đĩa trống | Lệnh kiểm tra trước khi chạy. Mỗi bên cần khoảng vài GB cho bản sao CSV và artifact dựng lại. |
| RAM | Heap Node cố định 4.608 MB. Chạy trên máy còn trống ≥ 6 GB. |

Thời gian tham khảo (khoảng 157 nghìn bản ghi): export 15 phút, prepare 3–4 phút, load 3–5 phút mỗi bên. Với `--old`, tổng khoảng 45–50 phút.

## 2. Chạy

```sh
DATABASE_URI=<uri-direct> npm run migrate:pw1:delta -- \
  --old <csv-đã-import> --new <csv-mới> --out .migration/delta-runs/<tên-lần-chạy>
```

- **Lần đầu trên môi trường nào cũng không dùng `--yes`.** Đọc `summary.md`, đối chiếu số NEW / CHANGED / GONE với kỳ vọng rồi mới gõ `y`.
- Trước production: chạy thử một lần trên **bản sao DB production** với CSV production thật.
- `--store <ids>` chỉ báo cáo và ghi cho các store đó (dùng để thử). Mật khẩu không được đồng bộ ở chế độ này.
- Chỉ một lần chạy tại một thời điểm trên cùng DB. Lần thứ hai báo `DELTA_ALREADY_RUNNING`.

Trước khi gõ `y`, rà `changes.jsonl` xem có dữ liệu bất thường (tài khoản test hoặc spam, media trỏ URL nội bộ…). Nếu có, dừng lại và xử lý trước: lệnh chưa có cờ loại trừ.

## 3. Kết quả

Trong thư mục `--out`:

| File | Nội dung |
|---|---|
| `summary.md` | Parity gate, bảng NEW / CHANGED / GONE theo collection, thời gian, mật khẩu, kết quả ghi |
| `changes.jsonl` | Từng thay đổi, kèm field đổi và PW2 target |
| `apply-result.json` | Kết quả ghi từng bản ghi: `written`, `report-only`, conflict, lỗi |
| `website-input.json` (+ `-report.json`) | Input cho `migrate:pw1:website` của các store mới hoặc chưa có website |
| `parity.json`, `input-guards.json`, `normalization.json`, `export-reports/` | Bằng chứng kiểm tra |

Mã thoát:

| Mã | Ý nghĩa |
|---|---|
| 0 | Xong, hoặc không có gì để ghi, hoặc operator trả lời N |
| 1 | Lỗi bất ngờ (xem dòng `pw1-delta failed:`) |
| 2 | Đầu vào không đạt: CSV thiếu hoặc lệch, đĩa, thiếu key |
| 3 | Chặn ghi: parity FAILED, hoặc vượt ngưỡng 5% thay đổi / 1% bản ghi biến mất (`--allow-mass-change` để vượt khi đã chắc chắn) |
| 4 | Đã ghi nhưng có store lỗi (store đó đã rollback, store khác giữ nguyên) |
| 130 | Bị Ctrl+C hoặc SIGTERM |

## 4. Đọc conflict

- `PW2_EDITED_CONFLICT`: bản ghi đã bị sửa trên PW2 sau import, nên không ghi đè.
- `SITE_WEBSITE_GENERATED`: site đã generate website, không đổi.
- `TARGET_MISSING` / `PROJECTION_MISSING`: không tìm thấy bản ghi đích hoặc không có mốc so sánh. Lệnh từ chối ghi để an toàn.
- Bản ghi PW1 đã xoá (GONE) chỉ được archive hoặc báo cáo, không xoá cứng. **Conflict của GONE chỉ xuất hiện trong `issues` của đúng lần chạy đó**; lưu lại `apply-result.json`.
- Mật khẩu: `ALREADY_SYNCED` (đã đồng bộ), `PW2_PASSWORD_CHANGED` (user đã đổi trên PW2, không ghi đè).

Theo dõi sau khi chạy: Studio → QA → Migration diff → panel "Delta migration" (Super Admin).

## 5. Sau khi chạy

- **Chạy lại** cùng lệnh là an toàn: bản ghi đã ghi được nhận ra qua `pw1_delta_map`, không ghi lặp. Thay đổi `report-only` (ví dụ discount mới, plan-subscription-usages) không được ghi nên lần nào chạy cũng hiện lại trong bảng; đó là bình thường. Số "PW1 password changes" là số trước khi kiểm; lúc ghi, mật khẩu đã đồng bộ sẽ báo `ALREADY_SYNCED`.
- **Generate website** là bước riêng. Chạy khi app đang trỏ cùng DB đích:
  ```sh
  npm run migrate:pw1:website -- .migration/delta-runs/<tên-lần-chạy>/website-input.json
  ```

## 6. Dọn bản sao CSV

Bản sao CSV (`users_*.csv` có hash mật khẩu PW1) nằm trong `<out>/old`, `<out>/new`, `<out>/source-old`, `<out>/source-new`. Chúng tự bị xoá khi lệnh kết thúc, lỗi, hoặc bị Ctrl+C / SIGTERM.

**SIGKILL hoặc hết RAM (OOM) không chạy được bước dọn.** Khi đó:

```sh
rm -rf .migration/delta-runs/<tên-lần-chạy>/{old,new,source-old,source-new}
```

Lần chạy sau cũng in cảnh báo kèm lệnh `rm -rf` nếu còn bản sao sót trong cùng thư mục `delta-runs/`. Nếu lần chạy bị ngắt khi đang ghi, `pw1_delta_runs.state` còn `APPLYING`; các store đã commit vẫn giữ, chạy lại để hoàn tất phần còn lại.
