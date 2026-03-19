# Test Cases: F05 — AI Editor

> **Tester:** ___
> **Ngày test:** ___
> **URL Staging:** https://ech-prime-web-v2-staging-pzdwc.ondigitalocean.app
> **PRD:** docs/prd/F05-ai-editor.md

---

## 9-Point Checklist

| # | Check | Status | Ghi chú |
|---|---|---|---|
| 1 | Loading State | ⬜ | Editor loading site data |
| 2 | Empty State | N/A | Editor luôn có site |
| 3 | Error State | ⬜ | Site không tồn tại → 404 |
| 4 | Form Validation | ⬜ | Settings panel inputs |
| 5 | Button States | ⬜ | Save, Publish disabled khi loading |
| 6 | Toast/Feedback | ⬜ | "Saved!", "Published!" |
| 7 | Auth Redirect | ⬜ | Chưa login → /login |
| 8 | Mobile 375px | ⬜ | Chat bottom sheet, preview full |
| 9 | Console Errors | ⬜ | |

---

## Test Cases

### TC-01: Editor — Load site

**Precondition:** Đã login, có ít nhất 1 site (Draft)

| Step | Action | Expected |
|---|---|---|
| 1 | Từ /dashboard, click "Edit" trên site card | Navigate /editor/:siteId |
| 2 | Check layout | Toolbar (top) + Chat (trái) + Preview (phải) |
| 3 | Check toolbar | Nút Back, Pages dropdown, Desktop/Mobile toggle, Publish |
| 4 | Check preview | Hiện full rendered site trong iframe |

**Result:** ⬜
**Bug #:** —

---

### TC-02: Editor — AI Chat edit

**Precondition:** Đang ở /editor/:siteId

| Step | Action | Expected |
|---|---|---|
| 1 | Trong chat panel, nhập: "Đổi tiêu đề hero thành 'Xin chào'" | |
| 2 | Click Send | AI xử lý, preview update |
| 3 | Check preview | Hero heading đổi thành "Xin chào" |
| 4 | Check unsaved indicator | Hiện "● Unsaved" trên toolbar |

**Result:** ⬜
**Bug #:** —

---

### TC-03: Editor — Save

**Precondition:** Có unsaved changes (TC-02)

| Step | Action | Expected |
|---|---|---|
| 1 | Click "Save" (hoặc Ctrl+S) | Button hiện loading |
| 2 | Chờ save xong | Toast "Saved!" / unsaved indicator biến mất |
| 3 | Refresh page (F5) | Site load lại với changes đã save |

**Result:** ⬜
**Bug #:** —

---

### TC-04: Editor — Publish

**Precondition:** Site đang là Draft, đã save

| Step | Action | Expected |
|---|---|---|
| 1 | Click "Publish" | Confirmation dialog hoặc trực tiếp publish |
| 2 | Chờ publish xong | Toast "Published!", status badge đổi thành "Published" |
| 3 | Mở /sites/:slug (public URL) | Site hiện cho public |

**Result:** ⬜
**Bug #:** —

---

### TC-05: Editor — Unpublish

**Precondition:** Site đang Published

| Step | Action | Expected |
|---|---|---|
| 1 | Click "Unpublish" | Site chuyển về Draft |
| 2 | Mở /sites/:slug | Không hiện (404 hoặc "not published") |

**Result:** ⬜
**Bug #:** —

---

### TC-06: Editor — Settings Panel

**Precondition:** Đang ở /editor/:siteId

| Step | Action | Expected |
|---|---|---|
| 1 | Mở Settings panel (gear icon hoặc tab) | Hiện theme settings |
| 2 | Đổi Primary Color | Preview update real-time |
| 3 | Đổi Heading Font | Preview headings đổi font |
| 4 | Đổi Body Font | Preview body text đổi font |

**Result:** ⬜
**Bug #:** —

---

### TC-07: Editor — Responsive toggle

**Precondition:** Đang ở /editor/:siteId

| Step | Action | Expected |
|---|---|---|
| 1 | Click Desktop icon | Preview full width |
| 2 | Click Mobile icon | Preview thu nhỏ (mobile frame) |
| 3 | Check site trong mobile frame | Responsive layout đúng |

**Result:** ⬜
**Bug #:** —

---

### TC-08: Editor — Back navigation

**Precondition:** Đang ở /editor/:siteId, có unsaved changes

| Step | Action | Expected |
|---|---|---|
| 1 | Click "← Back" | Warning: "You have unsaved changes" (hoặc auto-save) |
| 2 | Confirm leave | Navigate về /dashboard |

**Result:** ⬜
**Bug #:** —

---

### TC-09: Editor — Mobile responsive

**Precondition:** Chrome DevTools → iPhone SE (375px)

| Step | Action | Expected |
|---|---|---|
| 1 | Mở /editor/:siteId | Preview full-width |
| 2 | Check toggle Chat/Preview | Có toggle button |
| 3 | Mở chat | Chat overlay hoặc bottom sheet |
| 4 | Nhập message + send | AI respond, preview update |

**Result:** ⬜
**Bug #:** —

---

## Tổng kết

| TC | Tên | Result | Bug # |
|---|---|---|---|
| TC-01 | Load site | ⬜ | — |
| TC-02 | AI Chat edit | ⬜ | — |
| TC-03 | Save | ⬜ | — |
| TC-04 | Publish | ⬜ | — |
| TC-05 | Unpublish | ⬜ | — |
| TC-06 | Settings Panel | ⬜ | — |
| TC-07 | Responsive toggle | ⬜ | — |
| TC-08 | Back navigation | ⬜ | — |
| TC-09 | Mobile responsive | ⬜ | — |

**Overall:** ⬜ PASS / FAIL
**Sign-off by:** ___
**Date:** ___
