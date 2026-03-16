# PRD: AI Chat Builder (F01)
> **Version:** 2.0 | **Updated:** 2026-03-16 | **Agent:** `project-planner`
> **Priority:** P0 🌟 | **Sprint:** Wave 3 — Sprint 2 | **Size:** XL
> **Depends on:** F04 Block Renderer ✅ | **Blocks:** F02 Auth, F09 Products

---

> [!IMPORTANT]
> **Stories-First Rule:** PRD này được xây dựng từ các User Stories đã approve.
> Mọi FR phải có Story Ref. AC được copy từ story file. Không tự mở rộng scope.

---

## 0. Story Traceability

| Story ID | Title | File | Status |
|----------|-------|------|--------|
| US-F01-01 | Generate Site from Prompt | [F01-ai-chat-builder-stories.md](../stories/F01-ai-chat-builder-stories.md) | Ready |
| US-F01-02 | Store Setup — Basic Info | [F01-ai-chat-builder-stories.md](../stories/F01-ai-chat-builder-stories.md) | Ready |
| US-F01-03 | AI Image Generation | [F01-ai-chat-builder-stories.md](../stories/F01-ai-chat-builder-stories.md) | Draft |
| US-F01-04 | One-Click Publish | [F01-ai-chat-builder-stories.md](../stories/F01-ai-chat-builder-stories.md) | Draft |
| US-F01-05 | Conversational AI Onboarding Flow | [F01-ai-chat-builder-stories.md](../stories/F01-ai-chat-builder-stories.md) | Draft |
| US-F01-06 | Multilingual Site Output | [F01-ai-chat-builder-stories.md](../stories/F01-ai-chat-builder-stories.md) | Draft |
| US-F01-07 | Post-Generation Confirm & CMS Redirect | [F01-ai-chat-builder-stories.md](../stories/F01-ai-chat-builder-stories.md) | Draft |
| US-F01-08 | Drag-and-Drop Block Reorder in Builder Preview | [F01-ai-chat-builder-stories.md](../stories/F01-ai-chat-builder-stories.md) | Draft |

---

## 1. Problem Statement

Hiện tại, các chủ doanh nghiệp SME thường mất từ 30-60 phút để cấu hình các website builder (chọn template → điền form → upload ảnh → cấu hình SEO). Họ cần một cách để **mô tả doanh nghiệp của mình bằng ngôn ngữ tự nhiên** và có ngay một website hoàn chỉnh, đẹp mắt lập tức.

Phiên bản v1 chỉ có builder thủ công. Phiên bản v2 sẽ lấy AI làm trải nghiệm cốt lõi — đây là **#1 USP** (Unique Selling Proposition) của PrimeWeb.

---

## 2. Target User

- Chủ doanh nghiệp SME (tiệm nhỏ, freelancer), không có kỹ năng lập trình (no technical skills)
- Giao tiếp bằng Tiếng Việt, Bahasa Melayu, Tiếng Anh, hoặc Manglish
- Muốn có một website chuyên nghiệp trong **< 5 phút** (từ lúc đăng ký → publish)
- Chưa từng xây dựng website trước đây

---

## 3. Solution Overview

Người dùng truy cập vào `/builder/new`, mô tả doanh nghiệp của họ bằng ngôn ngữ tự nhiên. AI sẽ stream phản hồi, xây dựng tự động một website đa trang hoàn chỉnh (block-by-block) với quyền xem trước (live preview) ngay ở khung bên phải. Khi hoàn tất, người dùng có thể tinh chỉnh trong Editor hoặc publish ngay lập tức.

---

## 4. Scope

### In Scope
- Nhập prompt ngôn ngữ tự nhiên → generate toàn bộ site thông qua SSE streaming (US-F01-01)
- AI thu thập thông tin tên doanh nghiệp + danh mục (category) qua chat (không dùng form rời) (US-F01-02)
- Tự động generate ảnh (AI image generation) cho hero banner (US-F01-03)
- Publish URL `{slug}.primeweb.app` chỉ với 1 click (US-F01-04)
- Tự động lưu bản nháp (Auto-save draft) + khôi phục phiên làm việc (session recovery)
- Luồng trò chuyện AI (Conversational AI onboarding): AI chào tiếng Anh, nhận diện ngôn ngữ người dùng, hỏi tối đa 4 câu (US-F01-05)
- Nội dung site được generate theo ngôn ngữ trò chuyện, dự phòng (fallback) về tiếng Anh (US-F01-06)
- Sau khi generate: hiển thị domain, nút copy link, phân luồng redirect tới màn Admin/Editor (US-F01-07)
- Bắt buộc tạo đủ 4 trang: Homepage, About Us, Products & Services, Contact Us (US-F01-01)
- Layout thay đổi linh hoạt tùy theo danh mục business (US-F01-01)
- Cho phép người dùng thao tác Drag-and-drop đổi vị trí Block ở Preview Panel (US-F01-08)

### Out of Scope
- Custom domain (Sẽ xử lý ở Wave 6+)
- Generate xuất nhiều ngôn ngữ (Multi-language site) trong cùng 1 lần chạy
- Video background hoặc tùy chỉnh custom HTML/CSS code blocks

---

## 5. Success Metrics

| Metric | Target | Measured By |
|--------|--------|-------------|
| Time: register → first published site | < 10 min | PostHog funnel |
| AI generation success rate | > 95% | Sentry error rate |
| Generation time (p95) | < 60 seconds | Custom SSE timing |
| User satisfaction (post-generation) | > 8/10 | In-app survey |
| Onboarding completion rate | > 70% | PostHog funnel |

---

## 6. User Story Summary

```
AS A   newly registered SME owner
I WANT TO describe my business in natural language
SO THAT AI creates a complete website without design or coding skills
```

> Source: [US-F01-01](../stories/F01-ai-chat-builder-stories.md#us-f01-01)

---

## 7. Functional Requirements

| FR-ID | Requirement | Story Ref | Priority | Notes |
|-------|-------------|-----------|----------|-------|
| FR-01 | AI must stream response within < 2 seconds of prompt submission | US-F01-01 | P0 | SSE streaming |
| FR-02 | Complete site generation in < 60 seconds | US-F01-01 | P0 | Min 8 blocks |
| FR-03 | Live preview updates block-by-block in realtime | US-F01-01 | P0 | iframe sandboxed |
| FR-04 | AI asks max 2 clarifying questions if prompt is incomplete | US-F01-01 | P0 | Then generate with assumptions |
| FR-05 | Auto-save draft to DB after generation | US-F01-01 | P0 | Payload CMS |
| FR-06 | Session recovery: return to /builder/new shows draft | US-F01-01 | P0 | 24h validity |
| FR-07 | Error toast + retry without re-entering prompt | US-F01-01 | P0 | |
| FR-08 | AI collects business name + category via chat (no form) | US-F01-02 | P0 | Save to site.aiContext |
| FR-09 | Template flow: /templates → select → /editor/:id | US-F01-02 | P1 | |
| FR-10 | AI generates hero image (1200×400px) via DALL-E | US-F01-03 | P0 | CDN upload |
| FR-11 | Fallback stock image if image API fails | US-F01-03 | P0 | Never broken image |
| FR-12 | User can regenerate any AI image | US-F01-03 | P1 | |
| FR-13 | One-click publish to {slug}.primeweb.app in < 30s | US-F01-04 | P0 | |
| FR-14 | Unpublish: site returns 404 | US-F01-04 | P0 | |
| FR-15 | Rate limit: Free tier = 1 generation total | US-F01-01 | P0 | Ref: SPEC §7.3 |
| FR-16 | AI greets user in English on /builder/new load | US-F01-05 | P0 | Friendly, ≤ 2 sentences + example hint |
| FR-17 | AI detects user reply language and switches conversation language | US-F01-05 | P0 | From next message onward, no dropdown |
| FR-18 | Conversational flow completes in max 4 questions before generating | US-F01-05 | P0 | Quick-reply chips available |
| FR-19 | Site content generated in user's chat language (BM / VI / EN) | US-F01-06 | P0 | Fallback to EN if language unsupported |
| FR-20 | Post-generation: offer optional second language version | US-F01-06 | P1 | "Want an English version too?" |
| FR-21 | Generated site must include 4 pages: Homepage, About Us, Products & Services, Contact Us | US-F01-01 | P0 | Nav menu links to all 4 |
| FR-22 | Layout selected based on business category (F&B, Retail, Services, Beauty, etc.) | US-F01-01 | P0 | Color, font, block order per category |
| FR-23 | Post-publish screen: show `{slug}.primeweb.app` with copy-to-clipboard | US-F01-07 | P0 | Toast on copy |
| FR-24 | Post-publish: "Go to Admin Dashboard" redirects to /admin (authenticated) | US-F01-07 | P0 | No re-login required |
| FR-25 | Post-publish: "Continue Editing" redirects to /editor/:siteId (Published state) | US-F01-07 | P0 | |
| FR-26 | Drag handle appears on hover for reorderable blocks in builder preview | US-F01-08 | P0 | Exclude Navigation & Footer |
| FR-27 | Block reorder persisted to DB (Page.layout sortOrder) on confirm/publish | US-F01-08 | P0 | Works on Desktop (mouse) + Mobile (touch) |

---

## 8. Business Rules

- **BR-01:** Mọi query phải scope theo `tenant` — user chỉ thấy sites của mình
- **BR-02:** Soft delete only — không bao giờ hard delete site record
- **BR-03:** Rate limit được bắt buộc kiểm tra TRƯỚC khi gọi OpenAI API (tránh lãng phí credits)
- **BR-04:** Content/Images do AI generate được dán nhãn "AI Generated ✨" trong editor, ẩn nhãn này trên site live (storefront)
- **BR-05:** Draft bản nháp có hiệu lực trong 24 giờ — sau đó có thể bị tự động clear
- **BR-06 (Content Safety):** Hệ thống phải từ chối (reject) các prompt chứa từ khóa nhạy cảm, bạo lực, NSFW hoặc vi phạm chính sách trước khi gọi AI API
- **BR-07 (Quota Protection):** Nếu quá trình generate thất bại do lỗi phía server/hệ thống API (timeout, OpenAI is down), User KHÔNG bị trừ credit/quota 
- **BR-08 (Language Fallback):** Nếu ngôn ngữ user chat không thuộc danh sách hỗ trợ đầy đủ (BM, VI, EN) thì AI phải tự fallback về tiếng Anh để giao tiếp và generate
- **BR-09 (Data Retention):** Các site ở trạng thái Draft sẽ bị cronjob (Payload CMS) xóa sau 30 ngày để dọn rác DB

---

## 9. User Flow

```text
/builder/new (đã xác thực - authenticated)
  ↓
User nhập mô tả doanh nghiệp (BM/EN/Mixed/VI)
  ↓
AI đặt thêm các câu hỏi phân loại (tối đa 3-4 câu) nếu cần thu thập thêm Context
  ↓
User trả lời
  ↓
User xác nhận thông tin "Đã đủ thông tin, bắt đầu tạo website"
  ↓
  ├── Sinh URL slug tự động (vd: /my-cake-shop)
  ├── AI stream quá trình generate site (SSE)
  │     ├── nhận sự kiện block_complete → preview cập nhật realtime
  │     ├── nhận sự kiện theme_set → giao diện apply color/font mới
  │     └── nhận sự kiện done → Màn hình chúc mừng + CTAs {"Tinh chỉnh" | "Publish ngay"}
  │
  ├── Lỗi → hiển thị toast đỏ + "Thử lại" (giữ nguyên state prompt)
  └── Vượt quá giới hạn (Rate limit exceeded) → hiển thị modal mời upgrade (Upgrade Prompt)
```

---

## 10. Screen Layout

```
┌─ /builder/new ─────────────────────────────────────────┐
│  ┌──────────────┐          ┌──────────────────────┐    │
│  │  CHAT PANEL  │          │    LIVE PREVIEW       │    │
│  │  (380px)     │          │    (remaining width)  │    │
│  │  AI Welcome  │          │  [skeleton loading]   │    │
│  │  ↓           │  ──→     │  Nav → Hero → About   │    │
│  │  User types  │          │  → Contact → Footer   │    │
│  │  description │          │                       │    │
│  │  ↓           │          │                       │    │
│  │  [Refine]    │          │  Draft badge           │    │
│  │  [Publish]   │          │                       │    │
│  └──────────────┘          └──────────────────────┘    │
└─────────────────────────────────────────────────────────┘

Mobile (< 768px):
  Chat = full width | Preview hidden (toggle: [💬] [👁])
```

---

## 11. Acceptance Criteria

> AC được copy từ `F01-ai-chat-builder-stories.md`. Không tự thêm AC không có trong story.

### AC-1: Happy Path — Generate Site từ Prompt
> 📌 Source: [US-F01-01](../stories/F01-ai-chat-builder-stories.md) — AC-1

```gherkin
GIVEN user ở /builder/new
WHEN  nhập mô tả (VD: "Tiệm bánh handmade quận 3, mở 2020")
  AND click Enter hoặc nút gửi
THEN  AI stream response ngay trong < 2 giây
  AND live preview bên phải update realtime
  AND progress hiển thị: "Đang tạo Hero... About... Contact..."
  AND toàn bộ site hoàn thành trong < 60 giây
```

### AC-2: Clarifying Questions — Prompt Thiếu Thông Tin
> 📌 Source: [US-F01-01](../stories/F01-ai-chat-builder-stories.md) — AC-2

```gherkin
GIVEN AI cần thêm thông tin
WHEN  prompt thiếu tên shop hoặc ngành
THEN  AI hỏi tối đa 2 câu clarifying
  AND sau 2 câu → generate luôn với reasonable assumption
```

### AC-3: Site Generated — Lựa Chọn Tiếp Theo
> 📌 Source: [US-F01-01](../stories/F01-ai-chat-builder-stories.md) — AC-3

```gherkin
GIVEN site đã generate xong
WHEN  user thấy preview
THEN  có 2 options: "Tinh chỉnh" (→ /editor) và "Publish ngay"
  AND auto-save draft vào DB
```

### AC-4: Session Recovery
> 📌 Source: [US-F01-01](../stories/F01-ai-chat-builder-stories.md) — AC-4

```gherkin
GIVEN user refresh hoặc back trong lúc generate
WHEN  quay lại /builder/new
THEN  hiện lại draft, không mất progress
```

### AC-5: Error Handling — AI Service Fail
> 📌 Source: [US-F01-01](../stories/F01-ai-chat-builder-stories.md) — AC-5

```gherkin
GIVEN AI service lỗi (timeout, API fail)
WHEN  generation thất bại
THEN  toast đỏ "Không thể tạo website. Thử lại"
  AND nút "Thử lại" KHÔNG cần nhập lại prompt
```

### AC-6: AI Image Generation — Happy Path
> 📌 Source: [US-F01-03](../stories/F01-ai-chat-builder-stories.md) — AC-1

```gherkin
GIVEN AI generates a store for "kedai baju kurung, warna pink pastel"
WHEN  image generation runs via DALL-E
THEN  Hero banner (1200×400px) generated với fashion-appropriate imagery
  AND auto-uploaded to CDN (Cloudinary / Payload media)
```

### AC-7: Publish Happy Path
> 📌 Source: [US-F01-04](../stories/F01-ai-chat-builder-stories.md) — AC-1

```gherkin
GIVEN I click the "Publish" button in the editor toolbar
WHEN  publish action completes
THEN  my store is live at {slug}.primeweb.app within 30 seconds
  AND a success toast shows the live URL with "View Store" button
```

### AC-8: Mobile Responsive
> 📌 Source: [US-F01-01](../stories/F01-ai-chat-builder-stories.md) — Additional Criteria

```gherkin
GIVEN screen width < 768px
WHEN  user accesses /builder/new
THEN  chat panel takes full width
  AND preview hidden by default with toggle [💬 Chat] [👁 Preview]
```


### AC-9: 4 Trang Bắt Buộc
> 📌 Source: [US-F01-01](../stories/F01-ai-chat-builder-stories.md) — AC-6

```gherkin
GIVEN AI generate site cho bất kỳ loại business nào
WHEN  generation hoàn thành
THEN  site phải có đủ 4 trang:
        - Homepage: tổng quan business, hero section, CTA thu hút
        - About Us: lịch sử, năm thành lập, tầm nhìn, sứ mệnh
        - Products & Services: liệt kê sản phẩm/dịch vụ kinh doanh
        - Contact Us: địa chỉ, số điện thoại, email, contact form
  AND   mỗi trang được tạo tự động dựa trên thông tin từ prompt
  AND   navigation menu hiển thị link đến cả 4 trang
```

### AC-10: Layout by Business Type
> 📌 Source: [US-F01-01](../stories/F01-ai-chat-builder-stories.md) — AC-7

```gherkin
GIVEN AI biết category business của user (F&B, Retail, Services, v.v.)
WHEN  generation chạy
THEN  layout được chọn phù hợp với loại business:
        - F&B / Nhà hàng: hero ảnh thức ăn nổi bật, menu grid
        - Thời trang / Retail: product grid, image-heavy layout
        - Dịch vụ / Professional: text-focused, trust signals, testimonials
        - Beauty / Spa: elegant layout, gallery section
  AND  màu sắc, font, block order phản ánh đặc thù ngành
```

### AC-11: Chào Mừng Bằng Tiếng Anh
> 📌 Source: [US-F01-05](../stories/F01-ai-chat-builder-stories.md) — AC-1

```gherkin
GIVEN user mới vào /builder/new lần đầu
WHEN  page load xong
THEN  AI hiển thị tin nhắn chào bằng tiếng Anh
        VD: "👋 Hi! I'm here to build your website. What's your business about?"
  AND  tone thân thiện, ngắn gọn — không dài hơn 2 câu
  AND  có gợi ý ví dụ ngắn bên dưới để user biết cách reply
        VD: "Example: 'Handmade cake shop in District 3' or 'Online fashion store'"
```

### AC-12: Theo Ngôn Ngữ User Reply
> 📌 Source: [US-F01-05](../stories/F01-ai-chat-builder-stories.md) — AC-2

```gherkin
GIVEN AI đang hỏi bằng tiếng Anh
WHEN  user trả lời bằng ngôn ngữ khác (BM, Vietnamese, Manglish, v.v.)
THEN  AI detect ngôn ngữ của user reply
  AND  từ tin nhắn tiếp theo, AI chuyển sang ngôn ngữ đó hoàn toàn
  AND  ngôn ngữ này được lưu vào session để dùng cho toàn bộ hội thoại
  AND  KHÔNG yêu cầu user chọn ngôn ngữ qua dropdown hay button
```

### AC-13: Tối Đa 4 Câu Hỏi / Lựa Chọn
> 📌 Source: [US-F01-05](../stories/F01-ai-chat-builder-stories.md) — AC-3

```gherkin
GIVEN AI cần thu thập thông tin để generate site
WHEN  user bắt đầu cuộc trò chuyện
THEN  AI hỏi tối đa 4 câu hỏi ngắn (hoặc đưa ra quick-select options)
  AND  mỗi câu hỏi chỉ hỏi 1 thông tin (không hỏi gộp)
  AND  AI có thể đưa ra lựa chọn nhanh (quick reply chips) thay vì câu hỏi mở
        VD: [🍔 F&B] [👗 Fashion] [💄 Beauty] [🔧 Services] [📦 Retail] [Khác]
  AND  sau 4 câu → AI generate luôn, không hỏi thêm
```

### AC-14: Natural Language Understanding
> 📌 Source: [US-F01-05](../stories/F01-ai-chat-builder-stories.md) — AC-4

```gherkin
GIVEN user trả lời tự nhiên, không theo cấu trúc
WHEN  AI nhận được reply như "bánh handmade quận 3, tui mở từ 2020 nha"
THEN  AI extract được: loại business, location, năm mở
  AND  AI xác nhận lại ngắn gọn trước khi generate
        VD: "Got it! Handmade bakery in District 3, est. 2020. Building your site now... 🚀"
  AND  KHÔNG hỏi lại những thông tin đã mention rồi
```

### AC-15: Content Theo Ngôn Ngữ Chat
> 📌 Source: [US-F01-06](../stories/F01-ai-chat-builder-stories.md) — AC-1

```gherkin
GIVEN user đã chat với AI bằng Bahasa Melayu
WHEN  site generation hoàn thành
THEN  mọi text content trong site (headlines, body copy, CTA, nav labels)
        được generate bằng Bahasa Melayu
  AND  tone phù hợp với thị trường Malaysia (formal BM, bukan Bahasa Indonesia)
```

```gherkin
GIVEN user đã chat với AI bằng tiếng Việt
WHEN  site generation hoàn thành
THEN  mọi text content trong site được generate bằng tiếng Việt
  AND  tone chuyên nghiệp, phù hợp với SME Việt Nam
```

```gherkin
GIVEN user chat bằng tiếng Anh hoặc Manglish
WHEN  site generation hoàn thành
THEN  content được generate bằng tiếng Anh
```

### AC-16: Gợi Ý Thêm Ngôn Ngữ Thứ 2
> 📌 Source: [US-F01-06](../stories/F01-ai-chat-builder-stories.md) — AC-2

```gherkin
GIVEN site đã generate xong bằng ngôn ngữ chính của user
WHEN  user thấy màn hình post-generation
THEN  AI gợi ý thêm: "Want an English version too? [Add English Content]"
  AND  đây là optional — user có thể skip
  AND  nếu chọn → AI generate thêm bản dịch English song song
```

### AC-17: Ngôn Ngữ Không Hỗ Trợ
> 📌 Source: [US-F01-06](../stories/F01-ai-chat-builder-stories.md) — AC-3

```gherkin
GIVEN user chat bằng ngôn ngữ AI chưa hỗ trợ tốt (VD: Tamil, Mandarin)
WHEN  generation chạy
THEN  site content được generate bằng tiếng Anh (fallback)
  AND  AI thông báo: "Your site content has been generated in English. You can edit it in the editor."
  AND  KHÔNG fail generation
```

### AC-18: Hiển Thị Domain Sau Confirm
> 📌 Source: [US-F01-07](../stories/F01-ai-chat-builder-stories.md) — AC-1

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

### AC-19: Redirect vào CMS Admin
> 📌 Source: [US-F01-07](../stories/F01-ai-chat-builder-stories.md) — AC-2

```gherkin
GIVEN user click "Go to Admin Dashboard"
WHEN  redirect xảy ra
THEN  user được đưa vào /admin (Payload CMS dashboard)
  AND  user đã được authenticated — không cần login lại
  AND  dashboard hiển thị site vừa tạo ở vị trí đầu tiên
```

### AC-20: Không Bắt Buộc Redirect
> 📌 Source: [US-F01-07](../stories/F01-ai-chat-builder-stories.md) — AC-3

```gherkin
GIVEN user đang ở màn hình post-generation confirm
WHEN  user click "Continue Editing" thay vì vào Admin
THEN  user được redirect sang /editor/:siteId
  AND  site đang ở trạng thái Published (không phải Draft)
  AND  mọi thay đổi tiếp theo cần Publish lại để có hiệu lực
```

### AC-21: Clipboard
> 📌 Source: [US-F01-07](../stories/F01-ai-chat-builder-stories.md) — AC-4

```gherkin
GIVEN domain được hiển thị trên màn hình post-generation
WHEN  user click "Copy Link"
THEN  domain được copy vào clipboard
  AND  toast xanh hiện: "Link copied! 🎉"
  AND  button đổi thành "Copied ✓" trong 2 giây rồi reset
```

### AC-22: Kéo Thả Đổi Vị Trí Block
> 📌 Source: [US-F01-08](../stories/F01-ai-chat-builder-stories.md) — AC-1

```gherkin
GIVEN site đã generate xong và user đang xem preview ở /builder/new
WHEN  user hover lên một section (VD: About Us block)
THEN  hiển thị drag handle (⠿) ở cạnh trái/trên section
WHEN  user kéo section đó lên/xuống và thả vào vị trí mới
THEN  section di chuyển tức thì vào vị trí mới trong preview
  AND thứ tự blocks được cập nhật trong state (builderStore)
  AND KHÔNG cần reload lại preview
```

### AC-23: Visual Feedback Khi Kéo
> 📌 Source: [US-F01-08](../stories/F01-ai-chat-builder-stories.md) — AC-2

```gherkin
GIVEN user đang kéo một section
WHEN  section đang được kéo (drag in progress)
THEN  section gốc hiển thị placeholder mờ tại vị trí cũ
  AND vị trí drop target hiển thị đường kẻ highlight màu accent
  AND section đang kéo có opacity 0.7 và box-shadow để phân biệt
WHEN  user thả vào vị trí hợp lệ
THEN  animation smooth (duration 200ms) về vị trí mới
```

### AC-24: Lưu Thứ Tự Sau Khi Kéo Thả
> 📌 Source: [US-F01-08](../stories/F01-ai-chat-builder-stories.md) — AC-3

```gherkin
GIVEN user đã reorder các blocks trong preview
WHEN  user click "Tinh chỉnh" hoặc "Publish ngay"
THEN  thứ tự mới được persist vào DB (Payload CMS Page.layout sortOrder)
  AND editor /editor/:siteId hiển thị đúng thứ tự mới
  AND published site render đúng thứ tự này
```

### AC-25: Touch Drag
> 📌 Source: [US-F01-08](../stories/F01-ai-chat-builder-stories.md) — AC-4

```gherkin
GIVEN user trên mobile (< 768px) đang xem preview
WHEN  preview được bật (toggle 👁 Preview)
THEN  drag handle hiển thị và touch-draggable (long-press 500ms để bắt đầu kéo)
  AND kéo thả hoạt động bằng cử chỉ touch
  AND KHÔNG conflict với scroll gesture của trang
```

### AC-26: Không Kéo Navigation và Footer
> 📌 Source: [US-F01-08](../stories/F01-ai-chat-builder-stories.md) — AC-5

```gherkin
GIVEN site đã generate xong
WHEN  user cố kéo block Navigation hoặc Footer
THEN  drag handle không xuất hiện trên 2 block này
  AND tooltip hiển thị: "Navigation and Footer position is fixed"
```

---

## 12. Non-Functional Requirements

| Category | Requirement | Notes |
|----------|-------------|-------|
| **Performance** | SSE stream starts < 2s, full generation < 60s (p95) | |
| **Security** | Route requires auth — 401 → /login | |
| **Accessibility** | WCAG 2.1 AA, keyboard navigable | |
| **Browser support** | Chrome, Safari, Edge latest 2 versions | |
| **Device support** | Mobile 375px, Tablet 768px, Desktop 1280px+ | |
| **AI Cost** | GPT-4o for generation, GPT-4o-mini for edits | Ref: SPEC §7.2 |

---

## 13. Technical Architecture

### 13.1 Components

| Component | File | Description |
|-----------|------|-------------|
| `BuilderPage` | `app/(builder)/builder/new/page.tsx` | Page layout orchestrator |
| `BuilderChatPanel` | `components/builder/BuilderChatPanel.tsx` | Left chat panel (380px) |
| `BuilderPreview` | `components/builder/BuilderPreview.tsx` | iframe preview |
| `BuilderProgress` | `components/builder/BuilderProgress.tsx` | Step-by-step progress |
| `DraftRecoveryDialog` | `components/builder/DraftRecoveryDialog.tsx` | Resume draft dialog |
| `useAIStream` | `hooks/useAIStream.ts` | SSE consumer hook |
| `builderStore` | `store/builderStore.ts` | Zustand state |

### 13.2 API Endpoints

```
POST /api/ai/generate-site → text/event-stream (SSE)
Request: { prompt: string, siteId: string, language?: 'vi' | 'en' | 'ms' }
Response: SSE stream (step | block_complete | theme_set | seo_generated | error | done)
Auth: Bearer JWT (required)
Rate Limit: Free=1 total, Starter=5/mo, Pro=20/mo, Business=unlimited
```

### 13.3 Data Flow

```
User prompt → generateSite() Server Action
                   │
                   ├── Rate limit check
                   ├── Create/update Site record (Payload)
                   ├── Call OpenAI GPT-4o (streaming)
                   ├── Parse JSON blocks → Zod validate
                   ├── Save blocks to Page.layout (Payload)
                   └── Stream SSE events → Client builderStore
```

### 13.4 SSE Events

| Event | Data | UI Action |
|-------|------|-----------|
| `step` | `{step, label, progress}` | Update progress bar |
| `block_complete` | `{block: BlockConfig}` | Add block to preview |
| `theme_set` | `{theme: ThemeConfig}` | Apply theme to preview |
| `seo_generated` | `{title, description}` | Store SEO meta |
| `error` | `{code, message, retryable}` | Show toast, enable retry |
| `done` | `{siteId, totalBlocks, timeMs}` | Show success CTAs |

---

## 14. Dependencies

| Dependency | Status | Action Needed |
|-----------|--------|---------------|
| F04 Block Renderer | ✅ Done | — |
| Payload CMS (Sites, Pages collections) | ✅ Exists | — |
| OpenAI API key | ⬜ Configure | Add to .env |
| DALL-E 3 API | ⬜ Configure | Same key as GPT |
| Zustand | ✅ In package.json | — |

---

## 15. API Contract

> Full details: [AI_BUILDER_SPEC.md §14.1](../AI_BUILDER_SPEC.md#141-ai-chat-builder--generate-site)

```
POST /api/ai/generate-site
Request: { prompt: string, siteId: string, language?: 'vi'|'en'|'ms' }
Response: SSE text/event-stream
Auth: required
Error codes: 401 AUTH_REQUIRED, 429 AI_RATE_LIMIT, 500 INTERNAL_ERROR
```

---

## 16. Open Questions

| # | Question | Owner | Status |
|---|----------|-------|--------|
| 1 | Draft recovery: dialog hoặc auto-load? | PO | ⬜ Open |
| 2 | Image generation: chạy song song với site gen hay sau? | Dev | ⬜ Open |
| 3 | BM language detection: dùng library hay AI detect? | Dev | ⬜ Open |

---

## 17. 9-Point Done Checklist

- [ ] Loading State — Skeleton preview, typing indicator chat
- [ ] Empty State — Welcome message + 3 example prompts
- [ ] Error State — Toast + retry (giữ prompt, không reset)
- [ ] Form Validation — Rate limit check trước generation
- [ ] Button States — Send disabled during streaming
- [ ] Toast Feedback — Success/Error/Rate limit toasts
- [ ] Auth Redirect — 401 → /login
- [ ] Mobile 375px — Chat full-width, preview toggle
- [ ] TypeScript Clean — `tsc --noEmit` pass

---

## 18. Definition of Ready

- [ ] User Stories approved và linked ở Section 0
- [ ] AC ở Section 11 copy từ story files
- [ ] FR ở Section 7 có đầy đủ Story Ref
- [ ] F04 Block Renderer done (prerequisite)
- [ ] OpenAI API key configured in .env
- [ ] Architecture doc: `docs/architecture/F01-ai-chat-builder.md`

---

## 19. Definition of Done

- [ ] All FR items implemented và verified
- [ ] All AC in Section 11 pass
- [ ] 9-Point Checklist all pass
- [ ] Generation time < 60s (p95 measured)
- [ ] Rate limit blocks excess usage
- [ ] SSE streaming works (all event types)
- [ ] Draft recovery works (close tab → return)
- [ ] Mobile responsive (375px)
- [ ] QA report: `docs/qa/F01-ai-chat-builder.md`
