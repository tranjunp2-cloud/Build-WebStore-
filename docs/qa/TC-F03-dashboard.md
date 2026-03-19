# Test Cases: F03 — Dashboard

> **Tester:** ___
> **Ngày test:** ___
> **URL Staging:** https://ech-prime-web-v2-staging-pzdwc.ondigitalocean.app
> **PRD:** docs/prd/F03-dashboard.md

---

## 9-Point Checklist

| # | Check | Status | Ghi chú |
|---|---|---|---|
| 1 | Loading State | ⬜ | Skeleton loader khi fetch data |
| 2 | Empty State | ⬜ | "Create your first website" CTA |
| 3 | Error State | ⬜ | API fail → thông báo lỗi |
| 4 | Form Validation | N/A | Dashboard không có form |
| 5 | Button States | ⬜ | "Create New Website" button |
| 6 | Toast/Feedback | ⬜ | |
| 7 | Auth Redirect | ⬜ | Chưa login → /login |
| 8 | Mobile 375px | ⬜ | Sidebar collapse, cards stack |
| 9 | Console Errors | ⬜ | |

---

## Test Cases

### TC-01: Dashboard — Empty State (user mới)

**Precondition:** Login với account chưa có site nào

| Step | Action | Expected |
|---|---|---|
| 1 | Mở /dashboard | Thấy greeting "Good morning/afternoon/evening, [Name]" |
| 2 | Check main content | Hiện empty state: "Create your first website" |
| 3 | Thấy 2 options | "Build with AI" + "Choose Template" |
| 4 | Click "Build with AI" | Navigate tới /builder/new hoặc /onboarding |
| 5 | Click "Choose Template" | Navigate tới /templates |

**Result:** ⬜
**Bug #:** —

---

### TC-02: Dashboard — Has Sites

**Precondition:** Login với account đã có 1+ sites

| Step | Action | Expected |
|---|---|---|
| 1 | Mở /dashboard | Thấy greeting + stat cards |
| 2 | Check site cards | Hiện grid site cards (thumbnail, name, status) |
| 3 | Check status badge | Draft = xám, Published = xanh |
| 4 | Click "Edit" trên site card | Navigate tới /editor/:siteId |
| 5 | Click "Create New Website" button | Navigate tới /onboarding hoặc /builder/new |

**Result:** ⬜
**Bug #:** —

---

### TC-03: Sidebar navigation

**Precondition:** Đã login

| Step | Action | Expected |
|---|---|---|
| 1 | Check sidebar links | Dashboard, My Sites, Templates, SEO, Products, Orders, Analytics, Media, Settings |
| 2 | Click "My Sites" | Navigate /dashboard/sites |
| 3 | Click "Templates" | Navigate /templates |
| 4 | Click "Products" | Navigate /dashboard/products |
| 5 | Click "Orders" | Navigate /dashboard/orders |
| 6 | Click "Analytics" | Navigate /dashboard/analytics |
| 7 | Click "Media" | Navigate /dashboard/media |
| 8 | Click "Settings" | Navigate /dashboard/settings |
| 9 | Click "SEO" | Navigate /dashboard/seo |

**Result:** ⬜
**Bug #:** —

---

### TC-04: Dashboard — Mobile responsive

**Precondition:** Chrome DevTools → iPhone SE (375px), đã login

| Step | Action | Expected |
|---|---|---|
| 1 | Mở /dashboard | Sidebar ẩn (hamburger menu) |
| 2 | Bấm hamburger | Sidebar hiện overlay |
| 3 | Click link trong sidebar | Navigate + sidebar tự đóng |
| 4 | Check greeting + cards | Stack vertical, không bị tràn |

**Result:** ⬜
**Bug #:** —

---

### TC-05: My Sites page

**Precondition:** Đã login

| Step | Action | Expected |
|---|---|---|
| 1 | Mở /dashboard/sites | Hiện danh sách sites |
| 2 | Check mỗi site card | Tên, status badge, type badge, last edited |
| 3 | Click Edit | Navigate /editor/:siteId |
| 4 | Click Preview | Mở site public /sites/:slug |

**Result:** ⬜
**Bug #:** —

---

### TC-06: Media Library

**Precondition:** Đã login

| Step | Action | Expected |
|---|---|---|
| 1 | Mở /dashboard/media | Hiện media grid hoặc empty state |
| 2 | Click "Upload" | Mở file picker |
| 3 | Chọn 1 ảnh | Upload thành công, ảnh hiện trong grid |
| 4 | Click vào ảnh | Hiện detail modal (preview, alt text, URL) |
| 5 | Click "Copy URL" | URL copy vào clipboard |
| 6 | Search theo tên file | Kết quả filter đúng |
| 7 | Filter theo type (Images/Videos/PDF) | Grid filter đúng |

**Result:** ⬜
**Bug #:** —

---

### TC-07: Settings page

**Precondition:** Đã login

| Step | Action | Expected |
|---|---|---|
| 1 | Mở /dashboard/settings | Hiện profile section |
| 2 | Check fields | Name (editable), Email (read-only), Role badge |
| 3 | Đổi tên → Click Save | Toast "Profile updated" |
| 4 | Scroll xuống Change Password | Hiện 3 fields: current, new, confirm |
| 5 | Nhập current password sai | Error message |
| 6 | Nhập new + confirm không khớp | Validation error |

**Result:** ⬜
**Bug #:** —

---

## Tổng kết

| TC | Tên | Result | Bug # |
|---|---|---|---|
| TC-01 | Empty State | ⬜ | — |
| TC-02 | Has Sites | ⬜ | — |
| TC-03 | Sidebar navigation | ⬜ | — |
| TC-04 | Mobile responsive | ⬜ | — |
| TC-05 | My Sites | ⬜ | — |
| TC-06 | Media Library | ⬜ | — |
| TC-07 | Settings | ⬜ | — |

**Overall:** ⬜ PASS / FAIL
**Sign-off by:** ___
**Date:** ___
