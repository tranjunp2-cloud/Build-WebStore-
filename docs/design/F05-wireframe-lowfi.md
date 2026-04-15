# F05 AI Editor — Low-fidelity Wireframes & Use Cases

Tài liệu này phác thảo cấu trúc giao diện (Low-Fi Wireframe) cho màn hình F05 AI Editor dựa trên các tài liệu đặc tả (PRD).
> **Links figma:** https://www.figma.com/design/oFACZVA1oplxslloJWEkLp/TM_Prime-Web-V2.0?node-id=30668-18322&t=Yv0FOSGAQrfAsGh3-4
> **Links figma mobile:** https://www.figma.com/design/oFACZVA1oplxslloJWEkLp/TM_Prime-Web-V2.0?node-id=30881-4619&t=GdNslDJjKmpEoMkY-1
---

## 1. Màn hình Desktop (Desktop View)

### Screen 1.1: Default View (Trạng thái rảnh — Không chọn Block nào)
Trạng thái khi người dùng vừa load trang, chuẩn bị chat với AI hoặc tùy chỉnh toàn cục.

```text
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ [≡ Menu]  Home ▼ │ 🎨 Templates │ ↩ Undo  ↪ Redo │ 💻 Desktop ▼ │ 👁️ │ Draft │ 🚀 Publish│
├──────────────────┴──────────────┴────────────────┴──────────────┴────┴───────┴──────────┤
│ ┌──────────────────────┐ ┌──────────────────────────────────────┐ ┌───────────────────┐ │
│ │ 🤖 AI CHAT           │ │ 🌍 LIVE PREVIEW (Iframe Sandbox)     │ │ ⚙️ GLOBAL SETTINGS│ │
│ │ ──────────────────── │ │ ┌──────────────────────────────────┐ │ │ ───────────────── │ │
│ │ [AI] Xin chào! Bạn   │ │ │ [Logo]            Home  About  │ │ │ ▼ Brand Identity  │ │
│ │ muốn chỉnh sửa gì?   │ │ ├──────────────────────────────────┤ │ │   [ Upload Logo ] │ │
│ │                      │ │ │                                  │ │ │                   │ │
│ │ ┌────────────┐       │ │ │                                  │ │ │ ▼ Contact Info    │ │
│ │ │[Dùng prompt]       │ │ │       HERO BANNER SECTION        │ │ │  Điện thoại:      │ │
│ │ │ 💡 "Đổi màu web"   │ │ │                                  │ │ │  [ ____________ ] │ │
│ │ └────────────┘       │ │ │                                  │ │ │  Địa chỉ:         │ │
│ │                      │ │ │                                  │ │ │  [ ____________ ] │ │
│ │                      │ │ │                                  │ │ │                   │ │
│ │ ──────────────────── │ │ │                                  │ │ │ ▼ Social Links    │ │
│ │ ⌨️ [ Nhập lệnh... ] ▶│ │ └──────────────────────────────────┘ │ │ ▼ SEO Settings    │ │
│ └──────────────────────┘ └──────────────────────────────────────┘ └───────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```
**Use Case:**
- Khi user vừa mở Editor, Panel phải hiển thị `⚙️ GLOBAL SETTINGS` vì chưa chọn gì.
- Dữ liệu ở `Contact Info` (SDT, Địa chỉ) auto-bind vào các block Footer/Contact Form trong Preview.

---

### Screen 1.2: Inline Click-to-Edit & Contextual Settings (Trạng thái chọn 1 Block)
Trạng thái khi người dùng hover/click vào một phần tử cụ thể (Vd: Hero Headline).

```text
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ [≡ Menu]  Home ▼ │ 🎨 Templates │ ↩ Undo  ↪ Redo │ 💻 Desktop ▼ │ 👁️ │ Saved │ 🚀 Publish│
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────┐ ┌──────────────────────────────────────┐ ┌───────────────────┐ │
│ │ 🤖 AI CHAT           │ │ ┌──────────────────────────────────┐ │ │ ⚙️ BLOCK SETTINGS │ │
│ │ ──────────────────── │ │ │ [Logo]            Home  About  │ │ │ (Hero Section)    │ │
│ │ [User] Đậm chữ lên   │ │ ├──────────────────────────────────┤ │ │ ───────────────── │ │
│ │ [AI] Đã tăng độ đậm  │ │ │ ┌─────────────────────────┐      │ │ │ ▼ Background      │ │
│ │  -> [Hoàn tác bùm!]  │ │ │ │   ✨ Edit with AI       │      │ │ │  [ Image / Color] │ │
│ │                      │ │ │ │ ┌─────────┬───┬───┬──┐  │      │ │ │  #000000 🟨      │ │
│ │                      │ │ │ │ │ [ B ] I U │ H1 ▼│ = │  │      │ │ │                   │ │
│ │                      │ │ │ │ └─────────┴───┴───┴──┘  │      │ │ │ ▼ Padding/Margin  │ │
│ │                      │ │ │ │  [ HERO BENNER TEXT ]   │      │ │ │  T: 40px  B: 40px │ │
│ │                      │ │ │ └─────────────────────────┘      │ │ │                   │ │
│ │                      │ │ │                                  │ │ │ ▼ Animation       │ │
│ │ ──────────────────── │ │ │                                  │ │ │  [ Fade In ▼ ]    │ │
│ │ ⌨️ [ Nhập lệnh... ] ▶│ │ └──────────────────────────────────┘ │ │  [ Fade In ▼ ]    │ │
│ └──────────────────────┘ └──────────────────────────────────────┘ └───────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```
**Use Case:**
- Khi Hover quá 200ms vào Text: Hiện nút `✨ Edit with AI` ở góc phải trên.
- Khi Double-Click vào đoạn Text: Hiện Floating Toolbar (B, I, U, Heading, Align).
- Cột bên phải chuyển từ Global Settings sang: `⚙️ BLOCK SETTINGS` của riêng Hero Section (Background ảnh, padding, color overlay).

---

### Screen 1.3: Drag-and-Drop Component Library (Kéo thả block)
Trạng thái mở thư viện Component ở bên trái để kéo vào Preview.

```text
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ [≡ Menu]  Home ▼ │ 🎨 Templates │ ↩ Undo  ↪ Redo │ 💻 Desktop ▼ │ 👁️ │ Saved │ 🚀 Publish│
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────┐ ┌──────────────────────────────────────┐ ┌───────────────────┐ │
│ │ 🛠️ COMPONENTS        │ │ ┌──────────────────────────────────┐ │ │ ⚙️ GLOBAL SETTINGS│ │
│ │ ──────────────────── │ │ │ [Logo]                 Nav   │ │ │                   │ │
│ │ 🔍 [ Tìh kiếm...   ] │ │ ├──────────────────────────────────┤ │ │                   │ │
│ │                      │ │ │                                  │ │ │                   │ │
│ │ ▼ Cơ bản             │ │ │            HERO AREA             │ │ │                   │ │
│ │ ┌─┐ Rich Text        │ │ │                                  │ │ │                   │ │
│ │ ├─┤                  │ │ │                                  │ │ │                   │ │
│ │ └─┘ Hero Banner  <=======[DRAG & DROP]===============\      │ │ │                   │ │
│ │   (Hold to drag)     │ │ ├────── 🟢 DROP BLOCK HERE ───────┤│ │ │                   │ │
│ │ ▼ Cửa hàng           │ │ │                                  │ │ │                   │ │
│ │  [🛒] Giỏ Hàng        │ │ │          PRODUCTS LIST           │ │ │                   │ │
│ │  [🛍️] Danh sách SP    │ │ │                                  │ │ │                   │ │
│ │ ▼ Widgets            │ │ └──────────────────────────────────┘ │ │                   │ │
│ │  [💬] Social Media   │ │                                      │ │                   │ │
│ └──────────────────────┘ └──────────────────────────────────────┘ └───────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```
**Use Case:**
- Khi người dùng click chọn tab `Thư viện` hoặc `Blocks`: Cột Sidebar trái ẩn AI Chat đi và mở danh sách Blocks.
- Khi kéo thả block từ sidebar trái vào Middle Iframe: Một vạch line định vị (Vạch xanh lá / xanh dương) xuất hiện ở Iframe giữa các section để báo vị trí block sẽ rớt xuống.

---

### Screen 1.4: Header & Submenu Management
Trạng thái người dùng chỉnh sửa thanh Header và tổ chức Menu cấp 2 (Dropdown).

```text
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ ...                                                                                     │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────┐ ┌──────────────────────────────────────┐ ┌───────────────────┐ │
│ │ 🤖 AI CHAT           │ │ ┌──────────────────────────────────┐ │ │ ⚙️ HEADER SETTINGS│ │
│ │ ──────────────────── │ │ │ [Logo Component ] [Nav Links ] │ │ │ ───────────────── │ │
│ │                      │ │ ├──────────────────────────────────┤ │ │ ▼ Navigation Links│ │
│ │                      │ │ │                                  │ │ │ ⠿ Home            │ │
│ │                      │ │ │    (Rest of site is dimmed)      │ │ │ ⠿ Products      ✎ │ │
│ │                      │ │ │                                  │ │ │   ⠿ Áo dài      ✎ │ │
│ │                      │ │ │                                  │ │ │   ⠿ Váy cưới    ✎ │ │
│ │                      │ │ │                                  │ │ │ ⠿ About Us      ✎ │ │
│ │                      │ │ │                                  │ │ │  [+ Thêm Link Mới]│ │
│ │                      │ │ │                                  │ │ │                   │ │
│ │                      │ │ │                                  │ │ │ ▼ Logo            │ │
│ │                      │ │ └──────────────────────────────────┘ │ │  [ Tải ảnh lên ]  │ │
│ └──────────────────────┘ └──────────────────────────────────────┘ └───────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```
**Use Case:**
- Click trực tiếp vào vùng Header Navigator ở màn hình giữa.
- Toàn bộ phía dưới của màn hình bị làm mờ nhẹ (dimmed focus mode) để nổi bật Header.
- Panel bên phải xổ ra `Navigation Links` dạng danh sách. User kéo (Drag icon ⠿) item `Áo dài` thụt lề dưới `Products` để biến nó thành Sub-menu thả xuống.

---

### Screen 1.5: Quản lý ẩn/hiện trang & Tùy chỉnh 404
Trạng thái mở Page Manager Dropdown ở trên cùng thanh Toolbar.

```text
┌────────────────────────────────────────────────────────────┐
│ [≡ Menu]  Home ▼     │ 🎨 Templates │ ↩ Undo  ↪ Redo │
│        ┌──────────────────────────────────┐                │
│        │ 📄 QUẢN LÝ TRANG                 │                │
│        │ ──────────────────────────────── │                │
│        │  Home (Trang chủ)          [⚙️] │                │
│        │  Products            [👁️][⚙️] │                │
│        │  About Us (Draft)    [👁️][⚙️] │                │
│        │  - - - - - - - - - - - - - - - - │                │
│        │  404 Not Found       [✐ Sửa]  │                │
│        │                                  │                │
│        │  [+ Thêm trang mới]              │                │
│        └──────────────────────────────────┘                │
```
**Use Case:**
- Modal Dropdown khi bấm vào tên trang hiện tại (VD: `Home ▼`) trên thanh điều hướng Toolbar.
- Mắt `[👁️]`: Click để Ẩn trang (Trạng thái ẩn thành con mắt gạch chéo). URL trang đó sẽ bị 404 với user ngoài.
- `[✐ Sửa 404 Not Found]`: Mở trang 404 lên Layout giữa (Iframe) để design bằng chat và hình ảnh (VD: thêm cún khóc, nút "Về trang chủ").

---

### Screen 1.6: Token Exhausted (Hết AI Token)
Trạng thái khi người dùng đã sử dụng hết hạn mức chat AI. Các công cụ manual (kéo thả, sửa tay) vẫn dùng bình thường, nhưng khung nhập chat bị khoá lại và có tuỳ chọn nâng cấp.

```text
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ [≡ Menu]  Home ▼ │ 🎨 Templates │ ↩ Undo  ↪ Redo │ 💻 Desktop ▼ │ 👁️ │ Saved │ 🚀 Publish│
├──────────────────┴──────────────┴────────────────┴──────────────┴────┴───────┴──────────┤
│ ┌──────────────────────┐ ┌──────────────────────────────────────┐ ┌───────────────────┐ │
│ │ 🤖 AI CHAT           │ │ 🌍 LIVE PREVIEW (Iframe Sandbox)     │ │ ⚙️ GLOBAL SETTINGS│ │
│ │ ──────────────────── │ │ ┌──────────────────────────────────┐ │ │ ───────────────── │ │
│ │ [AI] Xin chào! Bạn   │ │ │                                  │ │ │ ▼ Brand Identity  │ │
│ │ muốn chỉnh sửa gì?   │ │ │                                  │ │ │                   │ │
│ │                      │ │ │                                  │ │ │                   │ │
│ │ [User] Đổi nền hồng  │ │ │                                  │ │ │                   │ │
│ │                      │ │ │                                  │ │ │                   │ │
│ │ ⚠️ [SYSTEM]          │ │ │       HERO BANNER SECTION        │ │ │ ▼ Contact Info    │ │
│ │ Rất tiếc, bạn đã hết │ │ │                                  │ │ │                   │ │
│ │ lượt dùng AI tháng   │ │ │                                  │ │ │                   │ │
│ │ này!                 │ │ │                                  │ │ │                   │ │
│ │                      │ │ │                                  │ │ │ ▼ Social Links    │ │
│ │  [ 💎 Nâng cấp gói ] │ │ │                                  │ │ │                   │ │
│ │ ──────────────────── │ │ │                                  │ │ │                   │ │
│ │ 🚫 [ Đã hết Token ]  │ │ └──────────────────────────────────┘ │ │ ▼ SEO Settings    │ │
│ └──────────────────────┘ └──────────────────────────────────────┘ └───────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```
**Use Case:**
- Khi user vừa gửi lệnh và server báo lỗi hết Token (Token Exhausted).
- Hoặc user vào chỉnh sửa khi vòng đời Token đã cạn: Ô input ở chat bị mờ `disabled`, hiển thị "Đã hết Token" và icon `🚫`.
- Button `[ 💎 Nâng cấp gói ]` dùng để chuyển hướng user đến màn hình hiển thị bảng giá/tài khoản để gia hạn/nâng cấp.
- User vẫn CÓ THỂ sử dụng Drag & Drop block, và Double-click để Manual Edit bình thường.

---

### Screen 1.7: SEO Settings (Khi Hết Token)
Trạng thái mở rộng của Right Panel khi người dùng muốn sửa SEO Meta. Các trường vẫn cho phép Edit tay, riêng tính năng AI Auto SEO bị vô hiệu hoá.

```text
┌────────────────────────────────────────────────────────┐
│ ⚙️ GLOBAL SETTINGS (hoặc PAGE SETTINGS)                  │
│ ────────────────────────────────────────────────────── │
│ ▼ Brand Identity                                       │
│ ▼ Contact Info                                         │
│ ▼ Social Links                                         │
│ ▼ SEO Settings                                         │
│                                                        │
│   Meta Title: (60 chars max)                           │
│   ┌────────────────────────────────────────────────┐   │
│   │ Cửa hàng Hoa Tươi - Giao Trong Ngày            │   │
│   └────────────────────────────────────────────────┘   │
│                                                        │
│   Meta Description: (160 chars max)                    │
│   ┌────────────────────────────────────────────────┐   │
│   │ Mua hoa tươi giao ngay trong 2h!               │   │
│   │                                                │   │
│   └────────────────────────────────────────────────┘   │
│                                                        │
│   [ ✨ Tự động Tối ưu SEO ] (Nút mờ - Disabled)        │
│   (Hover: 🚫 Khóa tính năng: Đã hết AI Token)          │
│                                                        │
│   💎 Nâng cấp gói để dùng Meta SEO tự động             │
└────────────────────────────────────────────────────────┘
```
**Use Case:**
- Khi user mở Accordion SEO Settings. Do hết Token, nút `[ ✨ Tự động Tối ưu SEO ]` bị chuyển sang trạng thái `disabled`.
- Khi user rê chuột (hover) vào nút, hiển thị Tooltip giải thích lý do bị khóa.
- Hiển thị dòng Text link hoặc banner nhỏ mời gọi "Nâng cấp gói..." ngay bên dưới nút.
- User có thể tự gõ Meta Title, Meta Description bằng phím (Manual Edit) và nhấn ô khác để lưu (Auto-save) một cách bình thường.

---

### Screen 1.8: Image Editor (Khi Hết Token)
Trạng thái hiển thị tính năng chỉnh sửa hình ảnh bên trong vùng Iframe (Live Preview) khi người dùng đã sử dụng hết Token sinh ảnh AI. Nút Sinh ảnh bị vô hiệu hóa nhưng nút Upload vẫn hoạt động.

```text
┌────────────────────────────────────────────────────────────┐
│                    Our Products                            │
│                                                            │
│ ┌──────────────────────────┐  ┌──────────────────────────┐ │
│ │ ┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐ │  │ ┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐ │ │
│ │  ┌───────────────────┐   │  │                        │ │ │
│ │  │ ↑  Change photo   │   │  │          [ 🖼️ ]        │ │ │
│ │  │ ✨ AI-gen photo 🚫│   │  │                        │ │ │
│ │  └───────────────────┘   │  │ └─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘ │ │
│ │ │          [ 🖼️ ]      │ │  │                          │ │
│ │ │                      │ │  │ Product 2                │ │
│ │ └─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘ │  │ $99.00                   │ │
│ │                          │  └──────────────────────────┘ │
│ │ Product 1                │                               │
│ │ $99.00                   │                               │
│ └──────────────────────────┘                               │
└────────────────────────────────────────────────────────────┘
```
**Use Case:**
- Khi user click vào phần chứa hình ảnh đang thiết kế trên Iframe (VD: Hero banner, Product image).
- Hệ thống hiển thị toolbar trôi nổi nhỏ kế bên khung hình ảnh, với hai thao tác: `Change photo` và `AI-generated photo`.
- Nút `[✨ AI-gen photo]` (hoặc Sinh ảnh AI) bị mờ màu `disabled` hiển thị icon chặn `🚫`. 
- Khi người dùng rê chuột (hover) vào nút Sinh ảnh AI: Tooltip hiện "Đã hết lượt sinh ảnh AI. Vui lòng nâng cấp."
- Người dùng vẫn nhấn nút `[↑ Change photo]` để thay ảnh theo phương pháp thủ công và tải lên tập tin từ máy tính cá nhân.

---

### Screen 1.9: Trạng thái AI Đang Xử Lý & Edge Cases
Trạng thái hiển thị khi AI đang thực thi lệnh trên Iframe hoặc khi nhận được lệnh nằm ngoài phạm vi hỗ trợ.

```text
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ [≡ Menu]  Home ▼ │ 🎨 Templates │ ↩ Undo  ↪ Redo │ 💻 Desktop ▼ │ 👁️ │ Draft │ 🚀 Publish│
├──────────────────┴──────────────┴────────────────┴──────────────┴────┴───────┴──────────┤
│ ┌───────────────────────┐ ┌──────────────────────────────────────┐ ┌───────────────────┐ │
│ │ 🤖 AI CHAT            │ │ 🌍 LIVE PREVIEW (Iframe Sandbox)     │ │ ⚙️ GLOBAL SETTINGS│ │
│ │ ───────────────────── │ │ ┌──────────────────────────────────┐ │ │ ───────────────── │ │
│ │ [User] Đổi nền hồng   │ │ │ [ 🔒 Overlay Mờ (Canvas Lock) ]  │ │ │ ▼ Brand Identity  │ │
│ │                       │ │ ├──────────────────────────────────┤ │ │                   │ │
│ │ [AI] Đã hoàn tất!     │ │ │                                  │ │ │                   │ │
│ │  Cùng một số...       │ │ │                                  │ │ │                   │ │
│ │                       │ │ │          [ ⏳ (Wait Cursor) ]    │ │ │                   │ │
│ │ [ 🔄 Thử phương án  ] │ │ │                                  │ │ │ ▼ Contact Info    │ │
│ │                       │ │ │                                  │ │ │                   │ │
│ │ ───────────────────── │ │ │                                  │ │ │                   │ │
│ │ [User] Thời tiết nay? │ │ │                                  │ │ │ ▼ Social Links    │ │
│ │                       │ │ │                                  │ │ │                   │ │
│ │ ⚠️ [SYSTEM]           │ │ │                                  │ │ │                   │ │
│ │ Xin lỗi, tôi chỉ hỗ   │ │ │                                  │ │ │ ▼ SEO Settings    │ │
│ │ trợ thiết kế web...   │ │ └──────────────────────────────────┘ │ │                   │ │
│ │                       │ │                                      │ │                   │ │
│ │ [ ■ Dừng tạo AI ]     │ │                                      │ │                   │ │
│ │ ───────────────────── │ │                                      │ │                   │ │
│ │ ⌨️ [ Nhập lệnh... ] ▶│ │ └──────────────────────────────────┘ │ │                   │ │
│ └───────────────────────┘ └──────────────────────────────────────┘ └───────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```
**Use Case:**
- Khi AI đang xử lý (Streaming), xuất hiện nút `[ ■ Dừng tạo AI ]`. Màn hình Iframe xuất hiện một lớp kính mờ (overlay lock) và chuột chuyển sang trạng thái Wait để khóa các tương tác kéo thả / sửa tay nhằm tránh conflict data.
- Các tin nhắn thực thi giao diện thành công sẽ kèm theo button `[ 🔄 Thử phương án khác ]` ngay bên dưới để AI regenerate một thiết kế/nội dung mới đối với prompt đó.
- Nếu gửi câu hỏi Out-of-scope (Thời tiết, Python, cài app...), hiện System Warning ⚠️.

---

## 2. Các Modal (Cửa sổ nổi bật)

### Modal 2.1: Cảnh báo Tạm ẩn (Maintenance Mode / Unpublish)
Xảy ra khi User nhấn vào một Action Dropdown bên cạnh nút `Publish` và chọn "Unpublish".
```text
┌─────────────────────────────────────────────────────┐
│ ⚠️ TẠM ẨN WEBSITE                                   │
│                                                     │
│ Bạn đang chuẩn bị đưa trang web về chế độ Bảo trì!  │
│ - Khách hàng sẽ không thể truy cập trang web này.   │
│ - SEO Bot sẽ nhận được mã lỗi 503 HTTP.             │
│                                                     │
│ [ Có, Ẩn ngay ]                    [ Huỷ bỏ ]       │
└─────────────────────────────────────────────────────┘
```

### Modal 2.2: Pre-publish Checklist
Xảy ra khi User nhấn vào nút `🚀 Publish`.
```text
┌─────────────────────────────────────────────────────┐
│ 🚀 XUẤT BẢN WEBSITE (PUBLISH)                       │
│                                                     │
│ Kiểm tra hoàn tất trước khi đưa website ra công chúng:   │
│ ✅ Đã có Trang chủ (Home Page)                      │
│ ✅ Nội dung giỏ hàng hợp lệ (Payment config done)   │
│ ⚠️ Cảnh báo SEO: Trang "About Us" chưa nhập Meta Desc!   │
│                                                     │
│ [ Quay lại biên tập ]      [ 👉 Vẫn Publish Ngay ]       │
└─────────────────────────────────────────────────────┘
```

---

## 3. Màn hình Mobile Layout (Thiết kế Responsiveness của Editor)

**Lưu ý quan trọng cho Designer:** Ở giao diện Mobile (< 768px), do màn hình bé, cấu trúc 3 panel không thể tồn tại dàn ngang mà phải xếp chồng lên nhau dưới dạng "Bottom Sheet" (tấm trượt phía dưới).

> **Interactive Demo:** [F05-mobile-editor-ui-demo.html](./F05-mobile-editor-ui-demo.html) — 11 screens tương tác đầy đủ, hỗ trợ Dark/Light theme, chạy trực tiếp trên trình duyệt.

### Screen 3.1: Live Preview & Swipe Handle

```text
┌───────────────────────┐
│ ☰  [Pages ▼]  [🚀 Pub]│
├───────────────────────┤
│ ┌───────────────────┐ │
│ │ (LIVE PREVIEW)    │ │
│ │  Cửa Hàng Quần Áo │ │
│ │                   │ │
│ │  [ Mua ngay ]     │ │  ← Vùng hiển thị web chiếm full màn hình.
│ │                   │ │    Khi Touch vào một text, hiện Inline Edit
│ │                   │ │    Popup ngay trên màn hình.
│ │                   │ │
│ │                   │ │
│ │                   │ │
│ └───────────────────┘ │
├───────────────────────┤
│ 🪄 ▲ Mở Chat AI & Tool│  ← Bar kéo trượt (Swipe Handle).
└───────────────────────┘
```
**Use Case (Mobile Preview):**
- Preview chiếm trọn 90% không gian màn hình chính.
- User tương tác chủ yếu bằng cách chạm để sửa chữ, hoặc vuốt thanh `Mở Chat AI & Tool` từ dưới chân màn hình lên để sử dụng các bảng điều khiển.

---

### Screen 3.2: Bottom Sheet (Các Tab Công Cụ)

Kéo Swipe Handle lên sẽ kích hoạt Bottom Sheet. 
Tab bên trong Bottom sheet chia làm `Chat`, `Blocks`, và `Settings` để luân chuyển nội dung nhỏ gọn. Cơ chế thêm component (Tap-to-Add) được áp dụng riêng cho Viewport này.

```text
┌───────────────────────┐
│ ➖                   │
│ 🤖 CHAT | 🧩 BLOCKS | ⚙️ SET│ 
│ ────────────────────  │
│ 🔍 [ Tìm block... ]   │
│                       │
│ ▼ Hero Section        │
│  [ Banner Lớn ]  [+]  │ ← Nút Tap-to-add
│  [ Báo chí    ]  [+]  │ 
│                       │
│ ▼ Features            │
│  [ 3 Cột Grid ]  [+]  │
│                       │
└───────────────────────┘
```
**Use Case (Mobile Tap-to-Add):**
- Do không thể kéo thả trên Mobile vì màn hình nhỏ và tránh xung đột thao tác vuốt cuộn, chức năng Drag & Drop bị loại bỏ (FR-30, US-F05-14).
- Thay vào đó, mục Component Library (tab `🧩 BLOCKS`) hiển thị danh sách khối đi kèm nút `[+]`. 
- Khi ấn `[+]`, hệ thống tự động chèn block đó vào vị trí liền kề dưới block đang được người dùng nhấn chọn trên Live Preview (hoặc chèn xuống cuối trang nếu không có block nào đang active). Sau đó, Iframe sẽ tự động cuộn (scroll-to-view) đến vị trí khối vừa xuất hiện.

---

### Screen 3.3: CMS Menu Drawer (Điều hướng Dashboard)

Khi nhấn nút `☰` ở Header, Drawer trượt từ trái sang chứa toàn bộ menu điều hướng CMS.

```text
┌───────────────────────┐
│ ⚡ Prime AI        [✕]│
├───────────────────────┤
│ 📊 Dashboard          │
│ ───────────────────── │
│ CỬA HÀNG CỦA TÔI     │
│ 🎨 Editor         ◀── │ ← Trang hiện tại (highlight)
│ 📝 Blog               │
│ ───────────────────── │
│ 🛍️ Sản phẩm           │
│ 📦 Đơn hàng       [5] │ ← Badge đếm đơn mới
│ ───────────────────── │
│ ⚙️ Cấu hình Store     │
│ ❓ Trung tâm hỗ trợ   │
│                       │
├───────────────────────┤
│ [VN] [EN]             │ ← Chuyển ngôn ngữ
│ 🚪 Đăng xuất          │
└───────────────────────┘
```
**Use Case:**
- Drawer overlay mờ phần preview phía sau. Click overlay hoặc nút `[✕]` để đóng.
- Trang hiện tại (Editor) được highlight với viền xanh bên trái.
- Badge số trên mục "Đơn hàng" cho biết số đơn chưa xử lý.
- Nút chuyển ngôn ngữ (VN/EN) đặt ở footer Drawer.

---

### Screen 3.4: Page Manager Dropdown (Quản lý trang)

Khi nhấn vào tên trang hiện tại trên Header (`🏠 Trang chủ ▼`), Dropdown danh sách trang mở ra ngay dưới Header.

```text
┌───────────────────────┐
│ ☰  [🏠 Trang chủ ▼]  🚀│
├───────────────────────┤
│ ┌─────────────────────┐│
│ │ 📄 Quản lý trang    ││
│ │                     ││
│ │ 🏠 Trang chủ   Live ││
│ │   [👁️] [✏️] [↑] [↓] ││
│ │ 🛍️ Sản phẩm   Live ││
│ │   [👁️] [✏️] [↑] [↓] ││
│ │ 📄 Giới thiệu Draft ││
│ │   [👁️] [✏️] [↑] [↓] ││
│ │ 📞 Liên hệ    Live ││
│ │   [👁️] [✏️] [↑] [↓] ││
│ │ ─────────────────── ││
│ │ 🚫 Trang 404 System ││
│ │   [✏️]               ││
│ │ ─────────────────── ││
│ │ [➕ Thêm trang mới]  ││
│ │                     ││
│ │ ┌─── Form thêm ───┐││
│ │ │Tên trang:        │││
│ │ │[_______________] │││
│ │ │Slug: /ten-trang  │││
│ │ │ [Huỷ] [Tạo trang]│││
│ │ └──────────────────┘││
│ └─────────────────────┘│
└───────────────────────┘
```
**Use Case:**
- Mỗi page hiển thị: icon, tên, tag trạng thái (Live/Draft/Ẩn), và 4 action buttons.
- `[👁️]` Toggle ẩn/hiện trang — khi ẩn, tag đổi thành "Ẩn" màu xám.
- `[↑][↓]` Sắp xếp lại thứ tự trang.
- `[✏️]` Chuyển sang Editor của trang đó.
- Trang 404 là System page — chỉ có nút `[✏️]`, không xóa/ẩn được.
- "Thêm trang mới" mở form inline ngay trong dropdown: nhập tên → auto-gen slug → tạo.
- Xóa trang hiện Confirm dialog inline → sau khi xóa hiện Undo Toast 5 giây.

---

### Screen 3.5: AI Processing / Canvas Lock

Trạng thái khi AI đang xử lý lệnh. Preview bị khóa bằng overlay mờ, nút Dừng nổi bật.

```text
┌───────────────────────┐
│ ☰  [🏠 Trang chủ]     │
│         Đang xử lý... │ ← Pulse animation
├───────────────────────┤
│ ┌───────────────────┐ │
│ │ (LIVE PREVIEW)    │ │
│ │   ░░░░░░░░░░░░░   │ │ ← Blur + Overlay mờ
│ │   ░░░░░░░░░░░░░   │ │
│ │                   │ │
│ │      [ ⏳ ]       │ │ ← Spinner xoay
│ │ AI đang chỉnh sửa │ │
│ │ giao diện...      │ │
│ │ "Đổi nền hero     │ │
│ │  sang hồng"       │ │
│ │                   │ │
│ └───────────────────┘ │
├───────────────────────┤
│ ➖                    │
│  [ ■ Dừng tạo AI ]   │ ← Nút đỏ nổi bật
└───────────────────────┘
```
**Use Case:**
- Preview bị blur nhẹ và phủ overlay bán trong suốt — user không thể tương tác kéo thả / sửa text trong lúc AI stream.
- Header hiển thị text "Đang xử lý..." với hiệu ứng pulse.
- Nút `[ ■ Dừng tạo AI ]` ở Bottom Bar cho phép dừng stream ngay lập tức.
- Sau khi AI xong hoặc bị dừng → overlay biến mất, preview trở lại trạng thái tương tác bình thường.
- Ref: FR-33, FR-34, US-F05-16/AC-1, AC-2.

---

### Screen 3.6: Block Selected + Inline Edit + Block Settings

Khi user chạm (tap) vào một block trên Preview, block được highlight và Bottom Sheet tự động mở tab Settings với thông tin block đó.

```text
┌───────────────────────┐
│ ←  [🏠 Trang chủ] ✓ 🚀│
├───────────────────────┤
│ ┌───────────────────┐ │
│ │ FloraShop     Nav │ │
│ ├───────────────────┤ │
│ │ [B] [I] [U] │H1│≡│ │ ← Inline Toolbar nổi
│ │╔═════════════════╗│ │
│ ││ Hoa Tươi Mỗi   ││ │ ← Block đang được chọn
│ ││ Ngày            ││ │   (viền xanh highlight)
│ ││ Giao hàng nhanh ││ │
│ │╚═════════════════╝│ │   [✨ AI] badge góc phải
│ │ Sản phẩm nổi bật  │ │
│ └───────────────────┘ │
├───────────────────────┤
│ ➖                    │
│ [HERO] Hero Section 🗑️│ ← Block type + tên + xóa
│ [↑ Di chuyển lên]     │
│ [↓ Di chuyển xuống]   │ ← Thay thế Drag & Drop
│ ───────────────────── │
│ ▶ 🎨 Background       │
│   Kiểu: [Gradient ▼]  │
│   Màu 1: [#667eea 🟪] │
│   Màu 2: [#764ba2 🟣] │
│ ▶ 📐 Padding          │
│ ▶ ✨ Animation         │
└───────────────────────┘
```
**Use Case:**
- Tap vào block → viền xanh highlight + badge `✨ AI` ở góc phải trên block.
- Double-tap vào text → Inline Toolbar nổi phía trên với B/I/U/Heading/Align.
- Bottom Sheet tự mở tab Settings, hiển thị Block Settings thay cho Global Settings.
- `[↑ Lên]` / `[↓ Xuống]` thay thế Drag & Drop trên mobile — nhấn để đổi thứ tự block.
- Nút `🗑️` xóa block (có confirm trước khi xóa).
- Tap ra ngoài block → đóng Sheet, bỏ highlight, quay về Global Settings.

---

### Screen 3.7: Image Edit — Upload & AI Disabled

Khi chạm vào hình ảnh trên Preview, hiện toolbar trôi nổi với 2 nút: Upload (hoạt động) và AI gen (bị khóa khi hết token).

```text
┌───────────────────────┐
│ ←  [🏠 Trang chủ]   🚀│
├───────────────────────┤
│ FloraShop         Nav │
│ ┌─────────┬─────────┐ │
│ │╔═══════╗│         │ │
│ ││  🌹   ││   🌻    │ │
│ ││ [📤 Đổi ảnh    ] ││ │ ← Upload hoạt động
│ ││ [✨ AI ảnh  🚫 ] ││ │ ← AI bị disable
│ │╚═══════╝│         │ │
│ │ Hoa Hồng│ Hướng   │ │
│ │ 299.000₫│ Dương   │ │
│ │         │ 199.000₫│ │
│ └─────────┴─────────┘ │
├───────────────────────┤
│ 🪄 ▲ Mở Chat AI & Tool│
└───────────────────────┘
```
**Use Case:**
- Tap vào ảnh sản phẩm → ảnh được highlight, toolbar trôi nổi ở phía dưới ảnh.
- `[📤 Đổi ảnh]` mở file picker để upload ảnh thủ công — hoạt động bình thường.
- `[✨ AI ảnh 🚫]` bị mờ (disabled) khi hết AI Token. Long-press hiện tooltip: "Đã hết lượt dùng AI."
- Ref: FR-32, US-F05-15/AC-5.

---

### Screen 3.8: Out-of-scope AI + Regenerate

Khi AI trả lời thành công sẽ có nút Regenerate. Khi nhận lệnh ngoài phạm vi sẽ hiện System Warning.

```text
┌───────────────────────┐
│ ←  [🏠 Trang chủ]   🚀│
├───────────────────────┤
│ (LIVE PREVIEW — nền   │
│  hero đã đổi sang hồng)│
├───────────────────────┤
│ ➖                    │
│ 🤖 CHAT | 🧩 | ⚙️      │
│ ───────────────────── │
│ [AI] Xin chào!        │
│                       │
│       [User] Đổi nền  │
│              hero hồng│
│                       │
│ [AI] Đã hoàn tất! 🌸  │
│  [🔄 Thử phương án    │
│       khác]           │ ← Regenerate button
│                       │
│       [User] Thời tiết│
│              hôm nay? │
│                       │
│ ⚠️ Mình chỉ hỗ trợ    │
│ thiết kế web. Thử:    │
│ "Đổi font","Thêm      │
│ section"...            │ ← System warning
│ ───────────────────── │
│ [  Nhập lệnh...    ▶] │
└───────────────────────┘
```
**Use Case:**
- Tin nhắn AI thành công kèm `[🔄 Thử phương án khác]` để regenerate thiết kế/nội dung khác cho cùng prompt.
- Câu hỏi ngoài phạm vi (thời tiết, cài app...) → System Warning ⚠️ kèm gợi ý lệnh hợp lệ.
- Ref: FR-35, FR-36, US-F05-16/AC-3, AC-4.

---

### Screen 3.9: Pre-Publish Checklist

Khi nhấn nút `🚀 Publish`, Sheet lớn trượt lên hiển thị danh sách kiểm tra trước khi xuất bản.

```text
┌───────────────────────┐
│ ←  [🏠 Trang chủ]Draft│
├───────────────────────┤
│ (Preview mờ blur)      │
│                       │
├───────────────────────┤
│ 🚀 Xuất bản Website [✕]│
│ ───────────────────── │
│ ✅ Trang chủ sẵn sàng  │
│    Homepage đã có nội  │
│    dung và đã lưu      │
│ ───────────────────── │
│ ✅ Cấu hình thanh toán │
│    Stripe đã kết nối   │
│ ───────────────────── │
│ ⚠️ SEO chưa đầy đủ     │
│    "Giới thiệu" thiếu │
│    Meta Description    │
│ ───────────────────── │
│ ✅ Responsive OK        │
│ ───────────────────── │
│ ✅ Navigation hoàn chỉnh│
│                       │
│ [← Quay lại] [👉 Pub] │
└───────────────────────┘
```
**Use Case:**
- Preview phía sau bị blur mờ.
- Checklist items hiển thị: ✅ (pass), ⚠️ (warning nhẹ), ❌ (blocker — chặn Publish).
- "Quay lại" → đóng sheet, quay về Editor.
- "Publish ngay" → deploy site lên subdomain, hiện Toast "🎉 Website đã live!".

---

### Screen 3.10: Unpublish / Delete Warning

Alert Dialog xác nhận khi user muốn Tạm ẩn website hoặc xóa block/trang.

```text
┌───────────────────────┐
│ (Preview mờ blur)      │
│                       │
│ ┌───────────────────┐ │
│ │       ⚠️          │ │
│ │ Tạm ẩn Website?   │ │
│ │                   │ │
│ │ Bạn đang chuẩn bị │ │
│ │ đưa web về Bảo trì│ │
│ │                   │ │
│ │ • Khách không thể  │ │
│ │   truy cập web    │ │
│ │ • SEO Bot nhận 503│ │
│ │ • Dữ liệu vẫn giữ│ │
│ │   nguyên          │ │
│ │                   │ │
│ │ [Huỷ bỏ]          │ │
│ │ [Có, Ẩn ngay]     │ │ ← Nút đỏ danger
│ └───────────────────┘ │
└───────────────────────┘
```
**Use Case:**
- Overlay tối phủ toàn màn hình, Alert Box ở giữa.
- Liệt kê hệ quả: khách không vào được, SEO bị ảnh hưởng.
- "Huỷ bỏ" → quay về Editor bình thường.
- "Có, Ẩn ngay" → site chuyển Maintenance mode (503), Toast xác nhận.

---

### Screen 3.11: Navigation / Menu Editor

Màn hình chuyên dụng quản lý các link trong thanh Navigation Header.

```text
┌───────────────────────┐
│ ←  Quản lý Menu  [Xong]│
├───────────────────────┤
│ ⠿ 🏠 Trang chủ [↑][↓][✏️]│
│ ⠿ 🛍️ Sản phẩm [↑][↓][✏️]│
│   ⠿ ↳ Áo dài  [↑][↓][✏️][✕]│
│   ⠿ ↳ Váy cưới[↑][↓][✏️][✕]│
│ ⠿ 📄 Giới thiệu[↑][↓][✏️]│
│ ⠿ 📞 Liên hệ  [↑][↓][✏️]│
│                       │
│ ┌─────────────────────┐│
│ │ ➕ Thêm link mới     ││
│ └─────────────────────┘│
│                       │
└───────────────────────┘
```
**Use Case:**
- Danh sách menu dạng tree — sub-items thụt lề với prefix `↳`.
- `⠿` icon grip cho phép kéo thả sắp xếp (trên mobile dùng nút `[↑][↓]` thay thế).
- `[✏️]` chỉnh sửa label, URL đích (Internal/External/Email/Phone).
- `[✕]` xóa link — chỉ hiển thị cho sub-items.
- "Thêm link mới" → mở form inline nhập Label + chọn Destination.
- Giới hạn: tối đa 1 cấp con (sub-menu), tối đa 15 menu items.

---

### Screen 3.12: SEO Disabled — Token Exhausted (Tab Settings)

Khi hết Token, tab Settings mở SEO Settings với nút AI bị disable.

```text
┌───────────────────────┐
│ ←  [🏠 Trang chủ]   🚀│
├───────────────────────┤
│ (LIVE PREVIEW)        │
├───────────────────────┤
│ ➖                    │
│ 🤖 | 🧩 | ⚙️ CÀI ĐẶT  │ ← Tab Settings active
│ ───────────────────── │
│ ▼ 🔍 SEO Settings     │
│   Meta Title (60):    │
│   [Cửa hàng Hoa Tươi]│
│                       │
│   Meta Desc (160):    │
│   [Mua hoa tươi giao │
│    ngay trong 2h!    ]│
│                       │
│   [✨ Tự động Tối ưu  │
│    SEO] (Mờ-Disabled) │
│                       │
│   🔒 Đã hết AI Token  │
│   — bạn vẫn có thể   │
│   chỉnh sửa thủ công  │
│                       │
│   [ 💎 Nâng cấp ]     │
│ ───────────────────── │
│ ▶ 🎨 Brand Identity   │
└───────────────────────┘
```
**Use Case:**
- Nút `[✨ Tự động Tối ưu SEO]` bị mờ, không bấm được.
- Text cảnh báo "🔒 Đã hết AI Token" hiện bên dưới.
- Nút `[ 💎 Nâng cấp ]` điều hướng đến trang Pricing/Subscription.
- User vẫn tự gõ Meta Title, Meta Description bằng tay bình thường.
- Ref: FR-32, US-F05-15/AC-4.

---

### Screen 3.13: Token Exhausted — Chat Tab

Khi hết Token, tab Chat hiển thị System Message và banner Upsell, input bị khóa.

```text
┌───────────────────────┐
│ ←  [🏠 Trang chủ]   🚀│
├───────────────────────┤
│ (LIVE PREVIEW)        │
├───────────────────────┤
│ ➖                    │
│ 🤖 CHAT | 🧩 | ⚙️      │ ← Tab Chat active
│ ───────────────────── │
│ [AI] Xin chào!        │
│                       │
│       [User] Đổi nền  │
│              hero hồng│
│                       │
│ [AI] Đã đổi nền! 🌸   │
│                       │
│      [User] Thêm      │
│         đánh giá KH   │
│                       │
│ ⚠️ Bạn đã hết lượt    │
│ dùng AI tháng này!    │
│ ┌─────────────────────┐│
│ │       💎            ││
│ │  Hết AI Token       ││
│ │ Bạn vẫn có thể thêm││
│ │ block và chỉnh sửa  ││
│ │ thủ công.            ││
│ │[💎 Nâng cấp gói ngay]││
│ └─────────────────────┘│
│ ───────────────────── │
│ 🚫 [Đã hết Token   ] ▶│ ← Input disabled
└───────────────────────┘
```
**Use Case:**
- Sau khi gửi request cuối, server trả 429/Token Exhausted → System Warning ⚠️.
- Banner Upsell nổi bật với icon `💎`, mô tả tình trạng, và CTA "Nâng cấp gói ngay".
- Input chat bị disable (mờ đi), placeholder "🚫 Đã hết Token", không nhập được.
- Nút Send cũng disable.
- User vẫn chuyển sang tab `🧩 Blocks` hoặc `⚙️ Cài đặt` để thao tác thủ công.
- Ref: FR-32, US-F05-15/AC-1, AC-2, AC-3.

---

### Screen 3.14: New Page Created — Empty State

Sau khi tạo trang mới thành công, Editor hiển thị Empty State với 2 CTA chính.

```text
┌───────────────────────┐
│ ←  [🎉 Khuyến mãi ▼]  │
│              Draft  🚀│
├───────────────────────┤
│                       │
│                       │
│         📄            │
│   Trang mới đã tạo!   │
│                       │
│ Trang "Khuyến mãi"    │
│ đang trống. Bắt đầu   │
│ thêm nội dung bằng AI │
│ hoặc kéo thả block.   │
│                       │
│ [🪄 Dùng AI tạo       │
│     nội dung  ]       │ ← CTA chính (gradient)
│ [🧩 Thêm Block]       │ ← CTA phụ (outline)
│                       │
│                       │
├───────────────────────┤
│     [🪄]              │ ← FAB vẫn hiển thị
│ 🪄 ▲ Mở Chat AI & Tool│
└───────────────────────┘
```
**Use Case:**
- Preview hiển thị Empty State cân giữa màn hình.
- `[🪄 Dùng AI tạo nội dung]` → mở Bottom Sheet tab Chat, user bắt đầu chat lệnh.
- `[🧩 Thêm Block]` → mở Bottom Sheet tab Blocks, user chọn block thủ công.
- FAB và Bottom Bar vẫn hiển thị bình thường.
- Status bar hiện "Draft" (trang chưa publish).

---

## 4. Design Tokens (Tham khảo từ Interactive Demo)

Bảng Design Tokens chung cho Mobile Editor, đảm bảo nhất quán giữa Dark/Light theme.

| Token | Dark Theme | Light Theme | Ghi chú |
|-------|-----------|-------------|---------|
| `--bg` | `#0B1120` | `#F8FAFC` | Nền chính |
| `--surface` | `#161E2E` | `#FFFFFF` | Nền panel/sheet |
| `--primary-blue` | `#3B82F6` | `#2563EB` | Màu chính (CTA, active) |
| `--primary-teal` | `#2DD4BF` | `#0D9488` | Màu phụ (gradient) |
| `--fg` | `#FFFFFF` | `#0F172A` | Text chính |
| `--muted` | `#9CA3AF` | `#64748B` | Text phụ, placeholder |
| `--border` | `#1F2937` | `#E2E8F0` | Viền, separator |
| `--success` | `#10B981` | `#059669` | Trạng thái thành công |
| `--error` | `#EF4444` | `#DC2626` | Trạng thái lỗi, danger |
| `--warning` | `#F59E0B` | `#D97706` | Cảnh báo |

### Kích thước chuẩn Mobile

| Element | Giá trị | Ghi chú |
|---------|---------|---------|
| Header height | `48px` | Cố định trên cùng |
| Bottom Bar height | `56px` | Cố định dưới cùng |
| FAB size | `50px` | Nút tròn AI, góc phải dưới |
| Touch target tối thiểu | `44px` | Theo Apple HIG |
| Bottom Sheet border-radius | `16px` | Góc bo tròn trên cùng |
| Font chính | `Inter` | Weight: 400/500/600/700/800 |
