# Chạy migration PW1 → PW2 trong Vercel Sandbox

Tài liệu này dùng cho project `ech-prime-web-v2`, Neon **staging** và một snapshot gồm 93 CSV PW1. Lệnh ở phần **máy cá nhân** và **Sandbox** chạy trong hai terminal khác nhau. Sandbox tạo trống không tự có source; CSV và env của deployment luôn cần nạp riêng.

## Cần có trước khi chạy

- Neon staging đã có schema Payload cơ bản (`users`, `tenants`, `media`, `plan_features`). `db:migrate` hiện bỏ qua migration nếu DB trống nhưng vẫn exit 0; chưa có bước tạo schema từ DB trống được xác minh trong runbook này.
- Bộ 93 CSV cùng một snapshot, thời điểm snapshot (`--as-of`) và profile nguồn phù hợp. Profile mặc định `configs/migration/pw1-prod-profile.json` chứa policy riêng của PROD; dùng nguồn khác phải duyệt lại profile.
- Env đúng của staging: `DATABASE_URI`, `PAYLOAD_SECRET`, `PW2_MIGRATION_TARGET_ID`, `PW2_MIGRATION_SECRET`, cấu hình S3, `SSO_SERVICE_PASSWORD`. Nếu import credential từ `users.csv`, cần thêm `PW1_APP_KEY` và `SSO_ENCRYPTION_KEY`. Website migration cần `OPENAI_API_KEY` và `NEXT_PUBLIC_SERVER_URL`.

## 1. Tạo Sandbox và lấy source từ Git

Trong Vercel Dashboard, chọn đúng team → project `ech-prime-web-v2` → **Sandboxes**. Nếu có **Create Sandbox**, tạo `pw1-staging-migration` với 8 vCPU và timeout đủ cho migration. Nếu giao diện không có nút tạo, dùng `sandbox create --project ech-prime-web-v2 --name pw1-staging-migration --vcpus 8 --timeout 24h` trên máy cá nhân. Nếu màn hình tạo có mục **Source/Repository**, chọn repo `primeproduction/ech-prime-web-v2`. Nếu giao diện đã clone source, mở terminal Sandbox và chuyển sang thư mục repo; bỏ lệnh `git clone` bên dưới.

Nếu màn hình chỉ tạo Sandbox trống, mở terminal tương tác của Sandbox (`sandbox connect` từ máy cá nhân nếu Dashboard không có terminal) rồi clone **trong Sandbox**:

```bash
sandbox connect --project ech-prime-web-v2 pw1-staging-migration
```

Lệnh này chạy trên **máy cá nhân** nếu bạn chưa mở được terminal Sandbox từ Dashboard. Sau khi đã vào Sandbox:

```bash
git clone https://github.com/primeproduction/ech-prime-web-v2.git /vercel/pw1-app
cd /vercel/pw1-app
```

Repo private cần quyền GitHub đọc repo riêng cho bước clone; việc Vercel deploy từ GitHub không tự cấp credential cho shell Sandbox. Dùng token GitHub giới hạn repo và quyền `Contents: Read` khi được hỏi, không đặt token vào URL/lệnh. [Vercel: private repository trong Sandbox](https://vercel.com/kb/guide/sandbox-private-github-repositories).

Ở **terminal Sandbox**, sau khi vào đúng thư mục repo:

```bash
APP_DIR=$(pwd)
git rev-parse HEAD
npm ci
```

`APP_DIR` được dùng lại trong phần backup. Trước migration, kiểm checkout đã có các script `migrate:pw1`, `migrate:pw1:import` và `migrate:pw1:website` trong `package.json`; giữ nguyên code từ export tới hết import. Nếu giao diện không có Source/Repository hoặc terminal, dùng `sandbox connect` để thực hiện bước clone; không giả định Dashboard đã tự chép code.

## 2. Trên máy cá nhân: chuyển env và CSV

Trong **cùng một terminal** trên máy cá nhân, điền đường dẫn snapshot vào `CSV_DIR`. Sandbox và source đã được tạo ở bước 1.

```bash
PROJECT=ech-prime-web-v2
SB=pw1-staging-migration
CSV_DIR='/absolute/path/to/csv-snapshot'
test -d "$CSV_DIR" || { echo 'CSV_DIR không tồn tại'; exit 1; }
umask 077

vercel link
vercel env pull /tmp/pw1-staging.env.local --environment=preview --git-branch=staging
sandbox copy --project "$PROJECT" /tmp/pw1-staging.env.local "$SB:/vercel/pw1-staging.env.local"

tar -czf /tmp/pw1-csv.tar.gz -C "$CSV_DIR" .
sandbox copy --project "$PROJECT" /tmp/pw1-csv.tar.gz "$SB:/vercel/pw1-csv.tar.gz"
```

Nếu staging là Vercel **Custom Environment** thay vì Preview branch, thay lệnh pull bằng `vercel env pull /tmp/pw1-staging.env.local --environment=staging`. Khi `vercel link` hỏi, chọn đúng team/project. File env được pull phải chứa secret thật, không phải placeholder; không dùng env trỏ DB local hoặc production.

## 3. Trong Sandbox: chuẩn bị CSV và env

Quay lại terminal Sandbox, trong thư mục repo đã chọn ở bước 1:

```bash
APP_DIR=$(pwd)
umask 077
mkdir -p /vercel/pw1-input
tar -xzf /vercel/pw1-csv.tar.gz -C /vercel/pw1-input
mv /vercel/pw1-staging.env.local "$APP_DIR/.env.local"
chmod 600 "$APP_DIR/.env.local"
find /vercel/pw1-input -maxdepth 1 -type f -name '*.csv' | wc -l
```

Kết quả cuối phải là **93**. Giữ nguyên thư mục source đến khi import xong. Nếu `/vercel` không có quyền ghi trên image đang dùng, chọn một đường dẫn tuyệt đối có quyền ghi và thay nhất quán trong các lệnh.

Trước khi ghi DB, kiểm `DATABASE_URI` trong `.env.local` trỏ **đúng Neon staging branch/database**, và `PW2_MIGRATION_TARGET_ID` cùng cấu hình `S3_ENDPOINT`, `S3_BUCKET`, `NEXT_PUBLIC_S3_ENDPOINT` khớp storage đích. Không sửa target guard để bỏ qua mismatch. `seed-preload.cjs` chỉ nạp biến chưa tồn tại trong process, nên env đã được cấp sẵn cho Sandbox có thể ghi đè file này.

## 4. Schema và SSO

Trong **Neon SQL Editor của đúng staging branch**, kiểm các bảng cơ bản:

```sql
SELECT to_regclass('public.users') AS users,
       to_regclass('public.tenants') AS tenants,
       to_regclass('public.media') AS media,
       to_regclass('public.plan_features') AS plan_features;
```

Nếu có giá trị `NULL`, dừng để provision/sửa schema. Nếu đủ, quay lại **Sandbox**:

```bash
npm run db:migrate
```

Chỉ tiếp tục khi log có `Migration summary: ... failed=0` và không báo `Migration failed`. Sau đó chạy:

```bash
npm run db:seed-sso
```

SSO phải báo tạo/cập nhật thành công, không phải `SKIPPED`. Lệnh này cập nhật mật khẩu nếu SSO user đã tồn tại. Không dùng `npm run db:seed` vì đó là demo fixture.

## 5. Export rồi import data

Trong **Sandbox**, dùng đúng thời điểm snapshot. Ví dụ dưới đây dành cho snapshot ngày 18/09/2026; thay nếu bộ CSV của bạn khác. Với bộ PROD lớn, cấp 4 GiB V8 heap cho exporter để tránh OOM ở bước coverage. Sandbox cần ít nhất 8 GiB RAM; kiểm `/sys/fs/cgroup/memory.max` nếu đã tạo Sandbox với cấu hình khác.

```bash
NODE_OPTIONS='--max-old-space-size=4096' npm run migrate:pw1 -- /vercel/pw1-input --as-of 2026-09-18T00:00:00Z
```

Exporter **chưa ghi DB**. Nếu nó chết giữa chừng, chạy lại tạo run mới; không dùng artifact dở. Đọc `handoff.json` và `artifact/export-review.md`. `status=exported` hoặc exit 0 chưa có nghĩa import-ready.

Exporter thường in sẵn `Import dry-run:` và `Import:` với đúng đường dẫn config. Kiểm `localDatabase` và `targetHost` trong `Import config:` khớp `DATABASE_URI`, rồi **chạy nguyên lệnh `Import dry-run:` được in ra**. Chỉ khi dry-run đạt `DRY_RUN_PASSED` và target đúng mới chạy lệnh `Import:`.

Nếu exporter chỉ in `Import config needs creatorBindings` mà không in hai lệnh trên, export vẫn thành công nhưng import `--all` cần xử lý các actor được liệt kê. Xem `docs/migration/README.md`; sau khi bổ sung binding vào `Import config:`, chạy dry-run/import với chính đường dẫn config đó.

Nếu import thật bị ngắt, dùng **đúng** đường dẫn `Inspect run:` của lần apply để tiếp tục:

```bash
npm run migrate:pw1:import -- --run /absolute/path/to/import-run --continue
```

BE hoàn tất khi `run.json` có stage `COMPLETED` và có `prepared/destination-manifest.json`. Mỗi Store được import phải có evidence generation `COMPLETE`; số dòng `migration_field_evidence` phải bằng `summary.fieldTotal`. `STORE_VERIFIED` chưa phải hoàn tất toàn run. Evidence `COMPLETE` vẫn có thể chứa `mismatch`/`unverified` cần xem xét.

## 6. Website và lưu kết quả

Chỉ chạy khi BE đã `COMPLETED`, staging app dùng cùng Neon/S3, và có `OPENAI_API_KEY`, `NEXT_PUBLIC_SERVER_URL`:

```bash
npx playwright install chromium
npm run migrate:pw1:website -- --dry-run
```

CLI tự chọn BE run hoàn tất mới nhất trong `.migration/runs`; kiểm dòng `BE input:`. Nếu dry-run đạt và chọn đúng run:

```bash
npm run migrate:pw1:website
```

Đọc `website-runs/.../summary.json` và báo cáo audit. Nếu Chromium thiếu thư viện hệ thống, cài dependencies phù hợp image rồi chạy lại.

Trước khi dừng/xóa Sandbox, đóng gói run trong **Sandbox**:

```bash
tar -czf /vercel/pw1-runs.tar.gz -C "$APP_DIR" .migration/runs
```

Thoát shell Sandbox bằng `exit`. Trên **máy cá nhân**, trong terminal còn `PROJECT` và `SB`:

```bash
sandbox copy --project "$PROJECT" "$SB:/vercel/pw1-runs.tar.gz" /tmp/pw1-runs.tar.gz
```

Lưu archive vào private storage của team. Archive chứa artifact, evidence và có thể có dữ liệu cá nhân; Sandbox không phải nơi lưu vĩnh viễn.
