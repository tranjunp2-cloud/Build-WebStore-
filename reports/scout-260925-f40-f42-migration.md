# Scout Report — F40 Migration Reconciliation & F42 PW1 Tooling

> Ngày scout: 2026-09-25
> Phạm vi: nhánh `staging` (worktree-3), `feat/F42-07-pw1-local-json-import` (main repo), `feat/pw1-master-json-exporter` (worktree-2), comment handoff PR #1807.

---

## 1. Tóm tắt điều hành (TL;DR)

- **F40** trên staging gồm 2 phân hệ: QA Control Center (`/studio/qa`, US-F40-00→08 — đã implement khá đầy đủ) và **Migration Reconciliation Studio** (`/studio/qa/migration-diff`, US-F40-09→14).
- Phân hệ Migration hiện là **UI shell + PW1 read-only connector + evidence contracts** — trung thực (hiển thị "Chưa xác minh" thay vì giả xanh), nhưng **chưa đối soát PW2 thật**.
- Nguyên nhân: đang **chờ artifact bàn giao** theo comment của QA Lead Ary trên PR #1807 (crosswalk, manifest, nguồn đọc PW1/PW2, field rules, security allow-list).
- Phía sản xuất artifact chính là **F42**, đang có 2 PR OPEN:
  - **PR #1896** (`feat/pw1-master-json-exporter`, worktree-2): exporter PW1 CSV → master JSON bundle.
  - **PR #1894** (`feat/F42-07-pw1-local-json-import`, main repo): importer master JSON → PW2 có resume.
- Khi 2 PR này merge, F40 chỉ cần **adapter** đọc artifact → plug vào 2 seam `registerMigrationEvidenceProvider()` / `registerMigrationRenderEvidenceProvider()`.

---

## 2. Trạng thái các nhánh đã scout

| Checkout | Branch | So với origin/staging | Working tree | PR |
|---|---|---|---|---|
| `worktrees/ech-prime-web-v2-worktree-3` | `staging` | 0 divergence | clean | — |
| `data/ech-prime-web-v2` | `feat/F42-07-pw1-local-json-import` | +203 files / +17.2k dòng | dirty (docker-compose, docs, runtime tweaks) | **#1894 OPEN** |
| `data/worktrees/ech-prime-web-v2-worktree-2` | `feat/pw1-master-json-exporter` | +149 files / +25.2k dòng | dirty (artifact-schemas, validate-artifact…) | **#1896 OPEN** |

---

## 3. F40 — QA Control Center (phân hệ 1, US-F40-00→08)

Workspace QA nội bộ cho super-admin tại `/studio/qa`. Đã implement trên staging:

- **8 collections:** `qa_test_runs`, `qa_test_results`, `qa_change_snapshots`, `qa_findings`, `qa_fixture_leases`, `qa_github_issues`, `qa_github_issue_mapping_events`, `qa_smoke_dispatches`.
- **~20 API routes** `/api/admin/qa/*` + `/api/internal/qa/targeted-dispatch`.
- **Ingest contract** (`src/lib/admin/qa/contracts.ts`): `POST /api/admin/qa/ingest` nhận signed summary (HMAC SHA-256 `QA_INGEST_SECRET`, window 5 phút, cap 1MB), idempotent, artifact chỉ là URL HTTPS hết hạn ≤7 ngày trên host allowlist — không lưu raw log/PII/credential.
- **UI:** `/studio/qa` (Project Health, QA Inbox, Manual Run, System Runs, Test Case Directory), `/studio/qa/visual-review`.
- **Cron:** `/api/cron/reconcile-qa-targeted-smoke` mỗi 10 phút (`Bearer CRON_SECRET`).
- **Tests:** ~25 unit + ~13 API test files + 4 E2E specs; chỉ TC-F40-13-07/08 còn `MANUAL`.

**Nguyên tắc cứng:** chỉ chạy trên QC/staging, không Run-All, không command tùy ý, GitHub ticket luôn cần tester xác nhận, `Unknown` không bao giờ hiển thị `Healthy`.

---

## 4. F40 — Migration Reconciliation Studio (phân hệ 2, US-F40-09→14) — CHECK CHI TIẾT

### 4.1. Mục đích

Đối soát **2.000 website** migrate PW1 (Laravel/MySQL) → PW2 (Next.js/Payload/Postgres) trước khi trỏ domain (cutover). Phát hiện: mất variant/SKU/giá, ảnh/link hỏng, RichText biến dạng (HTML→Lexical), thiếu trang/sai layout — qua 6 lớp: Dashboard → Block tree → Swipe slider → Mobile 375px → Live iframe → Field-by-field DB diff. Gate nghiệm thu: parity ≥99% + 0 lỗi P0 → "Duyệt QC Pass".

### 4.2. Bản đồ code

| Thành phần | Vị trí |
|---|---|
| Route | `/studio/migration` → redirect `/studio/qa/migration-diff` (requireSuperAdmin) |
| UI chính | `src/app/studio/qa/migration-diff/MigrationDiffClient.tsx` (3.471 dòng) + `BlockMigrationEvidence.tsx`, `ReconciliationInspector.tsx` |
| API | `GET/POST /api/qa/migration-diff`, `GET /api/qa/migration-reconciliation`, `GET /api/qa/migration-render-evidence`, `POST .../live-check`, `GET /api/qa/template-preview/[code]` |
| Engine | `src/lib/admin/qa/migration-diff-engine.ts` (2.351 dòng) |
| PW1 connector | `src/lib/admin/qa/pw1-mysql-connector.ts` (1.933 dòng, read-only, chặn non-SELECT, dùng `PW1_DATABASE_URL`) |
| Contracts | `migration-reconciliation.ts` (F40-14), `migration-render-evidence.ts` (F40-13) |

### 4.3. Input thực tế

```
NGUỒN THẬT            INPUT NGƯỜI DÙNG          FALLBACK/STUB                CÒN THIẾU
─────────────────     ───────────────────────   ──────────────────────────   ───────────────────────────
PW1 MySQL             filter/search/template    catalog mock 2000 store      PW2 Postgres/Payload
(PW1_DATABASE_URL)    store_id/page_id          demo fixtures (demo=1)       mapping registry PW1→PW2
                      actions (stub)            SITE-0001 ui_demo fixture    QC-pass persistence
                      demo/ui_demo flags        heuristic block map          live-check runner
```

### 4.4. Đánh giá: cái gì thật, cái gì chưa

**✅ Thật / đúng thiết kế**

- UI đầy đủ 6 lớp đối soát; auth `withSuperAdmin` mọi route; `maxDuration=60`.
- PW1 connector đọc MySQL thật: stores, products, skus, banners, categories, posts, menus, pages, components.
- Evidence boundary đã harden: connector **không fabricate PW2** — live records trả `migratedValue: null`, `status: warning`, lý do "PW2 chưa được đọc từ nguồn dữ liệu đã xác minh"; UI hiển thị badge `pw1_snapshot_unverified` → "PW2 chưa đọc được".
- F40-13/14 là honest shell: `evidenceProvider = null` → mọi snapshot `unverified`; `live-check` trả `LIVE_CHECK_RUNNER_UNAVAILABLE`; sanitize loại field nhạy cảm trước khi serialize.

**⚠️ Stub / simulated — chưa đạt claim PRD §10**

| # | Vấn đề | Chi tiết |
|---|---|---|
| 1 | Không đối soát PW2 thật | Không có env/connector/query nào đọc Postgres PW2; "Soi CSDL 1-to-1" live mode = PW1 inventory + cột PW2 trống |
| 2 | `approve_pass` là stub | Trả success nhưng không persist → nút "Duyệt QC Pass" (cutover gate) chưa có backend |
| 3 | `scan_batch` / `ingest_json` giả | Trả canned `scannedCount: 2000`; `ingest_json` chỉ echo `entityCount`, không parse/diff/persist |
| 4 | Fallback mock âm thầm | MySQL down → `generateReconciliationCatalog(2000)` giả; list response **không có source flag** → QA có thể đọc metric giả |
| 5 | Metric tự chế | `existsInPW2: true` hardcode, `missingPagesCount: 0`, `reconciliationAudit` ghi "100% Match" cho search/cart, score heuristic 98.5 |
| 6 | `groupStats` tự mâu thuẫn | Records đều `warning` nhưng groupStats báo `pass` |

**📋 KPI PRD §10.2 vs thực tế**

| KPI | Trạng thái |
|---|---|
| Field match 1-to-1 ≥99% | Chưa đo được — chưa có nguồn PW2 |
| Phát hiện P0 tự động 100% | Chỉ phát hiện block tương thích, không phát hiện data loss thật |
| Duyệt QC Pass → cutover certified | Stub, không persist |

---

## 5. Comment handoff PR #1807 (điều kiện tiên quyết)

**Comment:** https://github.com/primeproduction/ech-prime-web-v2/pull/1807#issuecomment-5674593370
**Tác giả:** `aryhibye` (QA Lead Ary) — 2026-09-15, trên PR #1807 `docs(f42): research pw1-to-pw2 tenant mapping and sample json` (**vẫn OPEN**).

**Nội dung:** tài liệu trong PR đủ làm *quy tắc mapping field* nhưng chưa chứng minh record PW2 đã ghi. Yêu cầu team Dev/Migration bàn giao 5 artifact:

| # | Artifact | Nội dung tối thiểu |
|---|---|---|
| 1 | Crosswalk PW1→PW2 | `source_db/table/id`, `pw1_store_id`, `tenant_id`, `site_id`, `target_collection`, `target_id`, `migration_run_id`, `status`, `mapped_at`, `mapping_version`, `reason/error_code` |
| 2 | Manifest migration run | Run ID, scope, importer/mapping version, counts PW1/PW2, migrated/skipped/quarantined/failed |
| 3 | JSON hoặc API read-only | Trả crosswalk + records theo Store/Site/Run, phân trang, Super Admin auth |
| 4 | Rule so sánh field | `source_key`, `target_key`, comparison rule, null/gap/lossy, version |
| 5 | Security allow-list | Field nào full/masking/never-return |

Điều kiện cứng: JSON chỉ hợp lệ nếu là **output migration run thực tế** có `targetId` PW2 thật — fixture/`_ref`/`targetPath` dự kiến không tính.

Riêng **F40-13**: cần `block_crosswalk` (PW1 `legacy_id` → PW2 block ID) + component registry + live-render evidence. Riêng **F40-14**: backfill history Product/Order/Discount/Customer/Settings + chốt rule currency/tax/shipping/dedupe.

---

## 6. F42 — phía sản xuất artifact

### 6.1. PR #1896 — `feat/pw1-master-json-exporter` (worktree-2)

**US-F42-08: "hoàn thiện exporter CSV PW1 thành master JSON"** — module `src/lib/migration/pw1-export/` (39 file, +25.2k dòng). Không ghi DB.

**Artifact bundle:**

| File | Vai trò |
|---|---|
| `master-manifest.json` | `exporterVersion`, `sourceSnapshot` (instance/db/snapshotId/asOf), sha256 mọi file, `counts` (source/selected/emitted/blocked), `status`, `importReady: false`, `coverage.accounted: true` |
| `master-0001.json…` | Master data tách part (≤300 store, <200MB/file) |
| `record-tracking.csv` | Disposition từng record: `mapped`/`partial`/`retained-source`/`excluded`/`unresolved` + targetPath + rules — không chứa source values/credentials |
| `customer-reconciliation.json`, `product-reconciliation.json` | Crosswalk sidecar: `sourceSkuId → targetId/targetPath/selectedTuple`; `sourceCustomerId → target` |
| `store-summary`, `mapping-report`, `conflict-details`, `export-review`, `user-actors.json` | Review/diagnostic/identity evidence |

Kèm modules phía PW2: `pw2-product-migration.mjs` (519 dòng), `pw2-product-eav.mjs`, `pw2-commerce-reconciliation.mjs`, `pw2-customer-reconciliation.mjs`.
Validate: `npm run migrate:pw1:export -- --validate-only --artifact-dir <dir>`.

### 6.2. PR #1894 — `feat/F42-07-pw1-local-json-import` (main repo)

**US-F42-07: "import master JSON PW1 có resume"** — module `src/lib/migration/pw1-json/` (44 file, +17.2k dòng).

- **CLI:** `npm run migrate:pw1:import -- --config local.json (--all | --store ID | --stores a,b | --from-store --to-store) [--dry-run] [--confirm-target profile@host/db/role]`
- **Resume:** `--run /runs/RUN_ID --continue`; `--export-only` chỉ ghi destination.
- Modules: `runner`, `workflow`, `writer`, `reconciliation`, `receipt-schemas`, `ledger`, `run-logger`, `projection`, `destination-map`, `user-runner`, `credentials`, `lease-heartbeat`, các `*-proof`.

---

## 7. Đối chiếu checklist Ary ↔ F42 thực tế

| # | Ary yêu cầu | F42 đáp ứng | Ghi chú |
|---|---|---|---|
| 1 | Crosswalk có `target_id` PW2 thật | ✅ | `reconciliation-receipts.ts` — SKU + customer crosswalk; nhưng targetId chỉ có sau khi **importer** chạy |
| 2 | Manifest run | ✅ | `master-manifest.json` giàu hơn yêu cầu (sha256, snapshot, blockedStores) |
| 3 | JSON read-only | ✅ | Artifact bundle — đúng hướng cắm F40 không làm lại UI |
| 4 | Rule so sánh field | ✅ | `mapping-report` + field dispositions + `source-classification-v1` |
| 5 | Security allow-list | ✅ | `security-excluded`, `source-identity`, `technical-user-excluded` |
| — | `block_crosswalk` cho F40-13 | ⚠️ | Chưa thấy trong exporter — crosswalk hiện chỉ cover Product SKU + Customer |

**Schema mismatch:** field name khác format Ary đề xuất (`snapshotId`/`exporterVersion`/`record-tracking.csv` thay vì `migrationRun.id`/`pw1StoreId`/`crosswalk[]`) → cần adapter dịch, đúng vai trò seam provider trong F40.

---

## 8. Bức tranh tổng & việc còn lại

```
PR #1896 (exporter)              PR #1894 (importer)              F40 Inspector (/studio/qa/migration-diff)
PW1 CSV/MySQL → master JSON  →   master JSON → PW2 Postgres   →   cần ADAPTER đọc artifact
  + manifest + crosswalk           + ledger + resume + receipts     → fill cột PW2 bằng evidence thật
  + record-tracking                                                → plug vào 2 register*Provider() seams
```

**Việc còn lại để F40 phân hệ 2 thành đối soát thật:**

1. Merge PR #1894 + #1896 (cả hai đang OPEN, chưa review xong).
2. Viết **adapter F40**: đọc artifact bundle (manifest + crosswalk sidecars + record-tracking) → implement `MigrationEvidenceProvider` (F40-14) và `MigrationRenderEvidenceProvider` (F40-13), map schema sang contract hiện có.
3. Bổ sung **`block_crosswalk`** (PW1 `legacy_id` → PW2 block ID) cho F40-13 — chưa có trong exporter.
4. Implement **live-check runner** thật cho `live-render` evidence (hiện `LIVE_CHECK_RUNNER_UNAVAILABLE`).
5. Làm `approve_pass` / `scan_batch` persist thật nếu muốn dùng làm cutover gate.
6. Sửa những chỗ tự mâu thuẫn trong connector: `groupStats`, `reconciliationAudit` "100% Match", `existsInPW2` hardcode, fallback mock không gắn cờ `source`.
7. Doc drift nhỏ: PRD §10.4 vẫn ghi US-F40-13 = "1-Click Ticket Export (Deprecated)" trong khi stories/code dùng US-F40-13 = "PW2 Render Evidence" (đã merged PR #1843); PRD ghi route `/studio/migration` (thực tế redirect sang `/studio/qa/migration-diff` — hoạt động đúng).

---

*Generated from scout of branches `staging`, `feat/F42-07-pw1-local-json-import`, `feat/pw1-master-json-exporter`.*
