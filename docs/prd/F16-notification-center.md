# PRD: Notifications Center (F16)
> **Version:** 1.0 | **Created:** 2026-03-17 | **Agent:** `project-planner`
> **Priority:** P1 | **Sprint:** Wave 2 — Sprint TBD | **Size:** M
> **Depends on:** F02 (Auth), F10 (Orders), F15 (Admin Management) | **Blocks:** None

---

> [!IMPORTANT]
> **Stories-First Rule:**
> PRD này PHẢI được xây dựng dựa trên các User Stories đã tồn tại và được approve.
> - Mọi Acceptance Criteria (Section 11) phải được copy từ file story, KHÔNG tự viết mới.
> - Mọi Functional Requirement (Section 7) PHẢI có Story ID tham chiếu trong cột `Story Ref`.
> - Nếu FR không có story cover → đó là scope chưa approve → tạo story mới trước, sau đó mới update PRD.
> - **Rule:** Stories → PRD. Không bao giờ ngược lại.

---

## 0. Story Traceability

> **[BẮT BUỘC]** Liệt kê đầy đủ các User Stories mà PRD này implement.
> Tham chiếu file stories tại `docs/stories/F14-notification-center-stories.md`.

| Story ID | Title | File | Status |
|----------|-------|------|--------|
| US-F16-01 | Xem tổng số thông báo chưa đọc (Unread Badge) | [F14-notification-center-stories.md](../stories/F14-notification-center-stories.md) | Draft |
| US-F16-02 | Xem danh sách thông báo (Notification Dropdown) | [F14-notification-center-stories.md](../stories/F14-notification-center-stories.md) | Draft |
| US-F16-03 | Chuyển hướng khi click thông báo (Actionable Links) | [F14-notification-center-stories.md](../stories/F14-notification-center-stories.md) | Draft |
| US-F16-04 | Đánh dấu "Đã đọc" (Mark all as read) | [F14-notification-center-stories.md](../stories/F14-notification-center-stories.md) | Draft |
| US-F16-05 | Nhận nhận thông báo từ Ban Quản Trị Hệ Thống (Global Broadcasts) | [F14-notification-center-stories.md](../stories/F14-notification-center-stories.md) | Draft |
| US-F16-06 | Hiển thị Live Popup góc dưới chuông thông báo (In-app Toast/Popup) | [F14-notification-center-stories.md](../stories/F14-notification-center-stories.md) | Draft |
| US-F16-07 | Nhận thông báo qua Trình duyêt Desktop (Browser Push Notifications) | [F14-notification-center-stories.md](../stories/F14-notification-center-stories.md) | Draft |

---

## 1. Problem Statement

Chủ cửa hàng (Owner) và nhân viên cần một nơi tập trung để xem lại và quản lý các sự kiện quan trọng (đơn hàng mới, thông báo hệ thống, cảnh báo) thay vì chỉ nhìn thấy các toast notification thoáng qua. Nếu không có Notification Center, họ có thể bỏ lỡ các thông tin quan trọng khi không trực tuyến hoặc không để ý màn hình.

---

## 2. Target User

- **Primary User:** Owner (Chủ cửa hàng) và Employee (Nhân viên được phân quyền).
- **Technical Level:** Từ cơ bản đến trung bình. Quen thuộc với UX chuông thông báo của Facebook/Shopee.
- **Language:** Hỗ trợ đa ngôn ngữ (EN / VI / BM tuỳ locale).

---

## 3. Solution Overview

Xây dựng một Notification Center (Trung tâm thông báo) trên thanh điều hướng chính (Header/Sidebar). Người dùng sẽ thấy biểu tượng chuông báo kèm số lượng thông báo chưa đọc (badge). Khi có sự kiện realtime, hệ thống sẽ bật popup nhỏ (toast) ở góc dưới để gây chú ý, đồng thời hỗ trợ Native Browser Push Notification. Khi click vào chuông, một dropdown menu sẽ xổ xuống hiển thị danh sách các thông báo mới nhất cho phép người dùng click để đánh dấu đã đọc và chuyển hướng đến trang chi tiết (ví dụ: chi tiết đơn hàng).

---

## 4. Scope

### In Scope
- Giao diện chuông thông báo (Bell icon & unread badge).
- Dropdown list hiển thị thông báo mới nhất.
- Live in-app popup (toast) ở góc dưới trình duyệt khi có sự kiện mới.
- Native Browser Push Notifications (Desktop).
- Tính năng Mark all as read.
- Actionable click: click vào thông báo để redirect.
- Tích hợp nhận event từ F10 (New Orders) và F15 (Global Broadcasts).

### Out of Scope
- Trang quản lý toàn bộ thông báo (View All Notifications Page / Pagination) — sẽ làm ở phase sau.
- Filter/Sort thông báo phức tạp trong dropdown.
- Push notification trên Mobile App (Native iOS/Android).
- SMS Notification.

---

## 5. Success Metrics

| Metric | Target | Measured By |
|--------|--------|-------------|
| Adoption Rate | > 80% active users click vào chuông báo ít nhất 1 lần/tuần | Mixpanel/PostHog event `Click_Notification_Bell` |
| Action Rate | > 50% thông báo Order được click để xem chi tiết | Event `Click_Notification_Item_Order` |
| Browser Push Opt-in | > 30% user cấp quyền nhận Browser Push | Database flag / Analytics tracker |

---

## 6. User Story Summary

```
AS AN Owner/Employee
I WANT TO có một trung tâm thông báo (Notification Center) với chuông báo, dropdown, popup realtime và browser push
SO THAT tôi không bao giờ bỏ lỡ các đơn hàng mới hoặc thông báo quan trọng từ hệ thống
```

---

## 7. Functional Requirements

| FR-ID | Requirement | Story Ref | Priority | Notes |
|-------|-------------|-----------|----------|-------|
| FR-01 | Hiển thị biểu tượng chuông với số đếm (Unread badge) | US-F16-01 | P1 | Badge auto update. Max display 99+ |
| FR-02 | Dropdown hiển thị danh sách tối đa 20 thông báo mới nhất | US-F16-02 | P1 | Sort: Newest first |
| FR-03 | Phân biệt visual trạng thái Đã đọc / Chưa đọc | US-F16-02 | P1 | |
| FR-04 | Click thông báo: Đánh dấu đã đọc & Điều hướng | US-F16-03 | P1 | Dựa vào `actionUrl` của notification |
| FR-05 | Nút "Mark all as read" chuyển toàn bộ status thành read | US-F16-04 | P2 | |
| FR-06 | Nhận và hiển thị Global System Broadcasts từ Admin (F16) | US-F16-05 | P2 | |
| FR-07 | Hiển thị Popup (Toast) góc dưới khi có notification mới realtime | US-F16-06 | P1 | Tự biến mất sau 5-7s |
| FR-08 | Tự động tăng số badge khi có popup realtime | US-F16-06 | P1 | |
| FR-09 | Flow xin quyền Native Browser Push Notification (Opt-in) | US-F16-07 | P2 | |
| FR-10 | Hiển thị thông báo Native Browser Desktop khi tab inactive | US-F16-07 | P2 | Focus tab Antigravity khi click Notification |

---

## 8. Business Rules

- **BR-01 (Role-Based Access):** User chỉ nhận và xem được các thông báo thuộc quyền hạn của mình (VD: Employee không có quyền xem Order thì không nhận được thông báo New Order).
- **BR-02 (Data Retention):** Thông báo đã đọc lưu trữ tối đa 30 ngày để tối ưu database (cronjob dọn dẹp).
- **BR-03 (Polling / Realtime limit):** Hạn chế spam thông báo. Nếu có biến động lớn (VD: import nhiều sản phẩm), hệ thống chỉ nên tạo 1 thông báo gom nhóm hoặc giới hạn tần suất gửi popup (Rate limiting).

---

## 9. User Flow

```
[System Event Occurs (e.g., New Order / Global Broadcast)]
  ↓
[Backend creates Notification Record in DB for Target Users]
  ↓
[Realtime event via Websocket/Polling reaches User's Browser]
  ↓
  ├── Tab is active: Show In-app Popup (Toast) at bottom corner + Increment Badge
  └── Tab is inactive AND Browser Push Allowed: Show Native Desktop OS Notification
  ↓
[User clicks Bell Icon in Utility Bar]
  ↓
[Dropdown lists top 20 notifications (newest first)]
  ↓
[User clicks a specific unread notification]
  ↓
[System marks as Read -> Decrements Badge count]
  ↓
[System navigates user to target URL (e.g., /dashboard/orders)]
```

---

## 10. Screen Layout

```
[Header Navigation]
  Logo    |   Search                          |   [🔔 (3)]   UserAvatar
                                                  |
                                                  v
                                      +-------------------------------+
                                      | Notifications       [Mark all]|
                                      |-------------------------------|
                                      | [🔵] 📦 New Order #1024       |
                                      |      RM 150.00 • 2 mins ago   |
                                      |-------------------------------|
                                      | [🔵] 📢 System Maintenance    |
                                      |      Downtime at 2AM • 1 hr   |
                                      |-------------------------------|
                                      | [ ]  📦 New Order #1023       |
                                      |      RM 80.00 • 5 hours ago   |
                                      +-------------------------------+

[Màn hình Dashboard]
...
...
                                                           +-------------------+
                                                           | 📦 New Order #1025|
                                                           | Just now          |
                                                           +-------------------+
                                                           (Live Popup Corner)
```

---

## 11. Acceptance Criteria

> Các AC dưới đây được copy nguyên bản từ `F14-notification-center-stories.md`.

### AC-1: Hiển thị badge chính xác
> 📌 Source: [US-F16-01](../stories/F14-notification-center-stories.md) — AC-1

```gherkin
GIVEN hệ thống có thông báo mới gửi cho User chưa được đọc
WHEN  User đăng nhập hoặc đang ở bất kỳ màn hình nào trên Dashboard
THEN  biểu tượng cái chuông (Bell Icon) sẽ hiển thị một chấm đỏ (badge) kèm số lượng thông báo chưa đọc (ví dụ: 3)
  AND nếu số lượng > 99, hiển thị "99+"
```

### AC-2: Cập nhật realtime (hoặc near-realtime)
> 📌 Source: [US-F16-01](../stories/F14-notification-center-stories.md) — AC-2

```gherkin
GIVEN User đang trực tuyến trên Dashboard
WHEN  có đơn hàng mới được tạo (System trigger)
THEN  số lượng trên badge tự động tăng lên 1
  AND có thể kèm theo một hiệu ứng rung nhẹ (optional animation) để thu hút chú ý
```

### AC-3: Mở danh sách thông báo
> 📌 Source: [US-F16-02](../stories/F14-notification-center-stories.md) — AC-1

```gherkin
GIVEN User đang thấy badge thông báo chưa đọc
WHEN  User click vào biểu tượng chuông
THEN  một dropdown (hoặc drawer panel) sẽ mở ra hiển thị danh sách các thông báo mới nhất (tối đa x20 items)
  AND danh sách được sắp xếp theo thời gian mới nhất (Newest first)
  AND hiển thị phân biệt rõ item "Đã đọc" (màu nhạt) và "Chưa đọc" (màu đậm/có chấm xanh)
```

### AC-4: Click điều hướng và đổi trạng thái
> 📌 Source: [US-F16-03](../stories/F14-notification-center-stories.md) — AC-1

```gherkin
GIVEN User đang mở Notification drop-down
WHEN  User click vào thông báo "Đơn hàng mới #1024"
THEN  thông báo đó tự động chuyển trạng thái thành "Đã đọc" (Unread count giảm 1)
  AND hệ thống điều hướng (navigate) mở trang /dashboard/orders với drawer số #1024
```

### AC-5: Mark all as read
> 📌 Source: [US-F16-04](../stories/F14-notification-center-stories.md) — AC-1

```gherkin
GIVEN User có 15 thông báo chưa đọc
WHEN  User mở dropdown và click "Mark all as read"
THEN  tất cả 15 thông báo lập tức chuyển trạng thái visual thành Đã đọc
  AND unread badge trên biểu tượng chuông biến mất (hoặc về 0)
```

### AC-6: Hiển thị popup tự động (In-app)
> 📌 Source: [US-F16-06](../stories/F14-notification-center-stories.md) — AC-1

```gherkin
GIVEN User đang trực tuyến (Online) trên hệ thống Dashboard
WHEN  có sự kiện hệ thống xảy ra: Đơn hàng mới (New Order), Sản phẩm mới được tạo (New Product tạo bởi nhân viên khác), Blog mới được tạo.
THEN  một popup nhỏ gọn xuất hiện ở góc dưới vị trí chuông thông báo (Notification bell)
  AND popup hiển thị thông tin ngắn gọn (Ví dụ: "📦 1 đơn hàng mới vừa được tạo", "📝 Blog 'ABC' vừa xuất bản")
  AND popup tự động biến mất sau 5-7 giây (hoặc khi User click tắt).
```

### AC-7: Tự động cập nhật Badge đồng thời khi có Popup
> 📌 Source: [US-F16-06](../stories/F14-notification-center-stories.md) — AC-2

```gherkin
GIVEN popup được hiển thị
WHEN  popup xuất hiện
THEN  chấm đỏ (badge) ở chuông thông báo tự động tăng lên 1 đồng thời.
```

### AC-8: Yêu cầu quyền thông báo (Opt-in) cho Desktop
> 📌 Source: [US-F16-07](../stories/F14-notification-center-stories.md) — AC-1

```gherkin
GIVEN User lần đầu truy cập Dashboard sau khi tính năng được bật
WHEN  User tắt các popup Onboarding
THEN  hệ thống hiển thị prompt xin quyền: "Cho phép Antigravity gửi thông báo quan trọng đến trình duyệt của bạn?"
  AND nếu User chọn "Allow" (Browser level), trạng thái được lưu lại là đã cấp quyền
  AND nếu User chọn "Block", không hiển thị lại prompt này trừ khi họ chủ động bật trong cài đặt.
```

### AC-9: Native Push Notification Behavior
> 📌 Source: [US-F16-07](../stories/F14-notification-center-stories.md) — AC-2

```gherkin
GIVEN User đã cấp quyền Push Notification của trình duyệt
WHEN  có thông báo quan trọng (VD: Đơn hàng mới, Cảnh báo hệ thống)
  AND tab ứng dụng Antigravity không phải là tab đang active (User đang ở tab khác hoặc app khác trên máy tính)
THEN  một Native Push Notification của hệ điều hành Desktop xuất hiện
  AND khi User click vào thông báo đó, trình duyệt tự động focus về tab Antigravity và di chuyển đến trang nội dung tương ứng (VD: trang Chi tiết Order).
```

---

## 12. Non-Functional Requirements

| Category | Requirement | Notes |
|----------|-------------|-------|
| **Performance** | API fetch danh sách thông báo < 500ms | Cần index tốt cột `user_id` và `is_read` |
| **Realtime** | Độ trễ thông báo In-app < 5s kể từ khi event xảy ra | Dùng Websocket (Socket.io) hoặc API Polling (5s) |
| **UI/UX** | Z-index popup/dropdown phải cao nhất để không bị che | |
| **Browser support** | Hỗ trợ Push API trên Chrome, Firefox, Edge, Safari (mới) | |

---

## 13. Technical Architecture

### 13.1 Components

| Component | File | Description |
|-----------|------|-------------|
| `NotificationDropdown` | `components/notifications/NotificationDropdown.tsx` | UI Dropdown hiển thị list thông báo. |
| `NotificationBell` | `components/notifications/NotificationBell.tsx` | Icon chuông và Badge đếm số. |
| `LivePopup` / `ToastProvider` | `components/ui/Toast.tsx` | UI cho popup hiển thị góc màn hình. |
| `NotificationService` | `services/notification.ts` | Handlers cho WebSocket, Polling và Browser Push API. |

### 13.2 API Endpoints

```
GET /api/notifications
Request: { limit: 20, offset: 0 }
Response: { success: true, data: { unreadCount: 3, notifications: [...] } }

POST /api/notifications/mark-read
Request: { notification_ids: [1, 2, 3] /* OR "all" */ }
Response: { success: true }
```

### 13.3 Data Flow

```
[System Event] -> [Backend: Websocket Emitter / Firebase] -> [Frontend: Websocket Receiver / Service Worker]
                                                                        |
                                                                        v
                                                               [Update Context/Store] -> Re-render Badge
                                                                        |
                                                                        v
                                                          [Trigger Toast] -> Show In-app Live Popup
                                                                        |
                                                           (If Service Worker) -> Show Native Browser Push
```

---

## 14. Dependencies

| Dependency | Status | Action Needed |
|-----------|--------|---------------|
| Hạ tầng Websocket hoặc Firebase Cloud Messaging (FCM) | ⬜ | Dev Ops cần setup hạ tầng Push. |
| Role-based ACL (F02/Auth) | ✅ | Đã có hệ thống Role. Cần filter event theo role ở backend. |

---

## 15. API Contract

> Full details sẽ được move sang ARCHITECTURE doc.

---

## 16. Open Questions

| # | Question | Owner | Status |
|---|----------|-------|--------|
| 1 | Sử dụng giải pháp Realtime nào? Websocket tự host, Socket.io, hay Firebase FCM/Pusher? | Tech Lead | ⬜ Open |
| 2 | Với Browser Push, Apple Safari có các strict policies. Có support full cho Safari desktop ko? | QA/Dev | ⬜ Open |

---

## 17. 9-Point Done Checklist

- [ ] Loading State — Skeletons hiển thị khi đang fetch list dropdown
- [ ] Empty State — "You have no new notifications" illustration
- [ ] Error State — "Failed to load notifications" kèm nút Retry
- [ ] Form Validation — N/A
- [ ] Button States — Disabled nút "Mark all as read" nếu unreadCount = 0
- [ ] Toast Feedback — In-app Live Popup (Toast)
- [ ] Auth Redirect — N/A
- [ ] Mobile 375px — Dropdown responsive thành dạng Bottom Sheet hoặc Drawer full màn hình trên mobile.
- [ ] TypeScript Clean — `tsc --noEmit` pass

---

## 18. Definition of Ready

- [x] User Stories approved và linked ở Section 0
- [x] AC ở Section 11 đã được copy từ story file
- [x] FR ở Section 7 có đầy đủ Story Ref
- [x] Architecture doc exists (`docs/architecture/F16-notification-center.md`)
- [ ] API contract defined
- [ ] Dependencies confirmed
- [ ] Business Rules confirmed với PO
- [ ] Open Questions resolved

---

## 19. Definition of Done

- [ ] All FR items implemented và verified
- [ ] All AC in Section 11 pass (traced back to story)
- [ ] 9-Point Checklist all pass
- [ ] QA report written (`docs/qa/F16-notification-center.md`)
- [ ] Bilingual EN/MY verified
- [ ] Mobile responsive verified (375px)
- [ ] Non-Functional Requirements validated

