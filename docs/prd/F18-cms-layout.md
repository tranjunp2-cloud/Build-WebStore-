# PRD: CMS Core Layout & Navigation (F18)
> **Version:** 1.0 | **Updated:** 2026-03-18 | **Agent:** `Antigravity-BA-Copilot`
> **Priority:** P0 🌟 | **Sprint:** Wave 1 | **Size:** M
> **Depends on:** F02 Auth, F16 Notification Center

---

> [!IMPORTANT]
> **Stories-First Rule:** PRD này được xây dựng từ các User Stories đã approve.
> Mọi FR phải có Story Ref. AC được copy từ story file. Không tự mở rộng scope.


---

## 0. Story Traceability

| Story ID | Title | File | Status |
|----------|-------|------|--------|
| US-F18-01 | CMS Global Sidebar Navigation | [F18-cms-layout-stories.md](../stories/F18-cms-layout-stories.md) | Ready |
| US-F18-02 | CMS Global Top Header | [F18-cms-layout-stories.md](../stories/F18-cms-layout-stories.md) | Ready |
| US-F18-03 | Main Content Area Display | [F18-cms-layout-stories.md](../stories/F18-cms-layout-stories.md) | Ready |

---

## 1. Problem Statement

CMS cần một khung bố cục (layout) nhất quán và thân thiện cho tất cả các module quản lý (Dashboard, Products, Orders, Blog, ...). Đây là nền tảng trải nghiệm người dùng — nếu navigation bị confusing, người dùng Malaysian SME (kỹ năng tech thấp, dùng mobile) sẽ không sử dụng được hệ thống. Hiện tại, layout CMS chưa được chuẩn hóa, thiếu mobile support và thiếu các yếu tố phù hợp thị trường Malaysia (WhatsApp support, BM/EN toggle).

---

## 2. Target User

- **SME Owner (Persona A)**: Tech level thấp, dùng mobile nhiều, cần navigation đơn giản, rõ ràng.
- **Dropshipper (Persona B)**: Kiểm tra Orders thường xuyên trên điện thoại — sidebar mobile phải hoạt động tốt.

---

## 3. Solution Overview

Thiết kế layout CMS 3-phần chuẩn:
1. **Top Header**: Fixed — Logo, Language Switcher (BM/EN), Notification Bell, Avatar (Profile).
2. **Side Menu**: Fixed trái — Navigation với Icon + Text. Mobile → Slide-in Drawer.
3. **Main Content Area**: Scroll độc lập, Spacing mobile-friendly.

---

## 4. Scope

### In Scope
- Global Sidebar Navigation với icon + text, active states (US-F18-01).
- Top Header: Logo, Notification Bell (tích hợp F16), Avatar dropdown (Profile, Language, Workspace, Logout) (US-F18-02).
- Main Content Area: Independent scrolling (US-F18-03).
- Mobile responsive: Hamburger → Slide-in drawer.
- Language toggle: BM / EN cố định trên Top Header.

### Out of Scope
- Thiết kế nội dung của từng module riêng lẻ (Products, Orders...).
- Dark mode / Theme customization.

---

## 5. Success Metrics

| Metric | Target | Measured By |
|--------|--------|-------------|
| Navigation error rate | < 5% (user lost/confused) | Session replay |
| Mobile usability score | > 90 (Lighthouse) | Lighthouse CI |
| Language toggle adoption | > 30% of MY users | PostHog event |

---

## 6. User Story Summary

> AC đầy đủ nằm trong Section 11. Đây là bản tóm tắt để dễ đọc.

```
AS A  SME Owner / Dropshipper trên Malaysia
I WANT TO có một giao diện CMS với sidebar navigation rõ ràng (icon + text), header cố định và content area mobile-friendly
SO THAT tôi có thể quản lý cửa hàng dễ dàng từ bất kỳ thiết bị nào mà không bị lạc
```

> Source Stories: [US-F18-01](../stories/F18-cms-layout-stories.md) | [US-F18-02](../stories/F18-cms-layout-stories.md) | [US-F18-03](../stories/F18-cms-layout-stories.md)

---

## 7. Functional Requirements

| FR-ID | Requirement | Story Ref | Priority | Notes |
|-------|-------------|-----------|----------|-------|
| FR-01 | Sidebar expanded với icon + text trên desktop | US-F18-01 | P0 | Active state highlight |
| FR-02 | Mobile: Sidebar ẩn mặc định, Hamburger → Slide-in drawer + overlay | US-F18-01 | P0 | z-index > main content |
| FR-03 | Sidebar footer: Help Center link, mở nội bộ CMS | US-F18-01 | P0 | Link dến màn hình F20 |
| FR-04 | Top Header: Logo PrimeWeb → click → /dashboard | US-F18-02 | P0 | Fixed, always visible |
| FR-05 | Top Header: Notification Bell + Red dot badge + số lượng | US-F18-02 | P0 | Link đến F16 |
| FR-06 | Top Header: Avatar dropdown (Profile, Workspace switch, Logout) | US-F18-02 | P0 | |
| FR-07 | Main Content: Scroll độc lập, Header + Sidebar fixed | US-F18-03 | P0 | |

---

## 7. Business Rules

- **BR-01:** Sidebar menu items đều có Icon + Text — không dùng icon đơn thuần (phù hợp SME thị trường MY).
- **BR-02:** Nút Help Center mở trang F20 nội bộ trong CMS; link WhatsApp Support nếu có sẽ nằm bên trong trang Help Center.
- **BR-03:** Language switch (BM/EN) phải được lưu persistent theo user preference.
- **BR-04:** Notification bell connect với real-time data từ F16 Notification Center.
- **BR-05:** Các nhóm menu chính (như My Webstore) có thể được mở rộng (expand/collapse) để chứa sub-menu tương ứng. (Dashboard là menu đơn).
- **BR-06:** Hiển thị Tên Webstore (Workspace hiện tại) rõ ràng trên Top Header/Sidebar để SME dễ nhận diện context đang thao tác (Multi-store Switcher visibility).

---

## 8. Navigation Menu Structure

| # | Menu Item | Icon | Route | Feature |
|---|-----------|------|-------|---------|
| 1 | Dashboard | 📊 | /dashboard | F03 |
| 2 | My Webstore | 🌐 | /editor | F05 |
|   | ↳ Editor | | /editor | F05 |
|   | ↳ Blog | | /blog | F17 |
| 3 | Products | 📦 | /products | F08 |
| 4 | Orders | 🛒 | /orders | F10 |
| 5 | Store Config| ⚙️ | /settings | F19 |
| — | Help Center | 🎧 | /help | F20 |

---

## 9. User Flow

```
User Login → /dashboard
   ↓
Header: Logo (PrimeWeb) + Bell icon + Avatar visible
   ↓
Sidebar: Expanded (Desktop) / Hamburger (Mobile)
   ↓
Click Menu Item → Main Content area loads feature
   ↓ [Mobile only]
Click ☰ → Sidebar Drawer slides in → Click Leaf-route → Drawer closes (KHÔNG đóng nếu click Expandable Menu)
   ↓
Click Bell → F16 Notification Dropdown
   ↓
Click Avatar → Dropdown: Profile | Workspace | Logout
```

---

## 10. Screen Layout

> **[Global CMS Constraint]** Đây là Root Layout của toàn bộ CMS Admin (Dashboard Panel). Mọi module tính năng khác đều phải load chèn vào phần Main Content Area của khung giao diện này.

> **[BẮT BUỘC]** Liệt kê chi tiết các màn hình (screens) và các state quan trọng (ví dụ: Empty, Loading, Error, Success). Mỗi màn hình cần mô tả UI component chính và luồng hiển thị.

### 10.1. Màn hình CMS Framework Layout
- **Mô tả:** Bản vẽ bộ khung Layout chung chứa Header, Sidebar và Main Content.
- **Components chính:**
  - Top Header: Nơi chứa Logo, Nút Menu Collapse/Hamburger, Icon Notification, Avatar/Profile dropdown.
  - Left Sidebar Navigation: Thanh trượt chứa các Menu tính năng dạng nhóm (Dashboard, Store, Config). Được thiết lập `overflow-y: auto` để scroll độc lập nếu danh sách menu dài. WhatsApp Hỗ Trợ ở chân.
  - Main Content Box: Nơi chứa ruột các module F03, F08, F10... Phần này được gắn quyền scroll-y độc lập.
- **Wireframe:**
```text
┌─ CMS Layout ──────────────────────────────────────────────┐
│ ┌─ Top Header ───────────────────────────────────────────┐ │
│ │ [☰] [Logo PrimeWeb]                [🔔 3] [Avatar ▼]  │ │
│ └────────────────────────────────────────────────────────┘ │
│ ┌─────────────────┐ ┌───────────────────────────────────┐ │
│ │ SIDEBAR         │ │ MAIN CONTENT (scrollable)         │ │
│ │                 │ │                                   │ │
│ │ 📊 Dashboard    │ │  [Feature Content Here]           │ │
│ │ 🌐 My Webstore ▼│ │  (VD: Bảng Danh Sách Sản Phẩm)    │ │
│ │   ├ Editor      │ │                                   │ │
│ │   └ Blog        │ │                                   │ │
│ │ 📦 Products     │ │                                   │ │
│ │ 🛒 Orders       │ │                                   │ │
│ │ ⚙️  Config      │ │                                   │ │
│ │─────────────────│ │                                   │ │
│ │ 🎧 Help Center  │ │                                   │ │
│ └─────────────────┘ └───────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
Mobile: Sidebar hides → ☰ at Header top-left
```

### 10.2. Các trạng thái UI (UI States) & Modals
- **Sidebar State:** 1) Expanded Mode: Chứa cả Icon + Text (Desktop mặc định). 2) Collapsed Mode: Thu gọn chỉ hiện Icon (Khi người dùng đóng hẹp thanh bar hoặc thiết bị Tablet). 3) Drawer Mode: Dành riêng cho Mobile dưới 768px, được gọi ẩn chứa bên ngoài màn hình và trượt vào khi click Hamburger.
- **Loading State:** Khi Router chuyển hướng giữa các module, Progress Bar chạy trên mép Top Header.
### 10.3. Màn hình phụ & Modals
- **Avatar Dropdown Popover:** Chứa Profile, Workspace Switch, Nút Đăng Xuất.
- **Wireframe (Avatar Dropdown):**
```text
┌────────────────────────┐
│  👤 Aisha Store        │
│  aisha@email.com       │
│  ────────────────────  │
│  ⚙️ Profile            │
│  🌐 Workspace: MY      │
│  ────────────────────  │
│  🚪 Logout             │
└────────────────────────┘
```

---

## 11. Acceptance Criteria

### AC-1: Desktop Sidebar
> 📌 Source: [US-F18-01](../stories/F18-cms-layout-stories.md) — AC-1

```gherkin
GIVEN user đang login vào CMS trên Desktop
WHEN  giao diện load
THEN  Side Menu hiển thị ở trái, mở rộng mặc định
  AND mỗi item hiển thị icon + text rõ ràng
  AND Active item được highlight theo Design System
```

### AC-2: Mobile Hamburger Menu
> 📌 Source: [US-F18-01](../stories/F18-cms-layout-stories.md) — AC-2

```gherkin
GIVEN user dùng CMS trên điện thoại
WHEN  giao diện load
THEN  Side Menu ẩn, chỉ hiện ☰ ở Header trái
WHEN  click ☰
THEN  Sidebar slide-in từ trái + overlay mờ
```

### AC-3: Notification Bell
> 📌 Source: [US-F18-02](../stories/F18-cms-layout-stories.md) — AC-2

```gherkin
GIVEN user có thông báo mới
WHEN  nhìn vào Header phải
THEN  icon Bell hiển thị Red dot badge + số
WHEN  click Bell
THEN  mở F16 Notification Dropdown
```

### AC-4: Avatar Dropdown
> 📌 Source: [US-F18-02](../stories/F18-cms-layout-stories.md) — AC-3

```gherkin
GIVEN user click Avatar ở Header phải
THEN  dropdown hiển thị: Profile | Workspace | Logout
```

### AC-5: Main Content Independent Scroll
> 📌 Source: [US-F18-03](../stories/F18-cms-layout-stories.md) — AC-1

```gherkin
GIVEN user scroll xuống danh sách dài
THEN  chỉ Main Content scroll
  AND Header + Sidebar vẫn fixed
```

---

## 12. Non-Functional Requirements

| Category | Requirement | Notes |
|----------|-------------|-------|
| **Performance** | Layout render < 1s (Above the fold) | CLS < 0.1 |
| **Mobile** | 375px full support, fat-finger friendly (min touch 44px) | |
| **Accessibility** | ARIA labels cho Sidebar + Bell + Avatar | |
| **i18n** | Language BM/EN persistent via localStorage | |

---

## 13. Dependencies

| Dependency | Status | Action Needed |
|-----------|--------|---------------|
| F02 Auth | ✅ Done | Session + Avatar data |
| F16 Notification Center | ⬜ | Bell badge API |

---

## 14. 9-Point Done Checklist

- [ ] Loading State — Skeleton layout khi chưa fetch session
- [ ] Empty State — N/A (Layout luôn có content)
- [ ] Error State — Session expired → redirect /login
- [ ] Form Validation — N/A
- [ ] Button States — Active states cho Sidebar items
- [ ] Toast Feedback — Logout success toast
- [ ] Auth Redirect — 401 → /login
- [ ] Mobile 375px — Hamburger + Drawer tested
- [ ] TypeScript Clean — `tsc --noEmit` pass

---

## 15. API Contract

> F18 là layout/shell component — không có API endpoint riêng. Phụ thuộc vào:
> - F16 Bell Badge API: `GET /api/notifications?limit=1` để lấy unread count
> - F02 Auth session để lấy Avatar, display name

---

## 16. Open Questions

| # | Question | Owner | Status |
|---|----------|-------|--------|
| 1 | Sidebar có cần hỗ trợ mini mode (icon-only) trên tablet không, hay chỉ Expanded / Hidden? | Design | ⬜ Open |
| 2 | Switch Workspace (multi-site) có trong Phase 1 không hay defer sang Wave 2+? | PO | ⬜ Open |
| 3 | Link WhatsApp Business nên dùng Floating Widget/Slide-over hay bắt redirect hẳn sang trang F20? | UX/Ops | ⬜ Open |
| 4 | Fallback cho Language Switch là BM hay EN nếu trình duyệt chặn localStorage? | Tech | ⬜ Open |
| 5 | Giao thức đồng bộ Notification Badge với F16 dùng Polling hay WebSocket? Limit max (VD: 99+)? | Tech/F16 | ⬜ Open |

---

## 17. Definition of Ready

- [x] User Stories approved và linked ở Section 0
- [x] F02 Auth done ✅
- [ ] F16 Notification Center badge API defined
- [ ] Design System tokens confirmed (colors, spacing, typography)

---

## 18. Definition of Done

- [ ] All FR implemented
- [ ] All AC pass
- [ ] Mobile 375px tested trên real device
- [ ] Link điều hướng đến Help Center (F20) test ok
- [ ] Language toggle persist qua sessions
- [ ] ARIA labels implemented cho Sidebar, Bell, Avatar
- [ ] Non-Functional Requirements validated (Lighthouse ≥ 90 mobile)

