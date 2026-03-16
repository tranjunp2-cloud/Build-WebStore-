# 🎨 Design Guide — PrimeWeb (Malaysia Market)

> **Dành cho:** UI/UX Designer
> **1 file duy nhất** — tất cả rules, screens, tokens, Figma links ở đây.
> **Đọc kèm:** [malaysia-market-context.md](../malaysia-market-context.md) (personas, payment, shipping, cultural UX)

---

## 1. Bối cảnh

PrimeWeb = **AI Website Builder cho SME Malaysia** — chủ tiệm nhỏ tạo website bán hàng trong 5 phút.

**Redesign nhắm vào:**
- Mobile-first (97.4% users MY mua trên điện thoại)
- Bilingual (BM + EN)
- Trust signals MY (Halal badge, SSM number, WhatsApp, J&T/Pos Laju)

**Cultural UX cần thể hiện:**

| Yếu tố | Làm sao trong UI |
|---------|-----------------|
| 🕌 Halal | Badge JAKIM trên product card + detail |
| 📱 WhatsApp | Floating button xanh lá ở storefront |
| 💰 Giá RM | Format: `RM 189.00` |
| 🏢 SSM | Footer: "SSM: 123456-X" |
| 📦 J&T / Pos Laju | Logo carriers khi chọn shipping |
| 🔤 BM + EN | Language switcher (toggle BM/EN) |

> Chi tiết personas, JTBD, payment landscape → [malaysia-market-context.md](../malaysia-market-context.md)

---

## 2. Quy trình Design

```
Step 1                Step 2              Step 3              Step 4
Nhận brief       →    Wireframe      →    UI Design      →    Handoff
(Đọc PRD + §4)       (Low-fi, 1 ngày)   (Hi-fi, 2-3 ngày)  (Figma link vào §7)
       ↓                    ↓                   ↓                    ↓
  Đọc PRD + Stories    Review với TL       Review với TL       Dev dùng Dev Mode
```

| Step | Input | Output | Review | Thời gian |
|------|-------|--------|--------|:---------:|
| **1. Brief** | PRD + Stories | Hiểu yêu cầu | — | 2-3 giờ |
| **2. Wireframe** | Brief | Low-fi (Desktop + Mobile) | Tech Lead | 1 ngày |
| **3. UI Design** | Wireframe approved | Hi-fi với Design System | Tech Lead + Dev | 2-3 ngày |
| **4. Handoff** | UI approved | Figma link vào §7 | — | 15 phút |

---

## 3. Design System — shadcn/ui

> Project dùng **shadcn/ui** (React). Designer phải design **matching** với shadcn components.

### Figma Kit
Import từ [Figma Community — shadcn/ui](https://www.figma.com/community/search?resource_type=mixed&sort_by=relevancy&query=shadcn)

### Components chính

| Component | Dùng cho |
|-----------|---------|
| **Button** | CTA — Primary, Secondary, Outline, Ghost |
| **Input** | Forms — Text, Email, Password, Search |
| **Select** | Dropdowns — Filter, sort, MY states |
| **Dialog** | Modals — Confirm, alert |
| **Sheet** | Slide-over — Detail views, cart drawer |
| **Card** | Product card, stat card |
| **Table** | Products list, Orders list |
| **Badge** | Status — Published, Draft, Halal ✅ |
| **Toast** | Notifications — Success, Error |
| **Tabs** | Navigation trong page |
| **Skeleton** | Loading states — KHÔNG dùng spinner |

### Color Tokens

```
Primary:     hsl(222, 47%, 31%)     ← Brand color
Background:  hsl(0, 0%, 100%)       ← Main bg
Card:        hsl(0, 0%, 100%)       ← Card bg
Foreground:  hsl(222, 47%, 11%)     ← Text chính
Muted:       hsl(210, 40%, 96%)     ← Text phụ bg
Border:      hsl(214, 32%, 91%)     ← Borders
Destructive: hsl(0, 84%, 60%)       ← Errors, delete
Success:     hsl(142, 71%, 45%)     ← Success, Halal badge
Warning:     hsl(38, 92%, 50%)      ← Warnings, stock low
WhatsApp:    hsl(142, 70%, 49%)     ← WhatsApp button (#25D366)
```

### Typography
```
Font:     Inter (Google Fonts)
H1:       30px / 700 (1 per page)
H2:       24px / 600
H3:       20px / 600
Body:     14px / 400
Small:    12px / 400
Mono:     JetBrains Mono (code blocks)
```

### Spacing
```
4px / 8px / 12px / 16px / 24px / 32px / 48px / 64px
```

---

## 4. Tất cả screens cần design (28 screens)

### 🔐 A. Auth (4 screens)

| # | Screen | Priority | Notes |
|---|--------|:--------:|-------|
| A1 | **Login** | 🔴 | Email + password. Social login (Google)? |
| A2 | **Register** | 🔴 | Name, email, password → onboarding |
| A3 | **Forgot Password** | 🟡 | Nhập email → link reset |
| A4 | **Reset Password** | 🟡 | New password + confirm |

- 1 cột giữa, brand logo + tagline "Tạo website bán hàng trong 5 phút"
- Mobile: full-width input, buttons ≥ 48px height

---

### 🚀 B. Onboarding (3 screens)

| # | Screen | Priority | Notes |
|---|--------|:--------:|-------|
| B1 | **Store Setup** | 🔴 | Tên store, loại (Fashion/F&B/Beauty), **ngôn ngữ BM/EN** |
| B2 | **AI Generation** | 🔴 | Loading animation + fun facts |
| B3 | **Result Preview** | 🔴 | Preview → "Edit" hoặc "Publish" |

- Wizard 3 steps (progress bar). B1 < 30 giây hoàn thành
- B2: skeleton animation ("Đang chọn màu sắc...", "Đang viết nội dung...")

---

### 📊 C. Dashboard (6 screens)

| # | Screen | Priority | Notes |
|---|--------|:--------:|-------|
| C1 | **Dashboard Home** | 🔴 | Stats: orders, revenue, visitors + Quick Actions |
| C2 | **Products List** | 🔴 | Table: name, price, stock, **Halal badge**, status |
| C3 | **Product Detail/Edit** | 🔴 | Form: name, price, images, AI desc btn, **Halal cert toggle+upload**, weight |
| C4 | **Orders List** | 🟡 | Table: order #, customer, total, status badge |
| C5 | **SEO Dashboard** | 🟡 | Score circle, issues list, "AI Fix All" |
| C6 | **Analytics** | ⚪ | Charts: visitors, revenue, top products |

- Sidebar nav (desktop) → bottom nav (mobile)
- Tables: desktop = full table, mobile = card list

---

### ✏️ D. AI Editor (2 screens)

| # | Screen | Priority | Notes |
|---|--------|:--------:|-------|
| D1 | **Editor Main** | 🔴 | Chat (30%) + Preview (70%). Device switcher |
| D2 | **Settings Panel** | 🟡 | Site name, favicon, SEO, colors |

- **D1 = screen quan trọng nhất** — user dùng nhiều nhất
- Toolbar: Undo/Redo, Publish, Settings gear

---

### 🎨 E. Templates (2 screens)

| # | Screen | Priority | Notes |
|---|--------|:--------:|-------|
| E1 | **Gallery Grid** | 🟡 | Cards + filter by: Fashion, F&B, Beauty, Raya Special |
| E2 | **Template Preview** | 🟡 | Full preview + "Use Template" CTA |

---

### 🌐 F. Storefront (5 screens) — PHẦN QUAN TRỌNG NHẤT

| # | Screen | Priority | Notes |
|---|--------|:--------:|-------|
| F1 | **Homepage** | 🔴 | Hero, products grid, about, trust footer |
| F2 | **Products Catalog** | 🔴 | Grid 2 cột (mobile), filter drawer |
| F3 | **Product Detail** | 🔴 | Gallery swipe, variant selector, **Halal badge**, WhatsApp btn |
| F4 | **Checkout** | 🔴 | Cart → Info → Shipping → Payment (SST 6%) |
| F5 | **Order Confirmation** | 🟡 | Order # + **"Share via WhatsApp"** button |

- **Mobile-first bắt buộc** — 97.4% users MY
- Trust signals footer mỗi storefront:
```
✅ Halal Certified (JAKIM)  🏢 SSM: 123456-X
📍 Jalan ABC, KL           📱 WhatsApp: +60 12-345 6789
💳 Visa, MC, FPX           📦 J&T, Pos Laju
```

---

### 🏠 G. Landing Page (1 screen)

| # | Screen | Priority | Notes |
|---|--------|:--------:|-------|
| G1 | **PrimeWeb Homepage** | 🟡 | Marketing — attract signups |

---

### 💳 H. Payment (2 screens — F16)

| # | Screen | Priority | Notes |
|---|--------|:--------:|-------|
| H1 | **Payment Method Selection** | 🟡 | Radio: FPX (bank dropdown), Card, E-wallet icon |
| H2 | **Payment Failed** | 🟡 | "Pembayaran gagal" + Retry + cart preserved |

- FPX: Malaysian bank logos (Maybank, CIMB, RHB) in dropdown
- Order summary: subtotal + shipping + SST 6% = total

---

### 📦 I. Shipping & Settings (3 screens — F17)

| # | Screen | Priority | Notes |
|---|--------|:--------:|-------|
| I1 | **Shipping Address** | 🟡 | Address form + **16 MY states dropdown** |
| I2 | **Shipping Settings** | 🟡 | Seller: West rate, East rate, free threshold |
| I3 | **Store Settings** | 🟡 | WhatsApp number, SSM, address, language |

---

### Tổng screens

| Nhóm | Screens |
|------|:-------:|
| A. Auth | 4 |
| B. Onboarding | 3 |
| C. Dashboard | 6 |
| D. AI Editor | 2 |
| E. Templates | 2 |
| F. Storefront | 5 |
| G. Landing | 1 |
| H. Payment | 2 |
| I. Shipping/Settings | 3 |
| **Total** | **28** |

---

## 5. Thứ tự ưu tiên design

### Wave 1 (Design trước — 1 tuần)
| # | Screen | Lý do |
|---|--------|-------|
| D1 | AI Editor | User dùng nhiều nhất |
| B1-B3 | Onboarding 3 steps | First impression |
| F1 | Storefront Homepage | Brand impression |
| F3 | Product Detail | Buyer quyết định mua |
| F4 | Checkout | Revenue — mất ở đây = mất tiền |

### Wave 2 (Tuần 2)
| # | Screen | Lý do |
|---|--------|-------|
| A1-A2 | Login/Register | Gate entry |
| C1-C3 | Dashboard + Products | Seller daily use |
| F2 | Product Catalog | Browse experience |

### Wave 3 (Tuần 3)
| # | Screen | Lý do |
|---|--------|-------|
| C4-C6 | Orders, SEO, Analytics | Secondary |
| E1-E2 | Templates | Fallback |
| F5, G1 | Order confirm, Landing | Polish |
| H1-H2 | Payment | FPX cho MY market |
| I1-I3 | Shipping, Settings | MY-specific settings |

---

## 6. Design Rules

### Mobile First
```
❌ Design desktop trước rồi co lại
✅ Design mobile (375px) trước → mở rộng ra desktop
```

### Consistency
```
❌ Tự tạo component/style mới
✅ Dùng shadcn components từ Figma Kit
   Cần mới → trao đổi với Tech Lead trước
```

### ⚠️ Rule: 4 States — BẮT BUỘC mỗi screen

> Nếu designer chỉ vẽ state "có data" → dev tự design trang trống/loading/lỗi → UI không nhất quán.

| State | Khi nào | User thấy gì | Mục đích |
|-------|---------|--------------|----------|
| **Success** | Có data | Nội dung thật | Bình thường |
| **Empty** | Chưa có data | Icon + text + CTA | Không hoang mang |
| **Loading** | Đang tải | Skeleton (khung xám nhấp nháy) | Trang không trống |
| **Error** | API lỗi | Toast đỏ + "Thử lại" button | Tự khắc phục |

**Ví dụ Products List:**
```
✅ Success:  Bảng product với data
📭 Empty:    📦 "Chưa có sản phẩm" + [+ Thêm Sản Phẩm]
⏳ Loading:  Skeleton giống layout thật (KHÔNG spinner)
🔴 Error:    Toast "Không thể tải" + [Thử lại]
```

### Naming trong Figma
```
Page:   F{XX} — {Feature Name}
Frame:  F{XX}/{Screen}/Desktop hoặc Mobile
Layer:  Tên có nghĩa, KHÔNG "Frame 123"
```

---

## 7. Figma Links — Tracking

> Designer vẽ xong → **paste link vào bảng dưới**. Dev dùng Figma Dev Mode.

| Feature | PRD | Figma Link | Desktop | Mobile | Status |
|---------|-----|------------|:---:|:---:|:---:|
| **DS** Design System (shadcn/ui) | [Docs](https://ui.shadcn.com/) | [Figma Kit](https://www.figma.com/design/VVSDY0EEZZEMvkDJ32JNz4/shadcn-ui-components-with-variables---Tailwind-classes---Updated-January-2026--Community-?node-id=72-2719&t=kfZtK78gqmsCLHlG-1) | ✅ | ✅ | ✅ Có sẵn |
| **F01** AI Chat Builder | [PRD](../prd/F01-ai-chat-builder.md) | <!-- PASTE --> | ⬜ | ⬜ | ⬜ Chưa có |
| **F02** Auth | [PRD](../prd/F02-auth.md) | <!-- PASTE --> | ⬜ | ⬜ | ⬜ Chưa có |
| **F03** Dashboard | [PRD](../prd/F03-dashboard.md) | ✅ Có PNG cũ | ✅ | ⬜ | ⚠️ Cần mobile |
| **F05** AI Editor | [PRD](../prd/F05-ai-editor.md) | <!-- PASTE --> | ⬜ | ⬜ | ⬜ Chưa có |
| **F06** Onboarding | [PRD](../prd/F06-onboarding.md) | <!-- PASTE --> | ⬜ | ⬜ | ⬜ Chưa có |
| **F07** Templates | [PRD](../prd/F07-template-gallery.md) | <!-- PASTE --> | ⬜ | ⬜ | ⬜ Chưa có |
| **F08** Publish Flow | [PRD](../prd/F08-publish-flow.md) | <!-- PASTE --> | ⬜ | ⬜ | ⬜ Chưa có |
| **F09** Products + Halal | [PRD](../prd/F09-products-crud.md) | <!-- PASTE --> | ⬜ | ⬜ | ⬜ Chưa có |
| **F10** Storefront + Trust | [PRD](../prd/F10-storefront-commerce.md) | ✅ Có JPG cũ | ✅ | ⬜ | ⚠️ Cần mobile |
| **F11** Orders + WhatsApp | [PRD](../prd/F11-orders-management.md) | <!-- PASTE --> | ⬜ | ⬜ | ⬜ Chưa có |
| **F12** SEO Dashboard | [PRD](../prd/F12-seo-dashboard.md) | <!-- PASTE --> | ⬜ | ⬜ | ⬜ Chưa có |
| **F13** Analytics | [PRD](../prd/F13-analytics-dashboard.md) | <!-- PASTE --> | ⬜ | ⬜ | ⬜ Chưa có |
| **F14** Undo/Redo | [PRD](../prd/F14-undo-redo.md) | — | — | — | Trong F05 |
| **F15** Auto-save | [PRD](../prd/F15-auto-save-draft.md) | — | — | — | Trong F05 |
| **F16** Payment 🇲🇾 | [PRD](../prd/F16-payment-gateway.md) | <!-- PASTE --> | ⬜ | ⬜ | ⬜ Chưa có |
| **F17** Shipping 🇲🇾 | [PRD](../prd/F17-shipping.md) | <!-- PASTE --> | ⬜ | ⬜ | ⬜ Chưa có |

---

## 8. Handoff Checklist

Trước khi paste Figma link vào §7:

- [ ] Desktop frame (1440px)
- [ ] Mobile frame (375px)
- [ ] 4 states (Empty, Loading, Error, Success)
- [ ] Dùng shadcn components
- [ ] Color tokens đúng (§3)
- [ ] Typography Inter, đúng sizes
- [ ] Spacing multiples of 4px
- [ ] MY elements: RM format, Halal badge, WhatsApp button
- [ ] Layer names có nghĩa
- [ ] Tech Lead approved

---

## 9. Tham khảo Design

| Loại | Xem | Học gì |
|------|-----|--------|
| **Shopee Seller Center** | seller.shopee.com.my | Dashboard, product management |
| **Shopify Admin** | admin.shopify.com | Clean dashboard, product form |
| **Wix/Squarespace Editor** | wix.com/editor | AI editor split view |
| **v0.dev** | v0.dev | AI chat → UI generation |
| **Shopee App** | Play Store | Mobile product page, checkout |
| **GrabFood** | Play Store | Bottom nav, order tracking |

---

## 10. Tìm ở đâu

| Câu hỏi | File |
|---------|------|
| MY market research (personas, payment, cultural) | [malaysia-market-context.md](../malaysia-market-context.md) |
| Feature PRD | [docs/prd/](../prd/) |
| User stories + Gherkin AC | [docs/stories/](../stories/) |
| Architecture / Component tree | [docs/architecture/](../architecture/) |
| Product decisions log | [docs/decisions/](../decisions/) |
| Sprint 0 tasks | [SPRINT0_DETAIL.md](../SPRINT0_DETAIL.md) |
