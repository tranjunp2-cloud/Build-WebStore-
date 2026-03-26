# F16 Notification Center — Design & Wireframes

> **Epic:** Core Infrastructure
> **Feature Code:** F16
> **Figma Design:** [link] (https://www.figma.com/design/oFACZVA1oplxslloJWEkLp/TM_Prime-Web-V2.0?node-id=31127-1251&t=Zu9yDxCVJsUh1bxo-1)
> **Ref PRD:** [F16-notification-center.md](../prd/F16-notification-center.md)

Tài liệu này cung cấp luồng đi của người dùng (User Flow) và bản vẽ Wireframe chi tiết cho bộ tính năng Notification Center (F16). Giao diện tuân thủ **F18 CMS Global Layout** (Sidebar trái và Topbar giữ nguyên).

---

## 1. User Flow (Luồng Người Dùng)

```text
[ Hệ thống sinh sự kiện: Đơn mới, Admin gửi Broadcast... ]
                           │
                           ▼
          [ Gửi data realtime/polling tới Frontend ]
                           │
           ┌───────────────┴───────────────┐
           │                               │
    [ Tab Đang Mở ]                [ Tab Đang Đóng/Ẩn ]
           │                               │
           ▼                               ▼
[ Bật In-app Toast ở góc ]    [ Bật OS Native Browser Push ]
[ +1 số đếm trên Chuông  ]                 │
           │                               │
           └───────────────┬───────────────┘
                           ▼
            [ Người Dùng Click vào Chuông ]
                           │
                           ▼
        [ Desktop: Mở Dropdown | Mobile: Mở Drawer ]
                           │
           ┌───────────────┴───────────────┐
           │                               │
[ Click "Mark all as read" ]   [ Click vào 1 Thông Báo cụ thể ]
           │                               │
           ▼                               ▼
 [ Đánh dấu tất cả là Đã đọc ]   [ Đánh dấu thông báo là Đã đọc ]
 [ Ẩn chấm đỏ (Badge)      ]   [ Trừ 1 số đếm Badge           ]
                                           │
                                           ▼
                                [ Điều hướng đến trang đích ]
                                (VD: Chi tiết Order #1024)
```

---

## 2. Wireframes

### 2.1. Global Header Navigation (Bell Icon & Badge)

Nằm ở thanh trên cùng (Topbar), nơi chứa Search, Bell Icon và Avatar.

```text
┌─────────────────────────────────────────────────────────┐
│ [≡ Logo]  Search...                           [🔔(3)] [👤] │
└─────────────────────────────────────────────────────────┘
```
- **Không có thông báo mới:** Chỉ hiện biểu tượng chuông trống màu nhạt/xám.
- **Có thông báo mới:** Hiện chấm tròn đỏ (Badge) dính góc phải trên chuông kèm con số. Max `99+`.

### 2.2. Desktop View: Dropdown List (Màn hình chính)
(Cho màn hình `≥ 768px`)

Khi click vào biểu tượng chuông, một popover sẽ xổ xuống dóng mép phải với icon chuông.

```text
┌─────────────────────────────────────────────────────────┐
│ [≡ Logo]                                      [🔔(3)] [👤] │
│                                             ▲           │
│                            ┌────────────────┴─────────┐ │
│                            │ Notifications [Mark All] │ │
│                            ├──────────────────────────┤ │
│                            │ [🔵] 📦 New Order #1024  │ │
│                            │      RM 150.00 • 2m ago  │ │
│                            ├──────────────────────────┤ │
│                            │ [🔵] 📢 System Update    │ │
│                            │      Maint 2AM • 1h ago  │ │
│                            ├──────────────────────────┤ │
│                            │ [🔵] ⚠️ Low Stock Alert  │ │
│                            │      Red Tee • 2h ago    │ │
│                            ├──────────────────────────┤ │
│                            │ [  ] 📦 New Order #1020  │ │
│                            │      RM 40.00 • 1d ago   │ │
│                            ├──────────────────────────┤ │
│                            │        View all ▼        │ │
│                            └──────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```
- **Item chưa đọc (`[🔵]`)**: Icon nổi bật, Text bôi đậm (Bold), nền sáng / màu thương hiệu nhạt.
- **Item đã đọc (`[  ]`)**: Icon chìm, Text in thường (Regular), nền trắng/transparent.

### 2.3. Mobile View: Full-Screen Drawer / Bottom Sheet
(Cho màn hình `< 768px`)

Giao diện trượt lên từ mép dưới hoặc vuốt ngang toàn màn hình để dễ thao tác chạm.

```text
📱 Mobile View (Drawer/Bottom Sheet)
┌─────────────────────────────┐
│                             │
│ ┌─────────────────────────┐ │
│ │ 🔔 Notifications    [X] │ │
│ ├─────────────────────────┤ │
│ │                         │ │
│ │ [🔵] 📦 New Order #1024 │ │
│ │      RM 150.00 • 2m ago │ │
│ │ ─────────────────────── │ │
│ │ [🔵] 📢 System Update   │ │
│ │      Maint 2AM • 1h ago │ │
│ │ ─────────────────────── │ │
│ │ [  ] 📦 Order #1020     │ │
│ │      RM 20.00 • 1d ago  │ │
│ │                         │ │
│ ├─────────────────────────┤ │
│ │  [ Mark All As Read ]   │ │ <-- Nút thao tác bám (sticky) để dễ với ngón cái
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

### 2.4. In-App Live Toast (Popup Realtime)

Khi User đang làm việc và có sự kiện mới (VD: đơn hàng), một thẻ toast nhỏ nổi lên ở góc dưới màn hình.

```text
┌─────────────────────────────────────────────────────────┐
│ 🏠 Dashboard                                            │
│   (Content...)                                          │
│                                                         │
│                                                         │
│                                 ┌─────────────────────┐ │
│                                 │ 📦 New Order #1025  │ │
│                                 │ Just now        [X] │ │
│                                 └─────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```
- **Behaviour:** Nổi lên dạng Card nổi (Elevation shadow), không che lấp Navigation hay nút chính, và tự động biến mất sau `5 giây`. Kèm theo hiệu ứng tăng Badge trên Icon chuông cùng lúc.

---

## 3. UI States

### 3.1. Empty State
Khi user không có thông báo nào.

```text
                            ┌─────────────────────────┐
                            │ Notifications           │
                            ├──────────────────────────┤
                            │                         │
                            │        ( 🔕 )          │
                            │  You have no new        │
                            │  notifications right    │
                            │  now.                   │
                            │                         │
                            └─────────────────────────┘
```

### 3.2. Loading State
Hiển thị khung xương (Skeletons) mờ liên tục chớp tắt khi gọi API fetch danh sách thông báo.

```text
                            ┌─────────────────────────┐
                            │ Notifications           │
                            ├──────────────────────────┤
                            │ [ ] ▒▒▒▒▒▒▒▒▒▒▒▒        │
                            │     ▒▒▒▒▒▒▒▒ • ▒▒       │
                            ├──────────────────────────┤
                            │ [ ] ▒▒▒▒▒▒▒▒▒▒▒▒▒       │
                            │     ▒▒▒▒▒▒▒▒ • ▒▒       │
                            └─────────────────────────┘
```

### 3.3. Browser Push Opt-In Prompt
(Native OS level permission) Hiển thị prompt ở trung tâm màn hình khi user (Owner) lần đầu đăng nhập.
Mặc định sẽ trigger browser's native allow popup (Ví dụ: `Antigravity wants to // Allow Notifications`). Trong Settings cũng có tuỳ chọn (Toggle): `[ Bật / Tắt ] Nhận Desktop Notification`.
