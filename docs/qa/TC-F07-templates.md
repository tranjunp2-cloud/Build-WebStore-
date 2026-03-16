# Test Cases: F07 — Template Gallery

> **Tester:** ___
> **Ngày test:** ___
> **URL Staging:** https://ech-prime-web-v2-staging-pzdwc.ondigitalocean.app

---

## 9-Point Checklist

| # | Check | Status | Ghi chú |
|---|---|---|---|
| 1 | Loading State | ⬜ | Template cards loading |
| 2 | Empty State | ⬜ | Không có template → message |
| 3 | Error State | ⬜ | API fail → error message |
| 4 | Form Validation | N/A | |
| 5 | Button States | ⬜ | "Use Template" hover + loading |
| 6 | Toast/Feedback | ⬜ | |
| 7 | Auth Redirect | ⬜ | Chưa login → /login khi dùng template |
| 8 | Mobile 375px | ⬜ | Cards stack 1 column |
| 9 | Console Errors | ⬜ | |

---

## Test Cases

### TC-01: Template Gallery — Browse

**Precondition:** Đã login

| Step | Action | Expected |
|---|---|---|
| 1 | Mở /templates | Hiện grid templates (10 categories) |
| 2 | Check header | "Template Gallery" + search bar + category pills |
| 3 | Check template cards | Thumbnail preview, tên, mô tả, category tag |
| 4 | Check "Featured" badge | Một số template có badge Featured |

**Result:** ⬜
**Bug #:** —

---

### TC-02: Template Gallery — Category filter

**Precondition:** Ở /templates

| Step | Action | Expected |
|---|---|---|
| 1 | Click "All" | Hiện tất cả templates |
| 2 | Click "Restaurant" | Chỉ hiện templates category restaurant |
| 3 | Click "Shop" | Chỉ hiện templates category shop/ecommerce |
| 4 | Click "All" lại | Quay về hiện tất cả |

**Result:** ⬜
**Bug #:** —

---

### TC-03: Template Gallery — Search

**Precondition:** Ở /templates

| Step | Action | Expected |
|---|---|---|
| 1 | Gõ "restaurant" vào search | Filter templates chứa "restaurant" |
| 2 | Xóa search text | Hiện lại tất cả |
| 3 | Gõ "xyzabc" (không tồn tại) | Hiện empty state "No templates found" |

**Result:** ⬜
**Bug #:** —

---

### TC-04: Template Gallery — Preview template

**Precondition:** Ở /templates

| Step | Action | Expected |
|---|---|---|
| 1 | Hover lên template card | Hiện Preview + Use buttons |
| 2 | Click "Preview" | Mở preview (modal hoặc expand) |
| 3 | Check preview content | Hiện full site preview |

**Result:** ⬜
**Bug #:** —

---

### TC-05: Template Gallery — Use template

**Precondition:** Đã login, ở /templates

| Step | Action | Expected |
|---|---|---|
| 1 | Click "Use this template" | Loading state |
| 2 | Chờ tạo site | Redirect tới /editor/:newSiteId |
| 3 | Check editor | Site tạo từ template, có đầy đủ blocks |

**Result:** ⬜
**Bug #:** —

---

### TC-06: Template Gallery — Language switcher

**Precondition:** Ở /templates

| Step | Action | Expected |
|---|---|---|
| 1 | Check language switcher (EN/MY) | Hiện ở header |
| 2 | Switch sang MY (Malay) | UI text đổi sang Malay |
| 3 | Switch lại EN | UI text đổi về English |

**Result:** ⬜
**Bug #:** —

---

### TC-07: Template Gallery — Mobile responsive

**Precondition:** Chrome DevTools → iPhone SE (375px)

| Step | Action | Expected |
|---|---|---|
| 1 | Mở /templates | Cards stack 1 column |
| 2 | Category pills | Scroll horizontal |
| 3 | Search bar | Full width |
| 4 | "Create with AI" button | Visible, không bị cắt |

**Result:** ⬜
**Bug #:** —

---

## Tổng kết

| TC | Tên | Result | Bug # |
|---|---|---|---|
| TC-01 | Browse | ⬜ | — |
| TC-02 | Category filter | ⬜ | — |
| TC-03 | Search | ⬜ | — |
| TC-04 | Preview template | ⬜ | — |
| TC-05 | Use template | ⬜ | — |
| TC-06 | Language switcher | ⬜ | — |
| TC-07 | Mobile responsive | ⬜ | — |

**Overall:** ⬜ PASS / FAIL
**Sign-off by:** ___
**Date:** ___
