# Bug Report Summary — F16 Notification Center

> **Project:** ECH Prime Web v2
> **Environment:** Staging
> **Date:** 2026-04-10
> **Reported by:** QA Team
> **Status:** 🔴 OPEN — Pending Dev Fix

---

## Tổng quan

| Feature | Tổng Bug | P0 Critical | P1 High | P2 Medium | Trạng thái |
| :--- | :---: | :---: | :---: | :---: | :---: |
| F16 — Notification Center | 13 | 2 | 10 | 1 | 🔴 BLOCKED |

> **⚠️ Release Decision: BLOCKED**
> Hệ thống Notification tồn tại nhiều lỗi liên quan tới flow realtime, mobile, bảo mật.

---

## Danh sách Bug

### 🔴 P0 — CRITICAL

> Phải fix ngay — block toàn bộ release, liên quan trực tiếp bảo mật và tính năng lõi.

---


#### BUG-F16-01 · API /api/notifications trả 200 không cần auth

| | |
| :--- | :--- |
| **Feature** | F16 — Notification Center |
| **TC-ID** | TC-F16.25 |
| **Severity** | 🔴 P0 Critical |
| **Module** | To Be Defined |
| **Nguồn** | F16-notification-center-test-report.md |

**Mô tả**
Anonymous browser (không có cookie/token) gọi `GET /api/notifications` → HTTP 200, body `{"unreadCount":0,"items":[]}`. Endpoint **KHÔNG kiểm tra authentication**. Hiện tại data rỗng nhưng nếu có notifications sẽ **leak data user**. Stream endpoint `/api/notifications/stream` thì bị timeout (protected). **Cần thêm auth middleware cho route `/api/notifications`.**

---


#### BUG-F16-12 · actionUrl sai → navigate 404

| | |
| :--- | :--- |
| **Feature** | F16 — Notification Center |
| **TC-ID** | TC-F16.06 |
| **Severity** | 🔴 P0 Critical |
| **Module** | To Be Defined |
| **Nguồn** | F16-notification-center-test-report.md |

**Mô tả**
Blog Published notification có `actionUrl: "/blogs"` nhưng route đúng là `/blog` (không có "s"). Click notification → navigate `/blogs` → **404 "This page could not be found"**. Root cause: `src/collections/Blogs.ts` dòng 18: `actionUrl: '/blogs'` phải sửa thành `actionUrl: '/blog'`. **User click notification → thấy 404 = trải nghiệm rất tệ.**

---

### 🟠 P1 — HIGH

> Lỗi chức năng cản trở flow.

---


#### BUG-F16-43 · Staff Account không nhận được Notification

| | |
| :--- | :--- |
| **Feature** | F16 - Notification Center |
| **Severity** | 🟠 P1 High |
| **Module** | Notification / Staff |

**Mô tả**
Staff account không nhận được notification từ hệ thống. Chỉ Owner nhận được notification, Staff bị bỏ qua. Ảnh hưởng đến luồng collaboration giữa Owner và Staff.

---


#### BUG-F16-02 · 404 page dùng mặc định Next.js, không có brand

| | |
| :--- | :--- |
| **Feature** | F16 — Notification Center |
| **TC-ID** | TC-F16.27 |
| **Severity** | 🟠 P1 High |
| **Module** | To Be Defined |
| **Nguồn** | F16-notification-center-test-report.md |

**Mô tả**
Navigate đến URL không tồn tại `/dashboard/orders/99999999` → hiện "404 \

---


#### BUG-F16-03 · Mark All disabled nhưng `pointer-events: auto`

| | |
| :--- | :--- |
| **Feature** | F16 — Notification Center |
| **TC-ID** | TC-F16.23 |
| **Severity** | 🟠 P1 High |
| **Module** | To Be Defined |
| **Nguồn** | F16-notification-center-test-report.md |

**Mô tả**
Button "Mark all as read" khi disabled: `disabled=true, opacity=1, pointer-events=auto, cursor=not-allowed`. Spec TC-F16.09 yêu cầu `pointer-events: none`. Mặc dù force-click không trigger API (OK), nhưng **CSS không đúng spec** — user vẫn thấy cursor hover effect.

---


#### BUG-F16-04 · Notification panel không support i18n / labels không đổi khi switch language

| | |
| :--- | :--- |
| **Feature** | F16 — Notification Center |
| **TC-ID** | TC-F16.20 |
| **Severity** | 🟠 P1 High |
| **Module** | To Be Defined |
| **Nguồn** | F16-notification-center-test-report.md |

**Mô tả**
Click language switcher "MY"↔"EN" ở sidebar → **labels trong notification panel KHÔNG thay đổi**. `Labels changed: false`. Các text cứng "Notifications", "Mark all as read", "Close notifications" luôn hiện tiếng Anh bất kể ngôn ngữ nào. **Notification panel chưa integrate i18n system.**

---


#### BUG-F16-05 · Web Push chưa implement — không có Service Worker

| | |
| :--- | :--- |
| **Feature** | F16 — Notification Center |
| **TC-ID** | TC-F16.10 |
| **Severity** | 🟠 P1 High |
| **Module** | To Be Defined |
| **Nguồn** | F16-notification-center-test-report.md |

**Mô tả**
`Notification.permission: "default"` (chưa hỏi user). **Service Worker: NOT registered**. Push subscription: none. Feature Web Push Notifications (US-F16-07) **chưa được implement** — không có SW để nhận push từ server khi tab background.

---


#### BUG-F16-06 · SSE không tự reconnect sau mất mạng

| | |
| :--- | :--- |
| **Feature** | F16 — Notification Center |
| **TC-ID** | TC-F16.17 |
| **Severity** | 🟠 P1 High |
| **Module** | To Be Defined |
| **Nguồn** | F16-notification-center-test-report.md |

**Mô tả**
SSE connections trước offline: 1, sau online lại: **vẫn 1** (không tăng). Console log 3 lỗi `"Failed to load resource: 404"`. App không crash nhưng **SSE stream bị mất vĩnh viễn** sau khi mất mạng → notification realtime sẽ **DỪNG** cho đến khi user F5 reload. **Cần implement SSE auto-reconnect logic (EventSource reconnect hoặc retry).**

---


#### BUG-F16-07 · Không có API rate limiting

| | |
| :--- | :--- |
| **Feature** | F16 — Notification Center |
| **TC-ID** | TC-F16.02 |
| **Severity** | 🟠 P1 High |
| **Module** | To Be Defined |
| **Nguồn** | F16-notification-center-test-report.md |

**Mô tả**
10 rapid API calls → ALL 200, **ZERO 429 rate limit**. Total 1100ms (avg 110ms/call). Spec TC-F16.02 yêu cầu gom nhóm toast khi spam nhưng **API không có throttle**. Attacker có thể spam endpoint liên tục. **Cần thêm rate limiting middleware.**

---


#### BUG-F16-08 · Sonner toast KHÔNG CÓ trên dashboard

| | |
| :--- | :--- |
| **Feature** | F16 — Notification Center |
| **TC-ID** | TC-F16.03 |
| **Severity** | 🟠 P1 High |
| **Module** | To Be Defined |
| **Nguồn** | F16-notification-center-test-report.md |

**Mô tả**
`[data-sonner-toaster]` = **FALSE** trong DOM. SSE stream active (1 connection) nhưng **không có toast container** để hiển thị notification popup. Chờ 10s → 0 toast xuất hiện. User sẽ **KHÔNG thấy** notification realtime dạng toast trên dashboard. **Cần mount `<Toaster />` component.**

---


#### BUG-F16-09 · Mobile: Không phải bottom sheet + touch target 15px

| | |
| :--- | :--- |
| **Feature** | F16 — Notification Center |
| **TC-ID** | TC-F16.05 |
| **Severity** | 🟠 P1 High |
| **Module** | To Be Defined |
| **Nguồn** | F16-notification-center-test-report.md |

**Mô tả**
Mobile 375x812: Panel mở nhưng **KHÔNG phải full-width bottom sheet** theo spec TC-F16.05 ("bố cục kéo Bottom Sheet rộng lên ôm hết thân màn hình"). Sheet elements chỉ width 96px/64px. "Mark All" button height=**15px** thay vì ≥44px (WCAG mobile touch target). **Cần refactor mobile UI thành bottom sheet.**

---


#### BUG-F16-11 · Click notification KHÔNG gọi mark-read API

| | |
| :--- | :--- |
| **Feature** | F16 — Notification Center |
| **TC-ID** | TC-F16.06 |
| **Severity** | 🟠 P1 High |
| **Module** | To Be Defined |
| **Nguồn** | F16-notification-center-test-report.md |

**Mô tả**
Click notification item → navigate OK nhưng **mark-read API calls = 0**. Frontend navigate đi mà không gọi `POST /api/notifications/mark-read`. unreadCount giảm có thể chỉ là frontend state, **DB chưa cập nhật isRead=true**. **Cần gọi mark-read API khi user click notification item.**

---

### 🟢 P2 — MEDIUM

> Lỗi hiển thị hoặc edge cases.

---


#### BUG-F16-10 · 9 console errors "404" trong journey

| | |
| :--- | :--- |
| **Feature** | F16 — Notification Center |
| **TC-ID** | E2E UAT |
| **Severity** | 🟢 P2 Medium |
| **Module** | To Be Defined |
| **Nguồn** | F16-notification-center-test-report.md |

**Mô tả**
Desktop+Mobile flow: 9 lần "Failed to load resource: 404" liên tục. Có thể do asset/font/image/favicon thiếu. Không crash nhưng gây noise trong monitoring/Sentry. **Cần kiểm tra và fix 404 resources.**

---

