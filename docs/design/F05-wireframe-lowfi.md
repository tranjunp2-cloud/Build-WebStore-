# F05 AI Editor — Low-fidelity Wireframes & Use Cases

Tài liệu này phác thảo cấu trúc giao diện (Low-Fi Wireframe) cho màn hình F05 AI Editor dựa trên các tài liệu đặc tả (PRD).

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

Kéo lên sẽ hiện Bottom Sheet:
┌───────────────────────┐
│ ➖                   │
│ 🤖 CHAT | ⚙️ SETTINGS │ (Cấu trúc Tab dạng switch)
│ ────────────────────  │
│ [AI] Bạn muốn đổi gì? │
│                       │
│ [Nhập lệnh...    ▶]   │
└───────────────────────┘
```
**Use Case (Mobile):**
- Preview chiếm trọn 90% không gian màn hình chính.
- User tương tác chủ yếu bằng cách chạm để sửa chữ, hoặc vuốt thanh `Mở Chat AI & Tool` từ dưới chân màn hình lên lên để ra lệnh bằng giọng nói / chat AI.
- Tab bên trong Bottom sheet chia làm `Chat`, `Cấu trúc Blocks`, và `Cài đặt Setting` để luân chuyển nội dung nhỏ gọn.
