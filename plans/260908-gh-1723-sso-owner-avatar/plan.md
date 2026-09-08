---
title: "GH-1723 — Owner avatar SSO source-of-truth BA contract"
description: "Refresh Issue #1723, add the stories-first F23 contract, update PRD F23, and obtain a written SSO integration contract before technical design."
status: in-progress-blocked-by-sso-contract
priority: Medium
effort: TBD-after-SSO-contract
issue: 1723
branch: docs/gh-1723-sso-owner-avatar-contract
tags: [f23, ba, prd, user-story, sso, avatar, integration]
blockedBy: [sso-avatar-contract]
created: 2026-09-08
updated: 2026-09-08
---

# GH-1723 — BA Documentation and SSO Contract Plan

## 1. Goal

Biến Issue #1723 từ một bug report đang mâu thuẫn tài liệu thành Product Contract có thể estimate và triển khai, dựa trên quyết định đã được PO/BA chốt:

- **Store Owner avatar:** SSO là source of truth.
- **Staff avatar:** PWv2 tiếp tục quản lý local.
- **Owner:** không upload/override avatar trực tiếp tại PWv2.
- **PWv2:** dùng cached copy của Owner avatar để bảo đảm performance và availability; SSO caching permission là hard prerequisite. Nếu SSO không cho phép cache, Product phải quyết định lại solution.

## Execution Status — 2026-09-08

| Phase | Status | Evidence / next gate |
|---|---|---|
| Phase 0 — Issue triage | Completed | Branch đã tạo từ latest `staging`; Issue #1723 đã refresh title/body, giữ Open, thêm BA comment và labels `F23`, `area:backend`, `blocked`, `question` |
| Phase 1 — SSO Contract | Blocked externally | Questionnaire đã chuẩn bị; chờ SSO owner, written answers, sample payload và Staging fixtures |
| Phase 2 — Stories-first | BA draft completed and verified | US-F23-01 đã revise; US-F23-05 có 11 AC. Static parity với PRD pass; final approval vẫn chờ G1 và cross-team review |
| Phase 3 — PRD v1.3 | BA draft completed and verified | PRD đã đồng bộ traceability/AC/BR/NFR/DoR; 21/21 Gherkin blocks khớp Stories. Development readiness vẫn chờ G1–G4 |
| Phase 4 — Handoff | BA handoff artifacts prepared | Design baseline đã đồng bộ; QA có proposed `TC-F23-SSO-01..11`. Architecture, Security/Privacy, UI/UX và QA owner sign-off còn mở |
| Phase 5 — Readiness | Static verification completed; externally blocked | [Verification report](./verification-report.md) đạt 100% static pass. Issue vẫn Open/`blocked`; chưa có SSO contract, PR tài liệu, sprint hoặc estimate cuối |

## Plan Sync-back — 2026-09-08

### Completed BA work

- [x] Phase 0: tạo đúng branch; refresh title/body/labels và BA comment của Issue #1723; giữ Issue Open và `blocked`.
- [x] Phase 1 preparation: hoàn thiện SSO questionnaire và Must-answer Gate.
- [x] Phase 2 draft: revise US-F23-01; thêm US-F23-05 với identity preflight, `PRESENT`/`ABSENT`/`UNKNOWN` và 11 AC.
- [x] Phase 3 draft: cập nhật PRD F23 v1.3, Decision Log, FR/BR/NFR/DoR/DoD và exact Story traceability.
- [x] Phase 4 preparation: đồng bộ F23 Design baseline và thêm proposed QA matrix `TC-F23-SSO-01..11`.
- [x] Phase 5 static verification: links, Markdown, Gherkin, Story/AC/FR/QA traceability, Design/password consistency, safety semantics và live Issue checks đều pass.
- [x] Không sửa source code, automated tests hoặc dependency lockfiles; không stage/commit file ngoài scope.

### Open external and delivery gates

- [ ] G1: gửi questionnaire và nhận written SSO Integration Contract, samples, staging access, owner và deadline.
- [ ] G2 final: PO/BA điền và approve các Story values phụ thuộc signed SSO contract.
- [ ] G3 final readiness: reconcile PRD với signed SSO contract.
- [ ] G4: Tech Lead Architecture, Security/Privacy, UI/UX và QA sign-off; Dev gap analysis/re-estimate.
- [ ] Tạo/link documentation PR và SSO contract vào Issue #1723.
- [ ] PM/Delivery gán milestone/iteration và sprint hiện hành.

**Current conclusion:** BA artifacts đã hoàn tất và đạt 100% static verification, nhưng tính năng **chưa Ready for Development**. Không bỏ label `blocked` trước khi các gate trên hoàn tất.

## 2. Evidence Baseline

- Issue #1723 mô tả đúng triệu chứng: PWv2 không nhận avatar mới từ SSO.
- Tại thời điểm scout trước update, `docs/prd/F23-personal-profile.md` BR-23-02 quy định avatar độc lập SSO, trái với quyết định mới.
- Tại thời điểm scout trước update, `docs/stories/F23-personal-profile-stories.md` US-F23-01 cho cả Owner/Staff upload avatar local.
- Tại thời điểm scout trước update, `docs/design/F23-personal-profile-design.md` ghi Owner upload avatar local, trong khi code/QA coi Owner Profile là read-only; handoff notice hiện đã supersede rule cũ.
- `src/app/api/v1/sso/provision/route.ts` và `src/app/api/auth/sso-session/route.ts` không nhận, fetch hoặc persist avatar SSO.
- Header chỉ render `users.avatar` local; không có avatar webhook/profile reconciliation hoặc SSO-avatar test.

## 3. Scope

### In scope — BA owned

- Refresh nội dung và metadata của GitHub Issue #1723.
- Thêm User Story `US-F23-05 — Synchronize Owner Avatar from SSO` theo Stories-First Rule.
- Sửa US-F23-01 để avatar upload local chỉ áp dụng cho Staff.
- Cập nhật PRD F23 lên v1.3 và đồng bộ Story Traceability, Scope, FR, BR, flow, AC, NFR, metrics, DoR/DoD.
- Gửi và lưu văn bản phản hồi của SSO team theo questionnaire đi kèm.
- Ghi Product Decision vào `docs/decisions/decisions-log.md`; giữ technical feasibility và Development readiness phụ thuộc SSO contract.
- Lập handoff checklist cho SSO owner, Tech Lead, UI/UX, QA và Dev.

### Out of scope của plan BA

- Viết Architecture Document thay Tech Lead/Solution Architect.
- Thay đổi source code, database schema, API, webhook, cache hoặc tests.
- Chọn thuật toán download/cache/media processing thay engineering.
- Chuyển Issue sang `Ready for Development` trước khi SSO contract và các handoff bắt buộc được sign-off.

## 4. Affected Artifacts

| Artifact | Owner | Planned change |
|---|---|---|
| GitHub Issue #1723 | BA/PO | Refresh Expected/Actual, decision, dependency, status, acceptance summary, links và metadata |
| `docs/stories/F23-personal-profile-stories.md` | BA/PO | Sửa US-F23-01; thêm US-F23-05 với complete AC/edge cases |
| `docs/prd/F23-personal-profile.md` | BA/PO | Version 1.3; thay BR-23-02; thêm FR/BR/flow/AC/NFR/metrics/gates |
| `docs/prd/F02-auth.md` | BA/PO + Auth owner | Chỉ cập nhật nếu login reconciliation hoặc SSO contract trở thành Auth responsibility |
| `docs/decisions/decisions-log.md` | PO/BA | Record Owner/Staff avatar source-of-truth và rationale |
| `docs/design/F23-personal-profile-design.md` | UI/UX | Handoff: Owner read-only avatar, sync/loading/fallback/error states |
| `docs/qa/F23-personal-profile.md` | QA | Handoff: webhook, reconciliation, delete, outage, cache refresh và Staff regression |
| F23 Architecture Document | Tech Lead/SA | Handoff: trust boundary, endpoint/event, cache, idempotency, security và observability |

## 5. Ordered Plan

### Phase 0 — Safe setup and Issue triage

1. Sau khi plan được duyệt, tạo branch `docs/gh-1723-sso-owner-avatar-contract` từ latest `staging`.
2. Không mang theo hoặc commit các file untracked ngoài scope.
3. Đăng PO/BA decision vào Issue #1723:
   - Owner = SSO source of truth;
   - Staff = PWv2 local;
   - implementation chưa Ready vì thiếu SSO contract.
4. Giữ Issue Open và chuyển về trạng thái refinement/blocked phù hợp với workflow hiện có.
5. Đồng bộ metadata bằng các label đang tồn tại: giữ `bug`, thêm `F23`, `area:backend`, `blocked`, `question`; không tạo label `sso`/`integration` nếu repository chưa có.
6. Gỡ hoặc thay milestone `v1.1 — Phase 2` đã quá hạn bằng milestone/iteration hiện hành sau khi PM xác nhận; không tự chọn sprint.

**Output:** Issue phản ánh đúng Product decision và dependency, nhưng chưa tuyên bố implementation-ready.

### Phase 1 — Obtain written SSO Integration Contract

1. Gửi [`sso-integration-questionnaire.md`](./sso-integration-questionnaire.md) cho SSO Product/Integration owner.
2. Yêu cầu một đầu mối chịu trách nhiệm và deadline phản hồi.
3. Thu thập sample payload, event/API documentation, staging endpoint, credentials process và test accounts.
4. Xác nhận hoặc điều chỉnh các proposed defaults:
   - Webhook update/delete là primary trigger.
   - Login-time Profile API reconciliation là fallback.
   - Mapping bằng immutable `sso_user_id`/OIDC `sub`, không dùng email; identity preflight skip/quarantine/report mapping thiếu, duplicate hoặc ambiguous.
   - PWv2 lưu cached copy; SSO unavailable thì giữ last-known avatar.
   - Avatar state chuẩn hóa thành `PRESENT`, `ABSENT`, `UNKNOWN`; chỉ authenticated `ABSENT` mới purge cached/stored/derived/CDN media và fallback về initials.
   - Target propagation SLA: p95 ≤ 5 phút; login reconciliation áp dụng trong login flow thành công.
5. Nếu SSO không cung cấp field, stable identity hoặc authorized delivery mechanism, dừng trước khi viết final AC và đưa ra Product fallback decision riêng.

**Gate G1:** Có written SSO contract và sample evidence; mọi unknown quan trọng có owner/date xử lý.

### Phase 2 — Stories-first update

1. Sửa US-F23-01:
   - Local avatar upload chỉ dành cho Staff.
   - Không còn wording `Owner/Staff` cho mutation local.
2. Thêm `US-F23-05 — Synchronize Owner Avatar from SSO`.
3. AC tối thiểu phải bao phủ:
   - Initial/backfill avatar.
   - Legacy Owner-local avatar replacement/retirement theo confirmed SSO state.
   - Update propagation.
   - Login reconciliation.
   - Delete avatar → initials.
   - Duplicate/out-of-order event idempotency.
   - SSO outage → last-known avatar.
   - Broken/expired/unsafe URL.
   - Stable identity và cross-user isolation.
   - Identity preflight cho missing/duplicate/ambiguous mapping; không fallback email.
   - `PRESENT`/`ABSENT`/`UNKNOWN` semantics và non-destructive `UNKNOWN` behavior.
   - Header/Profile cache refresh.
   - Owner không local upload; Staff không regression.
4. Ghi rõ measurable SLA, supported formats/size, data retention và security outcome từ SSO contract.
5. Đặt Story status `Refinement` cho đến khi Architecture, Design, QA và Dev re-estimate hoàn tất.

**Gate G2:** Story được PO/BA approve; không còn AC phụ thuộc unknown SSO contract.

### Phase 3 — PRD F23 v1.3 alignment

1. Bump version/date/status; sửa traceability cho US-F23-01 và US-F23-05.
2. Thay BR-23-02 bằng role-based source-of-truth matrix:

| Role | Avatar source | Local upload | Fallback |
|---|---|---|---|
| Owner | SSO authoritative; PWv2 cached copy | Không | Last-known khi transient failure; initials khi confirmed absent/deleted |
| Staff | PWv2 local Media | Có | Initials khi chưa upload/ảnh lỗi |

3. Bổ sung Functional Requirements cho ingestion/reconciliation outcome, cache visibility và role restrictions; không khóa endpoint/schema kỹ thuật.
4. Copy nguyên văn AC từ Stories vào PRD; mọi FR phải có Story Ref.
5. Định nghĩa Business Rules:
   - SSO event hợp lệ mới được overwrite Owner cached avatar.
   - Email không phải identity key.
   - Duplicate/older event không được rollback avatar mới hơn.
   - Transient integration error không được xóa last-known avatar.
   - Confirmed delete/absent state mới fallback về initials.
   - Owner local upload bị chặn ở cả UI outcome và API authorization requirement.
   - Staff local avatar flow phải giữ nguyên.
6. Bổ sung Success Metrics/NFR theo SSO contract: propagation SLA, sync success rate, security, observability và cache freshness.
7. Resolve mâu thuẫn hiện tại: PRD DoR đang check Stories approved trong khi Story index còn `Draft`.
8. Đánh dấu PRD `Draft/Refinement` cho đến khi handoff hoàn tất.

**Gate G3:** Story ↔ PRD traceability pass; không còn Owner avatar rule mâu thuẫn.

### Phase 4 — Cross-team handoff

1. **SSO Product/Integration owner:** sign-off field, identity, event/API, auth, retry, SLA, deletion, fixtures và support owner.
2. **Tech Lead/Solution Architect:** viết/update Architecture Document, bao gồm trust boundary, idempotency/versioning, cached media lifecycle, login reconciliation, cache invalidation và monitoring.
3. **UI/UX:** cập nhật F23 Design:
   - Owner avatar read-only;
   - loading/syncing, initials, broken image và last-known states;
   - không hiển thị local upload affordance cho Owner;
   - Staff upload không đổi.
4. **QA:** cập nhật F23 QA matrix cho Story mới và E2E cross-system.
5. **Security/Privacy:** review external image acquisition, SSRF controls, PII/media retention, webhook authentication và audit requirements.
6. **Dev:** gap analysis và re-estimate sau Architecture review.

**Gate G4:** Tất cả owner sign-off; open technical questions có owner nhưng không làm thay đổi Product behavior.

### Phase 5 — Final BA verification and GitHub readiness

1. Chạy consistency review Story ↔ PRD ↔ Issue ↔ SSO contract.
2. Verify toàn bộ AC có measurable expected results và QA mapping.
3. Link PR tài liệu, SSO contract và handoff documents vào Issue #1723.
4. Cập nhật Issue body từ giả thuyết kỹ thuật sang confirmed Product behavior/acceptance summary.
5. Chỉ bỏ label `blocked` và thêm `status:ready` khi G1–G4 đã pass.
6. PM/Delivery Manager gán milestone/iteration hiện hành; Dev nhận issue và estimate cuối.

## 6. Proposed Acceptance Contract

Các giá trị dưới đây là **khuyến nghị BA**, cần SSO contract xác nhận trước khi đưa vào Story final:

| Scenario | Expected business outcome |
|---|---|
| Owner đã có avatar tại SSO | PWv2 backfill cached avatar và hiển thị cùng ảnh tại Header/Profile |
| Owner cập nhật avatar | PWv2 hiển thị ảnh mới trong p95 ≤ 5 phút |
| Owner login trước khi webhook hoàn tất | Login reconciliation lấy trạng thái mới nhất trong login flow thành công |
| Owner xóa/không có avatar | Sau authenticated `ABSENT`, PWv2 purge cached/stored/derived/CDN media theo retention limit và hiển thị initials trong SLA |
| SSO tạm unavailable | PWv2 giữ last-known avatar; không tự xóa hoặc thay bằng dữ liệu user khác |
| Event duplicate/out-of-order | Xử lý idempotent; event cũ không overwrite version mới |
| Avatar URL/file không hợp lệ | Không render nội dung không an toàn; giữ last-known hoặc initials theo trạng thái confirmed |
| Owner thử upload local | UI không cung cấp action; server-side authorization từ chối mutation local |
| Staff upload local | Hành vi F23 hiện tại không regression |

## 7. Validation Matrix

| Check | Evidence required | Owner |
|---|---|---|
| Product source-of-truth | PO/BA decision log | PO/BA |
| SSO capability | Written contract + sample payload/event/API | SSO owner |
| Story completeness | US-F23-01/05 AC review | BA/PO + QA |
| PRD traceability | Mọi FR có Story Ref; AC được copy từ Story | BA |
| Architecture feasibility | Approved Architecture Document | Tech Lead/SA |
| UX states | Approved Owner/Staff F23 Design | UI/UX |
| Test coverage | QA matrix map đủ AC và regression | QA |
| Security/privacy | Webhook, external media và retention review | Security/Privacy |
| Delivery readiness | Estimate, dependencies, sprint capacity | Dev/Delivery |

## 8. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| SSO không có avatar contract | Không thể triển khai sync đúng | Giữ Issue blocked; BA quay lại quyết định fallback thay vì để Dev đoán |
| Dùng email để mapping | Avatar có thể gắn sai user sau đổi email | Bắt buộc immutable SSO identity |
| Existing Owner thiếu/trùng SSO ID | Backfill có thể gắn avatar sai account | Identity preflight; skip/quarantine/report; không fallback email |
| Field omission/lỗi quyền bị hiểu là delete | Xóa nhầm avatar hợp lệ | Canonical `PRESENT`/`ABSENT`/`UNKNOWN`; chỉ authenticated `ABSENT` được purge |
| Signed URL hết hạn | Header hiển thị ảnh hỏng | Cache approved media hoặc có refresh contract |
| Webhook duplicate/out-of-order | Avatar mới bị rollback | Event ID + version/updated_at + idempotency rule |
| SSO outage | Profile mất avatar | Giữ last-known avatar khi transient failure |
| Owner local API vẫn mở | Hai source of truth xung đột | Architecture/API guard và QA negative case |
| Docs F23 hiện mâu thuẫn | Dev/QA build khác nhau | Stories-first update và final consistency gate |
| Milestone cũ | Planning/reporting sai | PM gán iteration hiện hành sau readiness |

## 9. Definition of Ready for Development

- [x] Product Decision được ghi vào Issue và Decision Log.
- [ ] SSO written contract được sign-off và link từ Issue/PRD.
- [ ] Stable identity/preflight, avatar field/format, canonical state semantics và authentication đã chốt.
- [ ] SLA, retry, outage, deletion và backfill behavior đã chốt.
- [x] Draft US-F23-01 và US-F23-05 phản ánh đúng approved Product behavior.
- [ ] US-F23-05 final được PO/BA approve sau khi SSO contract values được điền.
- [x] Draft PRD F23 v1.3 trace đúng Stories và không còn BR-23-02 cũ.
- [x] Static documentation verification đạt 100%; xem [verification report](./verification-report.md).
- [x] Design baseline và proposed QA matrix đã được chuẩn bị cho handoff.
- [ ] Architecture, Design, QA và Security/Privacy review hoàn tất.
- [ ] Dev gap analysis/estimate hoàn tất; không còn product ambiguity.
- [ ] Issue #1723 có đúng links, metadata và current milestone/iteration.

## 10. Review Decisions

### Already approved

1. Owner avatar do SSO quản lý authoritative.
2. Staff avatar do PWv2 quản lý local.
3. Owner không upload/override avatar tại PWv2.
4. PWv2 ưu tiên cache thay vì runtime-fetch SSO trên mọi page render, với điều kiện SSO cho phép.

### Pending SSO confirmation

1. Avatar field và delivery channel.
2. Immutable identity mapping.
3. File/URL access và caching permission.
4. Update/delete event semantics và idempotency metadata.
5. Canonical `PRESENT`/`ABSENT`/`UNKNOWN` table, identity preflight exceptions và purge retention.
6. Webhook/API authentication, retry và rate limit.
7. Propagation SLA và login reconciliation capability.
8. Backfill method, staging fixtures và operational owner.

## 11. Delivery Proposal

- Documentation branch: `docs/gh-1723-sso-owner-avatar-contract`.
- Documentation PR base: `staging`.
- PR title: `docs(f23): define SSO owner avatar contract`.
- PR body: use `Relates to #1723`; không dùng auto-close vì implementation chưa hoàn tất.
- Không commit source code trong PR tài liệu.
- Current state: chưa commit/push/tạo PR; Issue vẫn Open và blocked đúng gate.
