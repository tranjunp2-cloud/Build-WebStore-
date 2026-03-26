# Design & Wireframes: Dashboard Suite (F03)

> **Feature:** F03 — Dashboard Overview, Analytics & SEO
> **Ref PRD:** [F03-dashboard.md](../prd/F03-dashboard.md)
> **Ref Stories:** [F03-dashboard-stories.md](../stories/F03-dashboard-stories.md)

Tài liệu này cung cấp wireframe thô (ASCII / cấu trúc text) để minh họa cho các tính năng Dashboard Overview, Analytics và SEO của tính năng F03, phục vụ việc xây dựng UI/UX cho frontend.

---

## 1. Màn hình chính (Dashboard Overview)

### 1.1 Desktop View (Màn hình lớn)

> **[Global CMS Constraint]:** Toàn bộ giao diện Dashboard được render bên trong khu vực `Main Content Area` (giữ nguyên Global Sidebar Navigation và Top Header).

```text
[ Global Sidebar Navigation ] | [ Global Top Header: Breadcrumbs, Store Selector, User Profile ]
                              |
[ Dashboard ]                 | [ Filter: Today | 7 days v | 30 days ] [ Tùy chỉnh Dashboard ]
                              |
---------------------------------------------------------------------------------------------------
| [ Views (Traffic)     ] | [ Clicks (Leads)      ] | [ Checkout (Engagement) ] | [ Revenue             ] |
| [ 15,240  (+12%) ↗    ] | [ 340     (-5%) ↘     ] | [ 1,200    (+8%) ↗      ] | [ RM 15,000 (+20%) ↗  ] |
| [ _--_/^--_/\_        ] | [ _--_/               ] | [ __/--\_/\_            ] | [ _--_/^--_/\_        ] |
---------------------------------------------------------------------------------------------------
                              |
[ Action Required (Pending) ] | [ SEO Health Widget                           ]
                              | 
- Order #1002 từ [John Doe]   |  Điểm SEO: [ 75/100 ] (Circle Chart)
  (Pending - RM 250)    [->]  |
                              |  [Warning] Thiếu Meta Title ở 5 sản phẩm
- Order #1001 từ [Jane]       |  [Warning] Cần tối ưu hình ảnh
  (Pending - RM 150)    [->]  |
                              |  [ ✨ AI Fix All Issues ] (Button bật Modal)
[ View all Orders ->        ] |
```

### 1.2 Empty State (Chưa có Website)

```text
                              |
                              |               [ (Illustration: Dashboard & Rocket) ]
                              |
                              |                      Chưa có dữ liệu website
                              |     Hãy tạo website đầu tiên để bắt đầu theo dõi hiệu quả kinh doanh.
                              |
                              |                       [ + Tạo Website mới ]
                              |
```

### 1.3 Mobile View (Màn hình nhỏ, Lưới 2x2)

```text
[ Hamburger ] [ Logo ] [ Profile ]
---------------------------------------
Dashboard         [ Filter: 7 days v ]
[ Tùy chỉnh ]
---------------------------------------
[ Views         ] | [ Clicks        ]
[ 15,240 (+12%) ] | [ 340 (-5%)     ]
[ _--_/^--_/\_  ] | [ _--_/         ]
---------------------------------------
[ Checkout      ] | [ Revenue       ]
[ 1,200 (+8%)   ] | [ RM 15,000     ]
[ __/--\_/\_    ] | [ _--_/^--_/\_  ]
---------------------------------------

[ Action Required ]
- Order #1002 (RM 250) [->]
- Order #1001 (RM 150) [->]
[ View all Orders ->]

---------------------------------------

[ SEO Health Widget ]
Điểm SEO: [ 75/100 ]
Thiếu Meta title, Chưa tối ưu ảnh...
[ ✨ AI Fix All Issues ]
```

---

## 2. Màn hình Chi tiết (Analytics Detail)

### 2.1 Desktop View

```text
[ Dashboard ] > [ Analytics ] | [ Filter: Today | 7 days v | 30 days ]
                              |
---------------------------------------------------------------------------------------------------
|  [Daily Traffic Bar Chart]                                                                      |
|                                                                                                 |
|   |         [ Hover Tooltip: May 20 - 1500 views ]                                              |
|   |           _                                                                                 |
|   |   _      | |      _                                                                         |
|   |  | |     | |     | |                                                                        |
|   |__|_|_____|_|_____|_|____________________________________________________________________    |
|      19/5   20/5    21/5                                                                        |
---------------------------------------------------------------------------------------------------
                              |
[ Top Pages (Tab) ] [ Top Products ] [ Top Blogs ]
                              |
1. /home                 - 5,000 views  (30%)
2. /products/ao-phong    - 2,000 views  (15%)
3. /blog/khuyen-mai      - 1,500 views  (10%)
4. /contact              - 500 views    (5%)
... (Max 10 rows)
```

*(Trên Mobile, trục X của Bar chart sẽ được giãn cách, ví dụ chỉ hiện 19/5, 23/5, 27/5 để tránh đè chữ, user có thể chạm, giữ và kéo để xem tooltip chi tiết từng ngày)*

---

## 3. Màn hình Chi tiết (SEO Dashboard)

### 3.1 Desktop View

```text
[ Dashboard ] > [ SEO Dashboard ]
                              |
---------------------------------------------------------------------------------------------------
| [ Tổng quan SEO Health ]                                 | [ Sitemap & Meta Tags ]              |
|                                                          | [ Generate Sitemap ]                 |
|       /---\       Score: 75/100                          | Last updated: 24/05/2026             |
|      | 75  |      [ ✨ AI Fix All Issues ]               | Auto Meta Generation: [x] Enabled    |
|       \---/                                              |                                      |
| Breakdown:                                               |                                      |
| - Meta Tags: 60/100 (Cần cải thiện)                      |                                      |
| - Content: 80/100   (Tốt)                                |                                      |
| - Technical: 90/100 (Rất tốt)                            |                                      |
---------------------------------------------------------------------------------------------------
                              |
[ Keyword Tracker (Max 5) ]   | [ + Thêm Từ Khóa ]
                              |
| Keyword             | Rank on Google | Trend | Action   |
-----------------------------------------------------------
| "buy shoes online"  | #5             | [ ↗ ] | [ Del ]  |
| "best store VN"     | #12            | [ = ] | [ Del ]  |
| "giày thể thao nam" | #25            | [ ↘ ] | [ Del ]  |
| (Empty slot)        |                |       |          |
| (Empty slot)        |                |       |          |
```

---

## 4. UI States, Modals & Drawers

### 4.1 Modal Tùy chỉnh Dashboard (Desktop)

Khi click `[ Tùy chỉnh Dashboard ]` trên Desktop:

```text
+-------------------------------------------------------------+
| Tùy chỉnh Dashboard (Overview)                        [ X ] |
|-------------------------------------------------------------|
| Chọn các chỉ số bạn muốn hiển thị (Kéo thả để sắp xếp):     |
|                                                             |
| [::] [x] Views (Traffic)                                    |
| [::] [x] Clicks Widget (Leads)                              |
| [::] [x] Clicks Sản phẩm/Giỏ hàng (Engagement)              |
| [::] [x] Pending Orders / Revenue                           |
| [::] [ ] Lượt truy cập Blog nhiều nhất                    |
| [::] [ ] Lượt mở trang theo URL                             |
|                                                             |
|                                     [ Hủy ] [ Lưu thay đổi ]|
+-------------------------------------------------------------+
```

### 4.2 Bottom Sheet Tùy chỉnh (Mobile)

Thay vì kéo thả khó thao tác trên di động, mobile sử dụng nút Lên/Xuống:

```text
+---------------------------------------+
| [-] (Swipe down to close)             |
| Tùy chỉnh Dashboard                   |
|---------------------------------------|
| [x] Views               [ ⬇ ]         |
| [x] Clicks Widget   [ ⬆ ] [ ⬇ ]         |
| [x] Clicks Checkout [ ⬆ ] [ ⬇ ]         |
| [x] Pending Orders      [ ⬆ ]         |
| [ ] Top Blog Views                    |
|                                       |
| [ Lưu thay đổi ] (Full width button)  |
+---------------------------------------+
```

### 4.3 Quá trình AI SEO Fix All (SSE Streaming)

Khi click `[ ✨ AI Fix All Issues ]` từ Overview hoặc SEO Dashboard:

```text
+-------------------------------------------------------------+
| ✨ Hệ thống AI đang tự động sửa lỗi SEO...                |
|-------------------------------------------------------------|
|                                                             |
| Tiến trình: [=========================>        ] 70%        |
|                                                             |
| - [x] Tạo Meta Title cho 12 sản phẩm                        |
| - [x] Tối ưu Meta Description cho trang chủ                 |
| - [ ] Đang thêm Alt Text cho hình ảnh... (Streaming)        |
| - [ ] Cập nhật tốc độ tải trang...                          |
|                                                             |
| (Vui lòng không đóng cửa sổ này, quá trình mất khoảng 15s)  |
|                                     [ Dừng (Cancel) ]       |
+-------------------------------------------------------------+
```

Sau khi hoàn tất:

```text
+-------------------------------------------------------------+
| ✨ AI SEO Fix All hoàn tất!                           [ X ] |
|-------------------------------------------------------------|
|                                                             |
| Chúc mừng! Điểm SEO của bạn đã tăng lên: 95/100 [ ↗ +20 ]   |
|                                                             |
| 25 lỗi đã được khắc phục.                                   |
|                                                             |
|                                     [ Hoàn tác (Undo) ]     |
|                                     [ OK, Đóng ]            |
+-------------------------------------------------------------+
```

### 4.4 Cảnh báo / Toast Notification

- Fetch data lỗi (API Failure): Toasts màu đỏ *"Không thể tải dữ liệu Analytics. [Thử lại]"*
- SSE Timeout (Fix All > 15s): Toasts màu đỏ *"Không thể hoàn tất AI Fix All, vui lòng thử lại."*
- Generate Sitemap thành công: Toasts màu xanh *"Sitemap đã được khởi tạo thành công."*
- Auto Meta Gen lỗi nền (Publish Flow): Âm thầm retry (background error log) không cản trở flow bán hàng. 

---
*(End of Wireframe Document)*
