# Phase 08 — Page/Block mapping và live-render evidence (gate F40-13 riêng)

## Context và phạm vi

Ưu tiên P1; trạng thái pending; ước lượng ban đầu **ít nhất 5 dev-days sau khi có mapping Page/Block**, cần ước lượng lại khi chốt nguồn Page migration và QA runner. Phase này hoàn tất khoảng trống F40-13 đã được nêu trong [plan hiện có](../260911-f40-13-pw2-render-evidence/plan.md). Field evidence Commerce/Settings không chứng minh một block có mặt trong PW2 hoặc đã render trên storefront.

Nguồn code: [`migration-render-evidence.ts`](../../src/lib/admin/qa/migration-render-evidence.ts), [`live-check/route.ts`](../../src/app/api/qa/migration-render-evidence/live-check/route.ts), [`BlockMigrationEvidence.tsx`](../../src/app/studio/qa/migration-diff/BlockMigrationEvidence.tsx), [`src/blocks/registry.ts`](../../src/blocks/registry.ts). Hiện provider chưa được đăng ký và live-check trả `LIVE_CHECK_RUNNER_UNAVAILABLE`; importer F42 hiện loại Page khỏi scope. Không diễn giải demo/iframe HTTP 200 là live-render proof.

## Kiến trúc và phụ thuộc

1. Team migration chốt Page/Block import scope và cung cấp crosswalk bền vững theo `sourceInstance + sourceStoreId + childRunId + sourcePageId + sourceBlockLegacyId → pw2SiteId + pw2PageId + pw2LayoutBlockId`, kèm `blockType`, mapping version, target read time. Nếu Page/Block thuộc một run khác, ghi **run ID riêng** và liên kết rõ với Commerce child run; không ép cùng UUID.
2. Xác định cách đọc block đích từ Payload/Postgres, kiểm tenant/site/page ownership và uniqueness. Một label/position trùng không phải mapping. Nếu không có block source ID hoặc PW2 layout block ID ổn định, trạng thái `unverified` và ghi blocker.
3. Kiểm `blockRegistry` runtime để kết luận `supported/unsupported/unverified`. Registry có component không chứng minh block được render cho template/site; xác minh điều kiện template nếu có.
4. Live runner chỉ nhận IDs allowlisted, chạy khi QA yêu cầu, lưu `rendered/not_rendered/unverified`, `checkedAt`, evidence ref an toàn. Browser probe phải xác nhận đúng block marker trong DOM của đúng site/page; timeout/network error là `unverified`, không phải `not_rendered`.
5. F40 giữ ba lớp status độc lập: `pw2Data`, `component`, `liveRender`; `overall=pass` chỉ khi đủ `migrated + supported + rendered` như contract hiện tại. Không cộng Page/Block vào summary Commerce cho đến khi registry/contract xác định rõ denominator.

## Việc cần làm theo thứ tự

- [ ] Khóa source Page/Block inventory và mapping rule; chọn owner F42/F40 cho crosswalk; pin version/hash và quyết định run identity riêng nếu cần.
- [ ] Thêm schema additive/index và strict schema verification nếu F42 là nơi ghi block crosswalk. Không thêm Payload collection field mà thiếu migration tương ứng trong `scripts/db-setup.js`.
- [ ] Tạo writer idempotent cho crosswalk theo source block identity, chặn duplicate/tenant mismatch và lưu target block ID thật sau import.
- [ ] Triển khai `MigrationRenderEvidenceProvider` đọc mapping + Payload target + component registry. Sanitize body/media/PII; chỉ expose safe field labels/values.
- [ ] Triển khai QA live-check runner/adapter có timeout, bounded target set, run history và safe evidence ref; bảo vệ endpoint bằng Super Admin và input validation.
- [ ] Tích hợp UI trạng thái ba lớp, placeholder khi thiếu evidence; demo luôn dán nhãn và không mở QC Pass.
- [ ] Thêm TC-ID vào `docs/qa/F40-qa-control-center.md` trước khi viết test; unit/API/E2E theo `docs/TEST_CONVENTION.md`; chạy manual TC-F40-13-07/08 trên fixture QC và ghi PASS/FAIL/NOT_RUN riêng.

## Done khi

- Một block fixture có mapping đích thật, renderer support và live runner proof hiển thị `pass`; thiếu một lớp thì không pass.
- Sai Site/Page/Block, mapping stale, renderer lạ, timeout và evidence ref không hợp lệ đều fail closed.
- QA có source Store, Page/Block IDs, run version, runner owner, timestamp và evidence ref an toàn để review; không có raw cookie/trace/customer content.
- Phase 08 được ký nghiệm thu **riêng** với Phase 01–07. Nếu chưa đạt, bàn giao Commerce/Settings field evidence vẫn có thể hoàn tất nhưng không claim F40 migration visual/render toàn diện.

## Rủi ro

Page không thuộc F42 importer hiện tại nên nguồn crosswalk có thể chưa tồn tại; runner live có thể chưa được cấp hạ tầng. Giữ F40-13 `unverified` cho đến khi có mapping và runner thật. Không làm giả bằng preview hoặc vị trí block.
