---
date: 2026-09-08
session: F23 SSO Owner avatar BA contract
---

# Journal: F23 SSO Owner Avatar BA Contract

## Outcome

Issue #1723 đã được chuyển từ một bug report mâu thuẫn với F23 v1.2 thành BA Product Contract thống nhất cho Owner avatar. User Stories và PRD F23 v1.3 đã hoàn tất ở mức BA draft, được kiểm tra consistency và sẵn sàng đưa vào documentation PR. Development vẫn chưa `Ready` vì còn phụ thuộc written SSO Integration Contract và các cross-team review.

Không có source code, database schema, API, webhook, cache implementation hoặc automated test nào được thay đổi trong phiên này.

## Product Decisions

- SSO là authoritative source của Store Owner avatar; Staff avatar tiếp tục do PWv2 quản lý local.
- Owner không được upload, replace, delete hoặc override avatar local tại PWv2.
- Webhook update/delete là primary synchronization trigger; SSO Profile API reconciliation khi successful login là fallback.
- PWv2 dùng cached copy nếu SSO cho phép; không runtime-fetch SSO trên mỗi page render.
- Target propagation là p95 không quá 5 phút; reconciliation failure không được block Owner login.
- Existing Owner được one-time backfill. Immutable SSO identity preflight phải chạy trước avatar mutation; missing, duplicate hoặc ambiguous mapping bị skip/quarantine/report và không fallback sang email hay mutable identity.
- Avatar state được chuẩn hóa thành `PRESENT`, authenticated `ABSENT` hoặc `UNKNOWN`. Chỉ authenticated `ABSENT` mới cho phép purge cached reference, stored object và derived/CDN copies theo retention đã được duyệt; `UNKNOWN` giữ last-known avatar.

## Updated Artifacts

- `docs/stories/F23-personal-profile-stories.md`: revise US-F23-01 và thêm US-F23-05 cùng AC cho backfill, update/delete, reconciliation, outage, idempotency, identity preflight và canonical state semantics.
- `docs/prd/F23-personal-profile.md`: bump v1.3; đồng bộ traceability, scope, source-of-truth, FR/BR, UI, AC, NFR, DoR/DoD và dependency gates.
- `docs/decisions/decisions-log.md`: thêm PD-022 cho role-based avatar source of truth.
- `docs/design/F23-personal-profile-design.md`: supersede Owner local-upload rule; thống nhất single-page/read-only Owner experience và Staff password baseline.
- `docs/qa/F23-personal-profile.md`: thêm planned matrix `TC-F23-SSO-01..11`; dùng namespace riêng để không đụng legacy Role Guard IDs.
- `plans/260908-gh-1723-sso-owner-avatar/plan.md`: ghi execution status và readiness gates.
- `plans/260908-gh-1723-sso-owner-avatar/validation-summary.md`: ghi nhận các Product decision đã được PO/BA duyệt và external gates còn mở.
- `plans/260908-gh-1723-sso-owner-avatar/sso-integration-questionnaire.md`: bộ câu hỏi chính thức về identity, avatar contract, delivery, security, failure semantics, purge retention, backfill, Staging và operations.

## Verification

- Story User Story Gherkin và PRD Acceptance Criteria được đối chiếu byte-for-byte: khớp.
- `git diff --check`: pass.
- Independent debugger re-audit cuối: 0 Critical, 0 High, 0 Medium, 0 Low.
- Issue, Stories, PRD, Decision Log, Design handoff, QA matrix, plan và questionnaire thống nhất về Owner/Staff source of truth, immutable identity, `PRESENT`/`ABSENT`/`UNKNOWN`, purge safety và non-blocking login.
- Không chạy application test vì thay đổi chỉ thuộc documentation và US-F23-05 chưa có implementation.

## GitHub Issue Actions

- Issue [#1723](https://github.com/primeproduction/ech-prime-web-v2/issues/1723) được đổi title và refresh body với Product decision, business outcomes, scope, technical evidence, SSO blockers và Definition of Ready.
- Issue vẫn `Open`, có labels `bug`, `F23`, `area:backend`, `blocked`, `question`; chưa auto-close và chưa được đánh dấu `Ready for Development`.
- PO/BA clarification đã được đăng tại [issue comment](https://github.com/primeproduction/ech-prime-web-v2/issues/1723#issuecomment-5582256827).
- Milestone `v1.1 — Phase 2` đã quá hạn vẫn được ghi nhận; PM/Delivery phải quyết định milestone/iteration hiện hành sau khi readiness gates hoàn tất.

## Remaining External Gates

1. SSO team cung cấp written contract, accountable owner, immutable identity/preflight data, avatar field/format, canonical state table, webhook/Profile API samples, authentication, retry/rate limit, caching permission, purge retention, SLA capability, backfill access và Staging fixtures.
2. Tech Lead/Solution Architect phê duyệt Architecture Document cho trust boundary, idempotency/versioning, cached-media lifecycle, login reconciliation, invalidation và observability.
3. Security/Privacy phê duyệt webhook security, external image acquisition, SSRF controls, PII/media retention và destructive purge signal.
4. UI/UX và QA sign-off các Owner states, namespace/test matrix và cross-system E2E plan.
5. Dev hoàn tất gap analysis/re-estimate; PM/Delivery gán sprint hoặc milestone mới.

Chỉ khi các gate trên pass mới bỏ label `blocked` và chuyển Issue #1723 sang `Ready for Development`.
