# Test Cases — F23 Personal Profile (Team & Account)

> **Status:** Automated (unit) — backfilled 2026-07-14; tests existed before this doc
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
| TC-F23-02-01 ♻ | `general-info-tab.test.tsx` | Staff thấy inputs editable; save bar chỉ hiện khi dirty (kèm indicator "Unsaved changes") | ✓ |
| TC-F23-02-01 ♻ | `api-users-me.test.ts` | PATCH — unauthorized khi chưa login | ✓ |
| TC-F23-02-02 ♻ | `general-info-tab.test.tsx` | Email luôn readonly | ✓ |
| TC-F23-02-02 ♻ | `api-users-me.test.ts` | PATCH — forbidden với owner (SSO managed) | ✓ |
| TC-F23-02-03 ♻ | `general-info-tab.test.tsx` | Submit hợp lệ → onUserUpdate + success toast | ✓ |
| TC-F23-02-03 ♻ | `api-users-me.test.ts` | PATCH — bad request khi phone sai | ✓ |
| TC-F23-02-04 | `api-users-me.test.ts` | PATCH — success với data hợp lệ | ✓ |
| TC-F23-02-05 | `general-info-tab.test.tsx` | Owner thấy SsoGuardBox + notice | ✓ |
| TC-F23-02-06 | `general-info-tab.test.tsx` | Staff không thấy SsoGuardBox | ✓ |
| **TC-F23-02-07** | `phone-input.test.tsx` | GH-1604: trigger chọn quốc gia hiện **đúng 1** cờ 🇲🇾 + `+60 MY` | ✓ |
| **TC-F23-02-08** | `phone-input.test.tsx` | GH-1604: value +84 → đúng 1 cờ 🇻🇳, không lẫn cờ MY | ✓ |
| **TC-F23-02-09** | `phone-input.test.tsx` | Value không có mã quốc gia → fallback +60, vẫn 1 cờ | ✓ |

### US-F23-03 — SSO redirect (Owner)

| TC-ID | File | Description | AUTO |
|-------|------|-------------|------|
| TC-F23-03-01 | `general-info-tab.test.tsx` | Owner → SsoGuardBox, không có input | ✓ |
| TC-F23-03-02..05 | `sso-guard-box.test.tsx` | Anchor attrs với SSO URL, span khi thiếu URL, notice luôn hiện, security variant | ✓ |

### US-F23-04 — Change Password (Staff) + schema validation

| TC-ID | File | Description | AUTO |
|-------|------|-------------|------|
| TC-F23-04-01..12 | `schemas.test.ts` | profilePatchSchema: name bounds, phone format/length/E.164 | ✓ |
| TC-F23-04-13 ♻ | `schemas.test.ts` | Password hợp lệ pass schema | ✓ |
| TC-F23-04-13 ♻ | `api-users-me-password.test.ts` | POST password — unauthorized | ✓ |
| TC-F23-04-14 ♻ | `schemas.test.ts` / `api-users-me-password.test.ts` | Password <8 ký tự / forbidden với owner | ✓ |
| TC-F23-04-15 ♻ | `schemas.test.ts` / `api-users-me-password.test.ts` | Thiếu uppercase / bad request password yếu | ✓ |
| TC-F23-04-16 | `api-users-me-password.test.ts` | Current password sai → unauthorized | ✓ |
| TC-F23-04-17 ♻ | `schemas.test.ts` / `api-users-me-password.test.ts` | Thiếu digit / success đổi password | ✓ |
| TC-F23-04-19..23 | `schemas.test.ts` | currentPassword bounds; phone optional/code-only/omitted | ✓ |

### Role guard (cross-US)

| TC-ID | File | Description | AUTO |
|-------|------|-------------|------|
| TC-F23-05-01..09 | `role-guard.test.ts` | Owner detection qua tenant role (incl. GH-905 regression), 403 owner, null staff | ✓ |

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
