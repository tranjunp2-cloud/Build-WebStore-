# User Stories: Notification Center (F16)

<!-- Rules & ID Convention: docs/stories/user-stories-p0.md | SPEC.md §2.4 -->

> **Feature:** F16 — In-app Notification Center for Owner & Employee
> **Wave:** 2 | **Priority:** P1 | **Ref PRD:** [F16-notification-center.md](../prd/F16-notification-center.md)

---

## 🌍 Global Acceptance Criteria (CMS Layout Compliance)

> **Áp dụng cho mọi User Story trong file này.**

```gherkin
GIVEN user truy cập tính năng trang quản trị (Dashboard, Products, Orders, v.v.)
THEN  nội dung của tính năng phải được render gọn bên trong Main Content Area (tuân thủ F18-03)
  AND Global Top Header (F18-02) và Global Sidebar Navigation (F18-01) vẫn giữ nguyên và hoạt động bình thường, không bị che khuất hay re-render toàn trang.
```

---

## 🌍 Global Acceptance Criteria (CMS Layout Compliance)

> **Áp dụng cho mọi User Story trong file này.**

```gherkin
GIVEN user truy cập tính năng trang quản trị (Dashboard, Products, Orders, v.v.)
THEN  nội dung của tính năng phải được render gọn bên trong Main Content Area (tuân thủ F18-03)
  AND Global Top Header (F18-02) và Global Sidebar Navigation (F18-01) vẫn giữ nguyên và hoạt động bình thường, không bị che khuất hay re-render toàn trang.
```

---

## Báo Cáo Phân Tích & Rà Soát Trùng Lặp (BA Analysis)

**1. Kết quả rà soát các feature hiện tại:**
- **F10-Orders**: Đã có requirement "New order notification: in-app toast + email to merchant". *F16 sẽ không thay thế toast mà đóng vai trò lưu trữ (persistent inbox) các thông báo này để Owner có thể xem lại.*
- **F15-Admin Management**: Có Epic "Global Notifications & Announcements" cho phép System Admin soạn thông báo gửi cho toàn hệ thống. *F16 chính là giao diện (Recipient UI) để Owner/Employee nhận và đọc các thông báo này.*
- **F01, F02, F05, F08**: Các feature dùng Alert banner và Toast/Toast.success/Toast.error. *Đây là UI feedback tạm thời (transient state), không tính là Notification Center.*

**Kết luận:** Không có sự trùng lặp (conflict) về mặt logic hệ thống. F16 sẽ là "Centralized Hub" hứng toàn bộ thông báo từ F10, F15 và các module khác trong tương lai (ví dụ: Low stock alert từ F08).

**2. Đề xuất Scope (F16):**
- **Thông báo nhận được:** Đơn hàng mới, Cập nhật hệ thống (từ Admin), Cảnh báo hết hàng, Báo cáo hàng tuần.
- **Tính năng UI:** Chuông báo (Bell Icon) kèm số đếm (Unread count badge), Dropdown List / Trang danh sách tập trung, Phân loại (Tất cả / Chưa đọc), Đánh dấu đã đọc (Mark as read / Mark all as read), Click link trực tiếp tới resource (VD: Click vào thông báo đơn hàng -> Mở popup chi tiết đơn hàng).

---

## US-F16-01: Notification Center — Unread Badge

**Wave 2** | **P1** | **S** | **Status:** Ready

### Story

```
As an   Owner hoặc Nhân viên (Employee)
I want  nhìn thấy biểu tượng cái chuông kèm số lượng thông báo chưa đọc trên thanh điều hướng (Header/Sidebar)
So that tôi biết ngay khi có sự kiện mới cần chú ý mà không cần tải lại trang
```

### Acceptance Criteria

#### AC-1: Hiển thị badge chính xác

```gherkin
GIVEN hệ thống có thông báo mới gửi cho User chưa được đọc
WHEN  User đăng nhập hoặc đang ở bất kỳ màn hình nào trên Dashboard
THEN  biểu tượng cái chuông (Bell Icon) sẽ hiển thị một chấm đỏ (badge) kèm số lượng thông báo chưa đọc (ví dụ: 3)
  AND nếu số lượng > 99, hiển thị "99+"
```

#### AC-2: Cập nhật realtime (hoặc near-realtime)

```gherkin
GIVEN User đang trực tuyến trên Dashboard
WHEN  có đơn hàng mới được tạo (System trigger)
THEN  số lượng trên badge tự động tăng lên 1
  AND có thể kèm theo một hiệu ứng rung nhẹ (optional animation) để thu hút chú ý
```

### Additional Criteria
- [ ] Số lượng unread count cần lấy từ API gọn nhẹ hoặc Webhook/Socket để tránh lag hệ thống.

### Market Notes

- Badge realtime là điều quen thuộc với user MY qua Facebook/Shopee — cần đảm bảo UX tương đương.
- Polling interval 5s là phù hợp với hạ tầng hiện tại cho thị trường SEA.

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] Badge cập nhật đúng khi có notification mới (tested với websocket/polling)
- [ ] Mobile 375px — badge hiển thị đúng trên mọi screen size

---

## US-F16-02: Notification Center — Dropdown List

**Wave 2** | **P1** | **M** | **Status:** Ready

### Story

```
As an   Owner hoặc Nhân viên
I want  click vào biểu tượng chuông để xem danh sách thông báo mới nhất thả xuống (Dropdown)
So that tôi có thể đọc lướt qua các sự kiện quan trọng (đơn mới, cảnh báo) một cách nhanh chóng
```

### Acceptance Criteria

#### AC-1: Mở danh sách thông báo

```gherkin
GIVEN User đang thấy badge thông báo chưa đọc
WHEN  User click vào biểu tượng chuông
THEN  một dropdown (hoặc drawer panel) sẽ mở ra hiển thị danh sách các thông báo mới nhất (tối đa x20 items)
  AND danh sách được sắp xếp theo thời gian mới nhất (Newest first)
  AND hiển thị phân biệt rõ item "Đã đọc" (màu nhạt) và "Chưa đọc" (màu đậm/có chấm xanh)
```

#### AC-2: Thông tin hiển thị của mỗi Item

```gherkin
GIVEN hiển thị list thông báo
WHEN  User nhìn vào một notification item
THEN  phải thấy các thông tin: Icon phân loại (Ví dụ: Giỏ hàng cho Order, Loa cho System), Tiêu đề, Nội dung tóm tắt, Thời gian (Ví dụ: 5 mins ago, 2 hours ago).
```

### Additional Criteria
- [ ] Infinite scrolling hoặc nút "Xem tất cả" (View all) ở cuối dropdown để xem danh sách đầy đủ.
- [ ] Hỗ trợ render an toàn cho Rich Text/HTML nếu là thông báo gửi từ System Admin (F15).

### Market Notes

- User MY quen với Shopee/TikTok Shop notification style — dropdown cần clean, không rối.
- Icon phân loại (giỏ hàng vs loa) giúp người dùng tech thấp nhận diện nhanh loại thông báo.

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] Dropdown hiển thị đúng sorting Newest First
- [ ] Visual phân biệt rõ Đã đọc / Chưa đọc được verify bằng QA
- [ ] Mobile 375px — dropdown responsive thành Bottom Sheet

---

## US-F16-03: Notification Center — Actionable Links

**Wave 2** | **P1** | **S** | **Status:** Ready

### Story

```
As an   Owner hoặc Nhân viên
I want  click thẳng vào một thông báo cụ thể
So that hệ thống đánh dấu nó là "Đã đọc" và điều hướng tôi đến đúng trang tương ứng (ví dụ: Trang chi tiết đơn hàng)
```

### Acceptance Criteria

#### AC-1: Click điều hướng và đổi trạng thái

```gherkin
GIVEN User đang mở Notification drop-down
WHEN  User click vào thông báo "Đơn hàng mới #1024"
THEN  thông báo đó tự động chuyển trạng thái thành "Đã đọc" (Unread count giảm 1)
  AND hệ thống điều hướng (navigate) mở trang /orders với drawer số #1024
```

#### AC-2: Thông báo không có liên kết điều hướng

```gherkin
GIVEN User nhìn thấy thông báo dạng "System Maintenance" (không có link cụ thể)
WHEN  User click vào thông báo
THEN  thông báo chuyển thành "Đã đọc"
  AND dropdown được đóng lại (hoặc giữ nguyên tuỳ UX) nhưng không redirect đi đâu
```

### Market Notes

- Actionable links giảm số bước từ "nhận thông báo đơn hàng" → "xem chi tiết đơn hàng" — quan trọng với Dropshippers hay check trên mobile.

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] Click notification → mark as read + navigate đúng resource (verified với Order #1024)
- [ ] Thông báo không có link không redirect nhưng vẫn mark as read

---

## US-F16-04: Notification Center — Mark All as Read

**Wave 2** | **P2** | **XS** | **Status:** Ready

### Story

```
As an   Owner hoặc Nhân viên
I want  có nút thao tác nhanh "Mark all as read"
So that tôi có thể xoá bỏ badge "thông báo chưa đọc" cho toàn bộ thông báo cùng một lúc
```

### Acceptance Criteria

#### AC-1: Mark all as read

```gherkin
GIVEN User có 15 thông báo chưa đọc
WHEN  User mở dropdown và click "Mark all as read"
THEN  tất cả 15 thông báo lập tức chuyển trạng thái visual thành Đã đọc
  AND unread badge trên biểu tượng chuông biến mất (hoặc về 0)
```

### Market Notes

- "Mark all as read" là tính năng quen thuộc từ email và Shopee — giảm cognitive load cho user.

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] Mark all as read: confirm toàn bộ items đổi visual và badge về 0
- [ ] Nút disabled khi unreadCount = 0

---

## US-F16-05: Notification Center — Global System Broadcasts

**Wave 2** | **P2** | **S** | **Status:** Ready

### Story

```
As an   Owner
I want  nhận được các thông báo chung từ Antigravity Platform (System Updates, Promo)
So that tôi luôn nắm được các chính sách mới hoặc lịch bảo trì của nền tảng
```

### Acceptance Criteria

#### AC-1: Tích hợp với F15 Admin Broadcast

```gherkin
GIVEN Admin hệ thống đẩy 1 thông báo Global "Bảo trì lúc 2h sáng" (F16)
WHEN  Owner đang hoạt động trên hệ thống
THEN  họ sẽ nhận được 1 thông báo vào Notification Center (kèm unread count +1)
  AND thông báo có tag/icon riêng biệt (System/Announcement)
```

### Market Notes

- Global announcements từ Platform (lịch bảo trì, tính năng mới) là kênh quan trọng với SME MY đang dùng trial hoặc gói thấp.

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] Global broadcast từ Admin xuất hiện trong Notification Center của Owner với tag/icon riêng
- [ ] Tested integration với F15 Admin Broadcast

---

## US-F16-06: Notification Center — Live In-app Popup

**Wave 2** | **P1** | **S** | **Status:** Ready

### Story

```
As an   Owner hoặc Nhân viên
I want  hệ thống tự động bật một popup tĩnh gọn (live popup/toast) ở góc dưới của chuông thông báo khi có sự kiện mới xảy ra
So that tôi nhận biết ngay sự kiện quan trọng (như có đơn hàng mới, sản phẩm mới, blog mới) dù đang thao tác ở màn hình khác
```

### Acceptance Criteria

#### AC-1: Hiển thị popup tự động

```gherkin
GIVEN User đang trực tuyến (Online) trên hệ thống Dashboard
WHEN  có sự kiện hệ thống xảy ra: Đơn hàng mới (New Order), Sản phẩm mới được tạo (New Product tạo bởi nhân viên khác), Blog mới được tạo.
THEN  một popup nhỏ gọn xuất hiện ở góc dưới vị trí chuông thông báo (Notification bell)
  AND popup hiển thị thông tin ngắn gọn (Ví dụ: "📦 1 đơn hàng mới vừa được tạo", "📝 Blog 'ABC' vừa xuất bản")
  AND popup tự động biến mất sau 5-7 giây (hoặc khi User click tắt).
```

#### AC-2: Cập nhật Badge đồng thời

```gherkin
GIVEN popup được hiển thị
WHEN  popup xuất hiện
THEN  chấm đỏ (badge) ở chuông thông báo tự động tăng lên 1 đồng thời.
```

### Additional Criteria
- [ ] Không spam: Nếu có quá trình tạo ra nhiều item cùng lúc, popup có thể gom nhóm (VD: "Có 5 đơn hàng mới trong 1 phút vừa qua").
- [ ] UI/UX không che chắn các nút chức năng chính trên màn hình hiện tại.

### Market Notes

- In-app popup quan trọng với Owner MY thường mở dashboard nhưng đang làm việc khác — cần popup không xâm phạm để không làm gián đoạn.

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] Popup xuất hiện đúng vị trí và tự biến mất sau 5-7 giây
- [ ] Popup không che khuất navigation hoặc primary action buttons
- [ ] Badge tăng đồng thời khi popup xuất hiện

---

## US-F16-07: Notification Center — Browser Push Notifications

**Wave 2** | **P2** | **M** | **Status:** Ready

### Story

```
As an   Owner hoặc Nhân viên
I want  được hỏi quyền và nhận thông báo Push Native của trình duyệt (Browser Push Notification) trên máy tính (Desktop)
So that tôi nhận được cảnh báo ngay cả khi đang mở tab khác hoặc thu nhỏ trình duyệt Antigravity
```

### Acceptance Criteria

#### AC-1: Yêu cầu quyền thông báo (Opt-in)

```gherkin
GIVEN User lần đầu truy cập Dashboard sau khi tính năng được bật
WHEN  User tắt các popup Onboarding
THEN  hệ thống hiển thị prompt xin quyền: "Cho phép Antigravity gửi thông báo quan trọng đến trình duyệt của bạn?"
  AND nếu User chọn "Allow" (Browser level), trạng thái được lưu lại là đã cấp quyền
  AND nếu User chọn "Block", không hiển thị lại prompt này trừ khi họ chủ động bật trong cài đặt.
```

#### AC-2: Push Notification Behavior

```gherkin
GIVEN User đã cấp quyền Push Notification của trình duyệt
WHEN  có thông báo quan trọng (VD: Đơn hàng mới, Cảnh báo hệ thống)
  AND tab ứng dụng Antigravity không phải là tab đang active (User đang ở tab khác hoặc app khác trên máy tính)
THEN  một Native Push Notification của hệ điều hành Desktop xuất hiện
  AND khi User click vào thông báo đó, trình duyệt tự động focus về tab Antigravity và di chuyển đến trang nội dung tương ứng (VD: trang Chi tiết Order).
```

### Additional Criteria
- [ ] Bổ sung khu vực Toggles trong User Profile / Settings -> Notification Preferences để User tuỳ chỉnh bật/tắt nhận Browser Push.
- [ ] Công nghệ sử dụng: Web Push API (Service Worker) hoặc Firebase Cloud Messaging (FCM).

### Market Notes

- Desktop Push ít phổ biến hơn ở MY do user thường dùng mobile — tính năng này là P2, không block launch.
- Safari Desktop (iOS 16.4+) mới hỗ trợ Web Push — cần test đặc biệt với Safari version cũ.

### Open Questions & Assumptions
- **Q:** Chúng ta có cần filter (Lọc theo Order, Lọc theo System) ngay trong Dropdown không? -> *Đề xuất tạm thời chỉ gom chung, tính năng Filter sẽ cho vào trang `View All Notifications`.*
- **Assumption:** Việc đẩy realtime thông báo sẽ sử dụng cơ chế có sẵn của frontend polling (5s/lần) hoặc websocket nếu hạ tầng đã sẵn sàng. Dành riêng cho US-F16-07 (Browser Push) bắt buộc cần Service Worker / FCM.
- **Roles:** Cả Owner và Nhân viên đều thấy chung thông báo hệ thống, NHƯNG chỉ thấy thông báo đơn hàng nếu họ có quyền xem đơn hàng (Role-based access).

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] Browser Push opt-in flow tested trên Chrome, Firefox, Edge
- [ ] Safari Desktop tested (iOS 16.4+)
- [ ] Settings toggle bật/tắt Browser Push hoạt động và persist

---

## US-F16-08: Mobile Web UX — Touch-friendly Notification Hub

**Wave 2** | **P1** | **S** | **Status:** Ready

### Story

```
As a   mobile user (Owner / Employee)
I want the notification list to be easy to read and tap on my phone
So that I don't misclick on tiny notification dropdowns
```

### Acceptance Criteria

#### AC-1: Full-Screen or Bottom Sheet Hub

```gherkin
GIVEN a user is on a mobile device (< 768px)
WHEN  they tap the Notification Bell icon
THEN  instead of a floating dropdown, a Full-Screen Drawer or Bottom Sheet opens up
  AND the notification items are rendered with large touch targets (≥ 44px height)
```

#### AC-2: Prominent "Mark All as Read"

```gherkin
GIVEN the mobile notification drawer is open
WHEN  the user wants to clear their notifications
THEN  the "Mark all as read" button is prominently displayed at the top or bottom sticky bar, making it easy to tap with one thumb
```

### Definition of Done
- [ ] 9-Point Checklist pass for mobile mode.
