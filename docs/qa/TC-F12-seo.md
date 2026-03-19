# Test Cases: F12 — SEO Dashboard + Analytics

> **Tester:** ___
> **Ngày test:** ___
> **URL Staging:** https://ech-prime-web-v2-staging-pzdwc.ondigitalocean.app

---

## 9-Point Checklist

| # | Check | Status | Ghi chú |
|---|---|---|---|
| 1 | Loading State | ⬜ | Skeleton khi analyze |
| 2 | Empty State | ⬜ | Chưa có site → message |
| 3 | Error State | ⬜ | Analyze fail → error |
| 4 | Form Validation | N/A | |
| 5 | Button States | ⬜ | "Analyze" / "Fix All" disabled khi loading |
| 6 | Toast/Feedback | ⬜ | "Fixed!" toast |
| 7 | Auth Redirect | ⬜ | |
| 8 | Mobile 375px | ⬜ | |
| 9 | Console Errors | ⬜ | |

---

## SEO Test Cases

### TC-01: SEO — Analyze site

**Precondition:** Đã login, có ít nhất 1 site

| Step | Action | Expected |
|---|---|---|
| 1 | Mở /dashboard/seo | Hiện SEO dashboard |
| 2 | Chọn site từ dropdown (nếu có) | |
| 3 | Click "Analyze" hoặc auto-analyze | Loading → hiện score |
| 4 | Check score | Score 0-100, color-coded (đỏ/vàng/xanh) |
| 5 | Check issues list | Errors (đỏ), Warnings (vàng), Info (xanh) |

**Result:** ⬜
**Bug #:** —

---

### TC-02: SEO — Fix issues with AI

**Precondition:** Site có SEO issues (missing meta title/description)

| Step | Action | Expected |
|---|---|---|
| 1 | Check issues list | Hiện "Missing meta title" hoặc tương tự |
| 2 | Click "Fix All" hoặc "Fix" từng issue | Loading state |
| 3 | Chờ AI fix | Toast "Fixed!", score tăng |
| 4 | Re-analyze | Issues đã fix biến mất, score cao hơn |

**Result:** ⬜
**Bug #:** —

---

### TC-03: SEO — No site

**Precondition:** Account không có site nào

| Step | Action | Expected |
|---|---|---|
| 1 | Mở /dashboard/seo | Empty state hoặc "Create a site first" |

**Result:** ⬜
**Bug #:** —

---

## Analytics Test Cases

### TC-04: Analytics — Dashboard view

**Precondition:** Đã login

| Step | Action | Expected |
|---|---|---|
| 1 | Mở /dashboard/analytics | Hiện analytics dashboard |
| 2 | Check metrics | Page Views, Unique Visitors |
| 3 | Check chart | Daily views chart (có thể trống nếu chưa có data) |
| 4 | Check top pages | List pages được xem nhiều nhất |
| 5 | Site selector (nếu có) | Chọn site → data filter theo site |

**Result:** ⬜
**Bug #:** —

---

### TC-05: Analytics — Empty data

**Precondition:** Site chưa có traffic

| Step | Action | Expected |
|---|---|---|
| 1 | Mở /dashboard/analytics | Hiện "No data yet" hoặc chart trống |
| 2 | Không bị crash | UI vẫn render đúng |

**Result:** ⬜
**Bug #:** —

---

### TC-06: SEO + Analytics — Mobile responsive

**Precondition:** Chrome DevTools → iPhone SE (375px)

| Step | Action | Expected |
|---|---|---|
| 1 | Mở /dashboard/seo | Layout stack, không bị tràn |
| 2 | Mở /dashboard/analytics | Chart resize responsive |

**Result:** ⬜
**Bug #:** —

---

## Tổng kết

| TC | Tên | Result | Bug # |
|---|---|---|---|
| TC-01 | SEO Analyze | ⬜ | — |
| TC-02 | SEO Fix with AI | ⬜ | — |
| TC-03 | SEO No site | ⬜ | — |
| TC-04 | Analytics dashboard | ⬜ | — |
| TC-05 | Analytics empty data | ⬜ | — |
| TC-06 | Mobile responsive | ⬜ | — |

**Overall:** ⬜ PASS / FAIL
**Sign-off by:** ___
**Date:** ___
