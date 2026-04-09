# F20 Help Center — Design & Wireframe Report

> **Epic:** Help & Support
> **Feature Code:** F20
> **Links figma:** https://www.figma.com/design/oFACZVA1oplxslloJWEkLp/TM_Prime-Web-V2.0?node-id=31225-3239&t=601og2GNCjvvkTka-4
> Link localhost: http://localhost:3000/F20-help-center-ui-demo
> - [PRD](../prd/F20-help-center.md)
> - [User Stories](../stories/F20-help-center-stories.md)
> - [QA Test Cases](../qa/F20-help-center.md)

Tài liệu này mô tả chi tiết giao diện UI/UX và wireframe cho tính năng **Help Center**, bao gồm cả Desktop và Mobile views. Tất cả render bên trong **F18 CMS Global Layout** (Sidebar trái + Topbar giữ nguyên, mọi thứ render trong Main Content Area).

---

## 1. Feature Summary (Tóm tắt Tính năng)

Help Center là hệ thống tài liệu hướng dẫn tĩnh (read-only) trong CMS, gồm 3 phần chính:

- **1-Page Guideline:** Trang tổng quan giới thiệu toàn bộ tính năng hệ thống.
- **Q&A Section:** Danh sách câu hỏi thường gặp phân loại theo danh mục, hiển thị dạng Accordion.
- **Module Guides:** Hướng dẫn chi tiết từng module (Dashboard, Products, Orders, ...) kèm screenshot minh hoạ.

**Tính năng bổ trợ:**
- Lightbox Modal: Click screenshot để phóng to với overlay tối.
- Mobile Pinch-to-zoom: Zoom ảnh bằng cử chỉ chụm ngón tay trên thiết bị di động.
- Responsive Navigation: Sidebar trái chuyển thành sticky dropdown trên mobile.

---

## 2. Wireframes & UI Layouts

### 2.1. Help Center Main Screen — 1-Page Guideline (Desktop View)

*Trạng thái mặc định khi User mở Help Center. Navigation bên trái, Content bên phải.*

```text
┌─────────────────────────────────────────────────────────────┐
│ [≡ Logo]  Search...                             [👤 Admin]  │ ◄── Global Header (F18)
├──────────────┬──────────────────────────────────────────────┤
│ 🏠 Dashboard │ Help Center                                  │
│ 📦 Products  │                                              │
│ 🛒 Orders    │ ┌──────────────────────────────────────────┐ │
│ ⚙️ Settings  │ │ [H1] 📖 Help Center / Hướng Dẫn Sử Dụng │ │
│ ❓ Help      │ └──────────────────────────────────────────┘ │
│   Center ◄── │                                              │
│ (Active)     │ ┌────────────┬───────────┬──────────────┐   │
│              │ │ 📋 Overview │ ❓ Q&A    │ 📚 Modules   │   │ ◄── Tab Navigation
│              │ │  (Active)  │           │              │   │
│              │ └────────────┴───────────┴──────────────┘   │
│              │                                              │
│              │ ┌──────────────────────────────────────────┐ │
│              │ │ [H2] 👋 Chào mừng bạn đến với EchPrime!  │ │
│              │ │                                          │ │
│              │ │ Đây là tổng quan hệ thống quản lý cửa   │ │
│              │ │ hàng trực tuyến của bạn.                 │ │
│              │ │                                          │ │
│              │ │ [H3] 🚀 Tính năng chính                  │ │
│              │ │ ┌──────────────────────────────────────┐ │ │
│              │ │ │ 1. Dashboard    — Xem tổng quan      │ │ │
│              │ │ │ 2. AI Builder   — Tạo web AI         │ │ │
│              │ │ │ 3. Products     — Quản lý sản phẩm   │ │ │
│              │ │ │ 4. Orders       — Quản lý đơn hàng   │ │ │
│              │ │ │ 5. Blog         — Viết bài blog      │ │ │
│              │ │ │ 6. Settings     — Cấu hình cửa hàng  │ │ │
│              │ │ └──────────────────────────────────────┘ │ │
│              │ │                                          │ │
│              │ │ [H3] 📞 Hỗ trợ thêm                     │ │
│              │ │ Nếu bạn cần hỗ trợ thêm, hãy liên hệ   │ │
│              │ │ qua WhatsApp hoặc email support.         │ │
│              │ └──────────────────────────────────────────┘ │
└──────────────┴──────────────────────────────────────────────┘
```

---

### 2.2. Q&A Section — Accordion (Desktop View)

*Khi User chọn tab "Q&A". Hiển thị danh sách câu hỏi phân loại theo nhóm, dạng Accordion expand/collapse.*

```text
┌──────────────┬──────────────────────────────────────────────┐
│ 🏠 Dashboard │ Help Center                                  │
│ 📦 Products  │                                              │
│ 🛒 Orders    │ ┌────────────┬───────────┬──────────────┐   │
│ ⚙️ Settings  │ │ 📋 Overview │ ❓ Q&A    │ 📚 Modules   │   │
│ ❓ Help      │ │            │ (Active)  │              │   │
│   Center     │ └────────────┴───────────┴──────────────┘   │
│              │                                              │
│              │ 🔍 ┌──────────────────────────────────────┐ │
│              │    │ Search Q&A...                        │ │ ◄── Search Input
│              │    └──────────────────────────────────────┘ │
│              │                                              │
│              │ [H3] 🛍️ Quản Lý Sản Phẩm                    │
│              │ ┌──────────────────────────────────────────┐ │
│              │ │ ▶ Làm sao để thêm sản phẩm mới?        │ │ ◄── Collapsed
│              │ ├──────────────────────────────────────────┤ │
│              │ │ ▼ Làm sao upload nhiều ảnh cùng lúc?    │ │ ◄── Expanded
│              │ │   ─────────────────────────────────────  │ │
│              │ │   Bạn có thể kéo thả nhiều ảnh vào     │ │
│              │ │   khung upload, hoặc dùng nút "Browse   │ │
│              │ │   Files" để chọn nhiều file cùng lúc.   │ │
│              │ │   Tối đa 10 ảnh, mỗi ảnh ≤ 5MB.        │ │
│              │ ├──────────────────────────────────────────┤ │
│              │ │ ▶ Halal Badge hiển thị ở đâu?           │ │ ◄── Collapsed
│              │ └──────────────────────────────────────────┘ │
│              │                                              │
│              │ [H3] 🛒 Quản Lý Đơn Hàng                    │
│              │ ┌──────────────────────────────────────────┐ │
│              │ │ ▶ Đơn hàng COD xử lý như thế nào?       │ │
│              │ │ ▶ Cách in hoá đơn / packing slip?       │ │
│              │ └──────────────────────────────────────────┘ │
└──────────────┴──────────────────────────────────────────────┘
```

**Search Q&A Empty State:**
```text
   ┌──────────────────────────────────────┐
   │ 🔍 "abc88xyz"                    [×] │
   └──────────────────────────────────────┘

          📭 No answers found
       Thử từ khoá khác hoặc liên hệ
           hỗ trợ qua WhatsApp.
```

---

### 2.3. Module Guide with Screenshots (Desktop View)

*Khi User chọn tab "Modules" rồi chọn một module cụ thể. Hiển thị hướng dẫn từng bước kèm screenshot.*

```text
┌──────────────┬──────────────────────────────────────────────┐
│ 🏠 Dashboard │ Help Center                                  │
│ 📦 Products  │                                              │
│ 🛒 Orders    │ ┌────────────┬───────────┬──────────────┐   │
│ ⚙️ Settings  │ │ 📋 Overview │ ❓ Q&A    │ 📚 Modules   │   │
│ ❓ Help      │ │            │           │  (Active)    │   │
│   Center     │ └────────────┴───────────┴──────────────┘   │
│              │                                              │
│              │ Module Navigation (Sub-menu):                │
│              │ ┌──────┬──────┬──────┬──────┬──────┐        │
│              │ │ Auth │ Dash │ Prod │ Ord  │ Blog │        │
│              │ │      │board │(Act) │ers   │      │        │
│              │ └──────┴──────┴──────┴──────┴──────┘        │
│              │                                              │
│              │ ┌──────────────────────────────────────────┐ │
│              │ │ [H2] 📦 Hướng dẫn sử dụng: Products     │ │
│              │ │                                          │ │
│              │ │ [H3] Bước 1: Truy cập mục Products      │ │
│              │ │ Từ Sidebar trái, nhấn vào mục            │ │
│              │ │ "📦 Products" để mở danh sách sản phẩm.  │ │
│              │ │                                          │ │
│              │ │ ┌──────────────────────────────────────┐ │ │
│              │ │ │                                      │ │ │
│              │ │ │    [ 📷 Screenshot Thumbnail ]       │ │ │ ◄── Click to Lightbox
│              │ │ │    "Danh sách Products"              │ │ │
│              │ │ │                                      │ │ │
│              │ │ └──────────────────────────────────────┘ │ │
│              │ │                                          │ │
│              │ │ [H3] Bước 2: Tạo Sản Phẩm Mới           │ │
│              │ │ Nhấn nút [+ Thêm Sản Phẩm] ở góc trên  │ │
│              │ │ bên phải. Điền thông tin vào form:       │ │
│              │ │ - Tên sản phẩm, giá RM, mô tả           │ │
│              │ │ - Upload ảnh (WebP recommended)          │ │
│              │ │ - Bật Halal Badge nếu cần                │ │
│              │ │                                          │ │
│              │ │ ┌──────────────────────────────────────┐ │ │
│              │ │ │                                      │ │ │
│              │ │ │    [ 📷 Screenshot Thumbnail ]       │ │ │ ◄── Click to Lightbox
│              │ │ │    "Form tạo sản phẩm"               │ │ │
│              │ │ │                                      │ │ │
│              │ │ └──────────────────────────────────────┘ │ │
│              │ └──────────────────────────────────────────┘ │
└──────────────┴──────────────────────────────────────────────┘
```

---

### 2.4. Lightbox Modal (Desktop View)

*Khi User click vào screenshot thumbnail — ảnh phóng to full-size với overlay tối.*

```text
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│  ░░░░░░░░░░░░░░░░ Dark Overlay ░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│  ░░░░┌─────────────────────────────────────────────┐░[X]░░ │ ◄── Close button
│  ░░░░│                                             │░░░░░░ │
│  ░░░░│                                             │░░░░░░ │
│  ░░░░│         Full Resolution Screenshot          │░░░░░░ │
│  ░░░░│              (Centered)                     │░░░░░░ │
│  ░░░░│                                             │░░░░░░ │
│  ░░░░│                                             │░░░░░░ │
│  ░░░░│                                             │░░░░░░ │
│  ░░░░└─────────────────────────────────────────────┘░░░░░░ │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│                                                             │
└─────────────────────────────────────────────────────────────┘

Interactions:
  • Click [X] hoặc click vùng overlay → Đóng lightbox
  • Nhấn phím ESC → Đóng lightbox
  • Body scroll bị lock (overflow: hidden) khi modal mở
```

---

### 2.5. Mobile View — Help Center (375px)

*Navigation chuyển từ Tab Bar thành sticky top dropdown. Content chiếm 100% width.*

```text
📱 Mobile View (375px)
┌─────────────────────────────┐
│ ☰  Help Center          👤  │ ◄── Global Header
├─────────────────────────────┤
│ ┌─────────────────────────┐ │
│ │ 📋 Overview       ▼    │ │ ◄── Sticky Top Dropdown
│ └─────────────────────────┘ │     (Thay thế Tab Bar)
│                             │
│ Dropdown expanded:          │
│ ┌─────────────────────────┐ │
│ │ 📋 Overview     ✓       │ │
│ │ ❓ Q&A                  │ │
│ │ 📚 Modules              │ │
│ │   ├── Auth / Login      │ │
│ │   ├── Dashboard         │ │
│ │   ├── Products          │ │
│ │   ├── Orders            │ │
│ │   └── Blog              │ │
│ └─────────────────────────┘ │
│                             │
│ ┌─────────────────────────┐ │
│ │ [H2] 👋 Chào mừng!      │ │
│ │                         │ │
│ │ Đây là tổng quan hệ    │ │
│ │ thống quản lý cửa hàng │ │
│ │ trực tuyến...           │ │
│ │                         │ │
│ │ [H3] 🚀 Tính năng chính │ │
│ │ 1. Dashboard            │ │
│ │ 2. AI Builder           │ │
│ │ 3. Products             │ │
│ │ 4. Orders               │ │
│ │ 5. Blog                 │ │
│ │ 6. Settings             │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

---

### 2.6. Mobile View — Q&A Accordion (375px)

```text
📱 Mobile View (375px)
┌─────────────────────────────┐
│ ☰  Help Center          👤  │
├─────────────────────────────┤
│ ┌─────────────────────────┐ │
│ │ ❓ Q&A              ▼  │ │ ◄── Sticky Dropdown
│ └─────────────────────────┘ │
│                             │
│ 🔍 ┌───────────────────┐   │
│    │ Search Q&A...     │   │
│    └───────────────────┘   │
│                             │
│ [H3] 🛍️ Sản Phẩm           │
│ ┌─────────────────────────┐ │
│ │ ▼ Upload nhiều ảnh?     │ │
│ │ ─────────────────────── │ │
│ │ Kéo thả nhiều ảnh vào  │ │
│ │ khung upload hoặc dùng │ │
│ │ nút "Browse Files"...  │ │
│ ├─────────────────────────┤ │
│ │ ▶ Halal Badge ở đâu?   │ │
│ ├─────────────────────────┤ │
│ │ ▶ Giá bao gồm SST?    │ │
│ └─────────────────────────┘ │
│                             │
│ [H3] 🛒 Đơn Hàng           │
│ ┌─────────────────────────┐ │
│ │ ▶ Xử lý COD?           │ │
│ │ ▶ In hoá đơn?          │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

---

### 2.7. Mobile View — Module Guide with Screenshot (375px)

```text
📱 Mobile View (375px)
┌─────────────────────────────┐
│ ☰  Help Center          👤  │
├─────────────────────────────┤
│ ┌─────────────────────────┐ │
│ │ 📚 Products          ▼ │ │ ◄── Sticky Dropdown
│ └─────────────────────────┘ │
│                             │
│ [H2] 📦 Products Guide     │
│                             │
│ [H3] Bước 1: Truy cập      │
│ Từ menu ☰, chọn mục        │
│ "📦 Products".              │
│                             │
│ ┌─────────────────────────┐ │
│ │                         │ │
│ │  [ 📷 Screenshot ]      │ │ ◄── Tap to Lightbox
│ │  "Danh sách Products"   │ │
│ │                         │ │
│ └─────────────────────────┘ │
│                             │
│ [H3] Bước 2: Tạo mới       │
│ Nhấn [+ Thêm Sản Phẩm].   │
│ Điền tên, giá RM, mô tả.  │
│                             │
│ ┌─────────────────────────┐ │
│ │                         │ │
│ │  [ 📷 Screenshot ]      │ │ ◄── Tap to Lightbox
│ │  "Form tạo sản phẩm"    │ │
│ │                         │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

---

### 2.8. Mobile View — Full-Screen Pinch-to-Zoom Lightbox (375px)

*Khi user tap vào screenshot trên mobile — Lightbox chiếm full-screen, hỗ trợ Pinch-to-Zoom.*

```text
📱 Lightbox Full-Screen (375px)
┌─────────────────────────────┐
│                         [X] │ ◄── Close button (top-right)
│                             │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░░░ Dark Overlay ░░░░░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░┌───────────────────────┐ │
│ ░░│                       │ │
│ ░░│   Full Screenshot     │ │
│ ░░│                       │ │
│ ░░│   👆👆 Pinch-to-Zoom  │ │ ◄── 2-finger pinch gesture
│ ░░│   👆👆 Double-tap     │ │ ◄── Double-tap to zoom
│ ░░│                       │ │
│ ░░│                       │ │
│ ░░└───────────────────────┘ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│                             │
└─────────────────────────────┘

Interactions (Mobile):
  • Pinch gesture (2 ngón giãn ra) → Zoom in mượt mà
  • Pinch gesture (2 ngón chụm lại) → Zoom out
  • Double-tap → Toggle zoom in/out
  • Tap [X] → Đóng lightbox, quay lại reading mode
  • CSS: touch-action: none trên image container
  • Z-index phải cao hơn F18 Bottom Toolbar
  • Body scroll bị lock khi modal mở
```

---

## 3. UI States (Các trạng thái giao diện)

### 3.1. Loading State
- **Skeleton Loader:** Khi trang Help Center đang tải, hiển thị skeleton placeholder cho Navigation (bên trái/trên) và Content Area (bên phải/dưới).
- **Image Lazy Loading:** Tất cả `<img>` tags có thuộc tính `loading="lazy"`. Trước khi ảnh load xong hiển thị Blur Container / Skeleton giữ chỗ để tránh CLS (Cumulative Layout Shift).
- **KHÔNG dùng spinner** — tuân theo Design System shadcn/ui (dùng Skeleton).

### 3.2. Error State — Broken Image
- Khi CDN ảnh lỗi (404), hiển thị fallback SVG placeholder hoặc alt text.
- Phần text hướng dẫn vẫn hiển thị bình thường, không ảnh hưởng layout.
- Component không crash (React Error Boundary nếu cần).

```text
   ┌──────────────────────────────────────┐
   │  ┌────────────────────────────────┐  │
   │  │   🖼️ [Image Not Available]     │  │ ◄── Fallback placeholder
   │  │   Alt: "Danh sách Products"    │  │
   │  └────────────────────────────────┘  │
   │                                      │
   │  Bước 2: Nhấn nút [+ Thêm]...       │ ◄── Text vẫn đọc bình thường
   └──────────────────────────────────────┘
```

### 3.3. Empty State — Q&A Search No Results
```text
          📭 No answers found
       Thử từ khoá khác hoặc liên hệ
           hỗ trợ qua WhatsApp.
```

### 3.4. Auth Redirect (401)
- User chưa đăng nhập truy cập `/cms/help` → Redirect 401 về `/login`.
- Không preload nội dung hoặc hình ảnh trước khi xác thực.

---

## 4. Component Architecture

| Component | File Path | Mô tả |
|-----------|-----------|-------|
| `HelpCenterLayout` | `src/components/help/HelpCenterLayout.tsx` | Layout 2 cột (Desktop: nav trái + content phải; Mobile: dropdown + content 100%) |
| `HelpCenterNav` | `src/components/help/HelpCenterNav.tsx` | Navigation tabs/dropdown responsive |
| `GuidelinePage` | `src/app/(cms)/help/page.tsx` | Trang 1-page guideline (default view) |
| `QnAAccordion` | `src/components/help/QnAAccordion.tsx` | Component accordion đóng mở Q&A với chevron animation |
| `QnASearch` | `src/components/help/QnASearch.tsx` | Input search Q&A với debounce 300ms và XSS sanitization |
| `ModuleGuide` | `src/components/help/ModuleGuide.tsx` | Trang hướng dẫn từng module với text + screenshots |
| `LightboxImage` | `src/components/ui/LightboxImage.tsx` | Component xem ảnh phóng to, hỗ trợ ESC close, scroll lock, pinch-to-zoom (mobile) |

---

## 5. Responsive Breakpoints & Behavior

| Breakpoint | Layout | Navigation |
|-----------|--------|------------|
| **Desktop** (≥ 1024px) | 2 cột: Navigation trái (240px) + Content phải (fluid) | Tabs ngang: Overview, Q&A, Modules |
| **Tablet** (768px–1023px) | 2 cột co lại hoặc 1 cột | Tabs ngang thu gọn |
| **Mobile** (< 768px) | 1 cột full width | Sticky top dropdown thay thế tabs/sidebar |

---

## 6. Interaction Details

### 6.1. Accordion Q&A
- **Click tiêu đề** → Expand/Collapse nội dung với **smooth CSS transition** (height + opacity).
- **Chevron icon** xoay 180° (▶ → ▼) khi mở.
- **Multiple panels** có thể mở đồng thời (không auto-close panel khác).
- **Keyboard accessible:** `Tab` để focus, `Space/Enter` để toggle.

### 6.2. Search Q&A
- **Debounce 300ms:** Request lọc chỉ trigger sau khi user ngừng gõ 300ms.
- **XSS Prevention:** Input được sanitize, không render raw HTML.
- **Empty state:** Hiển thị message "No answers found" khi không có kết quả.

### 6.3. Lightbox
- **Desktop:** Click thumbnail → Modal overlay (z-index cao) + ảnh centered + nút [X].
- **Mobile:** Tap thumbnail → Full-screen overlay + Pinch-to-zoom + Double-tap zoom.
- **Close methods:** Click [X], click overlay, nhấn ESC (desktop).
- **Scroll lock:** `overflow: hidden` trên body khi modal mở.
- **Z-index:** Phải cao hơn F18 Bottom Toolbar để không bị che trên mobile.

### 6.4. URL Anchor/Hash
- Mỗi module guide có hash riêng: `/help#products`, `/help#orders`, `/help#dashboard`.
- Deep link share: User gửi URL → Người nhận (có auth) sẽ jump đúng vị trí module.
- Khi ảnh lazy load thêm height → không được shift anchor position ra khỏi viewport.

---

## 7. Accessibility (A11y)

- Accordion headings: `tabIndex={0}`, `role="button"`, `aria-expanded="true/false"`.
- Lightbox: `role="dialog"`, `aria-modal="true"`, focus trap khi mở.
- Images: `alt` text mô tả rõ nội dung screenshot.
- Search: `aria-label="Search Q&A"`, live region cho empty state.

---

## 8. Design Checklist

- [x] Desktop frame (1440px) — 3 views: Guideline, Q&A, Module Guide
- [x] Mobile frame (375px) — 4 views: Guideline, Q&A, Module Guide, Lightbox Pinch-to-zoom
- [x] Loading State — Skeleton loader
- [x] Error State — Broken image fallback
- [x] Empty State — Q&A search "No results"
- [x] Lightbox Modal state — Desktop & Mobile
- [x] Auth redirect 401 documented
- [x] Responsive breakpoints defined
- [x] Accessibility requirements specified
- [ ] Figma Hi-fi design — ⬜ Chưa có (cần Designer thực hiện)
- [ ] Tech Lead review — ⬜ Pending
