# PW1 runtime handoff tests

Các test chuyển từ worktree exporter cùng thay đổi PW2 phục vụ dữ liệu sau migration.

- [x] AUTO TC-F42-055: Product slug collision scoped to effective tenant, including owner/admin and update identity.
- [x] AUTO TC-F42-059: Preserve untouched/reverted/image-only rich description; explicit text edit or clear remains intentional. Unit tests and local browser regression.
- [x] AUTO TC-F42-076: Normal create/add enforces five images; editing a persisted larger gallery preserves/reorders/removes existing image occurrences without allowing replacement/addition above five. Private importer context preserves all historical images; storefront shows and navigates them.

Browser test requires the isolated local database and server described in docs/runbooks/f42-local-browser-regression.md. Listing the test is not a browser execution.

2026-09-18: TC-F42-076 PASS qua `playwright.f42-products-local.config.ts` trên localhost:3005, dùng draft fixture tạm tại tenant1282 và tự xóa sau test; không sửa sản phẩm đã migrate. 34 unit tests liên quan PASS. Import rehearsal trên DB clone giữ đủ 6 ảnh, ngắt/resume/replay PASS.

- [x] AUTO TC-F42-IMP-ROOT-CREATOR: PW1 users.createdBy root reference 1 becomes explicit null, source remains unchanged, replay is stable, other creators still require binding; a bare null cannot discharge a creator diagnostic.

- [x] AUTO TC-F42-IMP-PROGRESS: CLI progress reports elapsed time, phases and byte/store/entity counts; throttles repeated updates and emits a waiting heartbeat without altering stdout JSON.

- [x] AUTO TC-F42-IMP-DIAGNOSTIC-SPOOL: Final classification aggregates over100000 distinct source diagnostics without losing counts; target checks retain IDs and duplicate counts in hash-verified per-store spool; mixed allowed/blocked rows remain separated.

- [x] AUTO TC-F42-IMP-GROUPS: Group boundaries, cross-group source/unique collisions, lease non-overlap and resume completion.
- [x] AUTO TC-F42-IMP-LOGS: Private session logs, rotation, safe metadata, summary and failure semantics; diagnostic field/reason and sample truncation; second-entity preflight errors retain source identity without credentials.
