# F40 — QA Control Center

## US-F40-04: QA Inbox and Feature Health Detail

### [x] AUTO TC-F40-04-02 — Editor Product Grid variant evidence and retest

**Preconditions:** Staging has the isolated `QA-Tshirt-SML` fixture and a super-admin E2E account. The target is `editor-productgrid-variants`; its selected pack is `editor-product-grid-variants-smoke` only.

```gherkin
GIVEN a tester opens the Editor Product Grid using QA-Tshirt-SML
WHEN the Product Grid binds the fixture variants
THEN the visible variant list contains S, M and L exactly once
AND the terminal run records target editor-productgrid-variants, fixture QA-Tshirt-SML,
  expected count 3, actual count 3 and the approved safe evidence metadata
```

**Failure evidence contract:** a missing/duplicate variant records `VISUAL_THRESHOLD_EXCEEDED` only for an approved visual comparison whose measured difference is greater than its threshold; functional count mismatch uses `VARIANT_COUNT_MISMATCH`.

**Safety:** the pack is staging-only, uses the registered fixture lease, runs no arbitrary command and never creates a GitHub issue.

> Source: `docs/prd/F40-qa-control-center.md`, `docs/design/qa-control-center-ux.md`, and `docs/stories/F40-qa-control-center-stories.md`.

## US-F40-05 — GitHub Issue Sync and Confirmed Target Mapping

| TC-ID        | Type     | Priority | Scenario                                                                                                                             | Status   | Automated by                                                                          |
| ------------ | -------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------- |
| TC-F40-05-01 | Unit     | Critical | Normalize metadata only; classify only exact `P1` as P1.                                                                             | [x] AUTO | `src/__tests__/unit/qa/f40-github-issues.test.ts`                                     |
| TC-F40-05-02 | Unit     | High     | Upsert is idempotent and preserves mapping; concurrent create reconciles safely.                                                     | [x] AUTO | `src/__tests__/unit/qa/f40-github-issues.test.ts`                                     |
| TC-F40-05-03 | API      | Critical | Sync route rejects unauthorized callers and safely handles GitHub failures.                                                          | [x] AUTO | `src/__tests__/api/f40-github-issues.test.ts`                                         |
| TC-F40-05-04 | API      | Critical | Mapping validates input and records actor/time/history on confirmation.                                                              | [x] AUTO | `src/__tests__/api/f40-github-issues.test.ts`                                         |
| TC-F40-05-05 | Unit/E2E | Critical | Unknown mapping has no health effect; confirmed open P1 is Critical with a GitHub link; closed/remapped issue clears the old target. | [x] AUTO | `src/__tests__/unit/qa/f40-project-health.test.ts`, `tests/f40-github-issues.spec.ts` |

## US-F40-07 — Targeted Manual Runs and Run History

| TC-ID        | Type    | Priority | Scenario                                                                                                                          | Status   | Automated by                                                             |
| ------------ | ------- | -------- | --------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------ |
| TC-F40-07-01 | Unit    | Critical | A target/profile resolves only its approved allow-listed pack; an unsupported Regression returns a coverage-gap block.            | [x] AUTO | `src/__tests__/unit/qa/f40-manual-runs.test.ts`                          |
| TC-F40-07-02 | API     | Critical | Preflight and dispatch require super-admin, validate paired PR/SHA and cannot accept arbitrary execution input.                   | [x] AUTO | `src/__tests__/api/f40-manual-runs.test.ts`                              |
| TC-F40-07-03 | API     | Critical | One confirmation idempotency key produces one dispatch; fixture/profile capacity blocks safely.                                   | [x] AUTO | `src/__tests__/api/f40-manual-runs.test.ts`                              |
| TC-F40-07-04 | API     | Critical | Only a non-terminal dispatch can be cancelled; cancellation keeps a possibly running fixture lease until terminal reconciliation. | [x] AUTO | `src/__tests__/api/f40-manual-run-cancel.test.ts`                        |
| TC-F40-07-05 | API/E2E | High     | Seven-day run history filters target/profile/PR/SHA and presents only safe evidence availability.                                 | [x] AUTO | `src/__tests__/api/f40-qa-runs.test.ts`, `tests/f40-manual-runs.spec.ts` |

### US-F40-07 operational contract

- `GET /api/admin/qa/manual-runs/preflight` and `POST /api/admin/qa/manual-runs` accept one allow-listed `targetId` and `smoke` or `regression` profile only. Both require a super-admin session; a PR number and immutable SHA are optional as a pair, never independently. The server resolves the Staging (QC) context and pack metadata—clients cannot supply a command, test list, fixture, environment or pack version.
- A dispatch is confirmed by an idempotency key. Reusing it with the same request returns the original ledger entry; using it for a different request returns `409`. Only an approved pack with available fixture and profile capacity can reach GitHub Actions. There is intentionally no “Run All” endpoint or workflow input.
- `GET /api/admin/qa/runs` defaults to the prior seven days. It accepts `targetId`, `status`, `profile`, `packId`, `pullRequest`, `commitSha` and `testCaseId`, returning terminal summaries with a keyset cursor plus separately-labelled active summaries. It exposes evidence availability (`available`, `expiring`, `expired` or `unavailable`), never artifact URLs or evidence bodies.
- `POST /api/admin/qa/manual-runs/:id/cancel` accepts a bounded reason and only permits `queued`, `dispatched` or `cancel_requested` ledger entries. A queued run is released immediately; a dispatched run remains `cancel_requested` until GitHub or reconciliation determines its terminal state, so an in-use fixture is never prematurely reused.
- Vercel invokes `GET /api/cron/reconcile-qa-targeted-smoke` every ten minutes. It requires `Authorization: Bearer $CRON_SECRET` and conservatively blocks/release-expired ambiguous runs; it never retries or re-dispatches a workflow. `CRON_SECRET` is already required in both staging and production environment templates.

## US-F40-08 — Evidence-gated CMS coverage expansion

| TC-ID        | Type | Priority | Scenario                                                                                                                                                                  | Status   | Automated by                                                         |
| ------------ | ---- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------- |
| TC-F40-08-01 | Unit | Critical | The checked-in coverage matrix contains exactly one policy row for every active CMS target; only certified rows expose an executable profile.                             | [x] AUTO | `src/__tests__/unit/qa/f40-targeted-qa-coverage.test.ts`             |
| TC-F40-08-02 | Unit | Critical | A descriptive `automated` catalog label does not authorize a pack; registry/manual resolution remains empty until a matching certified contract exists.                   | [x] AUTO | `src/__tests__/unit/qa/f40-targeted-qa-coverage.test.ts`             |
| TC-F40-08-03 | Unit | Critical | Every certified unit/API/logic/Smoke contract has one exact GitHub Actions branch emitting matching target, runner, version, source test and TC IDs; an unknown pack has no default target. | [x] AUTO | `src/__tests__/unit/qa/f40-targeted-smoke-workflow-contract.test.ts` |
| TC-F40-08-04 | Unit | Critical | A manual preflight for an active target without a certified pack is blocked with `NO_ACTIVE_PACK`; it returns the matrix owner, recovery guidance and no allowed profile. | [x] AUTO | `src/__tests__/unit/qa/f40-manual-runs.test.ts`                      |
| TC-F40-08-05 | API  | Critical | The targeted fixture endpoint rejects unauthenticated, missing or malformed dispatch leases; only an active, matching unexpired lease may reach fixture provisioning.     | [x] AUTO | `src/__tests__/api/f40-targeted-smoke-fixture.test.ts`               |

**Phase-01 operating rule:** the matrix is the execution-authority source. A target without a QA-approved TC, real source test, resettable fixture, owner and staged proof remains visible as a coverage gap with recovery guidance; it never becomes runnable because of a descriptive catalog coverage label.

**Workflow evidence policy:** targeted workflows publish only signed terminal summaries and safe evidence metadata to the Control Center. Raw Playwright reports, traces and screenshots are not uploaded by this workflow.

### Batch-1 Orders admission status

`order-refund-cancel-retry` is an API-contract candidate only. Its proposed allow-list is `src/__tests__/api/orders-cancel.test.ts` scoped by the exact title-token pattern `\\[TC-F10-03-01\\]|\\[TC-F10-03-03\\]`; this intentionally excludes `TC-F10-03-01b`. It does not use a tenant fixture, customer data, Stripe/Xendit, a browser run, a glob, or a full-suite fallback.

Local pre-certification proof passed on 2026-08-18: the exact command selected
three assertions (one `TC-F10-03-01`, two `TC-F10-03-03`) and skipped the
other 35 tests in that file. This proves selector precision only; QA must
still record owner approval and a signed Staging proof for the exact PR/SHA
before this candidate is admitted into the execution registry/workflow. Until
then the target remains a coverage gap and cannot auto-dispatch.

## QC browser verification runbook

`tests/f40-github-issues.spec.ts` has a public authorization-boundary check and a stateful browser/API flow. Run the stateful flow only against the isolated QC database: the seed and reset commands refuse any environment other than `APP_ENV=qc-test` (or `NEXT_PUBLIC_APP_ENV=qc-test`) and reject known staging/production hosts.

1. Load the uncommitted QC environment and start the application against the same database. Set `BASE_URL` to that running application (defaults to `http://localhost:3000`).
2. Set a temporary, non-production `F40_E2E_ADMIN_PASSWORD` of at least 12 characters. Do not put it in a committed env file.
3. Seed the two reserved fixtures and export the emitted IDs for the Playwright process:

   ```bash
   set -a && . .env.qc-test && set +a
   export F40_E2E_ADMIN_PASSWORD='replace-with-a-temporary-qc-password'
   eval "$(npm run --silent db:seed-f40-github-issues | rg '^F40_')"
   BASE_URL=http://localhost:3000 npx playwright test --project=f40-github-issues
   npm run db:reset-f40-github-issues
   unset F40_E2E_ADMIN_PASSWORD F40_E2E_ADMIN_EMAIL F40_GITHUB_MAPPING_ISSUE_ID F40_GITHUB_MAPPING_ISSUE_NUMBER F40_GITHUB_MAPPING_TARGET_ID F40_GITHUB_CLEARED_ISSUE_ID F40_GITHUB_CLEARED_ISSUE_NUMBER F40_GITHUB_CLEARED_TARGET_ID F40_GITHUB_REMAPPED_TARGET_ID
   ```

The fixture never calls GitHub. It creates one `unknown` open `P1` issue and one already-confirmed open `P1` issue. The test proves: the unknown issue does not affect health; confirming it makes the selected target `Critical` with its GitHub link; remapping the second issue removes it from its old target; and dismissing the first issue removes its health effect. Reset deletes only the two reserved issue numbers and the explicitly marked `f40-e2e-admin@primeweb.local` account.

### CI/release follow-up

The stateful test intentionally skips when its fixture variables are absent. Before making it a required CI gate, provision the QC-only password, run the seed command before the `f40-github-issues` Playwright project, and always run reset in an `always()` cleanup step. Never run this fixture on staging or production.

## US-F40-06 — Finding Review and Manual GitHub Ticket Creation

| TC-ID        | Type | Priority | Scenario                                                                                                                     | Status   | Automated by                                 |
| ------------ | ---- | -------- | ---------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------- |
| TC-F40-06-01 | Unit | Critical | A failed product testcase creates one stable-fingerprint finding; repeat and concurrent deliveries update the same finding.  | [x] AUTO | `src/__tests__/unit/qa/f40-findings.test.ts` |
| TC-F40-06-02 | Unit | High     | An eligible same-target pack pass verifies a finding; a later matching failure reopens it with latest safe evidence.         | [x] AUTO | `src/__tests__/unit/qa/f40-findings.test.ts` |
| TC-F40-06-03 | API  | Critical | Finding reads/promotions require super-admin, validate strictly, and cancel never contacts GitHub.                           | [x] AUTO | `src/__tests__/api/f40-findings.test.ts`     |
| TC-F40-06-04 | API  | Critical | Confirming promotion creates/reconciles exactly one marked GitHub issue; remote failure retains the internal finding safely. | [x] AUTO | `src/__tests__/api/f40-findings.test.ts`     |
| TC-F40-06-05 | E2E  | Critical | QA reviews a finding, cancels without issue creation, then confirms one linked GitHub ticket.                                | [x] AUTO | `tests/f40-findings.spec.ts`                 |

## US-F40-11 — Deep Field-by-Field Database Diff Inspector

| TC-ID | Type | Priority | Scenario | Status | Automated by |
| --- | --- | --- | --- | --- | --- |
| TC-F40-11-07 | Unit | High | A record with `matchStatus = match` but an error/warning field remains visible when **Chỉ Lỗi** is enabled. | [x] AUTO | `src/__tests__/unit/qa/f40-field-diff-inspector.test.ts` |
| TC-F40-11-08 | Unit | High | A Product with multiple SKU rows produces one Product entity candidate while retaining a deterministic primary SKU. | [x] AUTO | `src/__tests__/unit/qa/f40-pw1-mysql-connector.test.ts` |
| TC-F40-11-09 | Unit | High | The field-inspector status separates a meaningful matching value from two empty values, and never marks stale/different values as a match. | [x] AUTO | `src/__tests__/unit/qa/f40-field-diff-inspector.test.ts` |
| TC-F40-11-10 | Unit | High | The UI demo fixture exposes all evidence states only for its explicit `SITE-0001` QA fixture; it is not a migration result. | [x] AUTO | `src/__tests__/unit/qa/f40-field-diff-inspector.test.ts` |
| TC-F40-11-E2E-03 | E2E | High | A super-admin opens the `SITE-0001` UI fixture, sees attention records by default, expands/collapses one record, and filters exact evidence states. | [x] AUTO | `tests/studio-migration-diff.spec.ts` |

## US-F40-12 — Visual Parity Inspector

| TC-ID | Type | Priority | Scenario | Status | Automated by |
| --- | --- | --- | --- | --- | --- |
| TC-F40-12-11 | Unit | High | **Highlight Diff Gaps** identifies P0/P1 PW2 visual gaps with an explanatory label and ignores matched blocks. | [x] AUTO | `src/__tests__/unit/qa/f40-visual-parity-inspector.test.ts` |

## US-F40-13 — PW2 Render Evidence

| TC-ID | Type | Priority | Scenario | Status | Automated by |
| --- | --- | --- | --- | --- | --- |
| TC-F40-13-01 | Unit | Critical | No approved mapping returns `unverified`; never infer PW2 data from preview. | [x] AUTO | `src/__tests__/unit/qa/f40-migration-render-evidence.test.ts` |
| TC-F40-13-02 | Unit | Critical | Overall pass requires migrated data, supported component and verified live render. | [x] AUTO | `src/__tests__/unit/qa/f40-migration-render-evidence.test.ts` |
| TC-F40-13-06 | Unit | Critical | Sensitive evidence field is removed before response serialization. | [x] AUTO | `src/__tests__/unit/qa/f40-migration-render-evidence.test.ts` |
| TC-F40-13-03 | API | Critical | Evidence and explicit live-check endpoints require Super Admin authentication. | [x] AUTO | `tests/studio-migration-diff.spec.ts` |
| TC-F40-13-04 | E2E | High | Demo mode is visibly labelled as non-production evidence. | [x] AUTO | `tests/studio-migration-diff.spec.ts` |
| TC-F40-13-05 | E2E | Critical | The inferred PW2 preview is replaced when data/component evidence is incomplete. | [x] AUTO | `tests/studio-migration-diff.spec.ts` |
| TC-F40-13-07 | Manual | Critical | Approved PW1→PW2 mapping identifies the actual PW2 layout block. | [ ] MANUAL | Team migration mapping handoff |
| TC-F40-13-08 | Manual | High | On-demand live check confirms or rejects the real PW2 block without exposing customer data. | [ ] MANUAL | Team live-check runner handoff |

## US-F40-14 — Commerce và Settings Migration Reconciliation

| TC-ID | Type | Priority | Scenario | Status | Automated by |
| --- | --- | --- | --- | --- | --- |
| TC-F40-14-01 | Unit | Critical | Khi chưa có mapping evidence, snapshot chỉ là `Chưa xác minh`; không được suy đoán bản ghi khớp từ SKU/email/order number; exception mở hoặc dữ liệu bị cắt cũng không được báo pass. | [x] AUTO | `src/__tests__/unit/qa/f40-migration-reconciliation.test.ts`, `src/__tests__/unit/qa/f40-f42-ledger-evidence-provider.test.ts` |
| TC-F40-14-02 | E2E | Critical | Super Admin mở Đối soát Commerce, bật dữ liệu mẫu và lọc theo Products. | [x] AUTO | `tests/studio-migration-diff.spec.ts` |
| TC-F40-14-03 | Unit/API | High | Adapter evidence versioned có thể được đăng ký mà không thay đổi contract UI; run và issue chỉ đọc được khi Super Admin chọn đúng ID store PW1 số và child run đã VERIFIED. | [x] AUTO | `src/__tests__/unit/qa/f40-migration-reconciliation.test.ts`, `src/__tests__/api/f40-migration-reconciliation-ledger-routes.test.ts` |
| TC-F40-14-04 | Manual | Critical | Staging có schema F42 và một child run VERIFIED: nhập đúng ID store PW1 → chọn run → kiểm tra mapping/issue; không dùng mã F40 `SITE-xxxx` làm crosswalk. | [ ] MANUAL | Migration owner cung cấp child run ID + source store ID |

## Website migration — live ledger and durable audit

**Standalone deployment:** bản F40 này không triển khai schema/exporter/importer F42. Thiếu website ledger bắt buộc trả `503 / F42_SOURCE_UNAVAILABLE`; UI báo nguồn chưa sẵn sàng, không công bố “0 website” hoặc tổng/kết quả giả. Thiếu field evidence không đồng nghĩa website không tồn tại. Contract đọc cục bộ ghim `field-evidence-v26` / `qc-fields-v1`; xem [điều kiện tích hợp](F40-field-evidence-integration.md). Chỉ được đạt tự động khi đủ 100% phạm vi bắt buộc và khớp 100%; QC thủ công không thay đổi kết quả tự động.

| TC-ID | Type | Priority | Scenario | Automation | Source |
|---|---|---|---|---|---|
| TC-F40-MIG-REPORT-01 | Unit | Critical | Automatic report prioritizes proven migration/current-audit/field failures, marks stale audit/QC for recheck, and keeps missing/partial evidence insufficient. Matching available fields or manual QC Pass never certify complete website acceptance. | [x] AUTO | `src/__tests__/unit/qa/migration-report-status.test.ts` |
| TC-F40-MIG-LIVE-01 | Unit | Critical | Compare source-bound content; missing fields are unverified; changed links/media and selected product order are visible. Ignore AI style decisions. | [x] AUTO | `src/__tests__/unit/qa/f40-website-migration.test.ts` |
| TC-F40-MIG-LIVE-08 | Unit/E2E | Critical | Field evidence v26: no synthetic/older-run fallback; missing evidence has no percentage; coverage includes unsupported/unverified; real browser opens field panel and filters rows; no raw private fields returned. | [x] AUTO | `src/__tests__/unit/qa/f40-website-migration.test.ts`, `tests/f40-website-migration.spec.ts` |
| TC-F40-MIG-LIVE-09 | E2E | Critical | Đánh giá QC opens an inline Pass/Failed dropdown in live comparison, not a review page. Escape closes only the menu and restores trigger focus. Quick verdict requests require admin, strict input, completed/committed evidence and current version; legacy detailed Pass still requires all five checks. Quick decisions do not certify detailed checks or automatic parity. This regression validates rejected requests only, without saving real QC verdicts. | [x] AUTO | `tests/f40-website-migration.spec.ts` |
| TC-F40-MIG-LIVE-10 | Unit/E2E | Critical | Automatic report separates manual QC, prioritizes proven failures, identifies stale/missing evidence and never invents whole-website Pass. Real browser selects every automatic card and validates filtered rows. Missing evidence shows 0% placeholder with explicit no-data reason; measured evidence uses source-derived rate. Progress colors: red <85, yellow ≥85 unless fully accepted, green only exactly100% and automatic passed, independent of QC Pass. Partial ratios never round to100%. No QC verdict saved. Counts scoped to current catalog, not full source inventory. | [x] AUTO | `src/__tests__/unit/qa/migration-report-status.test.ts`, `tests/f40-website-migration.spec.ts` |
| TC-F40-MIG-LIVE-02 | E2E | Critical | Unauthenticated callers cannot read migration evidence. Super-admin opens real catalog, selects a store and reads mapped page/block evidence. | [x] AUTO | `tests/f40-website-migration.spec.ts` |
| TC-F40-MIG-LIVE-11 | E2E | High | Inspector page tabs use the unique PW2 menu label matching exact mapped destination path; otherwise current CMS title/slug. Missing destination explicit. Read-only SQL validates API and browser labels, with no inference by navigation order or changed identity/URLs. | [x] AUTO | `tests/f40-website-migration.spec.ts` |
| TC-F40-MIG-LIVE-12 | Unit/E2E | Critical | Missing F42 schema returns safe HTTP503 F42_SOURCE_UNAVAILABLE; authenticated real browser displays actionable unavailable state, no false zero totals or synthetic report; refresh retains explicit unavailable state. Uses dedicated synthetic local DB with no F42 tables, never mutates shared DB. | [x] AUTO | `src/__tests__/unit/qa/f42-source-contract.test.ts`, `tests/f40-website-migration.spec.ts` |
| TC-F40-MIG-LIVE-13 | Unit/E2E | High | Readable block cards label expected F42 versus current PW2 truthfully; text differences, missing versus empty, ordered list items and image load failures are explicit. URL-only image differences never prove wrong image. All fields display inline in original order; each block has only one technical JSON disclosure retaining PW1 source content. Filtering preserves original block numbering. Header attention button switches live iframe to filtered block view and exposes active state; disabling restores all blocks. Generic long report/CSP banners are absent. Real authenticated browser opens comparison without saving QC or image checks. | [x] AUTO | `src/__tests__/unit/qa/f40-block-comparison.test.tsx`, `tests/f40-website-migration.spec.ts` |
| TC-F40-MIG-LIVE-14 | Unit | High | Selecting a non-home PW2 page retains its exact mapped URL and the unchanged PW1 homepage URL. Homepage limitation is hidden by default in the accessible comparison-information disclosure and readable when opened. QC menu and attention-filter transitions continue to work. | [x] AUTO | `src/__tests__/unit/qa/f40-block-comparison.test.tsx` |
| TC-F40-MIG-LIVE-15 | Unit | Critical | Literal text including null, exponent notation, long digits and quotes is preserved exactly. Missing list positions remain distinct from intentional empty values. Control-character image URLs cannot normalize into local network requests. Per-item nested text/link differences highlight only changed items and ignore migration metadata IDs. Regressions fail on the pre-fix component. | [x] AUTO | `src/__tests__/unit/qa/f40-block-comparison.test.tsx` |
| TC-F40-MIG-LIVE-03 | E2E | High | Empty search returns an empty catalog rather than demo data; malformed pagination is rejected. | [x] AUTO | `tests/f40-website-migration.spec.ts` |
| TC-F40-MIG-LIVE-04 | E2E | Critical | Tester saves a versioned manual QC verdict and note. Stale evidence rejects a write; stale reviews are unverified. QC Pass requires every declared website check. Non-admin cannot save reviews. | [x] AUTO | `tests/f40-website-migration.spec.ts` |
| TC-F40-MIG-LIVE-05 | Unit/E2E | High | Image fields resolve safe public media metadata and show source/destination thumbnails, alt and dimensions; slide indexes are retained, missing media is explicit, technical JSON remains expandable and available images can be enlarged. Unsafe image protocols are rejected. | [x] AUTO | `src/__tests__/unit/qa/f40-website-migration.test.ts`, `tests/f40-website-migration.spec.ts` |
| TC-F40-MIG-LIVE-06 | Unit/E2E | Critical | Automatic image checking certifies identical SHA-256 or all decoded pixels, treats resized/similar images as review, detects different/corrupt image content, uses the durable cache, rejects stale evidence/arbitrary URLs, and runs through the real browser flow. | [x] AUTO | `src/__tests__/unit/qa/f40-website-migration.test.ts`, `tests/f40-website-migration.spec.ts` |

### Live dashboard F42: cách đọc trạng thái

Màn hình mặc định `/studio/qa/migration-diff` chỉ đọc migration ledger F42. `?demo=1` là prototype/snapshot và không dùng để duyệt migration thật.

| Hiển thị | Nguồn dữ liệu | Ý nghĩa vận hành |
|---|---|---|
| Migration | `pw1_migration_stores.status` | Tiến trình import; `completed` không phải QC Pass. |
| Publish | `sites.status` | Website PW2 đã `published` hay vẫn `draft`. |
| Audit | `pw1_migration_qa_audits` và thời điểm cập nhật site/page | `not-checked`, `historical`, `stale` hoặc finding đều cần xử lý; không tự kết luận trang giống nhau. |
| QC hiện tại | `pw1_migration_qa_reviews` khớp evidence version | Chỉ `QC Pass`, `Cần xem lại` hoặc `P0` do tester lưu; review cũ trở thành `Chưa QC`. |
| PW1 homepage | URL trong evidence F42 | Chỉ là URL homepage đã lưu. Khung iframe có thể trắng do nguồn timeout/chặn iframe; mở link tab mới để kiểm tra, không coi đó là lỗi migrate. |

Inspector mở ở **Tổng quan** trước. Tester chỉ mở **So sánh trực quan**, **Nội dung & mapping** hoặc **Audit & media** khi cần; image check bắt đầu khi mở tab nội dung/audit, không tự chạy khi mới mở store.

Automatic media checks start when the inspector opens and update the **Kết quả** cell of each corresponding image field, alongside the PW1/PW2 thumbnails. There is no separate image-results table. Checks are read-only. Four pairs per request, two workers, bounded downloads and raster decode keep each request below the 60-second route ceiling under normal operation. Source downloads allow HTTPS DigitalOcean Spaces assets only, reject redirects and private DNS addresses; other source hosts remain unverified. Destination bytes come from the configured S3 SDK or local media directory, resolving only migration-owned media for this store. Cache keys include algorithm/source URL/media ID/media revision/destination URL; successful results expire after 24 hours, unavailable download results after five minutes, and **Kiểm tra lại ảnh** explicitly refreshes source content that might change at the same URL. Similarity is normalized-pixel RMSE guidance, not a calibrated identity score or automatic QC verdict. Alt/dimension mismatches remain separate review signals. Checks do not certify crop/layout or all animation frames unless file bytes match.

The default migration screen keeps F40's overview, status filters, search, pagination and **So Sánh** entry point while reading real website migration evidence. The inspector separates side-by-side websites, source content/mapping/settings, persisted audit findings, and manual QC. Prototype heuristic scores are not measured parity; real mode uses available field evidence. Missing comparable data displays **0% with an explicit no-data explanation**, while the backend measurement stays null. Progressbar colors do not certify automatic website Pass. Manual QC verdicts remain separate from automatic classification. Each review stores the reviewer, note, declared checks, input hash, committed attempt and evidence revision; changed migration/site/pages/audit invalidate its applicability. Reviews certify website scope only, not full commerce reconciliation or automatic cutover. Old prototype tabs remain explicitly accessible in demo mode.

Manual image confirmation appears in each image result cell: **Xác nhận thủ công: ảnh đúng** records the authenticated reviewer and time for that store/evidence version/page/component/field/image path. **Huỷ xác nhận ảnh** removes it. Changing the evidence version makes old confirmations inactive. Automated checks and metadata warnings remain visible; a confirmation does not imply store QC Pass. TC-F40-MIG-LIVE-06 also verifies confirmation, persistence across inspector tabs and cancellation in the real browser.


| Test case | Type | Priority | Acceptance | Automation | File |
| --- | --- | --- | --- | --- | --- |
| TC-F40-MIG-WEB-RATE-01 | Unit | Critical | Website percentage uses matched/total website fields including unresolved fields, respects scoped manual image confirmation, and keeps absent evidence nullable. | [x] AUTO | `src/__tests__/unit/qa/website-comparison-summary.test.ts` |
| TC-F40-MIG-WEB-RATE-02 | E2E | Critical | Real migrated website has nonzero content percentage without requiring BE field evidence; overview agrees with API content counts. | [x] AUTO | `tests/f40-website-migration.spec.ts` |
