# F42 — prod-seed QC data cleanup

Scope: `scripts/prod-seed-clean-qc-data*.ts` (dọn dữ liệu QC trên Neon branch `prod-seed` trước khi `pg_dump`/`pg_restore` sang production). Runbook: [prod-db-restore-from-staging-checklist](../runbooks/prod-db-restore-from-staging-checklist.md).

Test file: `src/__tests__/unit/scripts/prod-seed-clean-qc-data.test.ts` (22 tests, logic thuần: guard, phân loại, planner FK).

| TC-ID | Mode | Scenario | Expected |
|---|---|---|---|
| TC-F42-PSC-001 | [x] AUTO | Target guard: thiếu/sai `--target-label`, endpoint staging (direct + pooler), project id prod, cùng endpoint với URI cấm, host không phải Neon/localhost, keyword staging/production, URI hỏng; denylist đồng bộ `qc-guard.ts` | Từ chối mọi trường hợp; chỉ chấp nhận branch Neon mới với label `prod-seed`; pooled được cảnh báo |
| TC-F42-PSC-002 | [x] AUTO | Phân loại user/tenant: provenance thắng quy ước QC, QC email/slug/name bị xoá, super-admin không phải QC được giữ, user lạ và service account vào REVIEW, tenant chỉ có member QC bị xoá | Không bao giờ xoá dòng không rõ nguồn; REVIEW không bị xoá; email được mask |
| TC-F42-PSC-003 | [x] AUTO | Planner FK: xoá con trước cha, tenant xoá cuối, predicate lồng cho bảng cháu, không lặp câu lệnh, chỉ theo CASCADE cho user, RESTRICT là blocker, chu trình FK dừng, identifier lạ bị từ chối, wipe set thoát FK bị chặn, thứ tự wipe | SQL đúng thứ tự, an toàn identifier |
| TC-F42-PSC-DB-01 | [ ] MANUAL | Chạy dry run rồi `--apply` trên DB Postgres tạm (clone schema + ledger giả): đếm khớp, dry run rollback, chạy lại rỗng, provenance giữ nguyên | Đã chạy tay trên DB local 2026-10-30 (6 user, 4 tenant): PASS. Chưa chạy trên branch Neon thật |
| TC-F42-PSC-DB-02 | [ ] MANUAL | Dry run trên branch `prod-seed` thật, owner duyệt REVIEW + danh sách super-admin | NOT_RUN |
