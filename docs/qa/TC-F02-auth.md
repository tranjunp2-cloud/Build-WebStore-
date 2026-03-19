# Test Cases: F02 — Auth Flow

> **Tester:** ___
> **Ngày test:** ___
> **URL Staging:** https://ech-prime-web-v2-staging-pzdwc.ondigitalocean.app
> **PRD:** docs/prd/F02-auth.md

---

## 9-Point Checklist

| # | Check | Status | Ghi chú |
|---|---|---|---|
| 1 | Loading State | ⬜ | Button spinner khi submit |
| 2 | Empty State | N/A | Không áp dụng cho auth |
| 3 | Error State | ⬜ | Sai password, email trùng |
| 4 | Form Validation | ⬜ | Email format, password min 6 |
| 5 | Button States | ⬜ | Disabled khi loading |
| 6 | Toast/Feedback | ⬜ | Error banner / success redirect |
| 7 | Auth Redirect | ⬜ | /dashboard → /login nếu chưa login |
| 8 | Mobile 375px | ⬜ | Form không bị tràn |
| 9 | Console Errors | ⬜ | Không có lỗi đỏ |

---

## Test Cases

### TC-01: Login thành công

**Precondition:** Chưa login (dùng incognito)

| Step | Action | Expected |
|---|---|---|
| 1 | Mở /login | Trang login hiện form email + password |
| 2 | Nhập email: phuong.ltweb@gmail.com | Field nhận giá trị |
| 3 | Nhập password: Aa123456@ | Field nhận giá trị (ẩn text) |
| 4 | Click "Sign in" | Button hiện spinner "Signing in..." |
| 5 | Chờ redirect | Redirect về /dashboard, thấy greeting |

**Result:** ⬜
**Bug #:** —

---

### TC-02: Login sai password

**Precondition:** Chưa login

| Step | Action | Expected |
|---|---|---|
| 1 | Mở /login | Form hiện |
| 2 | Nhập email đúng, password sai (ví dụ: wrongpass) | |
| 3 | Click "Sign in" | Hiện error: "Invalid email or password" |
| 4 | Check password field | Password field bị clear |
| 5 | Check console (F12) | Không có lỗi đỏ |

**Result:** ⬜
**Bug #:** —

---

### TC-03: Login email không tồn tại

**Precondition:** Chưa login

| Step | Action | Expected |
|---|---|---|
| 1 | Nhập email: notexist@test.com, password bất kỳ | |
| 2 | Click "Sign in" | Hiện error (không tiết lộ email có tồn tại không) |

**Result:** ⬜
**Bug #:** —

---

### TC-04: Login form validation

**Precondition:** Chưa login

| Step | Action | Expected |
|---|---|---|
| 1 | Bỏ trống email, click "Sign in" | Hiện validation error "Email is required" |
| 2 | Nhập email sai format (abc), click "Sign in" | Hiện validation error email format |
| 3 | Nhập email đúng, bỏ trống password | Hiện validation error password |
| 4 | Nhập password < 6 ký tự | Hiện validation error min length |

**Result:** ⬜
**Bug #:** —

---

### TC-05: Register user mới

**Precondition:** Chưa login, dùng email mới chưa đăng ký

| Step | Action | Expected |
|---|---|---|
| 1 | Mở /register | Form đăng ký hiện |
| 2 | Nhập First Name, Last Name | Fields nhận giá trị |
| 3 | Nhập email mới (ví dụ: test+123@gmail.com) | |
| 4 | Nhập password >= 6 ký tự | |
| 5 | Nhập confirm password giống password | |
| 6 | Click "Create account" | Button hiện spinner |
| 7 | Chờ redirect | Auto-login → redirect /onboarding |

**Result:** ⬜
**Bug #:** —

---

### TC-06: Register email trùng

**Precondition:** Chưa login

| Step | Action | Expected |
|---|---|---|
| 1 | Mở /register | |
| 2 | Nhập email đã tồn tại: phuong.ltweb@gmail.com | |
| 3 | Điền đầy đủ các field khác | |
| 4 | Click "Create account" | Hiện error: email đã được sử dụng |

**Result:** ⬜
**Bug #:** —

---

### TC-07: Register password mismatch

**Precondition:** Chưa login

| Step | Action | Expected |
|---|---|---|
| 1 | Nhập password: Abc123 | |
| 2 | Nhập confirm password: Abc456 | |
| 3 | Click "Create account" | Hiện error: passwords không khớp |

**Result:** ⬜
**Bug #:** —

---

### TC-08: Forgot Password

**Precondition:** Chưa login

| Step | Action | Expected |
|---|---|---|
| 1 | Mở /login | |
| 2 | Click "Forgot password?" | Navigate tới /forgot-password |
| 3 | Nhập email đã đăng ký | |
| 4 | Click "Send reset link" | Hiện success: "Check your email" |
| 5 | Nhập email KHÔNG tồn tại | Vẫn hiện success (bảo mật, không tiết lộ) |

**Result:** ⬜
**Bug #:** —

---

### TC-09: Auth Guard — redirect khi chưa login

**Precondition:** Chưa login (incognito)

| Step | Action | Expected |
|---|---|---|
| 1 | Truy cập /dashboard | Redirect về /login?returnUrl=/dashboard |
| 2 | Truy cập /editor/abc | Redirect về /login |
| 3 | Truy cập /builder/new | Redirect về /login |
| 4 | Login thành công | Redirect về /dashboard (từ returnUrl) |

**Result:** ⬜
**Bug #:** —

---

### TC-10: Auth Guard — redirect khi đã login

**Precondition:** Đã login

| Step | Action | Expected |
|---|---|---|
| 1 | Truy cập /login | Redirect về /dashboard |
| 2 | Truy cập /register | Redirect về /dashboard |

**Result:** ⬜
**Bug #:** —

---

### TC-11: Logout

**Precondition:** Đã login

| Step | Action | Expected |
|---|---|---|
| 1 | Ở /dashboard, tìm nút logout (sidebar) | Thấy nút logout |
| 2 | Click logout | Redirect về /login |
| 3 | Bấm Back trên browser | Không quay lại /dashboard (bị redirect /login) |

**Result:** ⬜
**Bug #:** —

---

### TC-12: Mobile responsive — Login

**Precondition:** Chrome DevTools → iPhone SE (375px)

| Step | Action | Expected |
|---|---|---|
| 1 | Mở /login | Form centered, không bị tràn |
| 2 | Nhập email + password | Keyboard không che form |
| 3 | Click "Sign in" | Button full width, dễ bấm |

**Result:** ⬜
**Bug #:** —

---

### TC-13: Mobile responsive — Register

**Precondition:** Chrome DevTools → iPhone SE (375px)

| Step | Action | Expected |
|---|---|---|
| 1 | Mở /register | Form centered, scroll được |
| 2 | Điền tất cả fields | Không bị tràn |

**Result:** ⬜
**Bug #:** —

---

### TC-14: Password visibility toggle

**Precondition:** Chưa login

| Step | Action | Expected |
|---|---|---|
| 1 | Mở /login | Password field type="password" (ẩn) |
| 2 | Click icon 👁 bên phải password field | Password hiện rõ (type="text") |
| 3 | Click lại icon | Password ẩn lại |

**Result:** ⬜
**Bug #:** —

---

## Tổng kết

| TC | Tên | Result | Bug # |
|---|---|---|---|
| TC-01 | Login thành công | ⬜ | — |
| TC-02 | Login sai password | ⬜ | — |
| TC-03 | Login email không tồn tại | ⬜ | — |
| TC-04 | Login form validation | ⬜ | — |
| TC-05 | Register user mới | ⬜ | — |
| TC-06 | Register email trùng | ⬜ | — |
| TC-07 | Register password mismatch | ⬜ | — |
| TC-08 | Forgot Password | ⬜ | — |
| TC-09 | Auth Guard — chưa login | ⬜ | — |
| TC-10 | Auth Guard — đã login | ⬜ | — |
| TC-11 | Logout | ⬜ | — |
| TC-12 | Mobile — Login | ⬜ | — |
| TC-13 | Mobile — Register | ⬜ | — |
| TC-14 | Password visibility toggle | ⬜ | — |

**Overall:** ⬜ PASS / FAIL
**Sign-off by:** ___
**Date:** ___
