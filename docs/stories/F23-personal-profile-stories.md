# F23 Personal Profile — User Stories

> **Epic:** User Management & Security
> **Feature Code:** F23
> **Status:** PO/BA Approved — Integration Refinement
> **Updated:** 2026-09-08
> **Related Issue:** [#1723](https://github.com/primeproduction/ech-prime-web-v2/issues/1723)

## Feature Overview

Cung cấp khu vực riêng để người dùng đã đăng nhập quản lý hồ sơ và bảo mật mà không ảnh hưởng Store Configuration. Avatar được quản lý theo Role: SSO là source of truth của Store Owner; PWv2 là source of truth của Staff.

> [!IMPORTANT]
> US-F23-05 đã được PO/BA chốt về Product behavior nhưng chưa Ready for Development. Story còn phụ thuộc written SSO Integration Contract, Architecture, Security, Design và QA review.

---

## Global Acceptance Criteria — CMS Layout Compliance

Áp dụng cho mọi User Story trong file này.

```gherkin
GIVEN user truy cập tính năng trong CMS
WHEN nội dung Personal Profile được render
THEN nội dung phải nằm gọn trong Main Content Area và tuân thủ F18-03
  AND Global Top Header (F18-02) và Global Sidebar Navigation (F18-01) vẫn hoạt động bình thường
  AND không che khuất hoặc re-render toàn bộ layout.
```

---

## Story Index

| Story ID | Title | Status | Priority |
|---|---|---|---|
| US-F23-01 | View Profile and Manage Staff Avatar | PO/BA Approved — Revised | P0 |
| US-F23-02 | Edit Personal Info (Staff Only) | Existing Baseline | P0 |
| US-F23-03 | Redirect to SSO (Owner Only) | Existing Baseline | P0 |
| US-F23-04 | Change Password Native (Staff Only) | Existing Baseline | P0 |
| US-F23-05 | Synchronize Owner Avatar from SSO | Refinement — Blocked by SSO Contract | P0 |

---

## User Stories

### US-F23-01: View Profile and Manage Staff Avatar

**As an** Authenticated User
**I want to** xem hồ sơ và avatar đúng theo Role của mình
**So that** tài khoản dễ nhận diện mà không tạo ra hai source of truth.

#### Acceptance Criteria

##### AC-01.1 — Access Profile

```gherkin
GIVEN tôi đã đăng nhập vào CMS với Role Owner hoặc Staff
WHEN tôi click Avatar tại Global Top Header và chọn "My Profile"
THEN hệ thống điều hướng đến single-page Personal Profile tại `/settings/profile`
  AND hiển thị đúng dữ liệu của user hiện tại.
```

##### AC-01.2 — Staff Upload Avatar

```gherkin
GIVEN tôi đã đăng nhập với Role Staff và đang ở Personal Information section
WHEN tôi chọn một file avatar
THEN hệ thống chỉ chấp nhận JPG hoặc PNG có dung lượng không quá 2 MB
  AND từ chối file không hợp lệ kèm Toast error rõ ràng
  AND sau khi upload thành công, avatar mới được cập nhật ngay tại Profile, Header và Staff Directory.
```

##### AC-01.3 — Owner Avatar Is Read-only

```gherkin
GIVEN tôi đã đăng nhập với Role Owner
WHEN tôi xem single-page Personal Profile
THEN avatar được hiển thị ở trạng thái Read-only và lấy từ cached SSO avatar theo approved SSO Integration Contract
  AND PWv2 không hiển thị action upload, replace hoặc delete avatar local
  AND mọi request cố thay đổi Owner avatar qua local avatar mutation đều bị authorization từ chối và không làm thay đổi dữ liệu.
```

---

### US-F23-02: Edit Personal Info (Staff Only)

**As a** Staff User
**I want to** chỉnh sửa thông tin cá nhân cơ bản
**So that** thông tin liên hệ của tôi luôn chính xác.

#### Acceptance Criteria

##### AC-02.1 — Read-only and Editable Fields

```gherkin
GIVEN tôi đã đăng nhập với Role Staff
WHEN tôi xem Personal Information section
THEN Email là Read-only vì đây là login identity
  AND tôi có thể sửa First Name, Last Name và Phone Number.
```

##### AC-02.2 — Validation and Save

```gherkin
GIVEN tôi đã thay đổi thông tin cá nhân
WHEN tôi click "Save Changes"
THEN First Name và Last Name phải dài từ 2 đến 50 ký tự
  AND Phone Number phải có Country Code và hợp lệ theo region đã chọn
  AND dữ liệu không hợp lệ hiển thị inline error
  AND dữ liệu hợp lệ được lưu và hiển thị Success Toast.
```

---

### US-F23-03: Redirect to SSO (Owner Only)

**As a** Store Owner
**I want to** biết dữ liệu nào do SSO quản lý và nơi có thể thay đổi dữ liệu đó
**So that** tôi hiểu lý do không thể chỉnh sửa trực tiếp tại PWv2.

#### Acceptance Criteria

##### AC-03.1 — Owner Identity Is Read-only

```gherkin
GIVEN tôi đã đăng nhập với Role Owner
WHEN tôi xem single-page Personal Profile
THEN First Name, Last Name, Phone và Email ở trạng thái Read-only
  AND giao diện giải thích rằng các thông tin này được quản lý bởi SSO.
```

##### AC-03.2 — SSO Redirect

```gherkin
GIVEN tôi đang ở single-page Personal Profile với Role Owner
WHEN tôi click "Manage SSO Account"
THEN SSO management portal được mở trong browser tab mới.
```

---

### US-F23-04: Change Password Native (Staff Only)

**As a** Staff User
**I want to** đổi mật khẩu trực tiếp trong PWv2
**So that** tôi có thể bảo vệ tài khoản khi cần.

#### Acceptance Criteria

##### AC-04.1 — Password Form

```gherkin
GIVEN tôi đã đăng nhập với Role Staff
WHEN tôi mở Password & Security section và click "Change Password"
THEN hệ thống hiển thị Current Password, New Password và Confirm New Password.
```

##### AC-04.2 — Validation and Update

```gherkin
GIVEN tôi đã nhập đủ các trường mật khẩu
WHEN tôi click "Change Password"
THEN New Password phải có ít nhất 6 ký tự, gồm ít nhất một chữ hoa và một chữ số
  AND New Password phải khác Current Password
  AND Confirm New Password phải khớp chính xác
  AND nếu validation thành công, mật khẩu được cập nhật an toàn.
```

---

### US-F23-05: Synchronize Owner Avatar from SSO

**As a** Store Owner
**I want to** thấy cùng một avatar tại SSO và PWv2
**So that** hồ sơ nhất quán và tôi không phải cập nhật ảnh ở hai hệ thống.

#### Product Contract

- SSO là authoritative source của Owner avatar.
- Webhook update/delete là primary synchronization trigger.
- SSO Profile API reconciliation khi login thành công là fallback.
- PWv2 lưu cached copy; caching permission từ SSO là hard prerequisite cho solution hiện tại.
- Target propagation SLA là p95 không quá 5 phút.
- Existing Owner được one-time backfill; account bị bỏ sót được xử lý khi login.
- Transient SSO failure giữ last-known avatar; confirmed deletion mới fallback về initials.
- Immutable SSO identity preflight phải hoàn tất trước avatar backfill; missing/duplicate/ambiguous mapping bị skip và quarantine, không fallback sang email.
- SSO avatar state phải được chuẩn hóa thành `PRESENT`, `ABSENT` hoặc `UNKNOWN`; `ABSENT` là explicit state cho avatar không tồn tại hoặc đã bị xóa, và chỉ authenticated `ABSENT` mới cho phép purge.

#### Acceptance Criteria

##### AC-05.1 — One-time Backfill and Legacy Owner Avatar Retirement

```gherkin
GIVEN một Owner hiện hữu thuộc phạm vi migration, bất kể hiện tại có hoặc không có avatar tại SSO
WHEN one-time backfill lấy được confirmed current SSO avatar state
THEN PWv2 chỉ xử lý Owner đã pass immutable SSO identity preflight
  AND nếu SSO confirmed có avatar, current SSO avatar thay thế mọi legacy Owner-local avatar reference, được cache theo approved permission và hiển thị tại Header và Personal Profile
  AND nếu SSO trả authenticated `ABSENT`, PWv2 retire legacy Owner-local avatar reference theo approved retention rule và hiển thị initials
  AND account bị bỏ sót trong batch được reconciliation ở lần login thành công tiếp theo.
```

##### AC-05.2 — Avatar Update Propagation

```gherkin
GIVEN một Owner đã liên kết đúng với SSO account
WHEN SSO xác nhận avatar của Owner được cập nhật
THEN PWv2 xử lý synchronization event hợp lệ
  AND cập nhật cached avatar tại Header và Personal Profile
  AND tối thiểu 95% thay đổi được hiển thị trong không quá 5 phút tính từ thời điểm SSO chấp nhận thay đổi.
```

##### AC-05.3 — Login Reconciliation

```gherkin
GIVEN webhook update bị trễ, bị bỏ lỡ hoặc cached avatar chưa tồn tại
WHEN Owner hoàn tất login thành công vào PWv2
THEN PWv2 reconciliation với SSO Profile API bằng immutable SSO identifier
  AND áp dụng SSO avatar state mới nhất nhận được trong login flow
  AND nếu reconciliation thất bại, login tiếp tục bằng last-known avatar state mà không bị fail hoặc delay không giới hạn
  AND không yêu cầu runtime fetch SSO trên mỗi lần render page.
```

##### AC-05.4 — Confirmed Avatar Deletion

```gherkin
GIVEN PWv2 đang có cached avatar của Owner
WHEN SSO trả về authenticated `ABSENT` state theo contract hợp lệ
THEN PWv2 purge cached media reference, stored object và derived/CDN copies trong approved retention limit
  AND Header và Personal Profile fallback về initials trong propagation SLA
  AND không ảnh hưởng avatar của user khác.
```

##### AC-05.5 — Transient SSO Failure

```gherkin
GIVEN PWv2 không thể gọi SSO, nhận field omission, insufficient scope, timeout, uncontracted `null`/`404` hoặc lỗi tạm thời khi synchronization
WHEN state được phân loại là `UNKNOWN` và chưa có authenticated `ABSENT` state từ SSO
THEN PWv2 tiếp tục hiển thị last-known Owner avatar
  AND không xóa cached avatar hoặc thay bằng avatar của user khác
  AND không chặn successful login chỉ vì avatar reconciliation thất bại
  AND ghi nhận trạng thái lỗi để retry và monitoring theo Architecture Contract.
```

##### AC-05.6 — Duplicate and Out-of-order Events

```gherkin
GIVEN PWv2 nhận duplicate event hoặc event cũ đến sau event mới
WHEN synchronization event được xử lý
THEN việc xử lý phải idempotent
  AND event cũ không được overwrite avatar version mới hơn
  AND không tạo duplicate cached media ngoài lifecycle rule đã duyệt.
```

##### AC-05.7 — Invalid, Expired or Unsafe Avatar Resource

```gherkin
GIVEN SSO trả về avatar URL hoặc file bị expired, broken, sai format hoặc không an toàn
WHEN PWv2 validate hoặc tải avatar
THEN PWv2 không render hoặc persist nội dung không hợp lệ
  AND phân loại kết quả là `UNKNOWN` và giữ last-known avatar
  AND chỉ fallback về initials khi authenticated `ABSENT` state được SSO xác nhận
  AND không để avatar resource truy cập private network hoặc dữ liệu của tenant khác.
```

##### AC-05.8 — Stable Identity and Tenant Isolation

```gherkin
GIVEN email, phone hoặc company information của Owner có thể thay đổi
WHEN PWv2 map SSO avatar vào local user
THEN mapping sử dụng immutable SSO identifier như OIDC sub hoặc sso_user_id
  AND không dùng email làm primary mapping key
  AND avatar chỉ được gắn vào đúng user và đúng tenant.
```

##### AC-05.9 — Owner and Staff Source-of-truth Separation

```gherkin
GIVEN PWv2 có cả Owner và Staff account
WHEN avatar được đọc hoặc thay đổi
THEN Owner avatar chỉ được cập nhật từ trusted SSO synchronization flow
  AND Owner không thể upload, replace hoặc delete avatar local
  AND Staff tiếp tục sử dụng local avatar flow hiện có mà không bị regression.
```

##### AC-05.10 — Immutable Identity Backfill Safety

```gherkin
GIVEN một Existing Owner thiếu immutable SSO identifier hoặc có mapping duplicate/ambiguous
WHEN identity preflight chạy trước avatar backfill hoặc reconciliation
THEN PWv2 skip và quarantine account đó khỏi avatar mutation
  AND không fallback sang email, phone hoặc mutable profile field để mapping
  AND không thay đổi legacy hoặc cached avatar hiện tại
  AND ghi account vào exception report để SSO/Operations xử lý
  AND chỉ retry avatar sync sau khi unique immutable mapping được confirmed.
```

##### AC-05.11 — Canonical Avatar State Semantics

```gherkin
GIVEN PWv2 nhận SSO avatar event hoặc Profile API response
WHEN hệ thống diễn giải avatar state
THEN state phải được chuẩn hóa thành `PRESENT`, `ABSENT` hoặc `UNKNOWN`
  AND `PRESENT` chỉ được áp dụng khi identity, authorization và avatar resource đều hợp lệ
  AND `ABSENT` chỉ được áp dụng từ authenticated explicit no-avatar hoặc deletion signal đã được SSO contract định nghĩa
  AND field omission, insufficient scope, timeout, invalid resource và uncontracted `null` hoặc `404` phải là `UNKNOWN`
  AND `UNKNOWN` không được purge hoặc overwrite last-known avatar.
```

## Dependency and Readiness

US-F23-05 chỉ được chuyển sang `Ready for Development` khi có đủ:

- Written SSO Integration Contract và sample payload.
- Immutable identity, avatar field/format, update/delete semantics và caching permission.
- Webhook/Profile API authentication, retry, rate limit và propagation SLA support.
- Backfill access, Staging endpoint và test account/fixtures.
- Identity preflight và `PRESENT`/`ABSENT`/`UNKNOWN` semantics được Architecture/QA map thành testable contract.
- QA dành namespace `TC-F23-SSO-01..11` cho US-F23-05; không dùng lại legacy `TC-F23-05-01..09` của Role Guard.
- Tech Lead Architecture review.
- Security/Privacy, UI/UX và QA sign-off.
- Dev gap analysis và estimate cập nhật.
