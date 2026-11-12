# Phase 04 — CLI bật lại COD cho site đã dựng web (`migrate:pw1:site-cod`)

## Context
- Exporter: `identity-site.ts:264` `cod = sourceCod && tenantStatus === 'active'` → ghi cả `tenants[].payments.payment_cod` và `sites[].paymentConfig.enableCod` (L285, L314). QR/card/FPX luôn `false`, không phụ thuộc status → chỉ COD bị ảnh hưởng.
- Checkout COD cần cả hai: `tenant.payments.payment_cod === true` VÀ `site.paymentConfig.enableCod !== false` (`api/orders/checkout/route.ts:91`, `site-by-slug/route.ts:91`).
- Delta không ghi site đã dựng web: `delta-apply.ts:70` `SITE_WEBSITE_GENERATED`; tập store lấy từ `generatedWebsiteStores()` (`delta-ledger.ts:81`, `pw1_migration_stores.status='completed'`).
- Import ledger đã ghi projection site: `migration_entity_map.detail.projection.paymentConfig.enableCod=false` cho store bị suspend (đã kiểm tra local: 1329, 2917, 570). Delta ghi projection riêng ở `pw1_delta_map` (`priorProjection`, `delta-ledger.ts:61`).
- Runtime ghi có sẵn: `createDeltaRuntime` (`delta-runtime.ts`) — Payload local API + transaction + migration context; lock `acquireDeltaLock` (`delta-ledger.ts:19`).
- Hook `Sites.afterChange` revalidate cache là no-op ngoài Next request (`revalidate-storefront.ts`) → storefront cache tối đa 5 phút.
- Không có UI seller ghi `site.paymentConfig.enableCod` (chỉ Payload admin) → rủi ro ghi đè chỉnh sửa PW2 thấp nhưng vẫn phải guard.

## Overview
Priority high (chặn COD của 57 store đã trả tiền). Sau delta, 57 store đã dựng web có tenant active + `payment_cod=true` nhưng site `enableCod=false` → checkout ẩn COD. Thêm 1 lệnh CLI nhỏ, độc lập với delta, sửa đúng 1 field. Không tự tìm site id bằng tay: lệnh tự suy ra từ DB.

## Requirements
Functional
- Ứng viên = site thoả TẤT CẢ:
  1. `pw1_migration_stores.status='completed'` (đúng tập delta bỏ qua);
  2. tenant `status='active'`;
  3. tenant `payments.payment_cod = true`;
  4. site `paymentConfig.enableCod = false`;
  5. guard chỉnh sửa PW2: projection gần nhất của `sites/<storeId>` (`pw1_delta_map` nếu có, ngược lại import projection `claim_active`, `action='CREATE'`) có `paymentConfig.enableCod = false` = giá trị live → giá trị false là do migration ghi, không phải PW2 sửa.
- Quyết định mỗi site: `PATCH` | `SKIP_PW2_EDITED` (projection ≠ live) | `SKIP_NO_PROJECTION`. Site không thoả 1-4 không xuất hiện (đã đúng).
- Phạm vi **bắt buộc chọn rõ**: `--store <ids>` (cùng format delta) HOẶC `--all`. Không truyền cả hai → lỗi `SCOPE_REQUIRED`; truyền cả hai → lỗi. Lý do: màn hình seller (`settings/payments/actions.ts`) chỉ ghi `tenant.payments.payment_cod`, không ghi `site.enableCod`, nên ngoài 97 store có thể còn store khác ở trạng thái tenant bật / site tắt — không được sửa ngầm.
- Mặc định **dry-run** (chỉ báo cáo). `--apply` mới ghi.
- Ghi: Payload `update` sites, `overrideAccess`, `depth:0`, `data.paymentConfig = { ...livePaymentConfig, enableCod: true }` (giữ field anh em: QR code, bank…), mỗi site 1 transaction, đọc lại sau ghi để xác nhận.
- Report: `report.json` + `summary.md` trong `--out` (mặc định `.migration/delta-runs/site-cod-<timestamp>/`, cùng rule `OUT_NOT_PRIVATE` như delta): storeId, tenantId, siteId, slug, decision, before, after.
- Idempotent: chạy lại → 0 ứng viên.
- Exit code ≠ 0 nếu có site ghi lỗi.

Non-functional
- Không đụng `pw1_delta_map` / `migration_entity_map` (chỉ đọc) → không đổi hành vi delta lần sau (site đã dựng web vẫn báo `SITE_WEBSITE_GENERATED` như cũ).
- Giữ advisory lock của delta → không chạy song song với delta. Lock **không** chặn `migrate:pw1:website` → runbook bắt buộc chạy sau khi bước dựng web xong hẳn.
- DB chưa từng chạy delta (không có bảng `pw1_delta_map`) không được lỗi: kiểm tra `to_regclass('pw1_delta_map')` (theo `search_path`, cùng cách tìm bảng với query), không có thì chỉ dùng import projection. Không có `pw1_migration_stores` → 0 ứng viên.
- Mỗi file < 200 dòng.
- Env: chỉ `DATABASE_URI` (+ env Payload mà delta đã dùng: `PAYLOAD_SECRET`).

## Architecture
```
scripts/pw1-site-cod-repair.ts  (CLI: args, lock, out dir, print table)
  └─ src/lib/migration/pw1-delta/site-cod-repair.ts
       ├─ findCodRepairCandidates(pool, stores?) → SQL join pw1_migration_stores + tenants + sites
       │      + projection (pw1_delta_map ∪ migration_entity_map)
       ├─ classifyCodRepair(row) → PATCH | SKIP_PW2_EDITED | SKIP_NO_PROJECTION   (pure)
       └─ applyCodRepair(runtime, rows) → per-site transaction: findByID → update → findByID verify
```
`sourceInstance` lấy từ `importedSnapshot(pool)` (`ledger-lookup.ts:39`). Parser `--store` của delta nằm inline trong `parseDeltaOptions` (`delta-options.ts:79`, không export) → tách id cùng cách (`split(',')`, `trim`, bỏ rỗng) và thêm kiểm tra `^[1-9]\d*$` (id sai → lỗi, không bỏ qua im lặng).
Projection: lấy `pw1_delta_map` (source_entity `sites`, source_id = storeId) trước, không có thì `migration_entity_map` (`source_system='pw1'`, đúng `source_instance_id`, `claim_active`, `action='CREATE'`). Local đã thấy cần fallback này: 3 site đã dựng web (store 2920-2922) không có import projection nhưng có delta projection.

## Related code files
Create
- `src/lib/migration/pw1-delta/site-cod-repair.ts`
- `scripts/pw1-site-cod-repair.ts`
- `src/__tests__/unit/migration/pw1-delta-site-cod-repair.test.ts` (pure)
- `src/__tests__/integration/pw1-delta-site-cod-repair-db.test.ts` (PostgreSQL thật qua `DATABASE_URI`, bảng TEMP + rollback như `category-delete-breadcrumbs.test.ts`; không cần biến env riêng)
Modify
- `package.json` — script `migrate:pw1:site-cod` (cùng node flags + preload như `migrate:pw1:delta`)
- `docs/qa/F42-pw1-master-json-export.md` — TC-F42-DELTA-12 (AUTO unit), TC-F42-DELTA-13 (AUTO integration), cập nhật DELTA-11
- `docs/migration/pw1-stale-expired-rollout-runbook.md` — đã tạo, hoàn thiện output thật sau khi code xong
- `phase-03-dev-rollout-runbook.md` Step 4 → trỏ sang lệnh mới
Delete: không.

## Implementation steps
1. `site-cod-repair.ts`: type `CodRepairRow`; `classifyCodRepair` (pure); SQL candidate query (parameterized, `= ANY($n)` cho store filter); `applyCodRepair` dùng `runtime.transaction` + `runtime.payload.update` với `req`.
2. CLI: parse `--store` | `--all` (bắt buộc đúng 1), `--apply`, `--out`, `--help`; `readOnlyPool` cho dry-run, `createDeltaRuntime` chỉ khi `--apply`; lock → candidates → classify → (apply) → report → print bảng (PATCH/SKIP count) + đường dẫn report.
3. `package.json` script.
4. Unit test TC-F42-DELTA-12 (`classifyCodRepair` + build patch, import từ source): projection false + live false → PATCH; projection true + live false → SKIP_PW2_EDITED; không projection → SKIP_NO_PROJECTION; delta projection ưu tiên hơn import projection; patch data giữ field anh em (`merchantQrCode`, bank) và chỉ đổi `enableCod`; parse scope (`--store`/`--all` bắt buộc 1 trong 2, id sai → lỗi).
4b. Integration test TC-F42-DELTA-13 (DB thật, tự tạo DB tạm): seed tối thiểu `pw1_migration_stores`/`tenants`/`sites`/`migration_entity_map`(+/- `pw1_delta_map`) → query chọn đúng ứng viên (lọc `completed`, tenant active, `payment_cod`, site false, đúng `source_instance_id`, lọc `--store`); fallback delta → import; DB không có `pw1_delta_map`; `--apply` ghi đúng 1 field, field anh em không đổi, chạy lại → 0.
5. Rehearsal local (DB local, được phép ghi). Thực tế local: 78 site `completed` đều `active cod=true site=true` và import projection `enableCod=true` (75) hoặc chỉ có delta projection `true` (3) → không có sẵn trường hợp cần bật; chỉ đổi live sẽ ra `SKIP_PW2_EDITED`. Cách dựng:
   - Sao lưu (`COPY ... TO` file trong scratchpad): `sites.payment_config_enable_cod`, `migration_entity_map.detail` của các site chọn.
   - Site A (đường PATCH): live `enableCod=false` + import projection `paymentConfig.enableCod=false` (jsonb_set).
   - Site B (đường SKIP_PW2_EDITED): chỉ live `enableCod=false`, projection giữ `true`.
   - Site C (store 2920-2922, delta projection): live false + delta projection false → PATCH qua fallback delta.
   - Chạy: thiếu scope → `SCOPE_REQUIRED`; `--store A,B,C` dry-run → A,C PATCH, B SKIP; `--apply` → A,C true, field anh em không đổi, B giữ false; chạy lại → A,C không còn, B vẫn SKIP.
   - Khôi phục từ bản sao lưu, kiểm tra lại đúng giá trị cũ.
6. `npm run typecheck`, `npx vitest run src/__tests__/unit/migration`, lint.
7. Cập nhật runbook với output thật; QA doc; commit vào PR #2182 (sau khi user review diff).

## Todo
- [x] site-cod-repair.ts (query + classify + apply)
- [x] CLI + package.json (+ `createRunDir` tách sang `pw1-delta/run-dir.ts`, delta CLI dùng chung — chuyển nguyên văn, không đổi hành vi)
- [x] unit test TC-F42-DELTA-12
- [x] integration test TC-F42-DELTA-13
- [x] local rehearsal (PATCH import + delta projection, SKIP_PW2_EDITED, SCOPE_REQUIRED, idempotent, restore)
- [x] typecheck + migration tests + lint
- [x] runbook + QA doc + phase-03 Step 4
- [ ] user review → commit vào #2182

## Success criteria
- Dev sau delta: dry-run liệt kê ~51 PATCH (57 store đã dựng web trừ 6 store active lúc import: 1456, 1730, 1827, 1857, 1871, 1873 — site vẫn true), 0 `SKIP_*` không giải thích được; store khác trong `--store` có lý do `Not selected`.
- `--apply`: tất cả PATCH → `enableCod=true`, field anh em không đổi; chạy lại → 0.
- Checkout store mẫu (vd 1329) hiện COD (sau ≤5 phút cache).
- Delta chạy lại sau đó không có thay đổi hành vi (vẫn `SITE_WEBSITE_GENERATED`, không conflict mới).

## Risk assessment
- Ghi đè chỉnh sửa PW2 → guard projection = live; mặc định dry-run.
- Sửa nhầm store ngoài rollout → bắt buộc `--store` hoặc `--all`.
- Chạy chồng lên `migrate:pw1:website` (không chung lock) → runbook: chỉ chạy sau khi bước dựng web xong.
- Bật COD cho store mà PW1 tắt COD → điều kiện 3 dùng `tenant.payment_cod` (delta ghi từ nguồn), không bật mù.
- Store tenant vẫn suspended (vd 1327) → điều kiện 2 loại ra.
- Cache storefront 5 phút → runbook ghi rõ chờ trước khi verify.
- Rollback: report có `before`; đặt lại `enableCod=false` qua Payload admin cho các site trong report (hiếm dùng; không làm lệnh revert — YAGNI).

## Security
- Chỉ ghi qua Payload local API (hooks + validate chạy), `overrideAccess` vì CLI không có user — giống delta.
- Query parameterized; không log secret; out dir private dưới `.migration/` (gitignored).
- Không cần credential tài khoản admin (khác với cách PATCH qua HTTP API trước đây).

## Review (code-reviewer 2026-11-02)
Không có critical/high. Đã xử lý: M2 báo lý do store không được chọn; L1 `FOR UPDATE`; L3 fixture test tách biệt; M1/L2 ghi trong help + runbook (`--all` gồm cả store merchant tự bật COD; không cập nhật ledger → website `--rerun` sau này có thể làm delta báo `PW2_EDITED_CONFLICT`).

## Next steps
Phase 03 rollout dev dùng lệnh này ở Step 4; prod dùng y hệt sau khi dev sign-off.
