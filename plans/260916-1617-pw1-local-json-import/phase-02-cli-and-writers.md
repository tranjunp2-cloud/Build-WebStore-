# Phase 02 — CLI, ledger và writer

- Status: in_progress
- Priority: P1
- Budget: 4h; phụ thuộc G1 hoặc phần contract độc lập đã đóng.

## Mục tiêu

Một đường thực thi local tuần tự, cùng core có thể được gọi bởi worker tương lai. Không viết API route/Vercel job trong phase này.

## Công việc

### Giờ2: adapter hạ tầng và CLI

- [x] Tạo entrypoint và script npm, parse selectors theo technical-contract; từ chối option lạ/conflicting, không nhận secret từ CLI.
- [x] Reader kiểm tra bytes/hash/version/schema/duplicate JSON keys, field allowlist, ref/ownership và safe numeric types. Hash và parse cùng bytes.
- [x] Port có chọn lọc transaction/lease/claim/context/security/credential primitives. Kiểm tra req transactionID tới mọi nested write; không fire-and-forget DB mutation.
- [x] Guard legacy rollback khi có JSON batches/consumers, không chỉ reject JSON run IDs; kiểm chứng trên clone.
- [x] DDL idempotent qua `scripts/db-setup.js`; schema assertions cho ledger/version/constraints. Giữ legacy run/source claims; xử lý profile fingerprint nullable/required có nghĩa, không dummy hashes.
- [x] Dry-run chỉ đọc DB/input và xuất proposal JSON lines; không gọi schema push, tạo run/lease/ledger hay business row. Schema setup là lệnh riêng.

### Giờ3: preflight, resume và foundation

- [x] Persist batch JSON và toàn bộ child run IDs trong DB; public RUN_ID là json:<batch-uuid>, không child UUID; validate strict flag matrix và resume qua ranh giới Store.
- [x] Bind run với sourceInstance, snapshot/master/sidecar/mapping, writer/schema, target fingerprint và sorted selectors. Persist selected Store list.
- [x] Preflight đủ selected scope trước apply; claim/recheck baseline trong transaction để chống race sau preflight.
- [x] Ghi business entity + source mapping + operation result/checkpoint cùng transaction. REUSE giữ owner run cũ, ghi dependency consumer; không chuyển quyền rollback.
- [x] Implement retry SQLSTATE và reconcile unknown commit; lease/fence kiểm tra trước finalization. Resume validate binding và target evidence của entity đã hoàn tất.
- [x] Foundation Tenant/User/Site: whitelist, private migration capability; resolve cycles bằng staged optional refs có ledger. Required cycles không hợp lệ thì block. Không activate existing/new user hoặc Site.
- [x] Credential sidecar binding, Laravel MAC/decrypt, optional current-hash verify, Payload auth hash/salt và PW2 SSO encryption. Existing credential untouched; missing/mismatch disposition rõ.

### Giờ4–5: business writers và verifier

- [x] Media metadata adapter externalURL/filenameNULL/sourceUrl; explicit validator/ownership vì bypass access/hooks. Không giả filename/upload.
- [x] Categories topological order, Customers canonical snapshot, Products variants/media/categories; giữ IDs con hoặc generate/persist stable identity theo contract.
- [x] Discounts/Orders: preserve mapped units, integer quantity, FK và aggregates; guards ngăn auto-link/customer-update/payment rewrite/email/provider/stock/usage.
- [x] Blog categories/Blogs resolve Lexical upload refs; templates/subscriptions/usages theo matrix, không renew/upsert SSO hoặc fallback free.
- [x] Verifier read-back canonical projection, child identity, relationships/ownership, money/timestamp, counts/dispositions, dependency completeness. Paginate đầy đủ.
- [x] Local report masked counts/codes/run ID, exit status và next safe command. Output lỗi sau commit được tái dựng từ ledger.

## File/action map

Các tên file mới là đề xuất; dùng module sẵn có tương đương nếu port chứng minh giữ contract.

| Absolute path | Action | Nội dung |
|---|---|---|
| `/home/liam/data/ech-prime-web-v2/package.json` | Modify | `migrate:pw1:import` và `migrate:pw1:prepare`, runner TS tương thích repo |
| `/home/liam/data/ech-prime-web-v2/scripts/prepare-pw1-import.ts` | Create | Đóng gói credential encrypted sidecar và manifest từ nguồn private; không operator hand-encryption |
| `/home/liam/data/ech-prime-web-v2/scripts/migrate-pw1-import.ts` | Create | Thin CLI, cleanup kết nối/SIGINT, masked errors |
| `/home/liam/data/ech-prime-web-v2/src/lib/migration/pw1-json/contract.ts` | Create | Artifact/selector/disposition validation |
| `/home/liam/data/ech-prime-web-v2/src/lib/migration/pw1-json/preflight.ts` | Create | Baseline, conflicts, source namespace adapter |
| `/home/liam/data/ech-prime-web-v2/src/lib/migration/pw1-json/runner.ts` | Create | Sequential scheduling, state/retry/resume |
| `/home/liam/data/ech-prime-web-v2/src/lib/migration/pw1-json/writers/` | Create | Explicit collection writers, no generic raw spread |
| `/home/liam/data/ech-prime-web-v2/src/lib/migration/pw1-json/verify.ts` | Create | Projection/relationship/coverage validation |
| `/home/liam/data/ech-prime-web-v2/src/lib/migration/pw1-pw2/` | Selective port | Shared transaction/lease/context/credential/security; retain legacy semantics |
| `/home/liam/data/ech-prime-web-v2/scripts/pw1-migration-schema.js` | Port/adapt | Legacy-compatible ledger schema/profile bindings |
| `/home/liam/data/ech-prime-web-v2/scripts/db-setup.js` | Modify | Wire idempotent DDL/assertions, no DROP TABLE |
| `/home/liam/data/ech-prime-web-v2/src/payload.config.ts` | Inspect/minimal modify | Importer disables auto schema push before initialization |
| `/home/liam/data/ech-prime-web-v2/src/collections/Products.ts` | Modify guards only as needed | Preserve slug/history, suppress external effects, retain integrity |
| `/home/liam/data/ech-prime-web-v2/src/collections/Orders.ts` | Modify guards only as needed | Suppress ORDER_NEW and historical replay |
| `/home/liam/data/ech-prime-web-v2/src/collections/orders-hooks/` | Modify targeted guards | auto-link/customer snapshot/payment normalization |
| `/home/liam/data/ech-prime-web-v2/src/collections/{Tenants,Users,Sites,Customers,Categories,Discounts,Media}.ts` | Inspect/targeted modify | Port necessary migration handling only; no unrelated schema redesign |
| `/home/liam/data/ech-prime-web-v2/.env.staging.example` | Modify if new env introduced | Placeholder docs; no Vercel execution implied |
| `/home/liam/data/ech-prime-web-v2/.env.production.example` | Modify if new env introduced | Same env declarations, no secrets |

If adding collection fields, matching SQL in db-setup required; arrays need varchar id/_uuid plus _order/_parent_id. Do not silently add public migration bypass fields. Existing changes in db-setup/docker are not owned by this task.

## Gate G2

No required selected writer silently skipped; duplicate run/claim blocked; read-back fidelity passes smoke import on isolated clone. Any missing writer/nonempty collection is explicit BLOCKED. Freeze code before three-hour rehearsal; do not spend verification budget adding optional UPDATE/parallelism/report UI.

## Optional UPDATE exception

Outside baseline four-hour budget. Only exact allowed fields: persist minimal protected before-image, compare expected baseline and lock row, update+audit atomic, verify post-image. Mixed arrays, password and broad source-wins remain blocked. No general rollback command promised; rehearsal recovery is restore isolated clone, not delete legacy rows.

## Cập nhật implementation

Core đã triển khai và chạy synthetic trên clone. Batch/resume ở ranh giới Store và post-commit ACK simulation đã có evidence; TCP disconnect thật chưa kiểm chứng. Không có UPDATE tổng quát.

## Cập nhật thực thi 2026-09-17

[Regression cuối](reports/260917-v2-regression-and-clone-evidence.md): 81 tests/8 files, typecheck và synthetic clone 2 Stores/18 entities PASS sau strict evidence/alias fixes (sau đó focused19/19 và typecheck PASS, gồm 1 path-guard case mới; tổng82 distinct tests qua các lượt, không phải full82 rerun). Không thay nghiệm thu nguồn thật. [Real prepare PASS; dry-run205 BLOCKED](reports/260917-v2-real-artifact-preflight.md): 226485 occurrences selected/global, 3 blocker codes, 0 PW1PROD runs. G5 real actor/credentials BLOCKED; G6 actual apply NOT_RUN. Checkbox mở giữ các phần nghiệm thu/fault case chưa chứng minh.
