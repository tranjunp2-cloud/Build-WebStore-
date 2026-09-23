# Chạy migrate PW1 trên local

Copy mỗi lệnh trên **một dòng**, không chèn khoảng trắng vào tên `creator-bindings.json`. Chạy lần lượt trong cùng terminal. Hướng dẫn này không reset DB.

## 1. Khai báo đường dẫn

```bash
cd /home/liam/data/ech-prime-web-v2
export PW1_ROOT=/home/liam/migration-data/pw1
export PW1_RUN=$(date +%Y%m%d-%H%M%S)
export PW1_IMPORT_MANIFEST="$PW1_ROOT/prepared-$PW1_RUN/import-manifest.json"
```

Chỉ đặt `PW1_RUN` một lần cho cả lượt bind → prepare → import. Mở terminal khác thì khai báo lại đúng giá trị cũ nếu muốn dùng lại bộ đã prepare.

`.env.local` cần có `DATABASE_URI` trỏ DB local, `PW1_APP_KEY`, `PW2_MIGRATION_SECRET`, `SSO_ENCRYPTION_KEY`. DB phải có schema migration và system user `sso-service@primeweb.app`. Bind-system chỉ tìm tài khoản theo email, không tạo user hoặc gán ID cố định.

## 2. Chuẩn bị file đầu vào

```text
/home/liam/migration-data/pw1/
├── artifact/                  # Nguyên bộ output exporter, gồm master-manifest.json
├── users.csv                  # CSV users đúng snapshot, có credential nguồn
├── system-binding-<PW1_RUN>/  # bind-system tạo
└── prepared-<PW1_RUN>/        # prepare tạo
```

Nếu đã có `artifact/` và `users.csv` đúng snapshot thì bỏ qua các lệnh copy dưới đây. Không copy chồng lên artifact cũ. Ví dụ bộ PROD export ngày 23/09/2026:

```bash
export PW1_EXPORT_SOURCE=/home/liam/data/worktrees/ech-prime-web-v2-worktree-2/.migration/runs/pw1-2026-09-23T06-27-32-825Z-2ce5b282/artifact
mkdir -p "$PW1_ROOT"
cp -R "$PW1_EXPORT_SOURCE" "$PW1_ROOT/artifact"
install -m 600 /home/liam/Documents/DB_PROD/users_202609161353.csv "$PW1_ROOT/users.csv"
chmod 700 "$PW1_ROOT/artifact"
find "$PW1_ROOT/artifact" -type f -exec chmod 600 {} +
```

Giữ đủ các file exporter tạo và không sửa master/report. CSV credential phải khớp hash của bảng users trong manifest; không dùng CSV của snapshot khác. Dữ liệu đặt ngoài source/Git.

## 3. Tạo system creator binding

```bash
npm run migrate:pw1:bind-system -- --export-artifact "$PW1_ROOT/artifact" --source-ref @users:users:51 --approved-by liam --output "$PW1_ROOT/system-binding-$PW1_RUN"
```

`@users:users:51` là actor PW1 đã được xác nhận mapping tới system user PW2 trong luồng hiện tại. Với snapshot khác phải xác nhận actor trước, không tự map mọi actor về system user. Thay `liam` bằng tên người thực sự duyệt mapping.

Output phải chưa tồn tại. Thư mục cha không bắt buộc quyền 700; thư mục binding mới có quyền 700, file có quyền 600. Kiểm tra symlink và ngoài Git vẫn áp dụng.

## 4. Prepare

```bash
npm run migrate:pw1:prepare -- --export-artifact "$PW1_ROOT/artifact" --credentials "$PW1_ROOT/users.csv" --creator-bindings "$PW1_ROOT/system-binding-$PW1_RUN/creator-bindings.json" --output "$PW1_ROOT/prepared-$PW1_RUN"
```

Đợi `PREPARED` và exit 0 rồi mới import. Prepare kiểm tra/copy artifact, mã hóa credential thành `credentials.enc` và tạo `import-manifest.json`; **không ghi DB**. Output phải chưa tồn tại và cần đủ dung lượng cho bản sao cùng dữ liệu tạm. Không chạy hai lệnh prepare cùng output.

## 5. Import User / Tenant / Site

Dry-run một store hoặc toàn bộ:

```bash
npm run migrate:pw1:users -- --manifest "$PW1_IMPORT_MANIFEST" --store 105 --local-database primeweb --dry-run
npm run migrate:pw1:users -- --manifest "$PW1_IMPORT_MANIFEST" --all --local-database primeweb --dry-run
```

Sau khi kiểm tra đạt, chạy ghi toàn bộ:

```bash
npm run migrate:pw1:users -- --manifest "$PW1_IMPORT_MANIFEST" --all --local-database primeweb
```

Nếu muốn chỉ định tên file đầu ra:

```bash
npm run migrate:pw1:users -- --manifest "$PW1_IMPORT_MANIFEST" --all --local-database primeweb --output-master "$PW1_ROOT/master-with-destination-$PW1_RUN.json" --output-file "$PW1_ROOT/migrated-users-$PW1_RUN.json"
```

Hai lệnh ghi trên là **hai lựa chọn**, không chạy cả hai liên tiếp. Mặc định xuất `master-with-destination.json` và `migrated-users.json` cạnh manifest; không ghi đè file có sẵn. Với artifact chia phần từ exporter 1.10.0, `master-with-destination.json` là index và dữ liệu nằm trong thư mục `master-with-destination.json.parts/` bên cạnh; cần giữ cả hai. Master gốc không đổi, dry-run không xuất file.

Thay `--all` bằng đúng một selector nếu cần:

| Phạm vi store PW1 | Tham số |
| --- | --- |
| Một store | `--store 105` |
| Danh sách | `--stores 1,31,105` |
| Khoảng ID | `--from-store 100 --to-store 200` |

Lệnh users là luồng tạm, chỉ ghi Tenant/User/Site và chưa có resume. Nếu lỗi sau khi ghi, các bản ghi đã commit vẫn còn; kiểm tra ledger trước khi chạy lại. Không dùng resume của full importer cho batch users.

User thiếu cả password hash và key_string được tạo password ngẫu nhiên nội bộ, keyString=null, ghi `passwordResetRequired` trong ledger/report. Credential chỉ có một phần hoặc không hợp lệ vẫn chặn. Không gửi email reset khi import. Email user được chuẩn hóa chữ thường/trim theo Payload, trừ email không hợp lệ được giữ nguyên khi artifact có contract và policy `preserveInvalidUserEmails` đã được chấp nhận. Xem [contract và giới hạn](pw1-users-destination.md).

## Full importer — chỉ dùng khi muốn nhập cả dữ liệu business

Các lệnh dưới đây khác với luồng users ở trên. Có master hoặc prepare thành công chưa có nghĩa mọi store vượt qua kiểm tra business.

```bash
npm run migrate:pw1:import -- --manifest "$PW1_IMPORT_MANIFEST" --all --group-size 100 --local-database primeweb --dry-run
npm run migrate:pw1:import -- --manifest "$PW1_IMPORT_MANIFEST" --all --group-size 100 --local-database primeweb
```

Chỉ chạy lệnh ghi sau khi dry-run đạt. Mỗi nhóm được kiểm tra trước khi ghi/verify từng store. `--group-size` nhận 1..100, mặc định 100. Các selector giống bảng trên.

Terminal in đường dẫn log; mặc định `/home/liam/migration-data/pw1/logs/<timestamp-session>/` gồm `events-*.jsonl`, `errors.jsonl`, `summary.json`. Có thể đổi bằng `--log-dir /absolute/private/logs`. Ledger là căn cứ xác nhận commit.

Resume full importer với runId từ `BATCH_READY` hoặc `summary.json`:

```bash
export PW1_BATCH_ID='json:THAY_BANG_UUID_THAT'
npm run migrate:pw1:import -- --resume "$PW1_BATCH_ID" --local-database primeweb
```

Có thể thêm `--from-store 100` nếu đó là store chưa hoàn tất đầu tiên. Không thêm manifest/group-size/dry-run khi resume. Giữ nguyên code/artifact/khóa/DB; không sửa ledger để ép chạy qua lỗi.

## Lỗi lệnh thường gặp

- `PREPARE_INPUT_OR_PARENT_NOT_FOUND`: kiểm tra đường dẫn và tên `creator-bindings.json` (không có khoảng trắng).
- `OUTPUT_ALREADY_EXISTS` / `PREPARE_OUTPUT_ALREADY_EXISTS`: chọn `PW1_RUN` mới, chạy lại bind và prepare; không ghi chồng output cũ.
- `EXACTLY_ONE_STORE_SELECTOR_REQUIRED`: chọn đúng một trong store/stores/range/all và không xuống dòng giữa đường dẫn.
- `PREPARE_DISK_FULL` / `ARTIFACT_DISK_SPACE_INSUFFICIENT`: giải phóng dung lượng trước khi thử lại; kiểm tra output dở còn tồn tại.

### Master parts — exporter 1.10.0

Importer accepts `master-0001.json`, `master-0002.json`, … directly from the manifest. Each part contains at most 300 whole Stores and strictly fewer than 200,000,000 UTF-8 bytes. Keep all parts and auxiliary artifacts together; do not concatenate them or create `master.json`. Legacy artifacts containing `master.json` remain supported.

Prepare binds `masterHash` to the manifest's deterministic `masterSetHash` and copies the parts without creating an aggregate file. Load streams every part through hash verification, including unselected Stores, and verifies global Store ordering, uniqueness, byte counts and the complete part registry. Selected Stores can be spooled separately.

The migration CLI is unchanged. For chunk input, `--output-master` (default `master-with-destination.json`) publishes a small `pw1-destination-parts-v1` index and a private sibling `.parts` directory. Destination annotations are written only after foundation verification; output parts are split again if annotations reach either limit. The index is published last without overwriting existing output. Keep the index and its `.parts` directory together. Legacy input still produces the original single destination master file.
