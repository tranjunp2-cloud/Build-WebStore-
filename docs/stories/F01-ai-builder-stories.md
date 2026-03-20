# User Stories: AI Web Builder (F01)

> **Feature:** F01 — AI Web Builder
> **Wave:** 3 | **Priority:** P0 🌟 | **Ref PRD:** [F01-ai-builder.md](../prd/F01-ai-builder.md)

---

## US-F01-01: AI Builder — Generate Site from Structured Input ⭐

**Wave 3** | **P0 🌟** | **XL** | **Status:** Ready

### Story

```
As a   SME owner mới đăng ký
I want điền thông tin vào ô nhập liệu (Tên doanh nghiệp, Mô tả ngắn, Mặt hàng/Dịch vụ)
So that AI tạo đầy đủ website phù hợp và chính xác
```

### Acceptance Criteria

#### AC-1: Happy Path — Generate Site từ Form Nhập Liệu

```gherkin
GIVEN user ở /builder/new có form nhập liệu
WHEN  user điền đủ thông tin: Tên doanh nghiệp, Mô tả ngắn, Mặt hàng/Dịch vụ
  AND click "Tạo Website"
THEN  hệ thống kiểm tra thông tin đầu vào
  AND AI bắt đầu sinh Media (Banner, Image Carousel) và Content (About Us, Vision, Mission)
  AND live preview ở khung bên phải cập nhật realtime
  AND progress hiển thị: "Đang tạo Banner... About Us... Vision..."
  AND toàn bộ site hoàn thành trong < 60 giây
```

#### AC-2: Input Validation — Thiếu Tên Hoặc Dịch Vụ

```gherkin
GIVEN user submit form tạo website
WHEN  các trường Tên doanh nghiệp hoặc Bổ sung thông tin bị trống
THEN  hiển thị báo lỗi đỏ tại ô nhập liệu
  AND KHÔNG bắt đầu quá trình generate cho tới khi đủ điều kiện
```

#### AC-3: Live Preview & View Modes (View only vs Kéo Thả)

```gherkin
GIVEN website đã được generate xong
WHEN  người dùng xem bản live preview kế bên
THEN  hệ thống cung cấp 2 chế độ xem (View Modes):
        - Full-screen view: Dạng lớn toàn màn hình, hỗ trợ toggle giữa Desktop/Mobile Layout (Chế độ View-only, không thể chỉnh sửa)
        - Normal view: Hiển thị preview kèm drag handle, cho phép kéo thả (drag and drop) chỉnh sửa vị trí component
  AND có 2 options next-step: "Tinh chỉnh" (→ /editor) và "Publish ngay"
  AND auto-save draft vào DB
```

#### AC-4: Session Recovery — Refresh/Back

```gherkin
GIVEN user refresh hoặc back trong lúc generate
WHEN  quay lại /builder/new
THEN  hiển thị lại bản draft, không bị mất tiến trình (progress)
```

#### AC-5: Error Handling — AI Service Fail

```gherkin
GIVEN Dịch vụ AI gặp lỗi (timeout, API fail)
WHEN  quá trình generate thất bại
THEN  toast đỏ "Không thể tạo website. Thử lại"
  AND nút "Thử lại" yêu cầu KHÔNG cần nhập lại prompt
```

#### AC-6: Site Page Structure — 4 Trang & Content Bắt Buộc

```gherkin
GIVEN AI generate website dựa trên form đã nhập
WHEN  quá trình generate hoàn thành
THEN  website phải có đầy đủ 4 trang với content được AI tự tạo:
        - Homepage: Banner hình ảnh, Image Carousel nổi bật, tổng quan business
        - About Us: Nội dung About Us, Vision (tầm nhìn), Mission (sứ mệnh)
        - Products & Services: Liệt kê tối ưu các mặt hàng/dịch vụ kinh doanh
        - Contact Us: Địa chỉ, số điện thoại, email, contact form
  AND   mỗi trang được cấu trúc tự động dựa trên thông tin nhập vào
  AND   navigation menu hiển thị link đến cả 4 trang
```

#### AC-7: Layout by Business Type

```gherkin
GIVEN AI nhận diện được category business của user (F&B, Retail, Services, v.v.)
WHEN  generation chạy
THEN  layout được chọn tự động phù hợp với loại business:
        - F&B / Nhà hàng: hero ảnh thức ăn nổi bật, menu grid
        - Thời trang / Retail: product grid, image-heavy layout
        - Dịch vụ / Professional: text-focused, trust signals, testimonials
        - Beauty / Spa: elegant layout, gallery section
  AND  màu sắc, font chữ, thứ tự block (block order) phản ánh đặc thù ngành
```

### Market Notes

- AI phải hiểu được Tiếng Bahasa Melayu (BM), Manglish, và các prompt trộn lẫn đa ngôn ngữ
- Nhận diện danh mục (Category detection) phải map đúng với các loại hình kinh doanh tại Malaysia (Modest Wear, Halal F&B, v.v.)
- Bảng màu (Color palette) phải phù hợp với bối cảnh văn hóa (ref: `malaysia-market-context.md §6`)

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] AI stream response trong < 2 giây với prompt tiếng Việt và BM
- [ ] Live preview cập nhật realtime không bị lag
- [ ] Draft auto-saved sau generate xong
- [ ] Retry không yêu cầu nhập lại prompt
- [ ] Site generate ra có đủ 4 trang: Homepage, About Us, Products & Services, Contact Us
- [ ] Layout phù hợp với loại business được detect

---

## US-F01-02: Store Setup — Basic Info Form (AI Context)

**Wave 1** | **P0** | **S** | **Status:** Ready

### Story

```
As a   owner vừa đăng ký
I want nhập thông tin cơ bản vào ô nhập liệu nhanh gọn
So that AI có đủ context (Tên, Mô tả, Mặt hàng) để generate nội dung chính xác
```

### Acceptance Criteria

#### AC-1: Happy Path — Chọn AI Builder Flow & Xem Form

```gherkin
GIVEN user ở /onboarding chọn "Tạo bằng AI"
WHEN  redirect sang /builder/new
THEN  hệ thống hiển thị form nhập liệu, bao gồm các ô: 
        - [Tên doanh nghiệp]
        - [Mô tả ngắn về doanh nghiệp]
        - [Mặt hàng/Dịch vụ doanh nghiệp kinh doanh]
  AND thông tin này tự động lưu vào site.aiContext trong DB
```

#### AC-2: Alternative — Chọn Template Flow

```gherkin
GIVEN user chọn "Chọn Template"
WHEN  redirect sang /templates
THEN  hiện template gallery
  AND chọn template → tạo site → /editor/:id
```

#### AC-3: Input Validation — Thông Tin Không Hợp Lệ

```gherkin
GIVEN AI nhận được input trống hoặc quá ngắn (< 3 ký tự)
WHEN  user submit
THEN  AI nhắc user cung cấp thêm thông tin
  AND KHÔNG proceed generation
```

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] Site record tạo đúng trong Payload CMS với aiContext đầy đủ

---

## US-F01-03: AI Image Generation for Store

**Wave 3** | **P0** | **L** | **Status:** Ready

### Story

```
As a   store owner with no product photography
I want AI to generate professional-looking hero images
So that my store looks complete and trustworthy from day one
```

### Acceptance Criteria

#### AC-1: Happy Path — Generate Hero Image

```gherkin
GIVEN AI generates a store for "kedai baju kurung, warna pink pastel"
WHEN  image generation runs via OpenAI DALL-E / image API
THEN  Hero banner (1200×400px) is generated with fashion-appropriate imagery
  AND color palette matches the store's theme
  AND image is auto-uploaded to CDN (Cloudinary / Payload media)
```

#### AC-2: Error Handling — Image API Fail

```gherkin
GIVEN image generation API fails or times out
WHEN  generation is attempted
THEN  curated stock image from the correct category is used as fallback
  AND KHÔNG hiện broken image
```

#### AC-3: User Control — Regenerate Image

```gherkin
GIVEN store owner không hài lòng với ảnh đã generate
WHEN  click "Generate New Image"
THEN  AI generate ảnh mới thay thế ảnh cũ
  AND ảnh mới auto-saved vào Payload CMS media library
```

### Additional Criteria

- [ ] Generated images stored in Payload CMS media library với store-namespaced path
- [ ] All AI-generated images labelled "AI Generated ✨" in editor — label removed on storefront
- [ ] Rate limit: theo tier (ref: `SPEC.md §7.3`)

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] Fallback stock image hiển thị đúng khi API fail
- [ ] Image label "AI Generated ✨" xuất hiện trong editor


---

## US-F01-04: One-Click Publish

**Wave 3** | **P0** | **S** | **Status:** Ready

### Story

```
As a   store owner who has reviewed the generated website
I want to publish my site with one click
So that my website goes live immediately without additional configuration
```

### Acceptance Criteria

#### AC-1: Happy Path — Publish với 1 click

```gherkin
GIVEN website đã được generate xong và user đang xem preview
WHEN  user click nút "Publish ngay"
THEN  hệ thống bắt đầu quá trình publish trong < 30 giây
  AND site status chuyển từ Draft → Published
  AND URL `{slug}.primeweb.app` trở nên accessible công khai
  AND hiển thị màn hình success với domain live được highlight
```

#### AC-2: Unpublish — Site trả về 404

```gherkin
GIVEN site đang ở trạng thái Published
WHEN  owner vào Settings và click "Unpublish"
THEN  site chuyển về trạng thái Draft
  AND URL `{slug}.primeweb.app` trả về 404 cho visitor
  AND dashboard hiển thị site đang ở trạng thái "Draft"
```

#### AC-3: Rate Limit — Free tier chỉ 1 lần generate

```gherkin
GIVEN user thuộc Free tier đã từng generate 1 site trước đó
WHEN  user cố gắng generate site thứ 2
THEN  hệ thống hiển thị modal Upgrade Prompt
  AND KHÔNG gọi AI API
  AND modal giải thích giới hạn và options nâng cấp
```

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] Publish hoàn thành trong < 30 giây (p95)
- [ ] Site accessible tại `{slug}.primeweb.app` ngay sau publish
- [ ] Unpublish khiến URL trả về 404 trong < 60 giây

---

## US-F01-05: AI Builder Input Forms

**Wave 3** | **P0** | **M** | **Status:** Ready

### Story

```
As a   newly registered SME owner
I want a simple, clear input interface
So that I can quickly provide my business info without being confused by open-ended questions
```

### Business Value

Sử dụng trực tiếp các ô nhập liệu giúp owner có overview những gì AI cần. Validate ngay tại chỗ giúp đảm bảo AI lấy đủ các nội dung như (About us, Vision, Mission) mà không cần đoán hoặc suy luận sai qua các câu trả lời tự do trong chat.

### Acceptance Criteria

#### AC-1: Form Interface Layout

```gherkin
GIVEN người dùng truy cập /builder/new lần đầu
WHEN  trang tải (load) xong
THEN  giao diện chính hiển thị một thẻ Card có 3 trường nhập liệu:
        - Tên doanh nghiệp (Input text)
        - Mô tả ngắn về doanh nghiệp (Textarea lớn)
        - Mặt hàng / Dịch vụ kinh doanh (Input text hoặc Tags check)
  AND  có phần ví dụ (placeholder) cho "Mô tả ngắn": "VD: Tiệm bánh handmade hoạt động từ 2020..."
```

#### AC-2: Field Validation Before Generate

```gherkin
GIVEN user vừa điền form
WHEN  click nút "Generate Website"
THEN  xác thực (validation) các trường bắt buộc (Tên doanh nghiệp, Mặt hàng/Dịch vụ)
  AND  nếu thiếu, hiển thị lỗi ngay tại ô text tương ứng
```

#### AC-3: Generation Processing

```gherkin
GIVEN form đã điền đủ dữ kiện 
WHEN  user click "Generate"
THEN  hệ thống khoá (disable) form và nút bấm
  AND  hiển thị trạng thái đang gọi AI phân tích content (About Us, Vision, Mission)
  AND  hiển thị trạng thái đang lấy Banner / Image Carousel
```

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] Render đầy đủ 3 form inputs với placeholders
- [ ] Submit button có validation
- [ ] Chuyển trạng thái processing đúng khi đủ info

---

## US-F01-06: Multilingual Site Output

**Wave 3** | **P0** | **S** | **Status:** Ready

### Story

```
As a   SME owner who inputted data in my native language
I want the generated website content to be in the same language I used in chat
So that my website feels natural and ready-to-use for my local customers
```

### Business Value

User nói BM → website ra tiếng Anh là mismatch, tạo cảm giác AI không hiểu mình. Content align ngôn ngữ = trust cao hơn, ít phải edit hơn sau khi generate.

### Acceptance Criteria

#### AC-1: Happy Path — Content Theo Ngôn Ngữ Chat

```gherkin
GIVEN user đã nhập form bằng Bahasa Melayu
WHEN  site quá trình generate hoàn thành
THEN  mọi text content trong site (headlines, body copy, CTA, nav labels)
        được generate bằng Bahasa Melayu
  AND  tone phù hợp với thị trường Malaysia (formal BM, bukan Bahasa Indonesia)
```

```gherkin
GIVEN user đã nhập form bằng tiếng Việt
WHEN  site quá trình generate hoàn thành
THEN  mọi text content trong site được generate bằng tiếng Việt
  AND  tone chuyên nghiệp, phù hợp với SME Việt Nam
```

```gherkin
GIVEN user nhập form bằng tiếng Anh hoặc Manglish
WHEN  site quá trình generate hoàn thành
THEN  content được generate bằng tiếng Anh
```

#### AC-2: Gợi Ý Thêm Ngôn Ngữ Thứ 2

```gherkin
GIVEN website đã được generate xong bằng ngôn ngữ chính của user
WHEN  user thấy màn hình post-generation
THEN  AI gợi ý thêm: "Want an English version too? [Add English Content]"
  AND  đây là optional — user có thể skip
  AND  nếu chọn → AI generate thêm bản dịch English song song
```

#### AC-3: Fallback — Ngôn Ngữ Không Hỗ Trợ

```gherkin
GIVEN user nhập form bằng ngôn ngữ AI chưa hỗ trợ tốt (VD: Tamil, Mandarin)
WHEN  generation chạy
THEN  site content được generate bằng tiếng Anh (fallback)
  AND  AI thông báo: "Your site content has been generated in English. You can edit it in the editor."
  AND  KHÔNG fail generation
```

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] Site content khớp ngôn ngữ user đã chat (BM, VI, EN)
- [ ] Fallback sang EN khi ngôn ngữ không hỗ trợ, kèm thông báo
- [ ] Gợi ý thêm ngôn ngữ thứ 2 hiển thị sau generate

---

## US-F01-07: Post-Generation Confirm & CMS Redirect

**Wave 3** | **P0** | **M** | **Status:** Ready

### Story

```
As a   store owner who just confirmed my generated website
I want to see my live domain and be taken to the CMS admin
So that I know my website is live and I can immediately start managing it
```

### Business Value

Post-generation là khoảnh khắc "aha moment" — user thấy domain thật của họ lần đầu tiên. Chuyển hướng vào CMS Admin ngay giúp user bắt đầu làm quen với hệ thống quản lý, giảm churn ngay sau onboarding.

### Acceptance Criteria

#### AC-1: Happy Path — Hiển Thị Domain Sau Confirm

```gherkin
GIVEN user xem preview và click "Confirm & Publish"
WHEN  publish action hoàn thành
THEN  hiển thị màn hình congratulations với:
        - Domain live được highlight: {slug}.primeweb.app
        - Nút "Copy Link" với clipboard feedback toast
        - Nút "View Live Site" → mở tab mới tới domain
        - Nút "Go to Admin Dashboard" → redirect /admin
  AND  site status chuyển từ Draft → Published
```

#### AC-2: Redirect vào CMS Admin

```gherkin
GIVEN user click "Go to Admin Dashboard"
WHEN  redirect xảy ra
THEN  user được đưa vào /admin (Payload CMS dashboard)
  AND  user đã được authenticated — không cần login lại
  AND  dashboard hiển thị site vừa tạo ở vị trí đầu tiên
```

#### AC-3: Continue Editing — Không Bắt Buộc Redirect

```gherkin
GIVEN user đang ở màn hình post-generation confirm
WHEN  user click "Continue Editing" thay vì vào Admin
THEN  user được redirect sang /editor/:siteId
  AND  site đang ở trạng thái Published (không phải Draft)
  AND  mọi thay đổi tiếp theo cần Publish lại để có hiệu lực
```

#### AC-4: Domain Copy — Clipboard

```gherkin
GIVEN domain được hiển thị trên màn hình post-generation
WHEN  user click "Copy Link"
THEN  domain được copy vào clipboard
  AND  toast xanh hiện: "Link copied! 🎉"
  AND  button đổi thành "Copied ✓" trong 2 giây rồi reset
```

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] Domain `{slug}.primeweb.app` hiển thị đúng sau publish
- [ ] Copy-to-clipboard hoạt động với toast feedback
- [ ] Redirect /admin giữ authenticated session
- [ ] "View Live Site" mở đúng URL trong tab mới

---

## US-F01-08: Drag-and-Drop Block Reorder in Builder Preview

**Wave 3** | **P0** | **M** | **Status:** Ready

### Story

```
As a   chủ cửa hàng đang xem bản preview được AI tạo ra
I want kéo thả (drag and drop) các section để sắp xếp vị trí
So that tôi có thể chỉnh bố cục theo ý thích trước khi publish — mà ko cần chui vào Editor
```

### Business Value

Sau khi AI generate site, bố cục có thể chưa đúng ý user. Nếu phải vào Editor chỉ để đổi thứ tự section, đó là friction không cần thiết. Drag-and-drop ngay trong preview của builder giúp user cảm thấy kiểm soát được kết quả ngay lập tức.

### Acceptance Criteria

#### AC-1: Happy Path — Kéo Thả Đổi Vị Trí Ở Normal View

```gherkin
GIVEN website đã được generate xong và user đang xem preview ở /builder/new (Normal view layout)
WHEN  user hover lên một section component (VD: About Us block)
THEN  hiển thị drag handle (⠿) ở cạnh trái/trên section
WHEN  user kéo section đó lên/xuống và thả vào vị trí mới
THEN  section di chuyển tức thì vào vị trí mới trong preview
  AND thứ tự blocks được cập nhật trong state (builderStore)
  AND KHÔNG thể dùng drag-and-drop nếu preview đang ở dạng lớn toàn màn hình (Full-screen view)
  AND KHÔNG cần reload lại preview
```

#### AC-2: Visual Feedback Khi Kéo

```gherkin
GIVEN user đang kéo một section
WHEN  section đang được kéo (drag in progress)
THEN  section gốc hiển thị placeholder mờ tại vị trí cũ
  AND vị trí drop target hiển thị đường kẻ highlight màu accent
  AND section đang kéo có opacity 0.7 và box-shadow để phân biệt
WHEN  user thả vào vị trí hợp lệ
THEN  animation smooth (duration 200ms) về vị trí mới
```

#### AC-3: Lưu Thứ Tự Sau Khi Kéo Thả

```gherkin
GIVEN user đã reorder các blocks trong preview
WHEN  user click "Tinh chỉnh" hoặc "Publish ngay"
THEN  thứ tự mới được persist vào DB (Payload CMS Page.layout sortOrder)
  AND editor /editor/:siteId hiển thị đúng thứ tự mới
  AND published site render đúng thứ tự này
```

#### AC-4: Mobile — Touch Drag

```gherkin
GIVEN user trên mobile (< 768px) đang xem preview
WHEN  preview được bật (toggle 👁 Preview)
THEN  drag handle hiển thị và touch-draggable (long-press 500ms để bắt đầu kéo)
  AND kéo thả hoạt động bằng cử chỉ touch
  AND KHÔNG conflict với scroll gesture của trang
```

#### AC-5: Giới Hạn — Không Kéo Navigation và Footer

```gherkin
GIVEN website đã được generate xong
WHEN  user cố kéo block Navigation hoặc Footer
THEN  drag handle không xuất hiện trên 2 block này
  AND tooltip hiển thị: "Navigation and Footer position is fixed"
```

### Additional Criteria

- [ ] Reorder history là một undoable action (một lần Ctrl+Z revert về thứ tự trước)
- [ ] Tối thiểu hỗ trợ reorder: Hero, About, Products & Services, Contact, và các section tùy chọn
- [ ] Drag handle chỉ xuất hiện khi hover — không chiếm không gian UI khi idle

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] Drag-and-drop hoạt động trên Desktop (mouse) và Mobile (touch)
- [ ] Thứ tự sau reorder được persist vào DB đúng khi user confirm
- [ ] Navigation và Footer không thể kéo được — tooltip xuất hiện
- [ ] Smooth animation 200ms khi drop

---

## US-F01-09: Mobile Web UX — Input Form & Immersive Preview

**Wave 3** | **P0 🌟** | **L** | **Status:** Ready

### Story

```
As a   mobile user (SME owner)
I want the input form to be clearly laid out vertically and transition into an immersive full-screen preview when generating
So that I can easily type my details and get the "wow" factor of seeing my site built without a cramped screen
```

### Acceptance Criteria

#### AC-1: Vertical Form & Sticky CTA

```gherkin
GIVEN the user accesses /builder/new on a smartphone (width < 768px)
WHEN  the page loads
THEN  the 3 form inputs (Name, Description, Services) are stacked vertically taking full width
  AND labels are positioned above the inputs to maximize tap area
  AND input font size is exactly 16px to prevent iOS Safari auto-zooming
  AND the "✨ Tạo Website" button remains sticky at the bottom of the screen to prevent being hidden by the virtual keyboard
```

#### AC-2: Transition to Immersive Preview

```gherkin
GIVEN the user has successfully submitted the Builder form on mobile
WHEN  the generation process starts (SSE stream initiates)
THEN  the form UI smoothly slides away or collapses
  AND the Live Preview iframe expands to take up 100% of the viewport height and width
```

#### AC-3: Floating Progress Indicator

```gherkin
GIVEN the AI is streaming the site generation on mobile
WHEN  viewing the full-screen preview
THEN  a compact floating pill (Bottom Sheet mini) appears at the bottom of the screen
  AND it displays the current generation step (e.g., "✨ Đang tạo Hero Banner...")
  AND its backdrop is slightly blurred to ensure background visibility without completely opaque blocking
WHEN  the generation completes
THEN  the pill expands into a Bottom Sheet containing the success message and CTAs
```

### Definition of Done

- [ ] 9-Point Checklist pass
- [ ] No horizontal scrolling when typing
- [ ] Safe area insets (iOS notch, Android home bar) handled gracefully
- [ ] Smooth CSS transition (60fps) from Form to Preview layout

---

## US-F01-10: Mobile Web UX — Touch-Safe Block Reordering

**Wave 3** | **P0** | **M** | **Status:** Ready

### Story

```
As a   mobile user
I want an easy, touch-friendly way to reorder sections
So that I don't accidentally swipe or scroll the page when trying to drag a heavy iframe block
```

### Business Value

Kéo thả (drag and drop) các component lớn trên màn hình cảm ứng thường xuyên xung đột với thao tác cuộn dòng (scroll) gốc của trình duyệt. Việc đổi sang UI Tap Up/Down hoặc "Reorder Mode" chuyên dụng (Card List) giải quyết triệt để lỗi UX này.

### Acceptance Criteria

#### AC-1: Action Bar Tap to Move (Up/Down)

```gherkin
GIVEN the user is viewing the generated site preview on mobile
WHEN  the user taps a section (e.g., About Us)
THEN  the section is highlighted with an outline
  AND a floating action bar appears anchored to that section containing [⬆ Lên] and [⬇ Xuống] buttons
WHEN  the user taps [⬆ Lên]
THEN  the section swaps position with the one above it instantly
  AND the state is saved for the next publish (no reload required)
```

#### AC-2: Dedicated Reorder Mode (Card List)

```gherkin
GIVEN the user wants to see all blocks to reorder them on mobile
WHEN  the user taps an "≡ Sắp xếp" button in the mobile toolbar
THEN  the live iframe is temporarily replaced by a simple list of cards representing the sections (Hero, About, Products, Contact)
  AND dragging these lightweight native cards is smooth and doesn't trigger iframe scroll conflicts
WHEN  the user taps "Xong"
THEN  the list returns to the updated full iframe preview
```

### Definition of Done

- [ ] 9-Point Checklist pass
- [ ] Up/Down arrows have minimum 44x44px touch targets
- [ ] Reordering does not trigger accidental native page refreshing (pull-to-refresh)


