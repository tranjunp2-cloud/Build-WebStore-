# PrimeWeb — User Stories (P0)

> **Format:** BMAD-style Gherkin (GIVEN/WHEN/THEN)  
> Stories đã **Ready** = dev bắt đầu sau Readiness Gate PASS.  
> ⏰ Docker build: `docker compose build --no-cache && docker compose up -d`

---

## US-001: Register & Welcome

**Wave 1** | **P0** | **S** | Status: Ready

### Story
```
As a   SME owner mới tìm hiểu PrimeWeb
I want đăng ký tài khoản và được chào đón  
So that tôi hiểu ngay bước tiếp theo là tạo website
```

### Acceptance Criteria
```
GIVEN user điền email + password hợp lệ (min 8 chars)
WHEN  click "Đăng ký"
THEN  tạo account + auto-login + redirect /onboarding
AND   KHÔNG redirect về /login

GIVEN user đã có account
WHEN  login thành công
THEN  redirect /dashboard (nếu có site) hoặc /onboarding (nếu chưa)

GIVEN email đã tồn tại
WHEN  nhập email đó vào register form
THEN  inline error "Email này đã được đăng ký" ngay dưới field
AND   KHÔNG submit form
```

### Definition of Ready
- [ ] UI mockup: Register + Onboarding Welcome (anh duyệt)
- [ ] Payload CMS auth configured + tested
- [ ] Email template (nếu cần verify email)

### Definition of Done
- [ ] 9-Point Checklist pass
- [ ] Register → auto-login → /onboarding flow works E2E

---

## US-002: AI Chat Builder — Generate Site from Prompt ⭐

**Wave 3** | **P0 🌟** | **XL** | Status: Ready

### Story
```
As a   SME owner mới đăng ký
I want mô tả business bằng ngôn ngữ tự nhiên
So that AI tạo đầy đủ website mà không cần pick template hay fill form
```

### Acceptance Criteria
```
GIVEN user ở /builder/new
WHEN  nhập mô tả (VD: "Tiệm bánh handmade quận 3, mở 2020")
AND   click Enter hoặc nút gửi
THEN  AI stream response ngay trong < 2 giây
AND   live preview bên phải update realtime
AND   progress: "Đang tạo Hero... About... Contact..."
AND   toàn bộ site hoàn thành trong < 60 giây

GIVEN AI cần thêm thông tin
WHEN  prompt thiếu tên shop hoặc ngành
THEN  AI hỏi tối đa 2 câu clarifying
AND   sau 2 câu → generate luôn với assumption hợp lý

GIVEN site đã generate xong
WHEN  user thấy preview
THEN  có 2 options: "Tinh chỉnh" (→ /editor) và "Publish ngay"
AND   auto-save draft vào DB

GIVEN user refresh/back trong lúc generate
WHEN  quay lại /builder/new
THEN  hiện lại draft, không mất progress

GIVEN AI service lỗi (timeout, API fail)
WHEN  generation thất bại
THEN  toast đỏ "Không thể tạo website. Thử lại"
AND   nút "Thử lại" KHÔNG cần nhập lại prompt
```

### AI Token Budget
- Model: GPT-4o (generation) + GPT-4o-mini (clarify questions)
- Output: JSON block config (~500 tokens), **KHÔNG** raw HTML
- Rate limit: theo subscription tier (see SPEC.md §6.5)

### Definition of Ready
- [ ] UI mockup: AI Chat Builder (anh duyệt)
- [ ] OpenAI API key configured + tested
- [ ] System prompt template reviewed
- [ ] SSE streaming endpoint documented

### Definition of Done
- [ ] 9-Point Checklist pass
- [ ] Generation time < 60s (p95)
- [ ] Rate limit works (exceed → 429 toast)
- [ ] E2E: chat → generate → preview → redirect to editor

---

## US-003: Store Setup — Basic Info

**Wave 1** | **P0** | **S** | Status: Ready

### Story
```
As a   owner vừa đăng ký
I want cấu hình tên và ngành cho website
So that AI có đủ context để generate
```

### Acceptance Criteria
```
GIVEN user ở /onboarding chọn "Tạo bằng AI"
WHEN  redirect sang /builder/new
THEN  AI hỏi tên business + ngành trong chat (không form riêng)
AND   thông tin này lưu vào site.aiContext trong DB

GIVEN user chọn "Chọn Template"
WHEN  redirect sang /templates
THEN  hiện template gallery, chọn template → tạo site → /editor/:id
```

### Definition of Done
- [ ] 9-Point Checklist pass
- [ ] Site record tạo đúng trong Payload CMS

---

## US-004: AI Editor — Split Screen Chat + Preview ⭐

**Wave 3** | **P0 🌟** | **XL** | Status: Ready

### Story
```
As a   site owner sau khi AI generate
I want chỉnh sửa website qua chat hoặc click trực tiếp
So that tôi tinh chỉnh nội dung mà không cần biết code
```

### Acceptance Criteria
```
GIVEN user ở /editor/:siteId
WHEN  load trang
THEN  AI chat panel trái (380px, collapsible)
AND   live preview giữa (iframe, sandboxed)
AND   settings panel phải (320px, context-sensitive)
AND   toolbar: [Undo] [Redo] [Save] [Preview] [Publish]
AND   status bar: autosave ON, draft/published badge

GIVEN user nhập lệnh chat (VD: "Đổi màu chủ thành xanh mint")
WHEN  gửi message
THEN  AI stream response
AND   changes apply lên preview realtime
AND   AI giải thích: "Đã đổi primary color thành #B2DFDB"
AND   có nút "Hoàn tác" trong chat message

GIVEN user nhấn Ctrl+Z
WHEN  undo
THEN  revert change (cả AI changes và manual edits)

GIVEN user hover element trên preview
WHEN  hover
THEN  hiện ✨ AI edit button tại element
WHEN  click ✨
THEN  mini popup, user type instruction ngắn
WHEN  accept
THEN  chỉ element đó thay đổi, phần còn lại không ảnh hưởng

GIVEN user chỉnh sửa nhưng chưa publish
WHEN  đóng tab hoặc navigate đi
THEN  auto-save (debounce 3s) đảm bảo không mất data
AND   badge "Draft" hiện trên header
```

### Definition of Ready
- [ ] UI mockup: Editor 3-panel layout (anh duyệt)
- [ ] AI chat endpoint documented (SSE)
- [ ] Block components renderable in iframe

### Definition of Done
- [ ] 9-Point Checklist pass
- [ ] Undo/Redo 10 steps correct
- [ ] Auto-save verified (simulate close tab)
- [ ] Mobile: chat panel collapse, toggle button

---

## US-005: Page Manager

**Wave 3** | **P0** | **M** | Status: Ready

### Story
```
As a   site owner
I want xem và quản lý tất cả pages
So that tôi biết page nào live, thêm/xóa page
```

### Acceptance Criteria
```
GIVEN user ở editor, click tab "Pages"
WHEN  load
THEN  list pages: status (Published/Draft), block count, last edited

GIVEN click "Thêm trang mới"
WHEN  điền tên (VD: "Khuyến mãi")
THEN  tạo page, slug = "khuyen-mai", redirect editor page đó

GIVEN click Delete page
WHEN  confirm
THEN  soft delete (deletedAt)
AND   toast "Đã xóa. Hoàn tác?" 5s
```

### Definition of Done
- [ ] 9-Point Checklist pass
- [ ] Soft delete works (page not on published site)

---

## US-006: Dashboard — Overview

**Wave 1** | **P0** | **M** | Status: Ready

### Story
```
As a   site owner đã có website
I want thấy tổng quan khi login
So that tôi biết status, actions cần làm
```

### Acceptance Criteria
```
GIVEN user login, có site
WHEN  vào /dashboard
THEN  hiện: Total Sites, Total Views, Storage Used, AI Credits
AND   site cards grid: thumbnail + name + status badge + actions

GIVEN chưa có site
WHEN  vào dashboard
THEN  empty state: icon + "Tạo website đầu tiên" + CTA → /onboarding

GIVEN site chưa publish
WHEN  vào dashboard
THEN  banner: "Website chưa live. Publish ngay →"
```

### Definition of Done
- [ ] 9-Point Checklist pass
- [ ] Empty state renders correctly
- [ ] Stats cards hiện đúng data

---

## US-007: Products — CRUD + AI Description

**Wave 4** | **P0** | **L** | Status: Draft

### Story
```
As a   site owner
I want thêm sản phẩm, AI viết description
So that sản phẩm có mô tả đẹp không mất thời gian
```

### Acceptance Criteria
```
GIVEN user ở /dashboard/products
WHEN  click "Thêm sản phẩm"
THEN  form: tên, giá, category, mô tả, ảnh (max 5, max 5MB), stock

GIVEN user điền tên sản phẩm
WHEN  click "✨ AI Viết Description"
THEN  AI generate description dựa trên tên + ngành
AND   user Accept hoặc chỉnh sửa

GIVEN user delete sản phẩm
WHEN  confirm
THEN  soft delete, toast "Đã xóa. Hoàn tác?" 5s
```

---

## US-008: Checkout — Purchase Flow ⭐

**Wave 4** | **P0 🌟** | **XL** | Status: Draft

### Story
```
As a   khách hàng trên published site
I want hoàn thành thanh toán dễ dàng
So that tôi nhận hàng và seller nhận tiền
```

### Acceptance Criteria
```
GIVEN khách có items trong cart
WHEN  vào /checkout
THEN  form: họ tên, phone, địa chỉ, payment method

GIVEN chọn Stripe payment
WHEN  click "Thanh toán"
THEN  redirect Stripe Checkout
AND   success → /order/:id/confirm, order CONFIRMED
AND   seller nhận notification

GIVEN payment thất bại
WHEN  return từ gateway FAIL
THEN  toast đỏ "Thanh toán thất bại. Thử lại"
AND   cart KHÔNG bị xóa
```

---

## US-009: SEO Dashboard ⭐

**Wave 4** | **P0 🌟** | **L** | Status: Draft

### Story
```
As a   site owner muốn traffic organic
I want thấy SEO health và fix bằng AI
So that Google index site tốt hơn
```

### Acceptance Criteria
```
GIVEN user ở /dashboard/seo
WHEN  load
THEN  Overall SEO Score (0-100), breakdown: Meta Tags, Content, Technical

GIVEN score < 70
WHEN  click "Fix All Issues"
THEN  AI fix missing meta titles, descriptions, alt texts
AND   progress: "Đang fix 12 issues..."
AND   done: score update + toast "Đã fix. Score: 72 → 89"

GIVEN click "Generate Sitemap"
WHEN  click
THEN  auto-generate sitemap.xml
AND   toast "Sitemap đã tạo"
```

---

## US-010: Publish Site

**Wave 3** | **P0** | **M** | Status: Ready

### Story
```
As a   site owner chuẩn bị xong
I want publish site live
So that khách hàng truy cập được
```

### Acceptance Criteria
```
GIVEN click "Publish" trong editor
WHEN  click
THEN  checklist: ✅ Có trang Home, ⚠️ SEO score (warning, không block)
AND   nút "Publish ngay" active

GIVEN confirm publish
WHEN  click "Publish ngay"
THEN  site.isPublished = true
AND   subdomain live: [slug].primeweb.app
AND   toast "🎉 Website đã live!" + link mở tab mới

GIVEN site live, muốn unpublish
WHEN  click "Unpublish"
THEN  site offline, subdomain 404
```
