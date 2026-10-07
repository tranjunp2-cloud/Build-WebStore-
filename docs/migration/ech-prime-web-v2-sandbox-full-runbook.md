# Migration PW1 → PW2 trên Vercel Sandbox

Cập nhật: 2026-10-07. Đây là đường chạy cho project `ech-prime-web-v2`, Neon staging và bộ 93 CSV tại `/home/liam/Documents/DB_PROD`. Lệnh **local** chạy trên máy giữ CSV; lệnh **Sandbox** chạy trong shell Sandbox. Chỉ import sau khi đã xác nhận Neon branch/database và storage đích.

**Điều kiện chặn cần biết trước:** Neon staging phải có core Payload schema. `db:migrate` hiện bỏ qua toàn bộ migration nhưng vẫn exit 0 nếu schema `public` trống; quy trình tạo core schema trên DB trống chưa được xác minh, từng lỗi F42/enum. Với snapshot PROD gốc, exporter có thể yêu cầu binding cho nhiều external creator; CLI `migrate:pw1:bind-system` chỉ tạo binding cho một actor. Nếu cần nhiều actor mà chưa có file `creatorBindings` hợp lệ cho đúng snapshot/target, không thể làm theo runbook này tới import thật. Phần dưới nêu điểm dừng cụ thể thay vì coi export thành công là import-ready.

## 1. Mở Sandbox

Trên Vercel Dashboard, chọn đúng team → project `ech-prime-web-v2` → **Sandboxes**. Nếu giao diện có **Create Sandbox**, tạo Sandbox tên `pw1-staging-migration`. Nếu chưa có nút tạo, chạy ở **local**:

```bash
sandbox create --project ech-prime-web-v2 --name pw1-staging-migration \
  --image vercel/sandbox/universal:latest --vcpus 8 --timeout 24h
sandbox exec --project ech-prime-web-v2 pw1-staging-migration -- pwd
sandbox exec --project ech-prime-web-v2 pw1-staging-migration -- node --version
sandbox exec --project ech-prime-web-v2 pw1-staging-migration -- mkdir -p /vercel/pw1-app /vercel/pw1-input
```

Mở terminal Sandbox từ **local**:

```bash
sandbox connect --project ech-prime-web-v2 pw1-staging-migration
```

Sandbox thuộc project Vercel nhưng **không tự có source hoặc env staging**. Dashboard giúp xem trạng thái/usage; các bước copy file và chạy migration dùng CLI. Nếu project/plan không cho 8 vCPU hoặc 24 giờ, dùng giới hạn CLI báo. Node phải từ 20 trở lên theo `package.json`. `/vercel` là thư mục cha dùng chung; không giả định working directory là `/vercel/sandbox` vì Sandbox thực tế từng trả về `/vercel`. Nếu `mkdir` thất bại, kiểm `pwd` và chọn một đường dẫn tuyệt đối có quyền ghi, rồi thay nhất quán các đường dẫn `/vercel/...` bên dưới. [Vercel Sandbox](https://vercel.com/docs/sandbox).

Image Sandbox có thể không cài sẵn `nano`/`vim`. Nếu cần sửa file trực tiếp trong shell Ubuntu, chạy `sudo apt-get update && sudo apt-get install -y nano`. Kiểm image bằng `cat /etc/os-release`; image Amazon Linux cũ dùng `dnf` thay cho `apt-get`. Có thể dùng `sandbox copy` để sửa file trên máy local rồi đưa lại vào Sandbox mà không cần editor trong máy.

## 2. Đưa source đã commit vào Sandbox

Repo private không tự clone được chỉ vì project đã liên kết GitHub. Cách không cần cấp credential GitHub cho Sandbox là chép **commit đã checkout**. Tại root repo trên **local**:

```bash
git status --short
git rev-parse HEAD
umask 077
git archive --format=tar HEAD | gzip -1 > /tmp/pw1-source.tar.gz
sha256sum /tmp/pw1-source.tar.gz
sandbox copy --project ech-prime-web-v2 /tmp/pw1-source.tar.gz \
  pw1-staging-migration:/vercel/pw1-source.tar.gz
sandbox exec --project ech-prime-web-v2 pw1-staging-migration -- sha256sum /vercel/pw1-source.tar.gz
sandbox exec --project ech-prime-web-v2 pw1-staging-migration -- \
  tar -xzf /vercel/pw1-source.tar.gz -C /vercel/pw1-app
sandbox exec --project ech-prime-web-v2 --workdir /vercel/pw1-app \
  pw1-staging-migration -- git init -q
sandbox exec --project ech-prime-web-v2 --workdir /vercel/pw1-app \
  pw1-staging-migration -- npm ci
```

Hai SHA-256 phải giống nhau. `git archive HEAD` chỉ gồm file đã commit; nếu `git status --short` trên local có thay đổi migration chưa commit thì dừng. `git init` tạo marker `.git` mà importer hiện yêu cầu để nhận diện repo; nó **không** khôi phục lịch sử/commit từ archive. Ghi lại commit hash in trên local và giữ nguyên source tới khi import xong. Nếu muốn clone trực tiếp trong Sandbox, phải cấp deploy key chỉ đọc hoặc token giới hạn repo, rồi kiểm đúng commit; không đặt token vào URL. [Repo private trong Sandbox](https://vercel.com/kb/guide/sandbox-private-github-repositories).

## 3. Lấy env staging và copy CSV

Thoát shell Sandbox bằng `exit`. **Local**, từ checkout của repo (khi `vercel link` hỏi, chọn đúng project/team):

```bash
umask 077
vercel link
vercel env pull /tmp/pw1-staging.env.local --environment=preview --git-branch=staging
tar -czf /tmp/pw1-csv.tar.gz -C /home/liam/Documents/DB_PROD .
sha256sum /tmp/pw1-csv.tar.gz
sandbox copy --project ech-prime-web-v2 /tmp/pw1-staging.env.local \
  pw1-staging-migration:/vercel/pw1-app/.env.local
sandbox copy --project ech-prime-web-v2 /tmp/pw1-csv.tar.gz \
  pw1-staging-migration:/vercel/pw1-csv.tar.gz
sandbox exec --project ech-prime-web-v2 pw1-staging-migration -- sha256sum /vercel/pw1-csv.tar.gz
sandbox connect --project ech-prime-web-v2 \
  --workdir /vercel/pw1-app pw1-staging-migration
```

Thay `/home/liam/Documents/DB_PROD` bằng đường dẫn snapshot thật. Nếu staging là **Custom Environment** thay vì Preview branch, dùng `--environment=staging` và bỏ `--git-branch`. `vercel link` chọn project, còn `vercel env pull` chọn environment/branch. So hai hash CSV. File env được pull có thể thiếu secret hoặc mang placeholder theo quyền; xác nhận giá trị thật trước khi copy. Nếu không có quyền pull env, lấy file riêng từ secret store của team. Ưu tiên file chỉ chứa các key cần thiết; không dùng `.env.local` local nếu nó trỏ DB/Minio local. [Vercel env pull](https://vercel.com/docs/cli/env).

**Sandbox:**

```bash
chmod 600 .env.local
umask 077
tar -xzf /vercel/pw1-csv.tar.gz -C /vercel/pw1-input
find /vercel/pw1-input -maxdepth 1 -name '*.csv' -type f | wc -l
node --require ./scripts/seed-preload.cjs -e 'const keys=["DATABASE_URI","PAYLOAD_SECRET","PW2_MIGRATION_TARGET_ID","S3_ENDPOINT","S3_BUCKET","NEXT_PUBLIC_S3_ENDPOINT","SSO_SERVICE_PASSWORD","NEXT_PUBLIC_SERVER_URL","OPENAI_API_KEY"];for(const k of keys)console.log(k,process.env[k]?"set":"MISSING");if(process.env.DATABASE_URI){const u=new URL(process.env.DATABASE_URI);console.log("target host",u.hostname,"database",decodeURIComponent(u.pathname.slice(1)))}'
```

Kết quả phải là **93** CSV ngay trong thư mục đầu vào. Đối chiếu `target host`/`database` với Neon Dashboard; `DATABASE_URI` phải trỏ Neon staging. `PW2_MIGRATION_TARGET_ID`, `S3_ENDPOINT`, `S3_BUCKET`, `NEXT_PUBLIC_S3_ENDPOINT` phải khớp guard/storage đích; không sửa guard để bỏ qua mismatch. `NEXT_PUBLIC_SERVER_URL` phải trỏ deployment staging dùng cùng Neon target. Các key giải mã credential (`PW2_MIGRATION_SECRET`, `PW1_APP_KEY`, `SSO_ENCRYPTION_KEY`) cần có nếu artifact của snapshot yêu cầu. `seed-preload.cjs` chỉ nạp các key chưa có trong process; env được cấp sẵn trong Sandbox có thể ghi đè file.

## 4. Schema và SSO

Trước khi ghi DB, trong **Neon SQL Editor của đúng staging branch**, chạy truy vấn chỉ đọc:

```sql
SELECT to_regclass('public.users') AS users,
       to_regclass('public.tenants') AS tenants,
       to_regclass('public.media') AS media,
       to_regclass('public.plan_features') AS plan_features;
```

Nếu bất kỳ cột nào trả `NULL`, dừng để provision/sửa schema. Khi core Payload tables đã tồn tại, trong **Sandbox**:

```bash
npm run db:migrate
```

`db:migrate` chỉ đạt khi log summary có `failed=0` và không có `[db-setup] ❌ Migration failed`; exit code 0 một mình chưa đủ. Nếu Neon branch trống, **chưa có lệnh bootstrap schema đã xác minh trong runbook này**; lệnh `db:migrate` sẽ bỏ qua migrations và Payload `pushDevSchema` từng lỗi `plan_features.plan_id`/enum. Chỉ sau khi migration đạt, chạy:

```bash
npm run db:seed-sso
```

`db:seed-sso` phải tạo/cập nhật account, không báo `SKIPPED`; cần `SSO_SERVICE_PASSWORD` trong env. Lệnh này đổi mật khẩu SSO user nếu tài khoản đã tồn tại. Không chạy `npm run db:seed` vì đó là demo fixture.

## 5. Export và import BE data

**Sandbox:** đặt `--as-of` theo thời điểm snapshot đã xác minh; mốc dưới đây chỉ là ví dụ và phải thay trước khi chạy. Profile mặc định `configs/migration/pw1-prod-profile.json` chứa source identity, domain mapping, policy và các Store bị loại theo quyết định PROD; phải duyệt lại nếu dùng nguồn khác.

Với snapshot PROD khoảng 2.918 Stores, Node 24 trong Sandbox từng OOM ở `build-coverage-report` khi V8 heap mặc định chỉ khoảng 2 GiB. Kiểm giới hạn bộ nhớ **trong Sandbox** trước khi export:

```bash
cat /sys/fs/cgroup/memory.max
free -h
node -p 'Math.round(require("v8").getHeapStatistics().heap_size_limit / 1024 / 1024) + " MiB V8 heap"'
df -h .
```

Nếu cgroup có ít nhất 8 GiB RAM, dành 4 GiB V8 heap cho riêng lần export. Profile PROD còn giới hạn RSS ở 6 GiB; tăng heap quá gần giới hạn này có thể chuyển từ OOM sang `RESOURCE_MEMORY_LIMIT`. Nếu Sandbox thực tế dưới 8 GiB, cần đổi cấu hình Sandbox trước khi export, không dùng lệnh 4 GiB dưới đây. `NODE_OPTIONS` chỉ áp dụng cho câu lệnh này; không phải env staging cần lưu lâu dài.

```bash
PW1_AS_OF='2026-09-18T00:00:00Z'
NODE_OPTIONS='--max-old-space-size=4096' npm run migrate:pw1 -- /vercel/pw1-input --as-of "$PW1_AS_OF"
```

Export chỉ đọc CSV, chưa import. Nếu trước đó exporter chết vì OOM, chạy lại lệnh sẽ tạo run ID mới; không dùng artifact/run dở của lần cũ để import. Đọc `handoff.json`, `artifact/export-review.md`, số Store được chọn/bị loại và blockers. `exitCode=0` hoặc `status=exported` không đồng nghĩa import-ready. Ghi đường dẫn `Import config:` mà exporter in ra, rồi đặt biến theo **run ID thật**:

```bash
PW1_IMPORT_CONFIG='/vercel/pw1-app/.migration/runs/THAY-RUN-ID/import-config.json'
```

Nếu exporter báo **một** external actor, config có thể tự có `systemCreator`; vẫn phải xác minh `sourceRef` trong `artifact/user-actors.json` và SSO user thực tế ở PW2. Nếu báo **nhiều** actor (snapshot PROD từng có `@users:users:1` và `@users:users:51`), config không tự có binding. Cần file `creatorBindings` hợp lệ cho **từng** actor, trỏ tới các PW2 user riêng đã xác minh, có evidence và hash đúng snapshot/target; thêm đường dẫn file vào `import-config.json` theo [contract](README.md). Repo hiện chưa có CLI tổng quát để tạo file nhiều actor từ đầu. **Không chạy import thật nếu thiếu bước này.**

Kiểm `localDatabase` và `targetHost` trong config khớp chính xác `DATABASE_URI`. Khi binding/config đã hoàn chỉnh, trong **Sandbox**:

```bash
npm run migrate:pw1:import -- --config "$PW1_IMPORT_CONFIG" --all --dry-run
```

Chỉ khi dry-run của **cùng config** có stage `DRY_RUN_PASSED`, target đúng và blockers đã xử lý, chạy import thật:

```bash
npm run migrate:pw1:import -- --config "$PW1_IMPORT_CONFIG" --all
```

Import thật tạo run mới; không dùng `--continue` với dry-run. Nếu apply bị ngắt, dùng **đúng** đường dẫn `Inspect run:` đã in:

```bash
npm run migrate:pw1:import -- --run /DUONG-DAN-IMPORT-RUN-THAT --continue
```

Hoàn tất BE cần `run.json` stage `COMPLETED`, `prepared/destination-manifest.json` và một `migration_evidence_generations` ở trạng thái `COMPLETE` cho **mỗi** Store đã chọn. Số dòng `migration_field_evidence` của từng generation phải bằng `summary.fieldTotal`. Import thật yêu cầu artifact có `source-evidence.ndjson`; thiếu sidecar hoặc evidence của bất kỳ Store nào sẽ khiến run báo lỗi thay vì hoàn tất. `COMPLETE` xác nhận evidence đã được ghi đầy đủ theo field registry; các dòng `mismatch`, `unsupported` và `unverified` vẫn cần được xem xét riêng. `FINALIZE_SELECTION_READY` và `STORE_VERIFIED` chưa phải hoàn tất.

## 6. Website migration và lưu kết quả

Chỉ chạy sau BE import `COMPLETED`, khi staging app đang dùng cùng Neon DB, S3 truy cập được và có `OPENAI_API_KEY`, `NEXT_PUBLIC_SERVER_URL`. Website CLI chọn **BE run hoàn tất mới nhất** trong `--runs-root`; nếu có nhiều run, kiểm dòng `BE input:` đã chọn đúng run:

```bash
npx playwright install chromium
npm run migrate:pw1:website -- --runs-root /vercel/pw1-app/.migration/runs --dry-run
```

Sau khi dry-run đạt và `BE input:` đúng run, chạy:

```bash
npm run migrate:pw1:website -- --runs-root /vercel/pw1-app/.migration/runs
```

Nếu image thiếu thư viện Chromium, cài OS dependencies phù hợp (`npx playwright install --with-deps chromium` có thể cần quyền `sudo`) rồi chạy lại. Đọc `website-runs/.../summary.json` và báo cáo audit, không suy thành công từ exit code đơn lẻ. Xem [website CLI](pw1-website-cli.md).

Lưu `.migration/runs` ra storage private của team **trước khi dừng/xóa Sandbox**. Ví dụ trong **Sandbox**, ở `/vercel/pw1-app`:

```bash
tar -czf /vercel/pw1-migration-runs.tar.gz -C /vercel/pw1-app .migration/runs
sha256sum /vercel/pw1-migration-runs.tar.gz
```

Sau đó trên **local**:

```bash
umask 077
sandbox copy --project ech-prime-web-v2 \
  pw1-staging-migration:/vercel/pw1-migration-runs.tar.gz /tmp/pw1-migration-runs.tar.gz
sha256sum /tmp/pw1-migration-runs.tar.gz
```

So hai SHA-256 và lưu archive vào private storage có retention phù hợp. Archive có thể chứa dữ liệu cá nhân, run state, evidence và credential sidecar. Filesystem Sandbox có snapshot để resume nhưng không phải nơi lưu lâu dài. [Thời hạn và persistence](https://vercel.com/kb/guide/vercel-sandbox-duration-and-persistence).

## Khi có lỗi

- `REPOSITORY_ROOT_NOT_FOUND`: chạy trong `/vercel/pw1-app` và kiểm archive source có đủ file đã commit.
- `TARGET_GUARD_*`: kiểm Neon target ID và S3 origins/bucket, không sửa guard cho khớp một env sai.
- `CREATOR_BINDINGS_REQUIRED`: xem `user-actors.json` và `import-config.json`, bind từng source actor với PW2 user đã xác minh; công cụ `bind-system` hiện chỉ xử lý một actor.
- `IMPORT_FAILED` tại `verify-store`: mở `Inspect run`/events và sửa nguyên nhân, rồi `--continue` run đó.
- Website không thấy BE run: kiểm stage `COMPLETED`, destination manifest và `--runs-root`.
