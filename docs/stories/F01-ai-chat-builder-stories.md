# User Stories: AI Chat Builder (F01)

> **Feature:** F01 — AI Chat Builder
> **Wave:** 3 | **Priority:** P0 🌟 | **Ref PRD:** [F01-ai-chat-builder.md](../prd/F01-ai-chat-builder.md)

---

## US-F01-01: AI Chat Builder — Generate Site from Prompt ⭐

**Wave 3** | **P0 🌟** | **XL** | **Status:** Ready

### Story

```
As a   SME owner mới đăng ký
I want mô tả business bằng ngôn ngữ tự nhiên (BM/EN/Mixed)
So that AI tạo đầy đủ website mà không cần pick template hay fill form
```

### Acceptance Criteria

#### AC-1: Happy Path — Generate Site từ Prompt

```gherkin
GIVEN user ở /builder/new
WHEN  nhập mô tả (VD: "Tiệm bánh handmade quận 3, mở 2020")
  AND click Enter hoặc nút gửi
THEN  AI stream phản hồi ngay trong < 2 giây
  AND live preview ở khung bên phải cập nhật realtime
  AND progress hiển thị: "Đang tạo Hero... About... Contact..."
  AND toàn bộ site hoàn thành trong < 60 giây
```

#### AC-2: Clarifying Questions — Prompt Thiếu Thông Tin

```gherkin
GIVEN AI cần thêm thông tin
WHEN  prompt thiếu tên cửa hàng hoặc ngành nghề
THEN  AI hỏi tối đa 2 câu làm rõ (clarifying)
  AND sau 2 câu → tự động generate với các giả định hợp lý (reasonable assumption)
```

#### AC-3: Site Generated — Lựa Chọn Tiếp Theo

```gherkin
GIVEN website đã được generate xong
WHEN  người dùng nhìn thấy bản preview
THEN  có 2 options: "Tinh chỉnh" (→ /editor) và "Publish ngay"
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

#### AC-6: Site Page Structure — 4 Trang Bắt Buộc

```gherkin
GIVEN AI generate website cho bất kỳ danh mục business nào
WHEN  quá trình generate hoàn thành
THEN  website phải có đầy đủ 4 trang:
        - Homepage: tổng quan business, hero section, CTA thu hút
        - About Us: lịch sử, năm thành lập, tầm nhìn, sứ mệnh
        - Products & Services: liệt kê sản phẩm/dịch vụ kinh doanh
        - Contact Us: địa chỉ, số điện thoại, email, contact form
  AND   mỗi trang được cấu trúc tự động dựa trên thông tin từ prompt
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

## US-F01-02: Store Setup — Basic Info (AI Context Collection)

**Wave 1** | **P0** | **S** | **Status:** Ready

### Story

```
As a   owner vừa đăng ký
I want cấu hình tên và ngành cho website
So that AI có đủ context để generate đúng site
```

### Acceptance Criteria

#### AC-1: Happy Path — Chọn AI Builder Flow

```gherkin
GIVEN user ở /onboarding chọn "Tạo bằng AI"
WHEN  redirect sang /builder/new
THEN  AI hỏi tên business + ngành trong chat (không form riêng)
  AND thông tin này lưu vào site.aiContext trong DB
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

**Wave 3** | **P0** | **L** | **Status:** Draft

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

## US-F01-04: One-Click Publish to Live Store

**Wave 3** | **P0** | **M** | **Status:** Draft

### Story

```
As a   store owner who has finished building
I want to publish my store with one click
So that my website goes live immediately on my subdomain
```

### Acceptance Criteria

#### AC-1: Happy Path — First Publish

```gherkin
GIVEN I click the "Publish" button in the editor toolbar
WHEN  publish action completes
THEN  my store is live at {slug}.primeweb.app within 30 seconds
  AND a success toast shows the live URL with a "View Store" button
```

#### AC-2: Re-publish — Update Live Site

```gherkin
GIVEN my store is already published
WHEN  I make changes and click "Publish" again
THEN  changes are live within 30 seconds
  AND sitemap is re-generated automatically
```

#### AC-3: Unpublish — Take Site Offline

```gherkin
GIVEN my store is published
WHEN  I click "Unpublish"
THEN  site goes offline
  AND subdomain returns 404
  AND editor shows "Draft" badge
```

### Additional Criteria

- [ ] Publish button always visible in editor toolbar — disabled only if critical validation errors
- [ ] Editor changes from "Draft" badge to "Live" badge with green dot after first publish
- [ ] Published store URL is copyable — one-click copy with clipboard feedback toast
- [ ] SEO meta tags auto-generated on first publish if not manually set

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] Subdomain accessible within 30 seconds of publish
- [ ] Unpublish works — site returns 404 after unpublish

---

## US-F01-05: Conversational AI Onboarding Flow

**Wave 3** | **P0** | **M** | **Status:** Draft

### Story

```
As a   newly registered SME owner
I want the AI to guide me through setup with natural, short conversational questions
So that I can provide my business info comfortably — like chatting with a person, not filling a form
```

### Business Value

First impression của product xảy ra ở đây. Nếu AI hỏi quá nhiều câu hoặc dùng ngôn ngữ cứng nhắc như form, user sẽ drop ngay. Conversational flow tự nhiên = conversion rate cao hơn.

### Acceptance Criteria

#### AC-1: Happy Path — Chào Mừng Bằng Tiếng Anh

```gherkin
GIVEN người dùng mới truy cập /builder/new lần đầu
WHEN  trang tải (load) xong
THEN  AI hiển thị tin nhắn chào bằng tiếng Anh
        VD: "👋 Hi! I'm here to build your website. What's your business about?"
  AND  tone thân thiện, ngắn gọn — không dài hơn 2 câu
  AND  có gợi ý ví dụ ngắn bên dưới để user biết cách reply
        VD: "Example: 'Handmade cake shop in District 3' or 'Online fashion store'"
```

#### AC-2: Language Switch — Theo Ngôn Ngữ User Reply

```gherkin
GIVEN AI đang hỏi bằng tiếng Anh
WHEN  user trả lời bằng ngôn ngữ khác (BM, Vietnamese, Manglish, v.v.)
THEN  AI detect ngôn ngữ của user reply
  AND  từ tin nhắn tiếp theo, AI chuyển sang ngôn ngữ đó hoàn toàn
  AND  ngôn ngữ này được lưu vào session để dùng cho toàn bộ hội thoại
  AND  KHÔNG yêu cầu user chọn ngôn ngữ qua dropdown hay button
```

#### AC-3: Conversational Flow — Tối Đa 4 Câu Hỏi / Lựa Chọn

```gherkin
GIVEN AI cần thu thập thông tin để generate site
WHEN  user bắt đầu cuộc trò chuyện
THEN  AI hỏi tối đa 4 câu hỏi ngắn (hoặc đưa ra quick-select options)
  AND  mỗi câu hỏi chỉ hỏi 1 thông tin (không hỏi gộp)
  AND  AI có thể đưa ra lựa chọn nhanh (quick reply chips) thay vì câu hỏi mở
        VD: [🍔 F&B] [👗 Fashion] [💄 Beauty] [🔧 Services] [📦 Retail] [Khác]
  AND  sau 4 câu → AI generate luôn, không hỏi thêm
```

#### AC-4: Natural Language Understanding

```gherkin
GIVEN user trả lời tự nhiên, không theo cấu trúc
WHEN  AI nhận được reply như "bánh handmade quận 3, tui mở từ 2020 nha"
THEN  AI extract được: loại business, location, năm mở
  AND  AI xác nhận lại ngắn gọn trước khi generate
        VD: "Got it! Handmade bakery in District 3, est. 2020. Building your site now... 🚀"
  AND  KHÔNG hỏi lại những thông tin đã mention rồi
```

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] AI chào bằng EN khi user vào /builder/new
- [ ] Language switch xảy ra ngay từ tin nhắn tiếp theo sau khi user reply bằng ngôn ngữ khác
- [ ] Toàn bộ flow không vượt quá 4 câu hỏi trước khi generate
- [ ] Quick-reply chips hiển thị đúng và click được

---

## US-F01-06: Multilingual Site Output

**Wave 3** | **P0** | **S** | **Status:** Draft

### Story

```
As a   SME owner who chatted in my native language
I want the generated website content to be in the same language I used in chat
So that my website feels natural and ready-to-use for my local customers
```

### Business Value

User nói BM → website ra tiếng Anh là mismatch, tạo cảm giác AI không hiểu mình. Content align ngôn ngữ = trust cao hơn, ít phải edit hơn sau khi generate.

### Acceptance Criteria

#### AC-1: Happy Path — Content Theo Ngôn Ngữ Chat

```gherkin
GIVEN user đã chat với AI bằng Bahasa Melayu
WHEN  site quá trình generate hoàn thành
THEN  mọi text content trong site (headlines, body copy, CTA, nav labels)
        được generate bằng Bahasa Melayu
  AND  tone phù hợp với thị trường Malaysia (formal BM, bukan Bahasa Indonesia)
```

```gherkin
GIVEN user đã chat với AI bằng tiếng Việt
WHEN  site quá trình generate hoàn thành
THEN  mọi text content trong site được generate bằng tiếng Việt
  AND  tone chuyên nghiệp, phù hợp với SME Việt Nam
```

```gherkin
GIVEN user chat bằng tiếng Anh hoặc Manglish
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
GIVEN user chat bằng ngôn ngữ AI chưa hỗ trợ tốt (VD: Tamil, Mandarin)
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

**Wave 3** | **P0** | **M** | **Status:** Draft

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

**Wave 3** | **P0** | **M** | **Status:** Draft

### Story

```
As a   chủ cửa hàng đang xem bản preview được AI tạo ra
I want kéo thả (drag and drop) các section để sắp xếp vị trí
So that tôi có thể chỉnh bố cục theo ý thích trước khi publish — mà ko cần chui vào Editor
```

### Business Value

Sau khi AI generate site, bố cục có thể chưa đúng ý user. Nếu phải vào Editor chỉ để đổi thứ tự section, đó là friction không cần thiết. Drag-and-drop ngay trong preview của builder giúp user cảm thấy kiểm soát được kết quả ngay lập tức.

### Acceptance Criteria

#### AC-1: Happy Path — Kéo Thả Đổi Vị Trí Block

```gherkin
GIVEN website đã được generate xong và user đang xem preview ở /builder/new
WHEN  user hover lên một section (VD: About Us block)
THEN  hiển thị drag handle (⠿) ở cạnh trái/trên section
WHEN  user kéo section đó lên/xuống và thả vào vị trí mới
THEN  section di chuyển tức thì vào vị trí mới trong preview
  AND thứ tự blocks được cập nhật trong state (builderStore)
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
