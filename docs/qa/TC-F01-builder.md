# Test Cases: F01 — AI Chat Builder

> **Tester:** ___
> **Ngày test:** ___
> **URL Staging:** https://ech-prime-web-v2-staging-pzdwc.ondigitalocean.app
> **PRD:** docs/prd/F01-ai-chat-builder.md

---

## 9-Point Checklist

| # | Check | Status | Ghi chú |
|---|---|---|---|
| 1 | Loading State | ⬜ | Skeleton preview, progress steps |
| 2 | Empty State | ⬜ | Welcome message + example prompts |
| 3 | Error State | ⬜ | AI fail → toast + retry button |
| 4 | Form Validation | ⬜ | Không cho gửi prompt rỗng |
| 5 | Button States | ⬜ | Disable khi generating |
| 6 | Toast/Feedback | ⬜ | Progress: "Đang tạo Hero... About..." |
| 7 | Auth Redirect | ⬜ | Chưa login → /login |
| 8 | Mobile 375px | ⬜ | Chat full-width, preview toggleable |
| 9 | Console Errors | ⬜ | |

---

## Test Cases

### TC-01: AI Builder — Welcome State

**Precondition:** Đã login

| Step | Action | Expected |
|---|---|---|
| 1 | Mở /builder/new | Split screen: Chat (trái) + Preview (phải) |
| 2 | Check chat panel | AI welcome message hiện |
| 3 | Check example prompts | Có 2-3 prompt gợi ý (click được) |
| 4 | Check preview panel | Skeleton/placeholder state |

**Result:** ⬜
**Bug #:** —

---

### TC-02: AI Builder — Generate site từ prompt

**Precondition:** Đã login, ở /builder/new

| Step | Action | Expected |
|---|---|---|
| 1 | Nhập: "Tiệm bánh handmade quận 3" | Text hiện trong input |
| 2 | Click Send hoặc Enter | Input disable, hiện progress |
| 3 | Quan sát chat panel | Progress steps: "Phân tích yêu cầu... Tạo header..." |
| 4 | Quan sát preview panel | Blocks xuất hiện từng cái (Hero → About → ...) |
| 5 | Chờ hoàn thành (< 60 giây) | Chat hiện "Done!", preview hiện full site |
| 6 | Check 2 CTA buttons | "Tinh chỉnh" + "Publish ngay" |

**Result:** ⬜
**Bug #:** —

---

### TC-03: AI Builder — Click example prompt

**Precondition:** Đã login, ở /builder/new (chưa nhập gì)

| Step | Action | Expected |
|---|---|---|
| 1 | Click 1 trong các example prompts | Prompt tự điền vào input |
| 2 | Click Send | Generation bắt đầu (giống TC-02) |

**Result:** ⬜
**Bug #:** —

---

### TC-04: AI Builder — Empty prompt

**Precondition:** Đã login, ở /builder/new

| Step | Action | Expected |
|---|---|---|
| 1 | Không nhập gì, click Send | Không gửi / hiện validation |
| 2 | Nhập chỉ spaces, click Send | Không gửi / hiện validation |

**Result:** ⬜
**Bug #:** —

---

### TC-05: AI Builder — Sau generate, navigate tới editor

**Precondition:** Đã generate site thành công (TC-02)

| Step | Action | Expected |
|---|---|---|
| 1 | Click "Tinh chỉnh" (hoặc "Edit") | Navigate tới /editor/:siteId |
| 2 | Editor load được site vừa tạo | Preview hiện đúng content |

**Result:** ⬜
**Bug #:** —

---

### TC-06: AI Builder — Draft auto-save

**Precondition:** Đã generate site thành công

| Step | Action | Expected |
|---|---|---|
| 1 | Sau generate xong, vào /dashboard | Site mới xuất hiện trong danh sách |
| 2 | Check status | Status = "Draft" |

**Result:** ⬜
**Bug #:** —

---

### TC-07: AI Builder — Mobile responsive

**Precondition:** Chrome DevTools → iPhone SE (375px), đã login

| Step | Action | Expected |
|---|---|---|
| 1 | Mở /builder/new | Chat panel full-width |
| 2 | Nhập prompt + Send | Generation bắt đầu |
| 3 | Check toggle Chat/Preview | Có nút toggle giữa 2 view |

**Result:** ⬜
**Bug #:** —

---

## Tổng kết

| TC | Tên | Result | Bug # |
|---|---|---|---|
| TC-01 | Welcome State | ⬜ | — |
| TC-02 | Generate site từ prompt | ⬜ | — |
| TC-03 | Click example prompt | ⬜ | — |
| TC-04 | Empty prompt | ⬜ | — |
| TC-05 | Navigate tới editor | ⬜ | — |
| TC-06 | Draft auto-save | ⬜ | — |
| TC-07 | Mobile responsive | ⬜ | — |

**Overall:** ⬜ PASS / FAIL
**Sign-off by:** ___
**Date:** ___
