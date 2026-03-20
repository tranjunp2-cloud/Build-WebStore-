# User Stories: AI Editor (F05)

> **Feature:** F05 — AI Editor (Split Screen)
> **Wave:** 3 | **Priority:** P0 🌟 | **Ref PRD:** [F05-ai-editor.md](../prd/F05-ai-editor.md)
> *Lưu ý: UX/UI Mobile Web Responsive/Adaptive được tách tại [F05-mobile-responsive-ai-editor-stories.md](./F05-mobile-responsive-ai-editor-stories.md).*

---

## US-F05-01: AI Editor — Split Screen Chat + Preview ⭐

**Wave 3** | **P0 🌟** | **XL** | **Status:** Ready

### Story

```
As a   site owner sau khi AI generate
I want chỉnh sửa website qua chat hoặc click trực tiếp
So that tôi tinh chỉnh nội dung mà không cần biết code
```

### Acceptance Criteria

#### AC-1: Happy Path — Layout 3 Panel

```gherkin
GIVEN user ở /editor/:siteId
WHEN  load trang
THEN  AI chat panel trái (380px, collapsible)
  AND live preview giữa (iframe, sandboxed)
  AND settings panel phải (320px, context-sensitive)
  AND toolbar: [Undo] [Redo] [Save] [Preview] [Publish]
  AND status bar: autosave ON, draft/published badge
```

#### AC-2: Happy Path — AI Chat Edit

```gherkin
GIVEN user nhập lệnh chat (VD: "Đổi màu chủ thành xanh mint")
WHEN  gửi message
THEN  AI stream response
  AND changes apply lên preview realtime
  AND AI giải thích: "Đã đổi primary color thành #B2DFDB"
  AND có nút "Hoàn tác" trong chat message
```

#### AC-3: Undo / Redo (Delegated)\r
> *Ghi chú: Chức năng Undo/Redo đã được tách thành [US-F11-01](../stories/F11-undo-redo-stories.md). Vui lòng xem chi tiết tại đó.*\r
#### AC-4: Inline Edit — Click Element

```gherkin
GIVEN user hover element trên preview
WHEN  hover trên element 200ms
THEN  hiện ✨ AI edit button tại element
WHEN  click ✨
THEN  mini popup xuất hiện, user type instruction ngắn
WHEN  accept
THEN  chỉ element đó thay đổi, phần còn lại không ảnh hưởng
```

#### AC-5: Auto-Save & Draft (Delegated)\r
> *Ghi chú: Chức năng Auto-save đã được tách thành [US-F12-01](../stories/F12-auto-save-draft-stories.md). Vui lòng xem chi tiết tại đó.*\r
### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] 3-panel layout support resize màn hình Desktop/Tablet ngang
- [ ] Undo/Redo hoạt động đúng với cả AI changes

---

## US-F05-02: Page Manager

**Wave 3** | **P0** | **M** | **Status:** Ready

### Story

```
As a   site owner
I want xem và quản lý tất cả pages của website
So that tôi biết page nào live, thêm/xóa page khi cần
```

### Acceptance Criteria

#### AC-1: Happy Path — Xem Danh Sách Pages

```gherkin
GIVEN user ở editor, click tab "Pages"
WHEN  tab load
THEN  list pages với: status (Published/Draft), block count, last edited
```

#### AC-2: Thêm Page Mới

```gherkin
GIVEN click "Thêm trang mới"
WHEN  điền tên (VD: "Khuyến mãi") và confirm
THEN  tạo page với slug = "khuyen-mai"
  AND redirect sang editor của page đó
```

#### AC-3: Xóa Page — Soft Delete
```gherkin
GIVEN click Delete trên 1 page
WHEN  confirm xóa
THEN  soft delete (deletedAt set)
  AND toast "Đã xóa. Hoàn tác?" hiện trong 5s
```

#### AC-4: Ẩn Trang (Toggle Page Visibility)
```gherkin
GIVEN user đang ở Page Manager
WHEN  click vào nút bật/tắt mắt (eye icon) hoặc chọn "Hide Page" cho một trang
THEN  trang đó bị đánh dấu `isVisible: false`
  AND link trang đó bị gỡ tự động khỏi Global Header/Footer navigation
  AND user thực tế (khách hàng) truy cập URL trực tiếp sẽ nhận lỗi 404 Not Found
  AND trang web cảnh báo "Đã ẩn trang này" tới Store owner.
```

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] Soft delete works — page deleted không hiển thị trên published site

---

## US-F05-03: Inline Click-to-Edit Element

**Wave 3** | **P0** | **L** | **Status:** Ready

### Story

```
As a   store owner
I want click trực tiếp lên bất kỳ element trong preview và yêu cầu AI thay đổi
So that tôi edit chính xác từng phần của trang mà không cần dùng chat
```

### Acceptance Criteria

#### AC-1: Happy Path — Hiện Edit Button khi Hover

```gherkin
GIVEN I hover over a text element in the preview pane
WHEN  my cursor rests on the element for 200ms
THEN  a blue "✨ Edit with AI" button appears overlaid on the element
  AND positioned at top-right, không che text
```

#### AC-2: Happy Path — Apply Inline Edit

```gherkin
GIVEN I click "Edit with AI" on the hero headline element
WHEN  the popup appears
THEN  an input popup shows current text pre-filled
  AND an instruction field: "How would you like to change this?"
  AND I type instruction và press Enter để apply
```

### Additional Criteria

- [ ] Inline edit popup closes on Escape key hoặc click outside
- [ ] Applied change reflected in preview within 300ms
- [ ] AI edits inline → chat panel shows same action in history (full transparency)

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] Hover button xuất hiện đúng trên mọi block type

---

## US-F05-04: Add New Section via AI

**Wave 3** | **P0** | **L** | **Status:** Ready

### Story

```
As a   store owner
I want thêm section nội dung mới vào trang qua AI chat
So that tôi mở rộng website mà không cần tự build block
```

### Acceptance Criteria

#### AC-1: Happy Path — Add Section qua Chat

```gherkin
GIVEN I type "Add a testimonials section with 3 customer reviews" in AI chat
WHEN  AI processes the request
THEN  a Testimonials section with 3 placeholder reviews is added
  AND I can drag it to reposition
```

### Additional Criteria

- [ ] AI-added sections match existing store's colour scheme và fonts
- [ ] Section added at bottom by default — drag handle to reposition
- [ ] Supported types: Testimonials, FAQ, Gallery, Features, Team, Newsletter, Banner, CTA
- [ ] Adding a section là 1 single undoable action

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] Tất cả supported section types được add đúng

---

## US-F05-05: Drag-and-Drop Block Reorder in Editor

**Wave 3** | **P0** | **M** | **Status:** Ready

### Story

```
As a   store owner editing my website
I want to easily rearrange sections by dragging and dropping them in the preview pane
So that I can quickly modify the page layout without typing instructions or using a complex menu
```

### Business Value

Visual editing (what you see is what you get) là kỳ vọng cơ bản của mọi website builder. Gõ lệnh chat để "move hero section below about" rất cồng kềnh so với việc kéo thả trực tiếp bằng chuột. Tính năng này bổ trợ hoàn hảo cho AI chat.

### Acceptance Criteria

#### AC-1: Happy Path — Drag Handle & Reorder

```gherkin
GIVEN user đang ở trang editor `/editor/:siteId`
WHEN  user hover lên bất kỳ block nào trong iframe preview (trừ Nav/Footer)
THEN  hiển thị drag handle (⠿) bên cạnh khu vực block
WHEN  user kéo thả block đến vị trí mới
THEN  vị trí block được cập nhật ngay lập tức trong iframe
  AND state (Zustand) được cập nhật
```

#### AC-2: Undo Integration

```gherkin
GIVEN user vừa kéo thả đổi vị trí 1 block
WHEN  user nhấn nút "Undo" (hoặc Ctrl+Z)
THEN  block quay trở lại vị trí cũ
  AND action kéo thả được coi là 1 bước trong history stack
```

#### AC-3: Auto-save Sau Khi Reorder

```gherkin
GIVEN user thay đổi vị trí block bằng drag-and-drop
WHEN  thao tác drop hoàn thành
THEN  auto-save trigger (sau debounce 3s)
  AND payload PATCH /api/sites/:id/pages/:pageId chứa mảng blocks với thứ tự mới
  AND status bar hiển thị "Saved"
```

#### AC-4: Tương tác với AI Chat

```gherkin
GIVEN user vừa kéo thả block thủ công
WHEN  user chat "Move it back" hoặc "Undo that"
THEN  AI hiểu context là user vừa reorder
  AND AI có thể gọi action undo thao tác drag-drop vừa rồi
```

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] Drag-and-drop hoạt động mượt trong sandboxed iframe
- [ ] Action drag-drop push đúng vào history stack của Undo/Redo
- [ ] Auto-save kích hoạt sau khi drop
- [ ] Drag handle không cản trở thao tác click-to-edit (US-F05-03)

---

## US-F05-06: Manual Visual Editing (WYSIWYG Text & Image)

**Wave 3** | **P0** | **L** | **Status:** Ready

### Story

```
As a   store owner
I want click đúp để sửa text trực tiếp và tải lên thay thế hình ảnh
So that tôi sửa những chi tiết nhỏ, lỗi chính tả mà không cần thông qua bước viết AI prompt
```

### Acceptance Criteria

#### AC-1: Happy Path — In-place Rich Text Editing & Floating Toolbar
```gherkin
GIVEN user đang xem preview
WHEN  double-click vào một đoạn text (Heading, Paragraph, Button text)
THEN  text biến thành input contentEditable (WYSIWYG)
  AND một Floating Toolbar nhỏ (giống style Notion/Word) nổi lên trên đoạn text đó
  AND Toolbar chứa các tuỳ chọn format: In đậm (B), Nghiêng (I), Gạch dưới (U), Canh lề (Trái, Giữa, Phải, Đều), Loại nội dung (Heading 1 -> 6, Body/Paragraph)
WHEN  user bôi đen để format hoặc chọn kiểu Heading
THEN  định dạng text thay đổi trực tiếp trên preview (style updates realtime)
WHEN  user click ra ngoài (blur) hoặc nhấn Enter/Cmd+Enter
THEN  thay đổi được áp dụng ngay lập tức
  AND status bar báo "Saved" sau 3s (Auto-save)
```

#### AC-2: Happy Path — Image Replacement
```gherkin
GIVEN user đang xem preview
WHEN  click vào một hình ảnh trên giao diện
THEN  hiện 1 toolbar nhỏ ở cạnh ảnh có nút: [Thay ảnh] [✨ Sinh ảnh AI]
WHEN  chọn [Thay ảnh] và tải lên 1 file cục bộ
THEN  hệ thống kiểm tra dung lượng: Nếu file > 2MB, tự động nén (compress) và crop kích thước trước khi upload
  AND ảnh cũ được thay bằng ảnh mới đã tối ưu, đảm bảo không làm sập layout
```

### Definition of Done
- [ ] 9-Point Checklist pass
- [ ] Text edits không làm vỡ HTML markup của block.
- [ ] Uploads lưu trữ an toàn, thay đổi cập nhật vào stack Undo/Redo.
- [ ] Tự động downscale/compress các ảnh có dung lượng lớn (> 2MB).

---

## US-F05-07: Global Header & Footer Management

**Wave 3** | **P1** | **M** | **Status:** Ready

### Story

```
As a   store owner
I want chỉnh sửa Header (Logo, Menu) và Footer 1 lần
So that thay đổi tự động được áp dụng đồng bộ xuyên suốt mọi trang của website
```

### Acceptance Criteria

#### AC-1: Sửa Navigation Menu (Nested Submenu)
```gherkin
GIVEN user click vào vùng Header trên canvas
THEN  Header được focus, các block khác bị mờ nhẹ
  AND panel Settings bên phải hiển thị bộ chỉnh sửa "Navigation Links"
WHEN  user thao tác trên panel Navigation:
  - Bấm "Thêm Link mới"
  - Đổi tên hiển thị (Label)
  - Chọn đích đến (Internal Page, External URL, Email, Phone)
  - Hoặc **Kéo thả (drag-and-drop tree)** một link thụt lề làm con của 1 link khác (tạo Submenu Dropdown)
THEN  mọi trang thuộc siteId đó đều update Header với Submenu đã tổ chức.
  AND UI ngoài frontend sẽ tự sinh ra hiệu ứng Dropdown (khi hover/click) cho dạng Submenu.
```

#### AC-2: Tuỳ chỉnh Logo và tự động tạo Favicon
```gherkin
GIVEN user đang chỉnh sửa Header
WHEN  user thay đổi hình ảnh Logo
THEN  ảnh Logo mới tự động adaptive thu phóng (scale) theo hình dáng/tỉ lệ chuẩn của Header (ví dụ max-height 60px)
  AND hệ thống AI tự động xử lý (extract icon/chữ nổi mảng miếng) để sinh ra một file ảnh nhỏ (.ico hoặc .png trong thẻ <link rel="icon">) để setup làm Favicon cho website
```

### Definition of Done
- [ ] Header/Footer state tách biệt khỏi Page blocks context.
- [ ] Quá trình sinh Favicon diễn ra tự động ngầm không chặn luồng UX.

---

## US-F05-08: Side Panel - Kéo Thả Drag-and-Drop Component Library

**Wave 3** | **P0 🌟** | **XL** | **Status:** Ready

### Story

```
As a   store owner
I want xem danh sách các Component dựng sẵn và kéo thả chúng trực tiếp vào màn hình Preview
So that xây dựng bố cục trang trực quan, thân thiện giống các công cụ thiết kế.
```

### Acceptance Criteria

#### AC-1: Mở Component Library
```gherkin
GIVEN user ở Editor layout
WHEN  click tab "Blocks/Components" trên Sidebar (hoặc Toolbar)
THEN  hiển thị side panel chứa danh sách các block được phân loại:
   - Cơ bản: Hero, Banner, Rich Text, Divider
   - Cửa hàng: Product List, Categories
   - Nội dung: Caurousel, Image Gallery, Blog List, Testimonials
   - Form: Contact Form, Newsletter
```

#### AC-2: Kéo Thả Block vào Preview (Drag from outside to iframe)
```gherkin
GIVEN user mở Component Library
WHEN  kéo (drag) một block (VD: Product List) từ side panel vào vùng iframe preview
THEN  iframe hiển thị một đường gạch ngang (drop indicator) màu xanh tại vị trí có thể đặt block giữa các section
WHEN  nhả chuột (drop)
THEN  block Product List xuất hiện ngay tại vị trí đó với placeholder data
  AND layout tự động được tối ưu Responsive/Adaptive cho Desktop/Mobile
  AND tự động Save trạng thái
```

### Definition of Done
- [ ] Block kéo vào đảm bảo Responsive Design sẵn có cho cả Mobile, Tablet, Desktop.
- [ ] Data của block drop vào được map vào Zustand store của page hiện tại.
- [ ] Hỗ trợ đầy đủ bộ Component tiêu chuẩn thị trường.

---

## US-F05-09: Tùy chỉnh Trang 404 (404 Not Found Page)

**Wave 3** | **P1** | **M** | **Status:** Ready

### Story

```
As a   store owner
I want tùy chỉnh thiết kế của trang báo lỗi 404 (Not Found)
So that khách hàng truy cập sai đường dẫn vẫn thấy giao diện chuyên nghiệp và nút quay về Trang chủ
```

### Acceptance Criteria

#### AC-1: Chỉnh sửa trang 404 qua Editor
```gherkin
GIVEN user đang ở Page Manager
WHEN  chọn trang hệ thống "404 Not Found" (luôn tồn tại mặc định)
THEN  trang 404 mở lên trong giao diện Iframe Preview
  AND user có thể dùng AI CHAT, sửa nội dung Text trực tiếp, thêm nút (ví dụ: Back to Homepage)
  AND mọi thao tác drag/drop component đều hoạt động như thao tác trên page thường
```

#### AC-2: Tự động hiển thị khi lỗi
```gherkin
GIVEN khách hàng truy cập bằng một URL slug không tồn tại trên published site
WHEN  site load
THEN  hiển thị trang 404 tuỳ chỉnh mà owner vừa tạo
  AND trả về mã lỗi HTTP status `404 Not Found`
```

### Definition of Done
- [ ] Mặc định Generate sẵn 1 trang 404-page chuẩn khi tạo website.
- [ ] Trang 404 render trên Published site cần trả đúng HTTP status 404.

---

## US-F05-10: Publish & Unpublish Flow (Live & Maintenance Mode)

**Wave 3** | **P0** | **M** | **Status:** Ready

### Story

```
As a   store owner
I want to publish my store to a live subdomain or unpublish it to maintenance mode
So that khách hàng có thể truy cập khi tôi sẵn sàng, hoặc không thể truy cập lúc tôi đang đại trùng tu
```

### Acceptance Criteria

#### AC-1: Happy Path — Pre-publish Checklist & Publish

```gherkin
GIVEN user click "Publish" trong editor toolbar
WHEN  click
THEN  hiện pre-publish checklist: ✅ Có trang Home, ⚠️ SEO score (warning, không block)
  AND nút "Publish ngay" active
WHEN  click "Publish ngay"
THEN  site.isPublished = true
  AND subdomain live: [slug].primeweb.app trong < 30 giây
  AND editor badge chuyển từ "Draft" thành "Live" (green dot)
  AND toast "🎉 Website đã live!" + link mở tab mới (hoặc copy-to-clipboard)
```

#### AC-2: Happy Path — Re-Publish (Update Live Site)

```gherkin
GIVEN my store is already published
WHEN  I make changes and click "Publish" again
THEN  changes are live within 30 seconds
  AND sitemap is re-generated automatically
```

#### AC-3: Bật chế độ Tạm Ẩn (Unpublish)

```gherkin
GIVEN user đang ở màn hình Editor (Settings Panel hoặc Toolbar)
WHEN  chọn "Unpublish" (Bật chế độ tạm ẩn)
THEN  trạng thái website chuyển sang Maintenance Mode (site.isPublished = false)
  AND khi truy cập Domain public, hệ thống hiển thị màn hình "Trang web đang bảo trì"
  AND URL public trả về HTTP 503 (Service Unavailable) cho SEO Crawler
  AND editor shows "Draft" badge
```

#### AC-4: Quyền chủ cửa hàng khi Tạm Ẩn

```gherkin
GIVEN site đang ở Maintenance Mode
WHEN  Store Owner vào Editor
THEN  Owner vẫn truy cập /editor/:siteId và xem Preview bình thường
  AND có notification vàng ở header: "Website đang trong trạng thái Tạm Ẩn"
```

### Definition of Done
- [ ] Subdomain accessible within 30 seconds of publish.
- [ ] Status Unpublish có hiệu lực ngay lập tức (hiển thị trang bảo trì 503).
- [ ] 9-Point Checklist pass.

---

## US-F05-11: Interactive Widgets (Cart & Social Media Components)

**Wave 3** | **P0** | **M** | **Status:** Ready

### Story

```
As a   store owner
I want kéo thả nút Giỏ Hàng (Cart) và bộ nút Mạng Xã Hội (Social Media) vào website
So that khách hàng có thể liên hệ qua nhiều kênh (FB, Zalo, WhatsApp,...) và dễ dàng xem/thanh toán giỏ hàng
```

### Acceptance Criteria

#### AC-1: Component Nút Mạng Xã Hội (Social Media Links)
```gherkin
GIVEN user đang thiết kế giao diện (có thể là Footer, hoặc làm Floating button)
WHEN  kéo thả Component "Social Media" vào canvas
THEN  hiện ra giao diện cấu hình gồm các icon: Facebook Messenger, WhatsApp, Instagram, LinkedIn, Youtube
  AND user có thể điền link URL hoặc User ID cho từng nền tảng
  AND khách hàng khi click vào một trong các icon trên website đã publish, sẽ mở tab mới dẫn đúng tới kênh liên hệ
```

#### AC-2: Component Nút Giỏ Hàng & Checkout Flow
```gherkin
GIVEN user đang chỉnh sửa Header (hoặc trang bất kỳ)
WHEN  kéo thả hoặc thêm Component "Cart Button" (Giỏ hàng)
THEN  website hiển thị một biểu tượng giỏ hàng (kèm số lượng item nhỏ giọt đếm trên góc)
WHEN  khách hàng click vào biểu tượng giỏ hàng trên published site
THEN  mở ra giao diện xem chi tiết giỏ hàng (popover hoặc redirect qua URL /cart)
  AND trong giao diện giỏ hàng đó, khi nhấn "Mua hàng" (Checkout), điều hướng sang trang Thanh Toán của cửa hàng
```

### Definition of Done
- [ ] Tất cả các cổng mạng xã hội chỉ định (FB, WA, IG, LinkedIn, YT) hiển thị đúng icon chuẩn và link ra ngoài.
- [ ] Component Giỏ Hàng gọi đúng API liên quan tới Checkout flow (Epic Commerce/Storefront).

---

## US-F05-12: Global Business Info & Settings Panel

**Wave 3** | **P0** | **L** | **Status:** Ready

### Story

```
As a   store owner
I want một bảng điều khiển Thông tin Cơ bản (Settings Panel) gom chung Tên, Liên hệ, Địa chỉ, và SEO
So that tôi nhập liệu 1 lần duy nhất, các widget khác (như Footer, Contact Form, Social Media) tự động lấy dữ liệu mà không cần phải điền lại trên giao diện.
```

### Acceptance Criteria

#### AC-1: Mở Global Settings Panel (Trạng thái Rảnh)
```gherkin
GIVEN user đang ở trang Editor
WHEN  user click ra nền trắng (background) của Preview, HOẶC không có Block nào đang được focus
THEN  Panel bên phải (Width 320px) hiển thị giao diện "Global Site Settings"
  AND bao gồm các khối nội dung dạng Accordion thu nhỏ gọn gàng: "1. Brand Identity", "2. Contact Info", "3. Social Links", "4. SEO Settings".
```

#### AC-2: Cập nhật Liên hệ (Data Binding)
```gherkin
GIVEN user đang nhập số điện thoại "0912345678" vào ô Hotline ở Global Settings (Tab: Contact Info)
WHEN  bấm Save (hoặc Auto-save debounce)
THEN  thông số SDT được lưu vào Database cấp độ Cửa hàng (`sites` table)
  AND tất cả các Block đang gắn nhãn (data-bind) như [Footer Hotline] hoặc [Contact Form text] trên Iframe tự động cập nhật hiển thị "0912345678" ngay tức thì.
```

#### AC-3: Cấu hình SEO chung (SEO Settings)
```gherkin
GIVEN user mở tab "SEO Settings" trong Global Settings
WHEN  điền Text vào ô Trích yếu (Site Meta/Bio Description) và upload ảnh "Social Share Thumbnail"
THEN  dữ liệu này được inject (chèn) trực tiếp vào `<meta name="description">` và `<meta property="og:image">` của trang <HEAD> khi website được render ra ngoài.
```

### Definition of Done
- [ ] Logic "Context-sensitive": Right-Panel tự động switch qua lại giữa (Block Setting) và (Global Setting) tuỳ thuộc vào việc user có click dính element nào không.
- [ ] Dữ liệu nhập vào phải được binding 2 chiều (hoặc pass xuống qua Props/Zustand store) tới Iframe Preview.

---

## US-F05-13: Page-Level SEO & AI Optimization

**Wave 3** | **P1** | **M** | **Status:** Ready

### Story

```
As a   store owner
I want to customize SEO settings for each individual page and use AI to generate them
So that I can improve my website's search engine ranking without knowing SEO techniques
```

### Acceptance Criteria

#### AC-1: Manual Page SEO Settings
```gherkin
GIVEN user đang ở Settings panel của một trang cụ thể (Page-level settings)
WHEN  chọn mục "SEO Settings"
THEN  hiển thị các form fields: URL Slug, Meta Title, Meta Description
  AND user có thể nhập thủ công nội dung
  AND preview snippet hiển thị cách trang hiện trên Google search
```

#### AC-2: AI Auto-Generate SEO
```gherkin
GIVEN user đang ở Page-level SEO Settings
WHEN  click nút "✨ Tự động Tối ưu SEO"
THEN  AI sẽ phân tích toàn bộ text content hiện có trên trang
  AND tự động điền Meta Title và Meta Description tối ưu
  AND URL Slug tự động đồng bộ theo Title (nếu page chưa publish)
```

### Definition of Done
- [ ] 9-Point Checklist pass.
- [ ] Dữ liệu SEO lưu thành công vào Database field của riêng page đó (`pages.metaTitle`, `pages.metaDescription`).
