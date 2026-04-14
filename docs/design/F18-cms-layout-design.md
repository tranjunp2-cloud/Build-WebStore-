# F18 CMS Core Layout & Navigation — Design & Wireframes

> **Epic:** Core Infrastructure
> **Feature Code:** F18
> **Figma Design:** [UI Design](https://www.figma.com/design/oFACZVA1oplxslloJWEkLp/TM_Prime-Web-V2.0?node-id=30675-275&t=ImhpbJ1K0aBFikqf-1)
> **Prototype:** [Interactive Demo](https://www.figma.com/make/Y48xuOh2gMCid2UmqOAFys/F01-ai-chat-builder-demo?fullscreen=1&t=DLqQPtpTDgA4lMa9-1&preview-route=%2Fdashboard)
> **Ref PRD:** [F18-cms-layout.md](../prd/F18-cms-layout.md)
> **Ref Stories:** [F18-cms-layout-stories.md](../stories/F18-cms-layout-stories.md)

Tài liệu này cung cấp luồng người dùng (User Flow) và bản vẽ Wireframe chi tiết cho bộ khung CMS Core Layout (F18). Đây là **Root Layout** — mọi module tính năng khác (F03, F05, F08, F10, F17, F19, F20) đều phải render bên trong `Main Content Area` của khung giao diện này.

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
        ┌───────┴────────────────────┐
        │                            │
  [Menu Đơn: Dashboard,       [Menu Nhóm: My Webstore]
   Products, Orders,                 │
   Store Config]                     ▼
        │               [ Expand → hiện sub-menu ]
        │               [ Editor, Blog ]
        │                            │
        └───────────┬────────────────┘
                    │
                    ▼
         [ Main Content area load module tương ứng ]
         [ Header + Sidebar vẫn fixed ]
                    │
                    ▼ [Mobile only]
         [ Drawer tự đóng nếu click Leaf-route ]
         [ Drawer KHÔNG đóng nếu click Menu Nhóm ]
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
    ┌───────┴────────────────────────────┐
    │               │                    │
    ▼               ▼                    ▼
[ Click Leaf ]  [ Click Menu Nhóm ] [ Click Overlay ]
[ VD: Orders ]  [ VD: My Webstore ] [ hoặc Swipe ← ]
    │               │                    │
    ▼               ▼                    ▼
[ Drawer đóng ] [ Expand sub-menu ] [ Drawer đóng ]
[ Navigate    ] [ Drawer vẫn mở  ] [ Giữ nguyên   ]
[ đến route   ] [ để chọn tiếp   ] [ trang hiện tại]
```

---

## 2. Navigation Menu Structure

| # | Menu Item | Icon | Route | Feature | Loại |
|---|-----------|------|-------|---------|------|
| 1 | Dashboard | 📊 | `/dashboard` | F03 | Đơn (Single) |
| 2 | My Webstore | 🌐 | — | — | Nhóm (Group) |
|   | ↳ Editor | | `/editor` | F05 | Sub-item |
|   | ↳ Blog | | `/blog` | F17 | Sub-item |
| 3 | Products | 📦 | `/products` | F08 | Đơn |
| 4 | Orders | 🛒 | `/orders` | F10 | Đơn |
| 5 | Store Config | ⚙️ | `/settings` | F19 | Đơn |
| — | Help Center | 🎧 | `/help` | F20 | Footer (cố định dưới cùng) |

---

## 3. Wireframes

### 3.1. CMS Framework Layout — Desktop View (≥ 768px)

> **[Global CMS Constraint]** Đây là Root Layout của toàn bộ CMS Admin. Mọi module tính năng khác đều render vào phần Main Content Area.

```text
┌── CMS Layout ─────────────────────────────────────────────────────┐
│ ┌─ Top Header (Fixed, z-index cao nhất) ─────────────────────────┐│
│ │ [☰/Logo]  PrimeWeb    [BM|EN]              [🔔 3]  [👤 ▼]     ││
│ │           ↑ Click →                          ↑        ↑        ││
│ │         /dashboard                     F16 Badge  Avatar       ││
│ │                                                   Dropdown     ││
│ └────────────────────────────────────────────────────────────────┘│
│ ┌── Sidebar (Fixed Left, overflow-y: auto) ─┐ ┌── Main Content ─┐│
│ │                                           │ │ (overflow-y:auto)││
│ │  [Tên Webstore hiện tại]                  │ │                  ││
│ │  ─────────────────────────                │ │  ┌────────────┐  ││
│ │  📊  Dashboard                            │ │  │            │  ││
│ │                                           │ │  │  Feature   │  ││
│ │  🌐  My Webstore           ▼              │ │  │  Content   │  ││
│ │       ├─ Editor                           │ │  │  (F03,     │  ││
│ │       └─ Blog                             │ │  │   F05,     │  ││
│ │                                           │ │  │   F08...) │  ││
│ │  📦  Products                             │ │  │            │  ││
│ │                                           │ │  │            │  ││
│ │  🛒  Orders                               │ │  └────────────┘  ││
│ │                                           │ │                  ││
│ │  ⚙️  Store Config                         │ │                  ││
│ │                                           │ │                  ││
│ │  ─────────────────────────                │ │                  ││
│ │  🎧  Help Center                          │ │                  ││
│ └───────────────────────────────────────────┘ └──────────────────┘│
└───────────────────────────────────────────────────────────────────┘
```

**Chi tiết Sidebar:**
- Width cố định ~240px
- Active item: highlight background + font bold theo Design System
- Menu Nhóm (My Webstore): click → expand/collapse accordion, icon mũi tên xoay
- Help Center: cố định ở cuối sidebar, phân tách bởi divider

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
│ SIDEBAR  │▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│
│ DRAWER   │▒▒▒ Overlay mờ ▒▒▒│
│          │▒▒▒ (Click để  ▒▒▒│
│ 📊 Dash. │▒▒▒  đóng)     ▒▒▒│
│ 🌐 Web ▼ │▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│
│  ├ Edit  │▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│
│  └ Blog  │▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│
│ 📦 Prod. │▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│
│ 🛒 Ord.  │▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│
│ ⚙️ Conf. │▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│
│ ──────── │▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│
│ 🎧 Help  │▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒│
└──────────┴───────────────────┘
```

**Hành vi đóng Drawer:**
- Click vào Overlay mờ → Drawer slide-out
- Swipe từ phải sang trái → Drawer slide-out
- Click vào Leaf-route (VD: Orders) → Drawer đóng + Navigate
- Click vào Menu Nhóm (VD: My Webstore) → Drawer **vẫn mở**, expand sub-menu

---

### 3.3. Top Header — Chi tiết Components

```text
Desktop Header:
┌────────────────────────────────────────────────────────────────┐
│  [Logo PrimeWeb]     [Tên Webstore]     [BM|EN]  [🔔 3] [👤▼] │
│   ↑ Click → /dash     ↑ Context          ↑ Lang   ↑ F16  ↑    │
│                        display            Switch  Badge  Avatar│
│                                                         Menu   │
└────────────────────────────────────────────────────────────────┘

Mobile Header:
┌────────────────────────────────────────┐
│  [☰]  [Logo]                [🔔 3] [👤]│
│   ↑ Toggle                             │
│   Drawer                               │
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

### 3.6. Sidebar — Expand/Collapse Menu Nhóm (Accordion)

```text
Trạng thái Collapsed:              Trạng thái Expanded:
┌─────────────────────┐            ┌─────────────────────┐
│ 🌐 My Webstore   ▶  │            │ 🌐 My Webstore   ▼  │
└─────────────────────┘            │    ├─ Editor         │
                                   │    └─ Blog           │
                                   └─────────────────────┘
```

- Click vào Menu Nhóm lần 1 → Expand, icon mũi tên xoay xuống (▼)
- Click vào Menu Nhóm lần 2 → Collapse, icon mũi tên xoay phải (▶)
- Animation expand/collapse mượt (< 200ms)

---

## 4. UI States (Các trạng thái UI)

### 4.1. Sidebar States

| State | Điều kiện | Mô tả |
|-------|-----------|-------|
| **Expanded** | Desktop mặc định | Icon + Text đầy đủ, width ~240px |
| **Collapsed (Icon-only)** | Tablet / User thu gọn (nếu hỗ trợ) | Chỉ hiện Icon, width ~60px, hover → tooltip text |
| **Drawer** | Mobile < 768px | Ẩn mặc định, slide-in từ trái khi click ☰ |

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

- **ARIA labels**: Sidebar (`nav[aria-label="Main navigation"]`), Bell (`button[aria-label="Notifications"]`), Avatar (`button[aria-label="User menu"]`)
- **Keyboard**: ESC đóng Dropdown/Drawer, Tab navigation qua menu items
- **Touch target**: Min 44×44px cho tất cả interactive elements (fat-finger friendly)
- **Animation**: Sidebar drawer slide < 200ms, smooth easing
- **Scroll**: Main Content `overflow-y: auto`, `height: calc(100vh - header-height)`, scroll position reset khi navigate route mới

---

*(End of Design & Wireframe Document)*
