# 📐 Low-fi Wireframes: F01 AI Web Builder

Dựa trên PRD v2.1 (`F01-ai-builder.md`) — **Form-based Structured Input** (không còn Chat conversational).
Bao gồm Desktop và Mobile wireframes, 4 trạng thái bắt buộc + Post-Publish.

- **Prototype Link**: [Figma Prototype](https://www.figma.com/make/Y48xuOh2gMCid2UmqOAFys/F01-ai-chat-builder-demo?fullscreen=1&t=iwM7PR5a2viApvbg-1&preview-route=%2Fsignin)
- **Figma Design Link**: [Figma Design](https://www.figma.com/design/oFACZVA1oplxslloJWEkLp/TM_Prime-Web-V2.0?node-id=30607-16452&t=fkzJdMXzmQQr0ppW-1)
- **PRD Reference**: [F01-ai-builder.md](../prd/F01-ai-builder.md) (Version 2.1 — Form-based Input)

---

## 💻 1. DESKTOP WIREFRAME (≥ 768px)

Cấu trúc: Split View — Form Panel trái (380px), Live Preview phải (còn lại).

### 1.1 Trạng thái Empty (Form Input — Chưa submit)
```text
┌──────────────────────────────────────┐┌────────────────────────────────────────────────────────┐
│ [Logo PrimeWeb]          [X] Close   ││                                                        │
│                                      ││                     [Badge: Draft]                     │
│ ─── Step 1/3: Thông tin ───          ││                                                        │
│                                      ││                                                        │
│ Tên doanh nghiệp *                  ││                                                        │
│ ┌──────────────────────────────┐     ││            [Illustration: Empty Canvas]                │
│ │ VD: Mira Boutique            │     ││             "Website của bạn sẽ hiển                 │
│ └──────────────────────────────┘     ││              thị ở đây..."                           │
│                                      ││                                                        │
│ Ngành nghề *                         ││                                                        │
│ ┌──────────────────────────────┐     ││                                                        │
│ │ [Thời trang] [F&B] [Làm đẹp]│     ││                                                        │
│ │ [Giáo dục] [Công nghệ]      │     ││                                                        │
│ │ [Bất động sản] [Y tế] [Khác]│     ││                                                        │
│ └──────────────────────────────┘     ││                                                        │
│ (Chọn 1 — hoặc gõ ngành khác)       ││                                                        │
│                                      ││                                                        │
│ Mô tả ngắn *                        ││                                                        │
│ ┌──────────────────────────────┐     ││                                                        │
│ │ VD: Shop thời trang nữ       │     ││                                                        │
│ │ phong cách Hàn Quốc          │     ││                                                        │
│ └──────────────────────────────┘     ││                                                        │
│                                      ││                                                        │
│ Sản phẩm / Dịch vụ *                ││                                                        │
│ ┌──────────────────────────────┐     ││                                                        │
│ │ VD: Áo dài, Váy cưới,       │     ││                                                        │
│ │ Phụ kiện thời trang          │     ││                                                        │
│ └──────────────────────────────┘     ││                                                        │
│                                      ││                                                        │
│ ┌──────────────────────────────┐     ││                                                        │
│ │      🚀 Tạo Website           │     ││                                                        │
│ └──────────────────────────────┘     ││                                                        │
└──────────────────────────────────────┘└────────────────────────────────────────────────────────┘
```

### 1.2 Trạng thái Loading (AI đang Generate — SSE Streaming)
```text
┌──────────────────────────────────────┐┌────────────────────────────────────────────────────────┐
│ [Logo PrimeWeb]          [X] Close   ││                     [Badge: Generating...]             │
│                                      ││                                                        │
│ ─── Step 2/3: Đang tạo 4 trang ──── ││  ┌──────────────────────────────────────────────────┐  │
│                                      ││  │ [Skeleton: Navbar] [Home] [About] [Shop] [Contact]│  │
│ [✅] Phân tích thông tin...           ││  └──────────────────────────────────────────────────┘  │
│ [✅] Chọn layout phù hợp...          ││  ┌──────────────────────────────────────────────────┐  │
│ [🔄] Tạo trang Homepage...           ││  │                                                  │  │
│ [  ] Tạo trang About Us...           ││  │         [Skeleton: Hero Banner — DALL-E]         │  │
│ [  ] Tạo trang Products...           ││  │                                                  │  │
│ [  ] Tạo trang Contact...            ││  └──────────────────────────────────────────────────┘  │
│                                      ││  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │
│ ⏱ Dự kiến hoàn thành: ~30 giây      ││  │ [Skel: Card] │ │ [Skel: Card] │ │ [Skel: Card] │  │
│                                      ││  └──────────────┘ └──────────────┘ └──────────────┘  │
│ ┌──────────────────────────────┐     ││                                                        │
│ │ 🚫 Đang xử lý... (Disabled)  │     ││                                                        │
│ └──────────────────────────────┘     ││                                                        │
└──────────────────────────────────────┘└────────────────────────────────────────────────────────┘
```

### 1.3 Trạng thái Success (Preview + Drag-Drop Reorder)
```text
┌──────────────────────────────────────┐┌────────────────────────────────────────────────────────┐
│ [Logo PrimeWeb]          [X] Close   ││                     [Badge: Draft]                     │
│                                      ││                                                        │
│ ─── Step 3/3: Hoàn tất! 🎉 ──────── ││  [Page Tabs: Home | About | Products | Contact]       │
│                                      ││  ┌──────────────────────────────────────────────────┐  │
│ ✅ Website "Mira Boutique"           ││  │ [MIRA Logo]    [Home] [About] [Shop] [Contact] │  │
│    đã tạo xong!                      ││  └──────────────────────────────────────────────────┘  │
│                                      ││  ┌──────────────────────────────────────────────────┐  │
│ 📊 Thống kê:                         ││  │ ⠿ ← Drag handle                                │  │
│ • 4 trang đã tạo                     ││  │     👗 Thời trang nữ thanh lịch & Tinh tế        │  │
│ • 12 sections generated             ││  │              [Nút: Mua sắm ngay]                │  │
│ • AI Image: ✅ Hero banner           ││  └──────────────────────────────────────────────────┘  │
│                                      ││  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │
│ Bạn có thể kéo thả các block        ││  │⠿ 👗 Áo Polo │ │⠿ 👗 Váy A  │ │⠿ 👚 Áo khoác│  │
│ để đổi vị trí ↕️                      ││  │ RM 49.00     │ │ RM 89.00     │ │ RM 120.00    │  │
│                                      ││  └──────────────┘ └──────────────┘ └──────────────┘  │
│                                      ││                                                        │
│ ┌──────────────────────────────┐     ││                                                        │
│ │     🚀 Publish Website        │     ││  ┌──────────────────────────────────────────────────┐  │
│ └──────────────────────────────┘     ││  │ [Footer: © Mira Boutique | Social icons]         │  │
│ ┌──────────────────────────────┐     ││  └──────────────────────────────────────────────────┘  │
│ │     ✏️ Open Editor             │     ││                                                        │
│ └──────────────────────────────┘     ││                                                        │
└──────────────────────────────────────┘└────────────────────────────────────────────────────────┘
```
**Ghi chú:**
- **Page Tabs**: Cho phép switch giữa 4 trang để xem Preview từng trang.
- **Drag handle (⠿)**: Hover block → hiện handle kéo thả. Navigation & Footer không được kéo.
- **AI Image**: Nhấn vào ảnh Hero → option "🔄 Tạo ảnh mới" (FR-12).

### 1.4 Trạng thái Error (Lỗi xảy ra)
```text
┌──────────────────────────────────────┐┌────────────────────────────────────────────────────────┐
│ [Logo PrimeWeb]          [X] Close   ││                                                        │
│                                      ││                     [Badge: Error]                     │
│ ─── Step 2/3: Đang tạo... ────────── ││                                                        │
│                                      ││                                                        │
│ [✅] Phân tích thông tin...           ││            [Illustration: Lỗi kết nối]                │
│ [❌] Tạo trang Homepage... (Lỗi!)    ││             "Đã xảy ra lỗi khi tạo website.            │
│                                      ││              Vui lòng thử lại!"                       │
│ ┌────────────────────────┐           ││                                                        │
│ │ ⚠️ Lỗi kết nối AI       │ (Toast)  ││                                                        │
│ │ Quota không bị trừ.    │           ││                                                        │
│ └────────────────────────┘           ││                                                        │
│                                      ││                                                        │
│ ┌──────────────────────────────┐     ││                                                        │
│ │     🔄 Thử Lại                │     ││                                                        │
│ └──────────────────────────────┘     ││                                                        │
│ (Không cần nhập lại form - FR-08)    ││                                                        │
└──────────────────────────────────────┘└────────────────────────────────────────────────────────┘
```

### 1.5 Post-Publish Confirmation (FR-19, FR-20)
```text
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                              │
│                        🎉 Website đã được xuất bản thành công!                              │
│                                                                                              │
│             ┌──────────────────────────────────────────────────────┐                         │
│             │                                                      │                         │
│             │   🌐 Website của bạn đã live tại:                     │                         │
│             │                                                      │                         │
│             │   ┌────────────────────────────────────────┐         │                         │
│             │   │ mira-boutique.primeweb.app       [📋] │         │                         │
│             │   └────────────────────────────────────────┘         │                         │
│             │           (Click 📋 để Copy URL — Toast: "Copied!")  │                         │
│             │                                                      │                         │
│             │   📊 Thống kê:                                        │                         │
│             │   • 4 trang đã publish                               │                         │
│             │   • SEO meta tự động                                 │                         │
│             │                                                      │                         │
│             │   ┌──────────────────────────────────┐               │                         │
│             │   │  👁️ Xem Website (Tab mới)         │               │                         │
│             │   └──────────────────────────────────┘               │                         │
│             │   ┌──────────────────────────────────┐               │                         │
│             │   │  📊 Go to Admin Dashboard         │               │                         │
│             │   └──────────────────────────────────┘               │                         │
│             │                                                      │                         │
│             └──────────────────────────────────────────────────────┘                         │
│                                                                                              │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📱 2. MOBILE WIREFRAME (< 768px)

### 2.1 Form Input (Vertical Layout) — FR-23
```text
┌──────────────────────────┐
│ [Logo]           [X]    │
│                          │
│ ─── Thông tin cơ bản ─── │
│                          │
│ Tên doanh nghiệp *      │
│ ┌──────────────────────┐ │
│ │ Mira Boutique        │ │
│ └──────────────────────┘ │
│                          │
│ Ngành nghề *             │
│ ┌──────────────────────┐ │
│ │[Thời trang] [F&B]    │ │
│ │[Làm đẹp] [Giáo dục]  │ │
│ │[Công nghệ] [BĐS]     │ │
│ │[Y tế] [Khác]         │ │
│ └──────────────────────┘ │
│ (Chọn 1 hoặc gõ khác)   │
│                          │
│ Mô tả ngắn *            │
│ ┌──────────────────────┐ │
│ │ Shop thời trang nữ   │ │
│ │ phong cách Hàn Quốc  │ │
│ └──────────────────────┘ │
│                          │
│ Sản phẩm / Dịch vụ *    │
│ ┌──────────────────────┐ │
│ │ Áo dài, Váy cưới     │ │
│ └──────────────────────┘ │
│                          │
│                          │
│ ┌──────────────────────┐ │ ← Sticky bottom
│ │  🚀 Tạo Website       │ │
│ └──────────────────────┘ │
└──────────────────────────┘
```
**Font ≥16px** để tránh Safari auto-zoom. Nút Submit **sticky đáy** không bị bàn phím che.

### 2.2 Immersive Preview + Floating Pill (Loading) — FR-24, FR-25
```text
┌──────────────────────────┐
│ [Logo]           [X]    │ ← Header nhỏ gọn
├──────────────────────────┤
│ ┌──────────────────────┐ │
│ │ [MIRA]         [ ☰ ] │ │
│ └──────────────────────┘ │
│ ┌──────────────────────┐ │
│ │                      │ │
│ │  [Skeleton: Hero]    │ │
│ │                      │ │
│ └──────────────────────┘ │
│ ┌──────────────────────┐ │
│ │ [Skeleton: Products] │ │  ← Preview chiếm 100% 
│ └──────────────────────┘ │    (Immersive mode)
│                          │
│                          │
│                          │
│ ┌──────────────────────┐ │ ← Floating Pill bottom
│ │ 🔄 Đang tạo (2/4)... │ │
│ └──────────────────────┘ │
└──────────────────────────┘
```
Form **trượt đi** nhường toàn bộ màn hình cho Preview. **Floating Pill** cuối màn hình hiện tiến trình.

### 2.3 Success — Mobile Reorder (List Mode / Up-Down) — FR-26
```text
┌──────────────────────────┐
│ [Logo]      [🔀] [🚀]   │
├──────────────────────────┤

Option A: List Mode             Option B: Preview + Buttons
┌──────────────────────────┐   ┌──────────────────────────┐
│ ─── SẮP XẾP BLOCK ────  │   │ ┌──────────────────────┐ │
│                          │   │ │ [MIRA]         [☰]  │ │
│ 1. ☰ Navigation     🔒  │   │ └──────────────────────┘ │
│ 2. ☰ Hero Banner    [↑↓]│   │ ┌──────────────────────┐ │
│ 3. ☰ Product Grid   [↑↓]│   │ │  Hero Banner     [↑] │ │
│ 4. ☰ Testimonials   [↑↓]│   │ │                  [↓] │ │
│ 5. ☰ Contact Form   [↑↓]│   │ └──────────────────────┘ │
│ 6. ☰ Footer          🔒  │   │ ┌──────────────────────┐ │
│                          │   │ │  Product Grid    [↑] │ │
│ ┌──────────────────────┐ │   │ │                  [↓] │ │
│ │ ✅ Xác nhận thứ tự    │ │   │ └──────────────────────┘ │
│ └──────────────────────┘ │   │                          │
└──────────────────────────┘   └──────────────────────────┘
```
**Touch-safe**: Dùng nút **Up/Down** hoặc **List Mode** thay vì kéo thả iframe trên mobile.

### 2.4 Post-Publish (Mobile)
```text
┌──────────────────────────┐
│ [Logo]                  │
├──────────────────────────┤
│                          │
│       🎉 Thành công!     │
│                          │
│  Website đã live tại:   │
│  ┌────────────────────┐  │
│  │ mira-boutique      │  │
│  │ .primeweb.app [📋] │  │
│  └────────────────────┘  │
│                          │
│  ┌────────────────────┐  │
│  │ 👁️ Xem Website      │  │
│  └────────────────────┘  │
│  ┌────────────────────┐  │
│  │ 📊 Admin Dashboard  │  │
│  └────────────────────┘  │
│                          │
└──────────────────────────┘
```

---

## 🛡 3. Ghi chú UI Patterns

- **Form Validation Inline:** Hiển thị lỗi ngay dưới trường input khi thiếu hoặc sai.
- **Industry Selector:** Hiển thị dạng chip grid (single-select). Chọn "Khác" → hiện thêm text input để user tự nhập ngành nghề. Giá trị industry được truyền cho AI để tối ưu layout, style, và nội dung phù hợp ngành.
- **Content Safety:** Input chứa từ nhạy cảm → Toast đỏ "Nội dung không phù hợp. Vui lòng thử lại."
- **Skeleton loading animation:** Dùng hiệu ứng shimmer/pulse, block-by-block fill-in.
- **Rate Limit Paywall:** Free tier hết lượt → CTA "Nâng cấp Pro" hiện trong form panel.
- **Draft Recovery Dialog:** Popup xác nhận khôi phục draft khi quay lại `/builder/new`.
- **Drag-Drop Visual Cue:** Khi kéo block → vạch xanh dương hiện vị trí drop.
- **AI Label:** Block AI-generated có badge "AI Generated ✨" trong editor mode, ẩn trên storefront.

---

## 🔍 4. BỔ SUNG: CÁC MÀN HÌNH CHI TIẾT (EDGE CASES)

### 4.1 Draft Recovery Dialog
```text
┌────────────────────────────────────────────────────────┐
│                                                        │
│          ┌──────────────────────────────────┐          │
│          │ ⚠️ Bạn có một bản nháp!           │          │
│          │                                  │          │
│          │ Website "Mira Boutique" đang dở  │          │
│          │ cách đây 2 giờ. Tiếp tục?        │          │
│          │                                  │          │
│          │ [Button: Bỏ qua, tạo mới (Đỏ)]    │          │
│          │ [Button: Tiếp tục bản nháp (Xanh)]│          │
│          └──────────────────────────────────┘          │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### 4.2 Rate Limit / Up-sell Paywall
```text
┌──────────────────────────────────────┐┌────────────────────────────────────────────────────────┐
│                                      ││                     [Badge: View Only]                 │
│ ─── Giới hạn tạo website ─────────── ││                                                        │
│                                      ││            [Illustration: Upgrade/Rocket]              │
│ ⚠️ Bạn đã sử dụng hết lượt tạo      ││             "Nâng cấp để mở khóa quyền                 │
│ AI miễn phí!                         ││              năng sáng tạo vô hạn!"                    │
│                                      ││                                                        │
│ ┌─────────────────────────────────┐  ││                                                        │
│ │ 🌟 Gói Pro - RM 49/tháng          │  ││                                                        │
│ │ - Tạo không giới hạn            │  ││                                                        │
│ │ - Không logo PrimeWeb           │  ││                                                        │
│ │ [Nâng cấp ngay]                 │  ││                                                        │
│ └─────────────────────────────────┘  ││                                                        │
└──────────────────────────────────────┘└────────────────────────────────────────────────────────┘
```

### 4.3 Content Safety Rejection
```text
┌──────────────────────────────────────┐
│                                      │
│ Mô tả ngắn *                        │
│ ┌──────────────────────────────┐     │
│ │ [Input nhạy cảm bị detect]   │     │
│ └──────────────────────────────┘     │
│ ❌ Nội dung không phù hợp.           │
│    Vui lòng mô tả lại.              │
│                                      │
└──────────────────────────────────────┘
```
