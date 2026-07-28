# Test Cases — F23 Personal Profile (Team & Account)

> **Status:** Automated (unit + Playwright) — browser regression added for GH-1614 review findings
> **Screen:** Settings → Team & Account (`src/app/(dashboard)/settings/profile/`)
> **Refs:** PRD `docs/prd/F23-personal-profile.md` · Stories `docs/stories/F23-personal-profile-stories.md` (US-F23-01..04) · GH #1604
> ⚠️ **Số F23 bị trùng** với `F23-custom-subdomain-slug` (feature khác, PRD/QA riêng). TC-ID của doc này luôn có ngữ cảnh profile.

---

## Test Case Matrix

TC-ID scheme: `TC-F23-{US}-{seq}`. ⚠️ Một số seq bị **trùng ID khác nghĩa giữa 2 file** (đánh dấu ♻ — nợ pre-existing, không renumber để khỏi phá git blame; TC mới PHẢI tra bảng này trước khi lấy số).

### US-F23-01 — Avatar & profile read

| TC-ID | File | Description | AUTO |
|-------|------|-------------|------|
| TC-F23-01-01 | `api-users-me.test.ts` | GET /users/me — unauthorized khi chưa login | ✓ |
| TC-F23-01-02 ♻ | `api-users-me.test.ts` | GET trả profile, không lộ sensitive fields | ✓ |
| TC-F23-01-02 ♻ | `api-users-me-avatar.test.ts` | POST avatar — unauthorized khi chưa login | ✓ |
| TC-F23-01-03..07 | `api-users-me-avatar.test.ts` | Size limit, MIME (GIF reject), missing file, Payload integration, response format | ✓ |

### US-F23-02 — Edit Personal Info (Staff)

| TC-ID | File | Description | AUTO |
|-------|------|-------------|------|
| TC-F23-02-01 ♻ | `general-info-tab.test.tsx` | Staff thấy inputs editable; inline action bar chỉ hiện khi dirty (Cancel resets) | ✓ |
| TC-F23-02-01 ♻ | `api-users-me.test.ts` | PATCH — unauthorized khi chưa login | ✓ |
| TC-F23-02-02 ♻ | `general-info-tab.test.tsx` + `tests/f23-profile-regression.spec.ts` | Email luôn readonly; browser xác nhận icon lock không bị clip trên desktop/mobile | ✓ |
| TC-F23-02-02 ♻ | `api-users-me.test.ts` | PATCH — forbidden với owner (SSO managed) | ✓ |
| TC-F23-02-03 ♻ | `general-info-tab.test.tsx` | Submit hợp lệ → onUserUpdate + success toast | ✓ |
| TC-F23-02-03 ♻ | `api-users-me.test.ts` | PATCH — bad request khi phone sai | ✓ |
| TC-F23-02-04 | `api-users-me.test.ts` | PATCH — success với data hợp lệ | ✓ |
| **TC-F23-02-05** | `general-info-tab.test.tsx` | Error toast khi submit thất bại (server error / network error) | ✓ |
| **TC-F23-02-06** | `general-info-tab.test.tsx` | Cancel → reset form về giá trị cũ + ẩn action bar | ✓ |
| **TC-F23-02-07** | `phone-input.test.tsx` | GH-1604: trigger chọn quốc gia hiện **đúng 1** cờ 🇲🇾 + `+60 MY` | ✓ |
| **TC-F23-02-08** | `phone-input.test.tsx` | GH-1604: value +84 → đúng 1 cờ 🇻🇳, không lẫn cờ MY | ✓ |
| **TC-F23-02-09** | `phone-input.test.tsx` | Value không có mã quốc gia → fallback +60, vẫn 1 cờ | ✓ |

> ⚠️ P4 xoá owner branch khỏi `GeneralInfoTab` (props chỉ còn `{ user, onUserUpdate }`) → TC-F23-02-05/06/TC-F23-03-01 bản cũ (SsoGuardBox trong general-info-tab) không còn áp dụng, đã thay bằng TC mới ở trên + US-F23-03 dưới.

### US-F23-03 — SSO redirect (Owner) — read-only single page (F23 GH-1614 P4)

| TC-ID | File | Description | AUTO |
|-------|------|-------------|------|
| **TC-F23-03-01** | `owner-profile-view.test.tsx` | 0 `<input>`/`<textarea>` trong DOM — hoàn toàn read-only | ✓ |
| **TC-F23-03-02** | `owner-profile-view.test.tsx` | Đúng 1 SSO CTA `target="_blank"`, href = `ssoUrl` prop | ✓ |
| **TC-F23-03-03** | `owner-profile-view.test.tsx` | `ssoUrl=""` → CTA disabled-look span + `urlMissing` text, không phải `<a>` | ✓ |
| **TC-F23-03-04** | `owner-profile-view.test.tsx` + `tests/f23-profile-regression.spec.ts` | Không hiển thị nhãn/status 2FA khi SSO chưa cung cấp trạng thái xác thực, trên desktop/mobile | ✓ |
| **TC-F23-03-05** | `owner-profile-view.test.tsx` | Password hiển thị dạng dots (masked), email/phone hiển thị đúng giá trị | ✓ |
| ~~TC-F23-03-02..05~~ | ~~`sso-guard-box.test.tsx`~~ | Xoá cùng component ở P5 (`SsoGuardBox` không còn importer) | — |

### US-F23-04 — Change Password (Staff) + schema validation

| TC-ID | File | Description | AUTO |
|-------|------|-------------|------|
| TC-F23-04-01..12 | `schemas.test.ts` | profilePatchSchema: name bounds, phone format/length/E.164 | ✓ |
| TC-F23-04-13 ♻ | `schemas.test.ts` | Password hợp lệ pass schema | ✓ |
| TC-F23-04-13 ♻ | `api-users-me-password.test.ts` | POST password — unauthorized | ✓ |
| TC-F23-04-14 ♻ | `schemas.test.ts` / `api-users-me-password.test.ts` | Password <8 ký tự / forbidden với owner | ✓ |
| TC-F23-04-15 ♻ | `schemas.test.ts` / `api-users-me-password.test.ts` | Thiếu uppercase / bad request password yếu | ✓ |
| TC-F23-04-16 ♻ | `api-users-me-password.test.ts` | Current password sai → unauthorized (backend) | ✓ |
| TC-F23-04-16 ♻ | `password-change-form.test.tsx` | Current password sai (401) → inline error, không collapse (component) | ✓ |
| TC-F23-04-17 ♻ | `schemas.test.ts` / `api-users-me-password.test.ts` | Thiếu digit / success đổi password | ✓ |
| TC-F23-04-19..23 | `schemas.test.ts` | currentPassword bounds; phone optional/code-only/omitted | ✓ |
| **TC-F23-04-24** | `security-tab.test.tsx` | Card collapsed mặc định: summary line + "Change Password" button, không có form | ✓ |
| **TC-F23-04-25** | `security-tab.test.tsx` | Click "Change Password" → expand hiện `PasswordChangeForm` | ✓ |
| **TC-F23-04-26** | `security-tab.test.tsx` | `onDone`/`onCancel` từ form → card collapse lại | ✓ |
| **TC-F23-04-27** | `password-change-form.test.tsx` | Action bar (Cancel + Update Password) luôn hiện, kể cả form pristine (không cần dirty) | ✓ |
| **TC-F23-04-28** | `password-change-form.test.tsx` | Update Password disabled khi còn field trống; enable khi đủ 3 field | ✓ |
| **TC-F23-04-29** | `password-change-form.test.tsx` | Cancel → reset form + gọi `onCancel` | ✓ |
| **TC-F23-04-30** | `password-change-form.test.tsx` | Submit hợp lệ → POST thành công, toast + `onDone` | ✓ |

### Role guard (cross-US)

| TC-ID | File | Description | AUTO |
|-------|------|-------------|------|
| TC-F23-05-01..09 | `role-guard.test.ts` | Owner detection qua tenant role (incl. GH-905 regression), 403 owner, null staff | ✓ |
| **TC-F23-05-10** | `e2e-profile-bypass.test.ts` + `e2e-ensure-test-user.test.ts` | E2E Profile chỉ cho phép Owner/Staff identity chuyên dụng; Staff fixture không mang Owner role | ✓ |
| **TC-F23-05-11** | `e2e-ensure-test-user.test.ts` | E2E provisioning từ chối identity fields sai kiểu trước khi gọi Payload | ✓ |

---

## Manual / eyeball checklist (chưa auto)

| Item | Trạng thái |
|------|-----------|
| Save bar không che content đáy form khi dirty (pb-24, GH-1538 pattern) | ☐ light ☐ dark |
| Phone trigger 320px mobile không tràn | ☐ |
| Emoji cờ render sạch trong trigger h-9 (Noto Color Emoji) | ☐ |
| Đổi tab khi dirty → mất edits KHÔNG cảnh báo — guard spec'd (key `profile.errors.unsavedChanges`) nhưng chưa wire | 🔴 known gap, chưa có issue |

## Unresolved

- Trùng số feature F23 (profile vs subdomain) — cần PM chốt renumber hay chấp nhận.
- Các cặp TC-ID ♻ trùng số khác nghĩa — chờ đợt refactor test đánh lại.
