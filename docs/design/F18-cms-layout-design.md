# F18 CMS Core Layout & Navigation — Design & Wireframes

> **Epic:** Core Infrastructure
> **Feature Code:** F18
> **Figma Design:** [UI Design](https://www.figma.com/design/oFACZVA1oplxslloJWEkLp/TM_Prime-Web-V2.0?node-id=30675-275&t=ImhpbJ1K0aBFikqf-1)
> **Prototype:** [Interactive Demo](https://www.figma.com/make/Y48xuOh2gMCid2UmqOAFys/F01-ai-chat-builder-demo?fullscreen=1&t=DLqQPtpTDgA4lMa9-1&preview-route=%2Fdashboard)
> **Ref PRD:** [F18-cms-layout.md](../prd/F18-cms-layout.md)
> **Ref Stories:** [F18-cms-layout-stories.md](../stories/F18-cms-layout-stories.md)

Tài liệu này cung cấp luồng người dùng (User Flow) và bản vẽ Wireframe chi tiết cho bộ khung CMS Core Layout (F18). Đây là **Root Layout** — mọi module tính năng khác (F03, F05, F08, F10, F15, F17, F20, F32, F33…) đều phải render bên trong `Main Content Area` của khung giao diện này.

---

## 1. User Flow (Luồng Người Dùng)

### 1.1. Luồng chính — Navigation & Layout

```text
[ User Login thành công (F02 Auth) ]
                │
                ▼
    [ Redirect → /dashboard ]
                │
                ▼
    ┌───────────┴───────────────────────────┐
    │  CMS Layout load hoàn tất:            │
    │  • Top Header: Logo + Bell + Avatar   │
    │  • Sidebar: Menu items                │
    │  • Main Content: Dashboard (F03)      │
    └───────────┬───────────────────────────┘
                │
    ┌───────────┴───────────────────────────┐
    │                                       │
  [Desktop ≥ 768px]                    [Mobile < 768px]
    │                                       │
    ▼                                       ▼
[ Sidebar Expanded ]              [ Sidebar Hidden, ☰ visible ]
[ Icon + Text hiển thị ]          [ Click ☰ → Drawer slide-in ]
    │                                       │
    └───────────┬───────────────────────────┘
                │
                ▼
    [ User click Menu Item trên Sidebar ]
                │
                ▼
  [ Sidebar PHẲNG hoàn toàn — không còn accordion ]
  [ 4 khối = Section Header + Divider tĩnh ]
  [ Mọi mục con LUÔN hiển thị, mỗi item là 1 Leaf-route ]
                │
                ▼
         [ Main Content area load module tương ứng ]
         [ Header + Sidebar vẫn fixed ]
                    │
                    ▼ [Mobile only]
         [ Drawer tự đóng sau khi click bất kỳ Leaf-route ]
```

### 1.2. Luồng Header Interactions

```text
[ User đang ở bất kỳ trang CMS nào ]
                │
    ┌───────────┼───────────────────┐
    │           │                   │
    ▼           ▼                   ▼
[ Click Logo ] [ Click 🔔 Bell ]  [ Click Avatar ]
    │           │                   │
    ▼           ▼                   ▼
[ → /dashboard ] [ Mở F16        ] [ Mở Dropdown:    ]
                 [ Notification   ] [  • Profile       ]
                 [ Dropdown/      ] [  • Language BM/EN]
                 [ Drawer         ] [  • Workspace     ]
                                   [  • Logout         ]
                                        │
                              ┌─────────┼──────────┐
                              │         │          │
                              ▼         ▼          ▼
                     [ Profile ]  [ Language ] [ Logout ]
                     [ → route ] [ Toggle    ] [ → /login ]
                                 [ BM ↔ EN   ]
                                 [ Lưu vào   ]
                                 [ localStorage]
                                 [ Không reload]
```

### 1.3. Luồng Mobile Drawer

```text
[ Mobile User ở trang CMS ]
            │
            ▼
[ Click ☰ Hamburger ở Header trái ]
            │
            ▼
[ Sidebar Drawer slide-in từ trái ]
[ Overlay mờ che Main Content ]
            │
    ┌───────┴───────────────────┐
    │                           │
    ▼                           ▼
[ Click Leaf ]            [ Click Overlay ]
[ VD: Orders ]            [ hoặc Swipe ← ]
    │                           │
    ▼                           ▼
[ Drawer đóng ]          [ Drawer đóng ]
[ Navigate đến route ]   [ Giữ nguyên trang hiện tại ]
```

> **Lưu ý:** Sidebar không còn Menu Nhóm (accordion). Mọi item đều là Leaf-route → click bất kỳ item nào trên mobile đều đóng Drawer + navigate.

---

## 2. Navigation Menu Structure

> **Cập nhật 2026-06-02 (IA Restructure):** Chuyển từ mô hình accordion (Menu Nhóm expand/collapse) sang **4 khối phẳng hoàn toàn**. Mỗi khối đóng vai trò **Section Header + Divider tĩnh** để phân vùng trực quan — **không có cơ chế đóng/mở**, toàn bộ mục con luôn hiển thị. Dashboard đứng độc lập trên cùng; Help Center neo cố định ở đáy Sidebar.

### Thứ tự hiển thị

```
Dashboard → [My Website] → [CORE OPERATIONS] → [CRM] → [SETTINGS] → (đáy) Help Center
```

### Bảng menu chi tiết

| Khối | Menu Item | Icon | Route | Feature | Badge | Ghi chú |
|------|-----------|------|-------|---------|-------|---------|
| — | **Dashboard** | 📊 | `/dashboard` | F03 | — | Standalone, trên cùng |
| **My Website** | Editor | 🎨 | `/editor` | F05 | — | Section header tĩnh |
| | Blog | 📝 | `/blog` | F17 | — | |
| | Media | 🖼️ | `/media` | — | — | Kho tư liệu hình ảnh |
| **CORE OPERATIONS** | Orders | 🛒 | `/orders` | F10 | Số đơn cần xử lý (vd 384) | |
| | Products | 📦 | `/products` | F08 | Số sản phẩm (vd 142) | |
| | Discounts | 🏷️ | `/discounts` | F33 | Số mã đang active (vd 12) | ⚠️ Route chưa tồn tại — phụ thuộc F33 (#1126–1133) |
| **CRM** | All Customers | 👥 | `/customers` | — | Số khách hàng (vd 210) | Rename từ "Customers" |
| | Contact Leads | 📇 | `/contact-leads` | — | Số leads (vd 34) | |
| **SETTINGS** | Payments | 💳 | `/settings/payments` | — | — | |
| | Shipping | 🚚 | `/settings/shipping` | — | — | |
| | Domains | 🌐 | `/settings/domains` | — | — | |
| | Notifications | 🔔 | `/settings/email-templates` | F32 | — | **Chỉ relabel** từ "Email Templates"; route giữ nguyên |
| | Team & Account | 👤 | `/settings/staff` | F15 | — | Trang đích có 2 sub-tab: **Staff** (default) + **Account Profile** (`/settings/profile`) |
| — | **Help Center** | 🎧 | `/help` | F20 | — | Footer, neo cố định đáy, tách bởi divider |
| — | Templates Health | 🛡️ | `/templates-health` | — | — | **Dev-only** — ẩn trên Production, chỉ hiện ở môi trường nội bộ/sandbox |

### Badge rules

- Badge là số đếm động, hiển thị bên phải label dưới dạng pill, **xám trung tính** (quyết định 2026-06-11 — KHÔNG dùng đỏ cho Orders).
- Khi count = 0/undefined → ẩn badge (không hiện "0"). Số > 999 → `999+`.
- Badge = **TỔNG số record** của tenant, áp cho 5 mục: Orders (mọi status), Products, Discounts, All Customers, Contact Leads (= contact-submissions + subscribers). Counts wire server-side tại `src/lib/dashboard/sidebar-badge-counts.ts`.

---

## 3. Wireframes

### 3.1. CMS Framework Layout — Desktop View (≥ 768px)

> **[Global CMS Constraint]** Đây là Root Layout của toàn bộ CMS Admin. Mọi module tính năng khác đều render vào phần Main Content Area.

```text
┌── CMS Layout ─────────────────────────────────────────────────────┐
│ ┌─ Top Header (Fixed, z-index cao nhất) ─────────────────────────┐│
│ │ [⊞] [Logo] PrimeWeb  [BM|EN]          [🔔 3] [👤▼]      [«]   ││
│ │  ↑    ↑ Click →                          ↑      ↑         ↑    ││
│ │ App  /dashboard                    F16 Badge  Avatar  Collapse ││
│ │ Switcher                                      Dropdown Sidebar ││
│ │ (9 chấm)                                                       ││
│ └────────────────────────────────────────────────────────────────┘│
│ ┌── Sidebar (Fixed Left, overflow-y: auto) ─┐ ┌── Main Content ─┐│
│ │                                           │ │ (overflow-y:auto)││
│ │  [Tên Website hiện tại]                   │ │                  ││
│ │  📊  Dashboard                            │ │  ┌────────────┐  ││
│ │  ── MY WEBSITE ───────────                │ │  │            │  ││
│ │  🎨  Editor                               │ │  │  Feature   │  ││
│ │  📝  Blog                                 │ │  │  Content   │  ││
│ │  🖼️  Media                                │ │  │  (F03,     │  ││
│ │  ── CORE OPERATIONS ──────                │ │  │   F05,     │  ││
│ │  🛒  Orders                    [384]      │ │  │   F08...) │  ││
│ │  📦  Products                  [142]      │ │  │            │  ││
│ │  🏷️  Discounts                 [12]       │ │  └────────────┘  ││
│ │  ── CRM ──────────────────                │ │                  ││
│ │  👥  All Customers             [210]      │ │                  ││
│ │  📇  Contact Leads             [34]       │ │                  ││
│ │  ── SETTINGS ─────────────                │ │                  ││
│ │  💳  Payments                             │ │                  ││
│ │  🚚  Shipping                             │ │                  ││
│ │  🌐  Domains                              │ │                  ││
│ │  🔔  Notifications                        │ │                  ││
│ │  👤  Team & Account                       │ │                  ││
│ │  ─────────────────────────                │ │                  ││
│ │  🎧  Help Center                          │ │                  ││
│ └───────────────────────────────────────────┘ └──────────────────┘│
└───────────────────────────────────────────────────────────────────┘
```

**Chi tiết Sidebar:**
- Width cố định ~240px
- Active item: highlight background + font bold theo Design System
- **Không còn accordion** — 4 khối là Section Header tĩnh (chữ uppercase nhạt + divider), mọi item luôn hiển thị
- Badge: pill số đếm bên phải label (Orders/Products/Discounts/All Customers/Contact Leads); ẩn khi = 0
- Help Center: neo cố định ở cuối sidebar, phân tách bởi divider
- `Templates Health`: chỉ render khi không phải Production (Dev-only)

**Header (Desktop/Tablet):**
- `[⊞]` **App Switcher** (icon lưới 9 chấm): nằm ngoài cùng bên trái, **trước** Logo → mở dropdown launcher (xem §3.7)
- `[«]` **Collapse/Expand Sidebar** (chevron-double-left): nằm ngoài cùng bên phải Header → thu/mở sidebar (xem §3.8); `hidden md:block` (ẩn trên mobile)

---

### 3.1b. Mini Sidebar — Trạng thái Collapsed (Desktop/Tablet)

```text
┌─ Top Header ──────────────────────────────────────┐
│ [⊞] [Logo]  [BM|EN]        [🔔 3] [👤▼]     [»]   │ ◄── icon đổi thành » (expand)
└────────────────────────────────────────────────────┘
┌──────┐ ┌── Main Content ───────────────┐
│ ~64px│ │                               │
│  📊  │ │   (rộng hơn khi sidebar thu)  │
│  ──  │ │                               │
│  🎨  │ │   Hover icon → Tooltip:       │
│  📝  │ │   ┌──────────┐                │
│  🖼️  │ │   │ Editor   │ ◄── nhãn EN    │
│  ──  │ │   └──────────┘                │
│ 🛒•  │ │   (• = chấm badge thu gọn)    │
│ 📦•  │ │                               │
│ 🏷️•  │ │                               │
│  ⋮   │ │                               │
│  🎧  │ │                               │
└──────┘ └───────────────────────────────┘
```

- Width ~64px, **chỉ icon căn giữa** — ẩn toàn bộ text label + section header (divider giữ lại dạng line mảnh)
- Hover từng icon → **Tooltip** hiển thị nhãn Tiếng Anh tương ứng (Editor, Orders, …)
- Badge thu gọn thành **chấm tròn nhỏ** (dot) trên góc icon (không hiện số khi collapsed)
- Trạng thái lưu `localStorage.sidebar_collapsed` (`true`/`false`) — giữ nguyên qua reload & chuyển module

---

### 3.2. CMS Framework Layout — Mobile View (< 768px)

```text
📱 Mobile View
┌──────────────────────────────┐
│ ☰  PrimeWeb     [🔔 3] [👤]  │ ◄── Top Header (Fixed)
├──────────────────────────────┤
│                              │
│    ┌────────────────────┐    │
│    │                    │    │
│    │   Feature Content  │    │
│    │   (Full width)     │    │
│    │                    │    │
│    │   Scrollable       │    │
│    │                    │    │
│    └────────────────────┘    │
│                              │
└──────────────────────────────┘

Khi click ☰ → Sidebar Drawer:
┌──────────────────────────────┐
│ ☰  PrimeWeb     [🔔 3] [👤]  │
├──────────┬───────────────────┤
│ 📊 Dash.   │▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│
│ MY WEBSITE │▒▒▒ Overlay mờ ▒│
│ 🎨 Editor  │▒▒▒ (Click để  ▒│
│ 📝 Blog    │▒▒▒  đóng)     ▒│
│ 🖼️ Media   │▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│
│ CORE OPS   │▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│
│ 🛒 Ord.384 │▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│
│ 📦 Prod.142│▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│
│ 🏷️ Disc.12 │▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│
│ CRM        │▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│
│ 👥 Cust.210│▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│
│ 📇 Leads 34│▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│
│ SETTINGS   │▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│
│ 💳 Pay.    │▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│
│ 🚚 Ship.   │▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│
│ 🌐 Domains │▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│
│ 🔔 Notif.  │▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│
│ 👤 Team    │▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│
│ ────────── │▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│
│ 🎧 Help    │▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│
└────────────┴───────────────┘
```

**Hành vi đóng Drawer:**
- Click vào Overlay mờ → Drawer slide-out
- Swipe từ phải sang trái → Drawer slide-out
- Click vào bất kỳ item (đều là Leaf-route) → Drawer đóng + Navigate
- Drawer cuộn dọc (`overflow-y: auto`) khi danh sách dài hơn màn hình

---

### 3.3. Top Header — Chi tiết Components

```text
Desktop Header:
┌──────────────────────────────────────────────────────────────────────┐
│ [⊞] [Logo PrimeWeb] [Tên Website] [BM|EN]  [🔔 3] [👤▼]        [«]  │
│  ↑    ↑ Click→/dash   ↑ Context    ↑ Lang   ↑ F16  ↑ Avatar  ↑       │
│ App                    display      Switch   Badge   Menu  Collapse   │
│ Switcher                                                    Sidebar   │
└──────────────────────────────────────────────────────────────────────┘

Mobile Header:
┌────────────────────────────────────────┐
│  [☰] [⊞] [Logo]          [🔔 3] [👤]  │
│   ↑   ↑ App Switcher                   │
│  Drawer   (« ẩn trên mobile)           │
└────────────────────────────────────────┘
```

---

### 3.4. Avatar Dropdown Popover

Khi click vào Avatar ở Header:

```text
Desktop:
                              ┌─────────────────────┐
                              │ 👤 Nguyễn Văn A      │
                              │    owner@email.com   │
                              ├─────────────────────┤
                              │ 🧑 Profile Settings  │
                              ├─────────────────────┤
                              │ 🌐 Language          │
                              │    (•) English       │
                              │    ( ) Bahasa Melayu │
                              ├─────────────────────┤
                              │ 🔀 Switch Workspace  │
                              │    ✓ MyStore-01      │
                              │      MyStore-02      │
                              ├─────────────────────┤
                              │ 🚪 Logout            │
                              └─────────────────────┘
```

**Hành vi:**
- Click outside / nhấn ESC → Dropdown đóng
- Chọn Language → lưu localStorage, đổi text tĩnh ngay, KHÔNG reload trang
- Chọn Workspace → chuyển context store, reload data

---

### 3.5. Notification Bell — Badge & Dropdown

```text
Không có thông báo mới:           Có thông báo mới:
    [🔔]                              [🔔(3)]
     ↑ Màu nhạt/xám                   ↑ Red dot badge + số (max 99+)

Click Bell → Mở F16 Notification Dropdown/Drawer
(Xem chi tiết tại: docs/design/F16-notification-center-design.md)
```

---

### 3.6. Sidebar — Khối phẳng (Flat Sections, KHÔNG accordion)

```text
── CORE OPERATIONS ──────────   ◄── Section Header tĩnh (uppercase, màu nhạt) + divider
🛒  Orders                 [384]
📦  Products               [142]
🏷️  Discounts              [12]
── CRM ──────────────────────   ◄── Section Header kế tiếp
👥  All Customers          [210]
📇  Contact Leads          [34]
```

- **Không có cơ chế đóng/mở.** Section Header chỉ là nhãn phân vùng — không click được, không có icon mũi tên.
- Mọi mục con luôn hiển thị (always-open). User cuộn dọc sidebar nếu danh sách dài hơn viewport.
- Active item: highlight nền + bold; badge pill nằm bên phải label.
- Quyết định này áp dụng đồng bộ cho Desktop, Tablet và Mobile Drawer.

---

### 3.7. App Switcher — Dropdown Launcher (SSO)

Nút icon lưới **9 chấm** (`⊞`), nằm **ngoài cùng bên trái Header, trước Logo**. Click → mở dropdown launcher liệt kê các app trong hệ sinh thái SaaS; mỗi item là **direct link** tới URL SSO của app tương ứng.

```text
[⊞] ← click
 │
 ▼
┌──────────────────────────┐
│  Switch app              │
├──────────────────────────┤
│  🟦  Web Store  (current)│ ◄── app hiện tại, đánh dấu active
│  🟩  App B               │ ──→ direct link tới URL SSO của App B
│  🟧  App C               │ ──→ direct link tới URL SSO của App C
│  …                       │
└──────────────────────────┘
```

**Hành vi:**
- Click item → điều hướng qua **SSO** sang app tương ứng (giữ session qua hệ thống SSO/Workspace chung)
- App hiện tại (Web Store) đánh dấu active; danh sách app lấy từ cấu hình (env / API workspace)
- Click outside / ESC → đóng dropdown
- Hiển thị trên cả Desktop và Mobile (nút SSO điều hướng chung)

---

### 3.8. Collapse / Expand Sidebar

Nút **chevron-double-left** (`«`), nằm **ngoài cùng bên phải Header**. Toggle thu gọn / mở rộng sidebar để tối ưu không gian làm việc.

```text
Expanded (~240px)          Collapsed (~64px, Mini)
[«] ← click          →     [»] ← click để mở lại
🎨  Editor                 🎨   (hover → tooltip "Editor")
🛒  Orders        [384]    🛒•  (badge thu thành dot)
```

**Hành vi:**
- Click `«` → sidebar thu về **Mini (~64px, icon-only)**, icon đổi thành `»`; click `»` → mở lại ~240px (xem wireframe §3.1b)
- Khi collapsed: ẩn text label + section header; hover icon → **tooltip nhãn EN**; badge → dot
- **Lưu trạng thái** `localStorage.sidebar_collapsed` (`true`/`false`) — giữ nguyên sau reload & khi chuyển module
- Responsive: `hidden md:block` — **ẩn hoàn toàn trên Mobile** (< 768px); mobile dùng `☰` + Drawer thay thế
- Animation thu/mở mượt (< 200ms)

---

## 4. UI States (Các trạng thái UI)

### 4.1. Sidebar States

| State | Điều kiện | Mô tả |
|-------|-----------|-------|
| **Expanded** | Desktop mặc định (`sidebar_collapsed=false`) | Icon + Text đầy đủ, width ~240px |
| **Collapsed (Mini, Icon-only)** | User click `«` (Desktop/Tablet); lưu `localStorage.sidebar_collapsed=true` | Chỉ hiện Icon căn giữa, width ~64px, ẩn text + section header, hover → tooltip nhãn EN, badge → dot (§3.1b) |
| **Drawer** | Mobile < 768px | Ẩn mặc định, slide-in từ trái khi click ☰; nút `«` ẩn (`hidden md:block`) |

### 4.2. Loading State — Route Transition

```text
┌─ Top Header ──────────────────────────────────────┐
│ [Logo]                               [🔔] [👤]    │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │ ◄── Progress bar 2px
└───────────────────────────────────────────────────┘
```
- Khi navigate giữa các module, progress bar xuất hiện ở mép dưới Header
- Hoàn tất → bar chạy đến 100% rồi ẩn

### 4.3. Loading State — Initial Layout Skeleton

Khi chưa fetch xong session data (F02 Auth):

```text
┌─ Top Header ──────────────────────────────────────┐
│ [Logo]                           [▒▒▒] [▒▒▒]     │
└───────────────────────────────────────────────────┘
┌── Sidebar ──────┐ ┌── Main Content ───────────────┐
│ ▒▒▒▒▒▒▒▒▒▒▒▒▒  │ │                               │
│ ▒▒▒▒▒▒▒▒▒▒▒▒▒  │ │  ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒  │
│ ▒▒▒▒▒▒▒▒▒▒▒    │ │  ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒  │
│ ▒▒▒▒▒▒▒▒▒▒▒▒▒  │ │                               │
│ ▒▒▒▒▒▒▒▒▒▒▒    │ │  ▒▒▒▒▒▒▒▒▒▒▒▒               │
│                 │ │  ▒▒▒▒▒▒▒▒▒▒▒▒               │
└─────────────────┘ └───────────────────────────────┘
```

### 4.4. Error State — Session Expired

```text
┌── Toàn màn hình ──────────────────────┐
│                                       │
│        ⚠️ Session đã hết hạn           │
│                                       │
│   Vui lòng đăng nhập lại để tiếp tục │
│                                       │
│         [ Đăng nhập lại ]             │
│           → redirect /login           │
│                                       │
└───────────────────────────────────────┘
```

### 4.5. Toast Notifications

| Tình huống | Loại Toast | Nội dung |
|------------|-----------|----------|
| Logout thành công | ✅ Success (xanh) | "Đăng xuất thành công" |
| Session expired (401) | ⚠️ Warning (vàng) | "Phiên đăng nhập đã hết hạn. Đang chuyển hướng..." |
| Language switch | ✅ Info (xanh dương) | "Ngôn ngữ đã chuyển sang English / Bahasa Melayu" |

---

## 5. Responsive Breakpoints

| Breakpoint | Layout | Sidebar | Header | Content |
|-----------|--------|---------|--------|---------|
| **Desktop** ≥ 1024px | 3 cột | Expanded (Icon + Text, ~240px) | Full | width = 100% - 240px |
| **Tablet** 768–1023px | 3 cột | Collapsed (Icon-only, ~60px) hoặc Expanded | Full | width = 100% - sidebar |
| **Mobile** < 768px | 1 cột | Hidden → Drawer | Compact (☰ + Logo + Icons) | Full width |

---

## 6. Accessibility & Interaction Notes

- **ARIA labels**: Sidebar (`nav[aria-label="Main navigation"]`), Bell (`button[aria-label="Notifications"]`), Avatar (`button[aria-label="User menu"]`), App Switcher (`button[aria-label="Switch app"]`), Collapse (`button[aria-label="Collapse sidebar"]` / `"Expand sidebar"`, `aria-expanded`)
- **Keyboard**: ESC đóng Dropdown/Drawer, Tab navigation qua menu items
- **Tooltip (Mini sidebar)**: khi collapsed, mỗi icon có tooltip nhãn EN (`aria-label` / `title`) để screen reader & hover đều đọc được
- **Touch target**: Min 44×44px cho tất cả interactive elements (fat-finger friendly)
- **Animation**: Sidebar drawer slide < 200ms, smooth easing
- **Scroll**: Main Content `overflow-y: auto`, `height: calc(100vh - header-height)`, scroll position reset khi navigate route mới

---

*(End of Design & Wireframe Document)*
