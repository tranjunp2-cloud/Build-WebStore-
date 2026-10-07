# Migration PW1 → PW2 trên Vercel Sandbox

Cập nhật: 2026-10-07. Đây là đường chạy ngắn cho project `ech-prime-web-v2`, Neon staging và bộ 93 CSV tại `/home/liam/Documents/DB_PROD`. Lệnh ghi DB chỉ chạy sau khi đã xác nhận `DATABASE_URI` là Neon staging. Lệnh **local** chạy trên máy bạn; lệnh **Sandbox** chạy trong shell Sandbox.

## 1. Mở Sandbox

Trên Vercel Dashboard, chọn đúng team → project `ech-prime-web-v2` → **Sandboxes**. Nếu giao diện có **Create Sandbox**, tạo Sandbox tên `pw1-staging-migration`. Nếu chưa có nút tạo, chạy ở **local**:

```bash
sandbox create --project ech-prime-web-v2 --name pw1-staging-migration \
  --image vercel/sandbox/universal:latest --vcpus 8 --timeout 24h
```

Mở terminal Sandbox từ **local**:

```bash
sandbox connect --project ech-prime-web-v2 pw1-staging-migration
```

Sandbox thuộc project Vercel nhưng **không tự có source hoặc env staging**. Dashboard giúp xem trạng thái/usage; các bước copy file và chạy migration dùng CLI. Nếu project/plan không cho 8 vCPU hoặc 24 giờ, dùng giới hạn CLI báo. [Vercel Sandbox](https://vercel.com/docs/sandbox).

Image Sandbox có thể không cài sẵn `nano`/`vim`. Nếu cần sửa file trực tiếp trong shell Ubuntu, chạy `sudo apt-get update && sudo apt-get install -y nano`. Kiểm image bằng `cat /etc/os-release`; image Amazon Linux cũ dùng `dnf` thay cho `apt-get`. Có thể dùng `sandbox copy` để sửa file trên máy local rồi đưa lại vào Sandbox mà không cần editor trong máy.

## 2. Clone source

**Sandbox:**

```bash
cd /vercel/sandbox
git clone --branch feat/F42-migration-data-pw1-to-pw2 --single-branch \
  git@github.com:primeproduction/ech-prime-web-v2.git ech-prime-web-v2
cd ech-prime-web-v2
npm ci
```

Branch migration hiện tại ở commit `48b6d8bad7ba5a40b3ae9097d8efe383ee744c24`. Kiểm `git rev-parse HEAD` trước khi export và giữ nguyên code tới khi import xong. Repo private cần GitHub credential riêng cho Sandbox (SSH deploy key chỉ đọc hoặc token giới hạn repo); Vercel liên kết GitHub để deploy **không** cấp sẵn quyền clone trong shell. Nếu `git clone` báo `Permission denied`, [thiết lập quyền repo private](https://vercel.com/kb/guide/sandbox-private-github-repositories) rồi chạy lại; không đặt token vào URL clone. Nếu thư mục source đã tồn tại, dùng nó sau khi kiểm commit, không clone chồng.

## 3. Lấy env staging và copy CSV

Thoát shell Sandbox bằng `exit`. **Local**, từ checkout của repo (khi `vercel link` hỏi, chọn đúng project/team):

```bash
umask 077
vercel link
vercel env pull /tmp/pw1-staging.env.local --environment=preview --git-branch=staging
tar -czf /tmp/pw1-csv.tar.gz -C /home/liam/Documents/DB_PROD .
sandbox copy --project ech-prime-web-v2 /tmp/pw1-staging.env.local \
  pw1-staging-migration:/vercel/sandbox/ech-prime-web-v2/.env.local
sandbox copy --project ech-prime-web-v2 /tmp/pw1-csv.tar.gz \
  pw1-staging-migration:/vercel/sandbox/pw1-csv.tar.gz
sandbox connect --project ech-prime-web-v2 \
  --workdir /vercel/sandbox/ech-prime-web-v2 pw1-staging-migration
```

Nếu staging là **Custom Environment** thay vì Preview branch, dùng `--environment=staging` và bỏ `--git-branch`. `vercel link` chọn project, còn `vercel env pull` chọn environment/branch. Nếu không có quyền pull env, lấy file private từ secret store của team. Không dùng `.env.local` của máy local nếu nó trỏ DB/Minio local. [Vercel env pull](https://vercel.com/docs/cli/env).

**Sandbox:**

```bash
mkdir -p /vercel/sandbox/pw1-input
tar -xzf /vercel/sandbox/pw1-csv.tar.gz -C /vercel/sandbox/pw1-input
chmod 600 .env.local
find /vercel/sandbox/pw1-input -maxdepth 1 -name '*.csv' -type f | wc -l
```

Kết quả phải là **93**. Trước bước ghi DB, xác nhận trong env: `DATABASE_URI` là Neon staging, `PW2_MIGRATION_TARGET_ID` đúng target, `S3_ENDPOINT`/`S3_BUCKET`/`NEXT_PUBLIC_S3_ENDPOINT` khớp storage mà Sandbox truy cập được. Nếu DB đã có `migration_target_guard`, các giá trị này phải khớp guard. Không sửa guard để bỏ qua mismatch. `NEXT_PUBLIC_SERVER_URL` phải trỏ deployment staging dùng cùng Neon target.

## 4. Schema và SSO

**Sandbox**, khi core Payload tables (`users`, `tenants`) đã tồn tại:

```bash
npm run db:migrate
npm run db:seed-sso
```

Nếu Neon branch **hoàn toàn trống**, tạo Payload core schema **trước** hai lệnh trên. Chỉ dùng lệnh này cho branch staging mới/trống:

```bash
NODE_ENV=development PAYLOAD_PUSH_SCHEMA=true npx tsx --require ./scripts/seed-preload.cjs -e "import { getPayload } from 'payload'; import config from './src/payload.config.ts'; getPayload({ config }).then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })"
```

`db:migrate` chỉ đạt khi log summary có `failed=0`; exit code 0 một mình chưa đủ. Code hiện tại từng báo lỗi `plan_features.plan_id` và enum trên DB mới: nếu gặp, dừng để xử lý schema. `db:seed-sso` phải tạo/cập nhật account, không báo `SKIPPED`; cần `SSO_SERVICE_PASSWORD` trong env. Không chạy `npm run db:seed` vì đó là demo fixture.

## 5. Export và import BE data

**Sandbox:**

```bash
npm run migrate:pw1 -- /vercel/sandbox/pw1-input --as-of 2026-09-18T00:00:00Z
```

Ghi đường dẫn `Import config:` mà exporter in ra, rồi đặt biến theo **run ID thật**:

```bash
PW1_RUN_DIR=/vercel/sandbox/ech-prime-web-v2/.migration/runs/pw1-THAY-RUN-ID
npm run migrate:pw1:import -- --config "$PW1_RUN_DIR/import-config.json" --all --dry-run
npm run migrate:pw1:import -- --config "$PW1_RUN_DIR/import-config.json" --all
```

Chỉ chạy lệnh import thật khi dry-run có stage `DRY_RUN_PASSED`, target đúng và creator binding đã xử lý. Export báo `partial`/`importReady=false` là báo cáo chẩn đoán; đọc `handoff.json` và output importer. Nếu apply bị ngắt, dùng **đúng** đường dẫn `Inspect run:` đã in:

```bash
npm run migrate:pw1:import -- --run /DUONG-DAN-IMPORT-RUN-THAT --continue
```

Hoàn tất BE cần `run.json` stage `COMPLETED`, `prepared/destination-manifest.json` và một `migration_evidence_generations` ở trạng thái `COMPLETE` cho **mỗi** Store đã chọn. Số dòng `migration_field_evidence` của từng generation phải bằng `summary.fieldTotal`. Import thật yêu cầu artifact có `source-evidence.ndjson`; thiếu sidecar hoặc evidence của bất kỳ Store nào sẽ khiến run báo lỗi thay vì hoàn tất. `COMPLETE` xác nhận evidence đã được ghi đầy đủ theo field registry; các dòng `mismatch`, `unsupported` và `unverified` vẫn cần được xem xét riêng. `FINALIZE_SELECTION_READY` và `STORE_VERIFIED` chưa phải hoàn tất.

## 6. Website migration và lưu kết quả

Chỉ chạy sau BE import, khi staging app đang dùng cùng Neon DB, S3 truy cập được và có `OPENAI_API_KEY`, `NEXT_PUBLIC_SERVER_URL`:

```bash
npx playwright install --with-deps chromium
npm run migrate:pw1:website -- --runs-root /vercel/sandbox/ech-prime-web-v2/.migration/runs --dry-run
npm run migrate:pw1:website -- --runs-root /vercel/sandbox/ech-prime-web-v2/.migration/runs
```

Lưu `.migration/runs` ra storage private của team trước khi dừng/xóa Sandbox. Thư mục này chứa artifact, run state và evidence; có thể chứa dữ liệu cá nhân. Filesystem Sandbox có snapshot để resume nhưng không phải nơi lưu lâu dài. [Thời hạn và persistence](https://vercel.com/kb/guide/vercel-sandbox-duration-and-persistence).

## Khi có lỗi

- `REPOSITORY_ROOT_NOT_FOUND`: chạy trong `/vercel/sandbox/ech-prime-web-v2`.
- `TARGET_GUARD_*`: kiểm Neon target ID và S3 origins/bucket, không sửa guard cho khớp một env sai.
- `CREATOR_BINDINGS_REQUIRED`: xem `user-actors.json` và `import-config.json`, bind từng source actor với PW2 user đã xác minh; không mặc định mọi actor là user 51.
- `IMPORT_FAILED` tại `verify-store`: mở `Inspect run`/events và sửa nguyên nhân, rồi `--continue` run đó.
- Website không thấy BE run: kiểm stage `COMPLETED`, destination manifest và `--runs-root`.
