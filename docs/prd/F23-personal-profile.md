# PRD: Personal Profile (F23)

> **Version:** 1.4
> **Updated:** 2026-10-22
> **Status:** Integration Refinement — Blocked by SSO Contract
> **Priority:** P1 | **Original Sprint:** Wave 2 | **Size:** Re-estimate required
> **Depends on:** F02 Auth, written SSO Integration Contract
> **Related Issue:** [#1723](https://github.com/primeproduction/ech-prime-web-v2/issues/1723)

---

> [!IMPORTANT]
> **Stories-First Rule:** PRD này được đồng bộ từ `docs/stories/F23-personal-profile-stories.md`. Product behavior đã được PO/BA duyệt; SSO integration details chưa được Dev tự suy đoán và phải chờ written contract.

## 0. Story Traceability

| Story ID | Title | File | Status |
|---|---|---|---|
| US-F23-01 | View Profile and Manage Staff Avatar | [F23 Stories](../stories/F23-personal-profile-stories.md#us-f23-01-view-profile-and-manage-staff-avatar) | PO/BA Approved — Revised |
| US-F23-02 | Edit Personal Info (Staff Only) | [F23 Stories](../stories/F23-personal-profile-stories.md#us-f23-02-edit-personal-info-staff-only) | Existing Baseline |
| US-F23-03 | Redirect to SSO (Owner Only) | [F23 Stories](../stories/F23-personal-profile-stories.md#us-f23-03-redirect-to-sso-owner-only) | Existing Baseline |
| US-F23-04 | Change Password Native (Staff Only) | [F23 Stories](../stories/F23-personal-profile-stories.md#us-f23-04-change-password-native-staff-only) | Existing Baseline |
| US-F23-05 | Synchronize Owner Avatar from SSO | [F23 Stories](../stories/F23-personal-profile-stories.md#us-f23-05-synchronize-owner-avatar-from-sso) | Refinement — Blocked by SSO Contract |

---

## 1. Problem Statement

Personal Profile hiện đã phân biệt Owner và Staff đối với identity fields, nhưng avatar contract chưa nhất quán:

- Tài liệu cũ quy định avatar độc lập với SSO và cho cả Owner/Staff upload local.
- UI hiện tại hiển thị Owner Profile ở trạng thái Read-only.
- PWv2 chưa ingest, reconcile hoặc cache avatar từ SSO, nên Owner cập nhật avatar tại SSO vẫn thấy initials hoặc ảnh local cũ trong PWv2.

Điều này tạo ra hai source of truth, làm Owner nhầm lẫn và khiến Issue #1723 chưa thể estimate chính xác.

## 2. Product Objective

Thiết lập một Product Contract thống nhất:

- Owner chỉ quản lý avatar tại SSO và nhìn thấy cùng avatar trong PWv2.
- Staff tiếp tục quản lý avatar local trong PWv2.
- PWv2 hiển thị ổn định khi SSO tạm unavailable.
- Dev có Acceptance Criteria đo được nhưng không phải tự đoán API, webhook hoặc security contract của SSO.

## 3. Target Users

- **Store Owner:** Xem identity và avatar do SSO quản lý; dùng CTA để thay đổi tại SSO.
- **Store Staff:** Tự quản lý tên, phone, avatar local và password trong PWv2.
- **Operations/Support:** Có trạng thái và evidence đủ để điều tra lỗi synchronization.

## 4. Solution Overview

Personal Profile tiếp tục dùng role-aware, single-page UI. Owner identity và avatar là Read-only tại PWv2; SSO là authoritative source. PWv2 dự kiến nhận avatar update/delete qua webhook, reconciliation qua SSO Profile API khi login thành công và lưu cached copy theo approved SSO caching permission. Caching permission là hard prerequisite của solution hiện tại; chưa có non-caching fallback được Product approve. Staff avatar vẫn sử dụng local Media flow hiện tại.

PWv2 không runtime-fetch SSO trên mỗi page render. Khi SSO lỗi tạm thời, hệ thống giữ last-known Owner avatar; chỉ fallback về initials khi SSO xác nhận avatar absent/deleted.

## 5. Scope

### 5.1 In Scope

- Xem Personal Profile từ Global Top Header.
- Staff upload avatar local JPG/PNG tối đa 2 MB.
- Staff chỉnh First Name, Last Name, Phone; Email Read-only.
- Staff đổi password native theo validation hiện tại.
- Owner identity và avatar Read-only; CTA mở SSO management portal.
- Đồng bộ Owner avatar từ SSO bằng trusted integration flow.
- Webhook update/delete primary và login reconciliation fallback.
- Cached copy, one-time backfill, legacy Owner-local avatar retirement, idempotency và fallback behavior.
- Header/Profile consistency, tenant isolation, monitoring outcome và security review.

### 5.2 Out of Scope

- Cho Owner upload hoặc override avatar tại PWv2.
- Đồng bộ Staff avatar sang SSO.
- Runtime fetch SSO trên mỗi page render.
- Quản lý active devices/sessions UI.
- Staff role/permission management thuộc F19.
- Xóa account từ PWv2.
- Personal language settings thuộc F18/F21.
- Chốt endpoint, schema, storage algorithm hoặc retry implementation thay Architecture Contract.

## 6. Source-of-truth Matrix

| Role | Identity source | Avatar source | Local avatar mutation | Failure fallback |
|---|---|---|---|---|
| Owner | SSO | SSO authoritative; PWv2 cached copy theo approved SSO contract | Không | Transient failure giữ last-known; confirmed absent/delete dùng initials |
| Staff | PWv2 local | PWv2 local Media | Có | Initials nếu chưa upload hoặc ảnh lỗi |

## 7. Confirmed Product Decisions

| ID | Decision |
|---|---|
| PD-F23-01 | SSO là source of truth của Owner avatar; Staff avatar do PWv2 quản lý local |
| PD-F23-02 | Owner không upload, replace hoặc delete avatar local tại PWv2 |
| PD-F23-03 | PWv2 dùng cached copy thay vì runtime-fetch SSO trên mỗi page render; SSO caching permission là hard prerequisite. Nếu không được phép cache, Product phải quyết định lại solution |
| PD-F23-04 | Webhook update/delete là primary trigger; SSO Profile API reconciliation khi login thành công là fallback |
| PD-F23-05 | Propagation target là p95 không quá 5 phút |
| PD-F23-06 | Existing Owner được one-time backfill; account bị bỏ sót được reconciliation khi login |
| PD-F23-07 | Transient SSO failure giữ last-known avatar; confirmed absent/delete mới fallback về initials |

## 8. Success Metrics

| Metric | Target | Measured By |
|---|---|---|
| Owner avatar update/delete propagation | p95 ≤ 5 phút từ lúc SSO chấp nhận thay đổi đến lúc PWv2 hiển thị state mới | Correlated SSO event/API timestamp và PWv2 synchronization telemetry |
| Login reconciliation | Latest confirmed SSO avatar state được áp dụng trong successful login flow | Login reconciliation logs/metrics |
| Cross-user/cross-tenant avatar incident | 0 | Security incident và audit log |
| Transient failure làm mất last-known avatar | 0 | Error monitoring và QA resilience tests |
| Staff local avatar regression | 0 failed approved regression cases | F23 QA suite |
| Personal Profile page performance | Không regression so với approved baseline; không phụ thuộc runtime SSO call khi page render | Application performance monitoring |

## 9. Functional Requirements

| FR-ID | Requirement | Story Ref | Priority |
|---|---|---|---|
| FR-23-01 | Render Personal Profile và avatar đúng user/Role từ Header navigation | US-F23-01 | P0 |
| FR-23-02 | Staff upload local JPG/PNG tối đa 2 MB và cập nhật avatar trên các PWv2 surfaces | US-F23-01 | P0 |
| FR-23-03 | Owner avatar Read-only; không cung cấp local mutation và server-side authorization phải chặn mutation | US-F23-01, US-F23-05 | P0 |
| FR-23-04 | Staff sửa Name/Phone; Email Read-only | US-F23-02 | P0 |
| FR-23-05 | Owner identity Read-only và có CTA mở SSO portal | US-F23-03 | P0 |
| FR-23-06 | Staff đổi password native theo password policy | US-F23-04 | P0 |
| FR-23-07 | Ingest confirmed Owner avatar update/delete từ trusted SSO synchronization channel | US-F23-05 | P0 |
| FR-23-08 | Reconcile current Owner avatar với SSO Profile API khi successful login nếu webhook bị trễ/bỏ lỡ hoặc cache chưa có | US-F23-05 | P0 |
| FR-23-09 | Thực hiện one-time backfill cho Existing Owner, retire legacy Owner-local avatar theo confirmed SSO state và dùng login reconciliation cho account bị bỏ sót | US-F23-05 | P0 |
| FR-23-10 | Xử lý duplicate/out-of-order event idempotently, không rollback version mới | US-F23-05 | P0 |
| FR-23-11 | Giữ last-known avatar khi transient failure; xóa cached reference và dùng initials khi SSO confirmed absent/delete | US-F23-05 | P0 |
| FR-23-12 | Validate external avatar resource và bảo đảm immutable identity, tenant isolation, safe caching và observability | US-F23-05 | P0 |
| FR-23-13 | Chạy immutable SSO identity preflight trước avatar backfill; skip/quarantine/report account thiếu hoặc có mapping duplicate/ambiguous. Email chỉ được dùng một lần để gắn `sso_user_id` cho Owner chưa có id khi email khớp đúng 1 Owner chưa gắn (GH-1979) | US-F23-05 | P0 |
| FR-23-14 | Chuẩn hóa SSO avatar state thành `PRESENT`, `ABSENT` hoặc `UNKNOWN`; chỉ authenticated `ABSENT` mới cho phép purge | US-F23-05 | P0 |

## 10. Business Rules

- **BR-23-01 — Owner Identity Source:** First Name, Last Name, Email và Phone của Owner là Read-only tại PWv2. PWv2 không ghi ngược các field này về SSO từ Personal Profile.
- **BR-23-02 — Role-based Avatar Source:** Owner avatar do SSO quản lý authoritative; Staff avatar do PWv2 quản lý local. Quy tắc này supersede BR-23-02 `Avatar Independence` của PRD v1.2.
- **BR-23-03 — Owner Local Mutation Block:** Owner không được upload, replace hoặc delete avatar local qua UI hoặc API.
- **BR-23-04 — Stable Identity:** Mapping Owner phải dùng immutable SSO identifier như OIDC `sub` hoặc `sso_user_id`; email không phải primary mapping key. Owner tạo trước khi có `sso_user_id` được gắn id theo email ở lần sync đầu tiên, chỉ khi email khớp đúng 1 Owner chưa gắn id (SSO đảm bảo email là duy nhất qua unique index `users.email`); từ đó mapping dùng `sso_user_id` (GH-1979). Identity preflight phải chạy trước avatar backfill. Missing/duplicate/ambiguous mapping bị skip, quarantine và report mà không thay đổi avatar.
- **BR-23-05 — Trusted Update:** Chỉ confirmed event/API response từ trusted SSO integration flow mới được overwrite Owner cached avatar.
- **BR-23-06 — Idempotency and Ordering:** Duplicate event không tạo duplicate outcome; event/version cũ không overwrite avatar mới hơn.
- **BR-23-07 — Canonical State:** SSO avatar state được chuẩn hóa thành `PRESENT`, `ABSENT` hoặc `UNKNOWN`. `ABSENT` là authenticated explicit no-avatar/deletion state. Field omission, insufficient scope, timeout, invalid resource và uncontracted `null`/`404` là `UNKNOWN`; chỉ `ABSENT` mới cho phép purge.
- **BR-23-08 — Caching:** PWv2 lưu cached copy theo SSO permission và tuân thủ retention/deletion rule đã sign-off. Caching permission là hard prerequisite; không có runtime-fetch fallback được approve trong PRD này.
- **BR-23-09 — Staff Independence:** Owner synchronization không làm thay đổi Staff local avatar behavior.
- **BR-23-10 — Validation:** Mutation form phải được validate ở client và server; external avatar phải được kiểm tra format, size và security trước khi persist/render.
- **BR-23-11 — Integration Gate:** Nếu SSO không hỗ trợ field, immutable identity, authorized delivery, caching permission hoặc agreed SLA, Product phải quyết định lại; Dev không tự thay behavior.
- **BR-23-12 — Legacy Owner Avatar Migration:** Backfill phải thay thế legacy Owner-local avatar bằng current SSO avatar. Nếu SSO trả authenticated `ABSENT`, PWv2 retire legacy local reference, purge stored/derived/CDN copies trong approved retention limit và hiển thị initials.

## 11. User Flows

### 11.1 Staff Profile

```text
Header Avatar → My Profile → single-page Personal Profile
  → View/Upload local avatar
  → Edit Name/Phone → Validate → Save → Header/Profile/Staff Directory refresh
  → Security → Change Password → Validate → Update
```

### 11.2 Owner Profile

```text
Header Avatar → My Profile
  → View SSO-managed identity and cached SSO avatar as Read-only
  → Manage SSO Account → Open SSO portal in a new tab
```

### 11.3 Owner Avatar Synchronization

```text
Owner changes/deletes avatar in SSO
  → SSO confirms change
  → Primary: trusted webhook update/delete
  → PWv2 validates identity, event version and avatar resource
  → Update/remove cached reference
  → Header/Profile display new avatar or initials

If webhook is missed/delayed or cache is absent
  → Successful Owner login
  → SSO Profile API reconciliation
  → Apply latest confirmed state

If SSO is temporarily unavailable
  → Keep last-known avatar
  → Record failure and retry according to Architecture Contract
```

## 12. UI Requirements

### 12.1 Personal Information — Staff

- Avatar upload control hiển thị rõ allowed format/size.
- Email Read-only.
- First Name, Last Name và Phone editable.
- Inline validation và Toast success/error.

### 12.2 Single-page Profile — Owner

- Identity và avatar Read-only.
- Không hiển thị upload/replace/delete affordance cho avatar.
- Copy giải thích dữ liệu được quản lý bởi SSO.
- CTA `Manage SSO Account` mở tab mới.
- Khi không có confirmed avatar, hiển thị initials.
- Khi transient sync failure, tiếp tục hiển thị last-known avatar; không hiển thị broken image.

### 12.3 Password & Security

- Staff: Native password form.
- Owner: SSO information box và CTA tới SSO portal.

## 13. Acceptance Criteria

> Các AC dưới đây được copy nguyên văn từ [F23 Stories](../stories/F23-personal-profile-stories.md). Story file là canonical source khi refinement.

### Global Acceptance Criteria — CMS Layout Compliance

```gherkin
GIVEN user truy cập tính năng trong CMS
WHEN nội dung Personal Profile được render
THEN nội dung phải nằm gọn trong Main Content Area và tuân thủ F18-03
  AND Global Top Header (F18-02) và Global Sidebar Navigation (F18-01) vẫn hoạt động bình thường
  AND không che khuất hoặc re-render toàn bộ layout.
```

### US-F23-01 — View Profile and Manage Staff Avatar

#### AC-01.1 — Access Profile

```gherkin
GIVEN tôi đã đăng nhập vào CMS với Role Owner hoặc Staff
WHEN tôi click Avatar tại Global Top Header và chọn "My Profile"
THEN hệ thống điều hướng đến single-page Personal Profile tại `/settings/profile`
  AND hiển thị đúng dữ liệu của user hiện tại.
```

#### AC-01.2 — Staff Upload Avatar

```gherkin
GIVEN tôi đã đăng nhập với Role Staff và đang ở Personal Information section
WHEN tôi chọn một file avatar
THEN hệ thống chỉ chấp nhận JPG hoặc PNG có dung lượng không quá 2 MB
  AND từ chối file không hợp lệ kèm Toast error rõ ràng
  AND sau khi upload thành công, avatar mới được cập nhật ngay tại Profile, Header và Staff Directory.
```

#### AC-01.3 — Owner Avatar Is Read-only

```gherkin
GIVEN tôi đã đăng nhập với Role Owner
WHEN tôi xem single-page Personal Profile
THEN avatar được hiển thị ở trạng thái Read-only và lấy từ cached SSO avatar theo approved SSO Integration Contract
  AND PWv2 không hiển thị action upload, replace hoặc delete avatar local
  AND mọi request cố thay đổi Owner avatar qua local avatar mutation đều bị authorization từ chối và không làm thay đổi dữ liệu.
```

### US-F23-02 — Edit Personal Info (Staff Only)

#### AC-02.1 — Read-only and Editable Fields

```gherkin
GIVEN tôi đã đăng nhập với Role Staff
WHEN tôi xem Personal Information section
THEN Email là Read-only vì đây là login identity
  AND tôi có thể sửa First Name, Last Name và Phone Number.
```

#### AC-02.2 — Validation and Save

```gherkin
GIVEN tôi đã thay đổi thông tin cá nhân
WHEN tôi click "Save Changes"
THEN First Name và Last Name phải dài từ 2 đến 50 ký tự
  AND Phone Number phải có Country Code và hợp lệ theo region đã chọn
  AND dữ liệu không hợp lệ hiển thị inline error
  AND dữ liệu hợp lệ được lưu và hiển thị Success Toast.
```

### US-F23-03 — Redirect to SSO (Owner Only)

#### AC-03.1 — Owner Identity Is Read-only

```gherkin
GIVEN tôi đã đăng nhập với Role Owner
WHEN tôi xem single-page Personal Profile
THEN First Name, Last Name, Phone và Email ở trạng thái Read-only
  AND giao diện giải thích rằng các thông tin này được quản lý bởi SSO.
```

#### AC-03.2 — SSO Redirect

```gherkin
GIVEN tôi đang ở single-page Personal Profile với Role Owner
WHEN tôi click "Manage SSO Account"
THEN SSO management portal được mở trong browser tab mới.
```

### US-F23-04 — Change Password Native (Staff Only)

#### AC-04.1 — Password Form

```gherkin
GIVEN tôi đã đăng nhập với Role Staff
WHEN tôi mở Password & Security section và click "Change Password"
THEN hệ thống hiển thị Current Password, New Password và Confirm New Password.
```

#### AC-04.2 — Validation and Update

```gherkin
GIVEN tôi đã nhập đủ các trường mật khẩu
WHEN tôi click "Change Password"
THEN New Password phải có ít nhất 6 ký tự, gồm ít nhất một chữ hoa và một chữ số
  AND New Password phải khác Current Password
  AND Confirm New Password phải khớp chính xác
  AND nếu validation thành công, mật khẩu được cập nhật an toàn.
```

### US-F23-05 — Synchronize Owner Avatar from SSO

#### AC-05.1 — One-time Backfill and Legacy Owner Avatar Retirement

```gherkin
GIVEN một Owner hiện hữu thuộc phạm vi migration, bất kể hiện tại có hoặc không có avatar tại SSO
WHEN one-time backfill lấy được confirmed current SSO avatar state
THEN PWv2 chỉ xử lý Owner đã pass immutable SSO identity preflight
  AND nếu SSO confirmed có avatar, current SSO avatar thay thế mọi legacy Owner-local avatar reference, được cache theo approved permission và hiển thị tại Header và Personal Profile
  AND nếu SSO trả authenticated `ABSENT`, PWv2 retire legacy Owner-local avatar reference theo approved retention rule và hiển thị initials
  AND account bị bỏ sót trong batch được reconciliation ở lần login thành công tiếp theo.
```

#### AC-05.2 — Avatar Update Propagation

```gherkin
GIVEN một Owner đã liên kết đúng với SSO account
WHEN SSO xác nhận avatar của Owner được cập nhật
THEN PWv2 xử lý synchronization event hợp lệ
  AND cập nhật cached avatar tại Header và Personal Profile
  AND tối thiểu 95% thay đổi được hiển thị trong không quá 5 phút tính từ thời điểm SSO chấp nhận thay đổi.
```

#### AC-05.3 — Login Reconciliation

```gherkin
GIVEN webhook update bị trễ, bị bỏ lỡ hoặc cached avatar chưa tồn tại
WHEN Owner hoàn tất login thành công vào PWv2
THEN PWv2 reconciliation với SSO Profile API bằng immutable SSO identifier
  AND áp dụng SSO avatar state mới nhất nhận được trong login flow
  AND nếu reconciliation thất bại, login tiếp tục bằng last-known avatar state mà không bị fail hoặc delay không giới hạn
  AND không yêu cầu runtime fetch SSO trên mỗi lần render page.
```

#### AC-05.4 — Confirmed Avatar Deletion

```gherkin
GIVEN PWv2 đang có cached avatar của Owner
WHEN SSO trả về authenticated `ABSENT` state theo contract hợp lệ
THEN PWv2 purge cached media reference, stored object và derived/CDN copies trong approved retention limit
  AND Header và Personal Profile fallback về initials trong propagation SLA
  AND không ảnh hưởng avatar của user khác.
```

#### AC-05.5 — Transient SSO Failure

```gherkin
GIVEN PWv2 không thể gọi SSO, nhận field omission, insufficient scope, timeout, uncontracted `null`/`404` hoặc lỗi tạm thời khi synchronization
WHEN state được phân loại là `UNKNOWN` và chưa có authenticated `ABSENT` state từ SSO
THEN PWv2 tiếp tục hiển thị last-known Owner avatar
  AND không xóa cached avatar hoặc thay bằng avatar của user khác
  AND không chặn successful login chỉ vì avatar reconciliation thất bại
  AND ghi nhận trạng thái lỗi để retry và monitoring theo Architecture Contract.
```

#### AC-05.6 — Duplicate and Out-of-order Events

```gherkin
GIVEN PWv2 nhận duplicate event hoặc event cũ đến sau event mới
WHEN synchronization event được xử lý
THEN việc xử lý phải idempotent
  AND event cũ không được overwrite avatar version mới hơn
  AND không tạo duplicate cached media ngoài lifecycle rule đã duyệt.
```

#### AC-05.7 — Invalid, Expired or Unsafe Avatar Resource

```gherkin
GIVEN SSO trả về avatar URL hoặc file bị expired, broken, sai format hoặc không an toàn
WHEN PWv2 validate hoặc tải avatar
THEN PWv2 không render hoặc persist nội dung không hợp lệ
  AND phân loại kết quả là `UNKNOWN` và giữ last-known avatar
  AND chỉ fallback về initials khi authenticated `ABSENT` state được SSO xác nhận
  AND không để avatar resource truy cập private network hoặc dữ liệu của tenant khác.
```

#### AC-05.8 — Stable Identity and Tenant Isolation

```gherkin
GIVEN email, phone hoặc company information của Owner có thể thay đổi
WHEN PWv2 map SSO avatar vào local user
THEN mapping sử dụng immutable SSO identifier như OIDC sub hoặc sso_user_id
  AND không dùng email làm primary mapping key
  AND avatar chỉ được gắn vào đúng user và đúng tenant.
```

#### AC-05.9 — Owner and Staff Source-of-truth Separation

```gherkin
GIVEN PWv2 có cả Owner và Staff account
WHEN avatar được đọc hoặc thay đổi
THEN Owner avatar chỉ được cập nhật từ trusted SSO synchronization flow
  AND Owner không thể upload, replace hoặc delete avatar local
  AND Staff tiếp tục sử dụng local avatar flow hiện có mà không bị regression.
```

#### AC-05.10 — Immutable Identity Backfill Safety

```gherkin
GIVEN một Existing Owner thiếu immutable SSO identifier hoặc có mapping duplicate/ambiguous
WHEN identity preflight chạy trước avatar backfill hoặc reconciliation
THEN PWv2 skip và quarantine account đó khỏi avatar mutation
  AND không fallback sang email, phone hoặc mutable profile field để mapping
  AND không thay đổi legacy hoặc cached avatar hiện tại
  AND ghi account vào exception report để SSO/Operations xử lý
  AND chỉ retry avatar sync sau khi unique immutable mapping được confirmed.
```

#### AC-05.11 — Canonical Avatar State Semantics

```gherkin
GIVEN PWv2 nhận SSO avatar event hoặc Profile API response
WHEN hệ thống diễn giải avatar state
THEN state phải được chuẩn hóa thành `PRESENT`, `ABSENT` hoặc `UNKNOWN`
  AND `PRESENT` chỉ được áp dụng khi identity, authorization và avatar resource đều hợp lệ
  AND `ABSENT` chỉ được áp dụng từ authenticated explicit no-avatar hoặc deletion signal đã được SSO contract định nghĩa
  AND field omission, insufficient scope, timeout, invalid resource và uncontracted `null` hoặc `404` phải là `UNKNOWN`
  AND `UNKNOWN` không được purge hoặc overwrite last-known avatar.
```

## 14. Non-functional Requirements

| Category | Requirement |
|---|---|
| Performance | Page render không gọi SSO synchronously; propagation p95 ≤ 5 phút |
| Availability | Transient SSO failure không làm mất last-known avatar, không chặn login và không chặn việc xem Profile |
| Security | Authenticate SSO event/API; chống replay; không fetch private-network resource; validate content type/size; không log secret hoặc sensitive signed URL |
| Privacy | Confirmed `ABSENT` phải purge cached reference, stored object và derived/CDN copies trong retention limit do Privacy sign-off; `UNKNOWN` không được purge |
| Isolation | Avatar chỉ được map vào đúng immutable user identity và tenant |
| Reliability | Event handling idempotent và version-aware; có retry/dead-letter/recovery outcome trong Architecture Contract |
| Observability | Có correlation giữa SSO event/API call và PWv2 sync result; theo dõi latency, success/failure và stale cache |
| Compatibility | Staff local avatar flow không regression |

## 15. SSO Contract Questions and Dependencies

Canonical questionnaire: [`plans/260908-gh-1723-sso-owner-avatar/sso-integration-questionnaire.md`](../../plans/260908-gh-1723-sso-owner-avatar/sso-integration-questionnaire.md).

Các nhóm bắt buộc phải có written answer:

1. Canonical avatar field và environment availability.
2. Immutable SSO identity và user/tenant mapping.
3. Avatar URL/file format, expiry và caching permission.
4. Webhook/Profile API capability, schema và deletion semantics.
5. Authentication, replay protection, retry, rate limit và operational owner.
6. Khả năng đáp ứng p95 ≤ 5 phút.
7. One-time backfill access, Staging endpoint, fixtures và test accounts.

### 15.1 Identifier and QA Namespace

- Repository hiện có legacy feature-code collision: Personal Profile và Custom Subdomain cùng dùng mã F23. PR này không tự renumber feature vì ảnh hưởng rộng; PM/Product Governance phải xử lý bằng quyết định riêng.
- Existing QA IDs `TC-F23-05-01..09` đã được dùng cho Role Guard và không được tái sử dụng cho US-F23-05.
- QA cases mới của SSO Owner Avatar phải dùng namespace `TC-F23-SSO-01..11` cho đến khi feature-code collision được giải quyết.

## 16. Delivery and Ownership

| Deliverable | Accountable owner | Required reviewers |
|---|---|---|
| Product behavior, Stories, PRD, Issue | PO/BA | Business, QA |
| SSO Integration Contract | SSO Product/Integration owner | PWv2 Tech Lead, Security |
| Architecture Document | PWv2 Tech Lead/Solution Architect | SSO, DevOps, Security, QA |
| Owner/Staff UI states | UI/UX | PO/BA, QA |
| QA matrix and E2E plan | QA | PO/BA, Dev, SSO test owner |
| Estimate and sprint assignment | Dev/Delivery | Tech Lead, PO/BA |

## 17. Definition of Ready

- [x] Bảy Product decisions tại Section 7 được PO/BA chốt.
- [x] US-F23-01 được sửa và US-F23-05 được tạo theo Stories-First Rule.
- [x] PRD traceability và BR-23-02 được đồng bộ với Stories.
- [ ] Written SSO Integration Contract và sample payload được sign-off.
- [ ] Immutable identity, avatar format, caching permission và delete semantics được xác nhận.
- [ ] SSO xác nhận webhook/Profile API, authentication, retry, rate limit và SLA capability.
- [ ] Backfill access, Staging endpoint và test fixtures sẵn sàng.
- [ ] Architecture Document được Tech Lead approve.
- [ ] Security/Privacy, UI/UX và QA review hoàn tất.
- [ ] Dev gap analysis và re-estimate hoàn tất.
- [ ] Issue #1723 được gán milestone/iteration hiện hành bởi PM/Delivery.

## 18. Definition of Done

- [ ] Tất cả Acceptance Criteria của US-F23-01 đến US-F23-05 pass.
- [ ] Automated/E2E và manual cross-system tests pass trên Staging.
- [ ] p95 propagation SLA được chứng minh bằng telemetry/test evidence.
- [ ] Backfill report xác nhận Existing Owner được xử lý và có retry path cho failure.
- [ ] Security/Privacy controls và audit evidence được sign-off.
- [ ] Staff avatar/profile/password regression suite pass.
- [ ] QA sign-off trước khi Issue #1723 được đóng.

## 19. Revision History

| Version | Date | Summary |
|---|---|---|
| 1.2 | 2026-03-26 | Baseline Personal Profile cho Owner/Staff; avatar được mô tả độc lập SSO |
| 1.3 | 2026-09-08 | Thay avatar contract theo Role; thêm SSO synchronization, backfill, SLA, fallback, security và readiness gates cho Issue #1723 |
| 1.4 | 2026-10-22 | BR-23-04 / FR-23-13: cho phép gắn `sso_user_id` theo email ở lần sync đầu cho Owner cũ (PO/BA đã xác nhận, Issue #1979) |
