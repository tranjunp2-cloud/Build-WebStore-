# 🎨 Design Workflow & Rules — PrimeWeb

> **Dành cho:** Designer UI/UX
> **Đọc trước khi bắt đầu:** [PROJECT_ALIGNMENT.md](PROJECT_ALIGNMENT.md) (timeline, priority)

---

## 1. Quy trình Design

```
Step 1                Step 2              Step 3              Step 4
Nhận brief       →    Wireframe      →    UI Design      →    Handoff
(Architecture doc)     (Low-fi, 1 ngày)   (Hi-fi, 2-3 ngày)  (Figma link vào repo)
       ↓                    ↓                   ↓                    ↓
  Đọc PRD + Stories    Review với TL       Review với TL       Dev dùng Dev Mode
```

### Chi tiết mỗi step

| Step | Input | Output | Ai review | Thời gian |
|------|-------|--------|-----------|:---------:|
| **1. Nhận brief** | PRD + Stories + Architecture doc | Hiểu rõ yêu cầu | — | 2-3 giờ |
| **2. Wireframe** | Hiểu biết từ step 1 | Low-fi frames (Desktop + Mobile) | Tech Lead | 1 ngày |
| **3. UI Design** | Wireframe approved | Hi-fi design với Design System | Tech Lead + 1 Dev | 2-3 ngày |
| **4. Handoff** | UI approved | Figma link vào `docs/design/README.md` | — | 15 phút |

---

## 2. Mỗi Feature cần có

### Bắt buộc
- [ ] **Desktop** (1440px)
- [ ] **Mobile** (375px) — BMAD bắt buộc
- [ ] **4 States**: Empty, Loading, Error, Success
- [ ] **Interactive elements**: hover, focus, disabled, active

### Nên có
- [ ] Tablet breakpoint (768px)
- [ ] Dark mode (nếu áp dụng)
- [ ] Micro-animations (transition notes)
- [ ] User flow (arrows giữa screens)

---

## 3. Design System — shadcn/ui

> **QUAN TRỌNG:** Project dùng **shadcn/ui** (React components). Designer phải design **matching** với shadcn components.

### Figma Resources
- **shadcn/ui Figma Kit**: [Tìm trên Figma Community](https://www.figma.com/community/search?resource_type=mixed&sort_by=relevancy&query=shadcn)
- Import kit vào project Figma → dùng components từ đó

### Components chính (phải dùng từ kit)

| Component | Dùng cho |
|-----------|---------|
| **Button** | CTA, actions — Primary, Secondary, Outline, Ghost |
| **Input** | Forms — Text, Email, Password, Search |
| **Select** | Dropdowns — Filter, sort |
| **Dialog** | Modal — Confirm, alert |
| **Sheet** | Slide-over panel — Detail views |
| **Card** | Product card, stat card, info card |
| **Table** | Products list, Orders list |
| **Badge** | Status tags — Published, Draft, Active |
| **Toast** | Notifications — Success, Error, Warning |
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
Success:     hsl(142, 71%, 45%)     ← Success states
Warning:     hsl(38, 92%, 50%)      ← Warnings
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

## 4. Design Rules

### Mobile First
```
❌ Design desktop trước rồi co lại
✅ Design mobile (375px) trước → mở rộng ra desktop
```

### Consistency
```
❌ Tự tạo component/style mới
✅ Dùng shadcn components từ Figma Kit
   Nếu cần component mới → trao đổi với Tech Lead trước
```

### ⚠️ Rule: 4 States — BẮT BUỘC mỗi screen

> **Tại sao?** Nếu designer chỉ vẽ state "có data" → dev không biết trang trống, đang load, hay bị lỗi thì hiện gì → tự design bừa → UI không nhất quán. 4 states đảm bảo **user không bao giờ thấy trang trắng trơn**.

Ví dụ: Trang **Products List** (`/dashboard/products`)

#### ✅ State 1: Success (có data — bình thường)
```
┌─ Products ──────────────────────────────┐
│  Products (12)           [+ Add Product] │
│                                          │
│  📷 Baju Kurung Pink     RM 189    Active│
│  📷 Tudung Bawal Basic   RM 35     Active│
│  📷 Telekung Premium     RM 250    Draft │
└──────────────────────────────────────────┘
```
Ai cũng design state này. **Nhưng 3 state dưới mới quan trọng.**

#### 📭 State 2: Empty (chưa có data)
```
┌─ Products ──────────────────────────────┐
│  Products (0)                            │
│                                          │
│              📦                          │
│      Chưa có sản phẩm nào               │
│    Thêm sản phẩm đầu tiên để            │
│    bắt đầu bán hàng                      │
│                                          │
│        [+ Thêm Sản Phẩm]  ← CTA        │
└──────────────────────────────────────────┘
```
User mới, chưa có data → trang **KHÔNG được trống trơn**:
- **Icon** (📦) → nhìn không hoang mang
- **Text giải thích** → hiểu tại sao trống
- **CTA button** → biết phải làm gì tiếp

```
❌ Sai:  Bảng trống, không có gì
✅ Đúng: Icon + text mô tả + nút hành động
```

#### ⏳ State 3: Loading (đang tải data)
```
┌─ Products ──────────────────────────────┐
│  Products                [+ Add Product] │
│                                          │
│  ██████████████████       ████    ██████ │
│  ██████████████████       ████    ██████ │
│  ██████████████████       ████    ██████ │
│  ██████████████████       ████    ██████ │
└──────────────────────────────────────────┘
           ↑ Skeleton (xám nhấp nháy, hình giống nội dung thật)
```
API đang load → hiện khung xám nhấp nháy **giống hình dáng nội dung thật**. User thấy layout đang hình thành → cảm giác nhanh.

```
❌ Sai:  Spinner tròn quay giữa trang trống → không biết chờ bao lâu
✅ Đúng: Skeleton giống layout thật → user thấy data sắp xuất hiện
```

#### 🔴 State 4: Error (API lỗi, mất mạng)
```
┌─ Products ──────────────────────────────┐
│  Products                                │
│                                          │
│  ┌─ Toast (góc trên phải) ──────────┐   │
│  │ ❌ Không thể tải sản phẩm.       │   │
│  │    [Thử lại]                      │   │
│  └───────────────────────────────────┘   │
└──────────────────────────────────────────┘
```
API lỗi → **KHÔNG để trang trắng không nói gì**:
- **Toast đỏ** → user biết có lỗi
- **"Thử lại" button** → user tự fix được, không cần refresh trang

```
❌ Sai:  Trang trắng, hoặc hiện "Error" không có nút gì
✅ Đúng: Thông báo rõ lỗi + nút retry
```

#### Tóm tắt rule

| State | Khi nào | User thấy gì | Mục đích |
|-------|---------|--------------|----------|
| **Success** | Có data | Nội dung thật | Bình thường |
| **Empty** | Chưa có data | Icon + text + CTA | Không hoang mang |
| **Loading** | Đang tải | Skeleton (khung xám) | Trang không trống |
| **Error** | API lỗi | Toast + "Thử lại" | Tự khắc phục |

### Naming trong Figma
```
Page:   F{XX} — {Feature Name}
Frame:  F{XX}/{Screen}/Desktop hoặc Mobile
Layer:  Dùng tên có nghĩa, KHÔNG "Frame 123"
```

Ví dụ:
```
📄 F05 — AI Editor
├── F05/Editor/Desktop
├── F05/Editor/Mobile
├── F05/Editor/Empty-State
├── F05/Editor/Loading-State
└── F05/Editor/Error-State
```

---

## 5. Figma Links — Tracking

> Designer vẽ xong → **paste link vào bảng dưới**. Dev dùng Figma Dev Mode.

| Feature | PRD | Figma Link | Desktop | Mobile | Status |
|---------|-----|------------|:---:|:---:|:---:|
| **F01** AI Chat Builder | [PRD](../prd/F01-ai-chat-builder.md) | `<!-- PASTE FIGMA LINK -->` | ⬜ | ⬜ | ⬜ Chưa có |
| **F02** Auth | [PRD](../prd/F02-auth.md) | `<!-- PASTE FIGMA LINK -->` | ⬜ | ⬜ | ⬜ Chưa có |
| **F03** Dashboard | [PRD](../prd/F03-dashboard.md) | ✅ Có PNG cũ | ✅ | ⬜ | ⚠️ Cần mobile |
| **F05** AI Editor | [PRD](../prd/F05-ai-editor.md) | `<!-- PASTE FIGMA LINK -->` | ⬜ | ⬜ | ⬜ Chưa có |
| **F06** Onboarding | [PRD](../prd/F06-onboarding.md) | `<!-- PASTE FIGMA LINK -->` | ⬜ | ⬜ | ⬜ Chưa có |
| **F07** Templates | [PRD](../prd/F07-template-gallery.md) | `<!-- PASTE FIGMA LINK -->` | ⬜ | ⬜ | ⬜ Chưa có |
| **F08** Publish Flow | [PRD](../prd/F08-publish-flow.md) | `<!-- PASTE FIGMA LINK -->` | ⬜ | ⬜ | ⬜ Chưa có |
| **F09** Products CRUD | [PRD](../prd/F09-products-crud.md) | `<!-- PASTE FIGMA LINK -->` | ⬜ | ⬜ | ⬜ Chưa có |
| **F10** Storefront | [PRD](../prd/F10-storefront-commerce.md) | ✅ Có JPG cũ | ✅ | ⬜ | ⚠️ Cần mobile |
| **F11** Orders | [PRD](../prd/F11-orders-management.md) | `<!-- PASTE FIGMA LINK -->` | ⬜ | ⬜ | ⬜ Chưa có |
| **F12** SEO Dashboard | [PRD](../prd/F12-seo-dashboard.md) | `<!-- PASTE FIGMA LINK -->` | ⬜ | ⬜ | ⬜ Chưa có |
| **F13** Analytics | [PRD](../prd/F13-analytics-dashboard.md) | `<!-- PASTE FIGMA LINK -->` | ⬜ | ⬜ | ⬜ Chưa có |
| **F14** Undo/Redo | [PRD](../prd/F14-undo-redo.md) | — | — | — | Trong F05 Editor |
| **F15** Auto-save | [PRD](../prd/F15-auto-save-draft.md) | — | — | — | Trong F05 Editor |

Figma link format: `https://www.figma.com/design/XXXXX/PrimeWeb-F{XX}?node-id=...`

---

## 6. Handoff Checklist

Trước khi ghi Figma link vào bảng trên, check:

- [ ] Desktop frame (1440px) — done
- [ ] Mobile frame (375px) — done
- [ ] 4 states (Empty, Loading, Error, Success)
- [ ] Dùng shadcn components (không custom)
- [ ] Color tokens đúng (không hardcode hex)
- [ ] Typography đúng (Inter, đúng sizes)
- [ ] Spacing đúng (multiples of 4px)
- [ ] Layer names có nghĩa
- [ ] Tech Lead approved

→ Paste link vào bảng **§5 Figma Links** ở trên

---

## 7. Skills cần thiết

### Bắt buộc
| Skill | Mức | Lý do |
|-------|-----|-------|
| **Figma** | Thành thạo | Tool chính. Component system, auto-layout, variants |
| **Responsive Design** | Thành thạo | Mobile-first là bắt buộc |
| **Design System** | Hiểu rõ | Phải biết dùng tokens, components nhất quán |
| **UI States** | Hiểu rõ | Empty/Loading/Error/Success cho mọi screen |

### Nên có
| Skill | Mức | Lý do |
|-------|-----|-------|
| **Tailwind CSS** | Cơ bản | Hiểu spacing/color naming → design sát code |
| **shadcn/ui** | Cơ bản | Biết components nào có sẵn → design khả thi |
| **Prototyping** | Cơ bản | Demo user flows cho review |
| **Accessibility** | Cơ bản | Contrast ratio, touch target size (44px min) |
| **E-commerce UX** | Portfolio | Hiểu checkout flow, product page, cart |
| **SaaS Dashboard UX** | Portfolio | Biết layout admin panel, data tables, charts |

### Tham khảo Design
| Loại | Xem |
|------|-----|
| **SaaS Builder** | Framer, Webflow, Shopify admin |
| **E-commerce** | Shopee seller center, Lazada seller |
| **Dashboard** | Linear, Notion, Vercel dashboard |
| **AI Chat** | ChatGPT, Claude, v0.dev |

---

## 8. Tìm ở đâu

| Câu hỏi | File |
|---------|------|
| Feature cần design gì? | [docs/prd/](../prd/) — đọc PRD |
| User flows, acceptance criteria? | [docs/stories/](../stories/) — Gherkin AC |
| Component tree, layout gợi ý? | [docs/architecture/](../architecture/) |
| Figma links tracking? | Bảng §5 trong file này |
| Quyết định đã chốt? | [docs/decisions/](../decisions/) |
