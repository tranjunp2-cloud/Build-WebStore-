# Runbook — Rollout PR #2182: store "expired" giả → active, slug theo domain gốc, bật lại COD

> Issue #2179 (mục 1–3, 7). Rule: [addendum](pw1-stale-expired-status-and-bound-slug-20261102.md), PD-026.
> Chạy **dev trước**, prod chỉ sau khi dev sign-off. Chạy từ thư mục gốc repo, trên nhánh đã có code của PR (sau merge: `staging`/`main`).

## Tóm tắt

Chạy **tuần tự**; bước sau chỉ bắt đầu khi bước trước đã xong.

Mọi số kỳ vọng trong runbook đo trên **dev** (02/11/2026). Prod mới xác nhận được 57 store đã có web (link đang mở); trạng thái tenant/COD trên prod chưa đọc trực tiếp → trên prod dùng dry-run bước 3a, 4a để đối chiếu (mục 7).

| Bước | Lệnh | Ghi DB | Kỳ vọng (đo trên dev) |
|---|---|---|---|
| 1 | Chuẩn bị env + biến shell | – | – |
| 2 | `migrate:pw1:delta` → đọc report → `y`/`N` | khi gõ `y` | 97 tenant ghi; 39 site ghi; 57 site đã dựng web → `conflict` (đúng) |
| 3 | `migrate:pw1:website` (dry-run → chạy thật) | có, **tốn token** | chỉ dựng 1 web: 2917 |
| 4 | `migrate:pw1:site-cod` (dry-run → `--apply`) | chỉ `enableCod` | ~51 site bật COD |
| 5 | Kiểm tra (SQL chỉ đọc + mở web) | – | 96 tenant active, COD hiện ở checkout |

Kết quả cuối: 96 tenant `active`; slug 1329 = `de-lettuce-bear-berhad`, 1327 = `westwell-technology-malaysia-sdn-bhd` (1327 vẫn `suspended` vì PW1 ban store); COD hiện ở checkout cho mọi store PW1 bật COD.

## 1. Chuẩn bị

### 1.1 Đầu vào
- **Chỉ cần thư mục CSV PW1 prod**, mới hơn hoặc bằng bản đã import vào môi trường đích. Rollout này dùng `DB_PROD_281026_clean` (28/10/2026).
- Profile: để mặc định (`configs/migration/pw1-prod-profile.json`, có domain binding cho 1327/1329). **Không** truyền `--profile …pw1-dev-profile.json` → 1329/1327 lỗi `SOURCE_SITE_DOMAIN_SELECTION_REQUIRED`.
- `website-input.json` (bước 3) do bước 2 tự sinh; site id (bước 4) do lệnh tự tìm trong DB.

### 1.2 Biến môi trường
Lấy từ Vercel Dashboard, **không commit**:
```bash
vercel link                                                  # chọn đúng team/project
vercel env pull .env.local --environment=<môi trường đích>
chmod 600 .env.local
```
Biến đã `export` trong shell được ưu tiên hơn `.env.local`. **Trước mỗi lệnh, kiểm tra `DATABASE_URI` trỏ đúng môi trường** (`.env.local` máy dev thường trỏ DB local).

| Biến | Dùng ở bước |
|---|---|
| `DATABASE_URI` — kết nối trực tiếp, không dùng host `-pooler` | 2, 3, 4 |
| `PAYLOAD_SECRET` | 2, 3, 4 (`--apply`) |
| `PW1_APP_KEY`, `SSO_ENCRYPTION_KEY` (64 ký tự hex) | 2 — chỉ khi report có user mới/đổi mật khẩu (thiếu thì delta báo lỗi trước khi hỏi y/N) |
| `NEXT_PUBLIC_SERVER_URL` — app đang chạy, cùng DB + `PAYLOAD_SECRET` | 3 (publish + audit) |
| `AI_PLATFORM_URL`, `AI_PLATFORM_CONTEXT_SECRET` | 3 |
| `PIXABAY_API_KEYS` hoặc `PIXABAY_API_KEY` | 3 (thiếu → không lấy ảnh Pixabay) |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `NEXT_PUBLIC_S3_ENDPOINT` — đúng storage môi trường đích | 3 |

Không cần (dù có trong runbook import cũ): `PW2_MIGRATION_TARGET_ID`, `PW2_MIGRATION_SECRET`, `SSO_SERVICE_PASSWORD`, `OPENAI_API_KEY` (AI nay đi qua `AI_PLATFORM_*`), `NODE_OPTIONS`.

### 1.3 Biến shell
97 store = 96 store status=2 (đã gồm 1329) + 1327 (store bị ban, chỉ đổi slug).
```bash
export STORES="401,485,510,530,570,653,657,659,722,742,765,787,792,840,850,867,888,921,1218,1233,1239,1277,1329,1344,1388,1403,1410,1420,1430,1432,1454,1456,1487,1496,1516,1528,1543,1547,1550,1573,1590,1593,1617,1620,1639,1654,1665,1668,1672,1677,1689,1697,1725,1730,1758,1760,1768,1770,1778,1789,1792,1802,1820,1827,1836,1843,1846,1857,1871,1873,1912,1919,1967,1968,2000,2099,2111,2147,2152,2159,2177,2183,2219,2233,2236,2237,2240,2293,2315,2317,2324,2355,2593,2740,2861,2917,1327"
export CSV=/đường/dẫn/DB_PROD_281026_clean
export RUN=.migration/delta-runs/rollout-2179-$(date +%Y%m%d-%H%M)   # phải chưa tồn tại; chạy lại delta → đặt RUN mới
mkdir -p .migration
```

### 1.4 Kiểm tra trước khi chạy
- Slug đích còn trống — kết quả phải **rỗng** (trừ chính tenant 1329/1327 nếu đã chạy trước):
  ```sql
  SELECT 'slug' AS kind, id, slug FROM tenants WHERE slug IN ('de-lettuce-bear-berhad','westwell-technology-malaysia-sdn-bhd')
  UNION ALL
  SELECT 'previous', _parent_id, slug FROM tenants_previous_slugs WHERE slug IN ('de-lettuce-bear-berhad','westwell-technology-malaysia-sdn-bhd');
  ```
  Kiểm tra thêm từ ngoài (không cần DB): `GET /api/storefront/site-by-slug?slug=<slug>` phải 404 và `/api/slug/redirect` trả `redirect:false`.
- **Không đổi `--as-of`** (mặc định 2026-09-18 = lần import). Đổi sẽ ảnh hưởng lifecycle của mọi store.

## 2. Delta — xem report rồi mới ghi
```bash
npm run migrate:pw1:delta -- --new "$CSV" --store "$STORES" --out "$RUN"
```
Mất ~20–25 phút. Lệnh ghi report rồi dừng ở câu hỏi `Apply N changes to <db>? (y/N)`:
1. Mở terminal khác, đọc `$RUN/summary.md`; kiểm tra tên DB trong câu hỏi.
2. Đúng kỳ vọng → gõ **`y`**. Sai → gõ **`N`** (không ghi gì).

Không có terminal tương tác (CI, `nohup`) và không có `--yes` → tự dừng, không ghi.

**Report phải có:** `tenants` CHANGED 97, `sites` CHANGED 96, `plan-subscription-usages` NEW 1 (chỉ báo cáo); diagnostics `TENANT_STALE_EXPIRED_STATUS` 96 store, `SOURCE_DOMAIN_BINDING_APPLIED` chỉ 1327 + 1329. Có thể thêm thay đổi products/pages nếu CSV mới hơn lần delta trước — đọc kỹ, không phải lỗi.

**Sau khi ghi** (`$RUN/apply-result.json`):
- 39 store chưa dựng web: tenant + site `written` (COD đã bật).
- 57 store đã dựng web: tenant `written`, site `conflict` `SITE_WEBSITE_GENERATED` — đúng thiết kế, COD xử lý ở bước 4.
- 1327: tenant `written` (slug mới), vẫn `suspended`.
- Dòng `Website input: 39 stores → $RUN/website-input.json`.

## 3. Dựng website
```bash
npm run migrate:pw1:website -- "$RUN/website-input.json" --dry-run      # 3a. không gọi AI
```
Kỳ vọng: `invalidStores: []`, **1 store sẽ dựng (2917)**, 38 store `skipped` "no active pages to migrate" (PW1 không có page publish — đúng). **Ra nhiều hơn 1 store → dừng, kiểm tra lại.**
```bash
npm run migrate:pw1:website -- "$RUN/website-input.json" --store 2917  # 3b. chạy thật
npm run migrate:pw1:website -- status --store 2917
```
- Bị dừng giữa chừng → chạy lại cùng lệnh. Lỗi → `npm run migrate:pw1:website -- retry "$RUN/website-input.json" --store 2917`. Log: `… -- logs --store 2917`.
- Web xong tự publish qua `NEXT_PUBLIC_SERVER_URL`. Chi tiết: [pw1-website-cli.md](pw1-website-cli.md).

## 4. Bật lại COD cho site đã dựng web
Checkout chỉ hiện COD khi **cả** tenant `payment_cod` **và** site `enableCod` bật. Bước 2 bật phía tenant; site đã dựng web không được delta ghi nên vẫn `false`.

Chỉ chạy khi bước 3 đã xong (`status --store 2917` không còn `running`).
```bash
npm run migrate:pw1:site-cod -- --store "$STORES"            # 4a. xem trước, không ghi
npm run migrate:pw1:site-cod -- --store "$STORES" --apply    # 4b. ghi
```
Lệnh tự tìm site: đã dựng web + tenant `active` + `payment_cod=true` + site `enableCod=false`, và `false` đúng là giá trị migration đã ghi. Chỉ đổi `enableCod`, giữ nguyên QR/bank. Report in ở dòng `Report:` cuối lệnh.

| Kết quả | Nghĩa | Kỳ vọng (dev) |
|---|---|---|
| `PATCH` | sẽ bật / đã bật (`written`) | ~51 |
| `SKIP_PW2_EDITED` | PW2 đã sửa tay sau migration → không đụng, hỏi người phụ trách store | 0 |
| `SKIP_NO_PROJECTION` | thiếu dữ liệu import để đối chiếu → kiểm tra tay | 0 |

Store trong `--store` không được chọn được liệt kê ở mục `Not selected`:

| Lý do | Nghĩa | Kỳ vọng (dev) |
|---|---|---|
| `NOT_GENERATED` | chưa dựng web (bước 2 đã ghi site) | ~39 (38 store không page + 1327) |
| `ALREADY_ENABLED` | COD đã bật | 7 (2917 + 6 store active lúc import: 1456, 1730, 1827, 1857, 1871, 1873) |
| `NOT_COMPLETED` | dựng web chưa xong | 0 — chạy lại sau bước 3 |
| `TENANT_NOT_ACTIVE` | tenant chưa active (delta chưa ghi / `PW2_EDITED_CONFLICT`) | 0 |
| `TENANT_COD_OFF` | PW1 tắt COD | 0 |

- Chạy lại sau `--apply` phải ra 0 `PATCH`.
- `changed-since-check`: giá trị đổi giữa lúc liệt kê và lúc ghi → không ghi.
- Exit code: `0` xong; `2` sai tham số; `4` có site ghi lỗi (chạy lại được); `1` lỗi khác.
- **Không dùng `--all`** cho rollout này: nó sửa cả store ngoài 97 store (vd merchant tự bật COD).

## 5. Kiểm tra
Chờ ≥ 5 phút (cache storefront), thay `<STORES>` bằng giá trị `$STORES`:
```sql
-- active 96, suspended 1 (1327)
SELECT t.status, count(*) FROM migration_entity_map m JOIN tenants t ON t.id = m.target_id::int
 WHERE m.source_entity='stores' AND m.target_collection='tenants' AND m.claim_active
   AND m.source_id = ANY(string_to_array('<STORES>', ',')) GROUP BY 1;
-- 2 dòng, slug mới
SELECT slug, status FROM tenants WHERE slug IN ('de-lettuce-bear-berhad','westwell-technology-malaysia-sdn-bhd');
-- = số SKIP_* ở bước 4 (thường 0)
SELECT count(*) FROM pw1_migration_stores ps JOIN tenants t ON t.id=ps.tenant_id JOIN sites s ON s.id=ps.site_id
 WHERE t.status='active' AND t.payments_payment_cod AND s.payment_config_enable_cod IS FALSE
   AND ps.source_store_id = ANY(string_to_array('<STORES>', ','));
```
- Mở `https://luxurious-wedding.<suffix>/` và `https://de-lettuce-bear-berhad.<suffix>/` → 200, có nội dung. `store-1329`, `store-1327` → 404 (không redirect, link cũ chưa gửi ai).
- Checkout thử 1 store đã dựng web từ trước + 2917 → có COD.
- Owner 1 store mẫu đăng nhập được.
- Ghi evidence vào `docs/qa/F42-pw1-master-json-export.md` TC-F42-DELTA-11.

## 6. Lỗi thường gặp
| Lỗi | Xử lý |
|---|---|
| `MASS_CHANGE_BLOCKED` | Gate tính trên mọi store trước khi lọc `--store`. Xem report; chỉ thêm `--allow-mass-change` nếu thay đổi của 97 store đúng kỳ vọng |
| `PW2_EDITED_CONFLICT` (tenant) | Tenant bị sửa trên PW2 sau import → không ép ghi, xem từng id |
| `SITE_WEBSITE_GENERATED` | Đúng thiết kế → bước 4 |
| `SOURCE_SITE_DOMAIN_SELECTION_REQUIRED` | Dùng nhầm dev profile → bỏ `--profile` |
| `DELTA_ALREADY_RUNNING` | Delta hoặc site-cod khác đang chạy → chờ |
| `SCOPE_REQUIRED` | site-cod thiếu `--store` |
| `OUT_PARENT_MISSING` | `mkdir -p .migration` |
| `OUT_NOT_PRIVATE` | `--out` phải nằm dưới `.migration/` (hoặc ngoài repo) |
| `POOLED_DATABASE_URI` | Dùng connection string trực tiếp, không `-pooler` |
| `no active pages to migrate` / `expected exactly one active owner` | Đúng — store không có page / bị ban không dựng web |
| Web 404 hoặc chưa thấy COD ngay | Cache 5 phút → chờ rồi kiểm tra lại |

## 7. Prod và rollback
- **Thứ tự release:** không promote #2183 (chặn COD/QR khi tenant suspended) lên `main` trước khi bước 2–4 của runbook này chạy xong trên prod — nếu không, 96 store đang bị suspend nhầm mất cả COD/QR cho tới lúc rollout.
- Lặp lại bước 1–5 với env prod sau khi dev sign-off. Bắt buộc:
  - kiểm tra lại slug trống (1.4);
  - report bước 2 khớp mục 2 (97 tenant, 57 site `SITE_WEBSITE_GENERATED`);
  - bước 3a ra đúng 1 store sẽ dựng (2917);
  - bước 4a ra ~51 `PATCH`, 0 `SKIP_*`.

  Số nào khác dev → **dừng**, đối chiếu từng store khác biệt trước khi ghi.
- Rollback: `$RUN` và report bước 4 giữ trạng thái trước khi ghi. Tenant đặt lại `suspended` qua Payload admin; site đặt lại `enableCod=false`. Sửa tay tenant làm các lần delta sau báo `PW2_EDITED_CONFLICT` cho tenant đó.
- Slug mới của 1329/1327 là chủ đích, không rollback. Nếu bắt buộc quay lại, sửa tay slug trong Payload admin (cũng gây `PW2_EDITED_CONFLICT` ở lần delta sau).
- Lệnh site-cod không cập nhật ledger migration: nếu sau này dựng lại web một store (`--rerun`) rồi delta ghi lại site đó, delta có thể báo `PW2_EDITED_CONFLICT` (an toàn, xử lý tay).

## Phụ lục — Rehearsal local (02/11/2026, CSV 281026)
- Bước 2: 97 tenant + 96 site `written`, 0 conflict (local chưa dựng web store nào); 1329/1327 đổi slug đúng.
- Bước 3a: 58 store đủ điều kiện (local chưa dựng web), 38 skip, 0 invalid. 3b chưa chạy (tốn token).
- Bước 4, dựng trạng thái giống dev (57 store đã dựng web, site `false`; sao lưu + khôi phục): 51 `PATCH` written + 6 `SKIP_PW2_EDITED` (6 store active lúc import — trên dev các site này vẫn `true`, nên dev ra `ALREADY_ENABLED`); 1327/2917/38 store không page không bị đụng; chạy lại → 0 `PATCH`.
- Bước 4, store 3/7/2920: thiếu `--store` → exit 2; dry-run không ghi; `--apply` → 2 written + 1 `SKIP_PW2_EDITED`; QR/bank và các cột khác giữ nguyên; chạy lại → 0 `PATCH`.
