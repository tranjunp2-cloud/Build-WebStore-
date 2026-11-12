# Plan — password min length 8 → 6 (#2269)

Issue: https://github.com/primeproduction/ech-prime-web-v2/issues/2269
Branch: `feat/F02-02-password-min-length-6` (từ `origin/staging`)
Status: ✅ Done 2026-11-04 — unit + local UI verified

## Ý tưởng chính
Gom số 6 về **1 hằng số** dùng chung → sau này đổi chỉ sửa 1 chỗ. Đồng thời đưa schema login + hàm độ mạnh password ra module riêng để test import được từ source (đúng `.claude/rules/testing.md`).

## Phase 1 — Module dùng chung (mới)
`src/lib/auth/password-rules.ts` (chỉ logic thuần, không UI)
- `export const PASSWORD_MIN_LENGTH = 6`
- `export function getPasswordStrength(password): number` (chuyển từ `reset-password/page.tsx`, trả score 0–4, mốc độ dài = `PASSWORD_MIN_LENGTH`; màu `STRENGTH_COLORS` giữ ở page)
- `loginSchema` **giữ trong** `login/page.tsx` (review: không cần chuyển; test qua render component theo pattern sẵn có `login-page-otp-lockout.test.tsx`)

## Phase 2 — Áp dụng vào code
| File | Thay đổi |
|---|---|
| `src/app/(auth)/login/page.tsx` | `min(8)` → `min(PASSWORD_MIN_LENGTH)` |
| `src/app/(auth)/reset-password/page.tsx` | `min(PASSWORD_MIN_LENGTH)`, import `getPasswordStrength`, checklist `>= PASSWORD_MIN_LENGTH` |
| `src/lib/profile/schemas.ts` | `newPassword.min(PASSWORD_MIN_LENGTH)` (giữ chữ hoa + số) → server `/api/users/me/password` tự áp theo |
| `.../profile/_components/password-change-form.tsx` | `hasMinLength = length >= PASSWORD_MIN_LENGTH` |

## Phase 2b — Chặn ở server cho `/api/users/reset-password`
- Mới `src/lib/auth/enforce-reset-password-min-length.ts`: `CollectionBeforeOperationHook` — nếu `operation === 'resetPassword'` và `args.data.password` là string có độ dài `< PASSWORD_MIN_LENGTH` → `throw new APIError('Password must be at least 6 characters', 400)`. Operation khác → trả `args` nguyên vẹn.
- `src/collections/Users.ts:318`: `beforeOperation: [rejectInvalidRoleFilter, enforceResetPasswordMinLength]`.
- Payload 3.91.0 `resetPassword` gọi `beforeOperation` **trước** khi tìm token và hash password → password ngắn bị chặn, không ghi DB. (Token sai + password ngắn → 400 thay vì 403; không lộ thông tin gì.)
- Trang reset hiện message lỗi server nguyên văn (không chứa "token"/"expired") → user thấy đúng câu. Bình thường client đã chặn trước, server chỉ là lớp bảo vệ khi gọi API trực tiếp.
- **Cố ý KHÔNG** chặn ở `create`/`update`: SSO provision, SSO reset-password, migrate PW1, admin panel đều ghi password qua đó; password do SSO quản lý có thể < 6 → chặn sẽ làm hỏng đồng bộ SSO. `/api/users/me/password` đã chặn qua `passwordChangeSchema`. Login server không chặn độ dài (chỉ xác thực).

## Phase 3 — i18n (`en.json` + `ms.json`)
"8 characters" → "6 characters", "8 aksara" → "6 aksara" ở 9 key: `auth.errors.passwordMinLength`, `auth.register.reqLength`, `auth.reset.{newPasswordPlaceholder,reqLength,passwordMin}`, `accountSettings.password.{placeholder,tooShort}`, `profile.security.ruleMinLength`, `profile.errors.passwordMinLength`.

## Phase 4 — Tests
- Mới `src/__tests__/unit/auth/login-page-password-min-length.test.tsx` (render `LoginPage` thật, mock giống `login-page-otp-lockout.test.tsx`):
  - TC-F02.67: password 5 ký tự → hiện lỗi `auth.reset.passwordMin`, **không** gọi `fetch`; 6 ký tự → gọi `POST /api/users/login`
- Mới `src/__tests__/unit/auth/password-rules.test.ts` (import từ source):
  - TC-F02.68: `getPasswordStrength` — 5 ký tự không có điểm độ dài, 6 ký tự có; 4 tiêu chí đủ → 4
- Mới `src/__tests__/unit/auth/enforce-reset-password-min-length.test.ts` (import hook từ source, theo pattern `clear-login-lock-on-password-change.test.ts`):
  - TC-F02.69: `resetPassword` + 5 ký tự → throw `APIError` 400; 6 ký tự → trả `args`; operation `update`/`create` với password 3 ký tự → không chặn
  - TC-F02.70: `Users.hooks.beforeOperation` có đăng ký hook
- `src/__tests__/unit/auth/auth-validation.test.ts`: xoá bản tự dựng `loginSchema` + `getPasswordStrength` và test của chúng (TC-F02.12/13 không tồn tại trong `docs/qa/F02-auth.md`; đã thay bằng 2 file trên). Phần register/slug giữ nguyên (ngoài phạm vi).
- Test hiện có không bị vỡ: giá trị "yếu" đang dùng (`short`, `weak`, `Aa1!aaa`) đều < 6 hoặc sẽ sửa ở TC-F23-04-14.
- `src/__tests__/unit/profile/schemas.test.ts` TC-F23-04-14: `< 8` → `< 6`, thêm case biên `Aa1!a` (5, fail) / `Aa1!aa` (6, pass).
- `password-change-form.test.tsx`, `security-tab.test.tsx`: mock text "8" → "6"; thêm case form nhận password 6 ký tự.

## Phase 5 — Docs
- F23: `prd:310`, `stories:163`, `design:243`, `qa` (TC-F23-04-14) → 6 ký tự
- F02: `design/F02-wireframe-lowfi.md:592` (≥6); `stories/F02-auth-stories.md` thêm dòng quy tắc min 6 vào US-F02-02 + US-F02-06; `qa/F02-auth.md` thêm TC-F02.67 → TC-F02.70; `docs/architecture/F02-auth.md` thêm 1 dòng về hook chặn reset password ngắn
- `docs/CHANGELOG.md`

## Phase 6 — Verify
`npm run verify` (oxlint, typecheck, related tests) + chạy `vitest` các file test ở Phase 4.
Không commit — để bạn review diff trước.

## Review trước triển khai (2026-11-04)
- ✅ Payload 3.91.0 validator `password` mặc định `minLength = 3`, project không set `defaultMaxTextLength` → không giới hạn max; 6 không xung đột.
- ✅ `passwordChangeSchema` chỉ dùng ở `/api/users/me/password` + form Profile → đổi 1 chỗ là cả client + server theo.
- ✅ Chỉ có 2 locale (`en`, `ms`); không có help/e2e nào nhắc "8 ký tự"; `e2e/auth-flow.spec.ts` không test độ dài.
- ✅ TC-F02.67/68 chưa dùng (QA doc tới TC-F02.66).
- ✅ Gap `/api/users/reset-password` chỉ chặn < 3 ở server → **xử lý trong Phase 2b** (theo yêu cầu).
- ℹ️ Key i18n `auth.register.reqLength`, `accountSettings.password.*` không còn dùng — vẫn đổi text cho đồng nhất (không xoá key).

## Không đụng
`AGENTS.md`, `next-env.d.ts` (đang modified sẵn, không liên quan), `api/e2e/ensure-test-user` (giữ 8), luồng SSO/PW1, `.trim()` ở login, DB.
