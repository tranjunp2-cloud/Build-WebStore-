# PRD: AI Web Builder (F01)
> **Version:** 2.1 | **Updated:** 2026-03-18 | **Agent:** `project-planner`
> **Priority:** P0 🌟 | **Sprint:** Wave 3 — Sprint 2 | **Size:** XL
> **Depends on:** F04 Block Renderer ✅ | **Blocks:** F02 Auth, F08 Products

---

> [!IMPORTANT]
> **Stories-First Rule:** PRD này được xây dựng từ các User Stories đã approve.
> Mọi FR phải có Story Ref. AC được copy từ story file. Không tự mở rộng scope.


---

## 0. Story Traceability

| Story ID | Title | File | Status |
|----------|-------|------|--------|
| US-F01-01 | Generate Site from Structured Input | [F01-ai-builder-stories.md](../stories/F01-ai-builder-stories.md) | Ready |
| US-F01-02 | Store Setup — Basic Info | [F01-ai-builder-stories.md](../stories/F01-ai-builder-stories.md) | Ready |
| US-F01-03 | AI Image Generation | [F01-ai-builder-stories.md](../stories/F01-ai-builder-stories.md) | Ready |
| US-F01-04 | One-Click Publish | [F01-ai-builder-stories.md](../stories/F01-ai-builder-stories.md) | Ready |
| US-F01-05 | AI Builder Input Forms | [F01-ai-builder-stories.md](../stories/F01-ai-builder-stories.md) | Ready |
| US-F01-06 | Multilingual Site Output | [F01-ai-builder-stories.md](../stories/F01-ai-builder-stories.md) | Ready |
| US-F01-07 | Post-Generation Confirm & CMS Redirect | [F01-ai-builder-stories.md](../stories/F01-ai-builder-stories.md) | Ready |
| US-F01-08 | Drag-and-Drop Block Reorder in Builder Preview | [F01-ai-builder-stories.md](../stories/F01-ai-builder-stories.md) | Ready |
| US-F01-09 | Mobile Web UX — Input Form & Immersive Preview | [F01-ai-builder-stories.md](../stories/F01-ai-builder-stories.md) | Ready |
| US-F01-10 | Mobile Web UX — Touch-Safe Block Reordering | [F01-ai-builder-stories.md](../stories/F01-ai-builder-stories.md) | Ready |

---

## 1. Problem Statement

Hiện tại, các chủ doanh nghiệp SME thường mất từ 30-60 phút để cấu hình các website builder (chọn template → điền form dài → upload ảnh → cấu hình SEO). Họ cần một cách để **cung cấp thông tin cơ bản về doanh nghiệp** thông qua một form đơn giản có chọn sẵn ngành nghề, và có ngay một website hoàn chỉnh, đẹp mắt lập tức nhờ AI.

Phiên bản v1 chỉ có builder thủ công. Phiên bản v2 lấy AI làm trải nghiệm cốt lõi — đây là **#1 USP** (Unique Selling Proposition) của PrimeWeb. Cập nhật từ Chat-based sang Form-based (Structured Input) giúp thu thập dữ liệu chính xác và dự đoán được kết quả tốt hơn.

---

## 2. Target User

- Chủ doanh nghiệp SME (tiệm nhỏ, freelancer), không có kỹ năng lập trình (no technical skills)
- Có thể nhập dữ liệu bằng Tiếng Việt, Bahasa Melayu, Tiếng Anh, hoặc Manglish
- Muốn có một website chuyên nghiệp trong **< 5 phút** (từ lúc đăng ký → publish)
- Muốn cung cấp thông tin rõ ràng một lần, thay vì phải chat qua lại nhiều bước gây bối rối

---

## 3. Solution Overview

Người dùng truy cập vào `/builder/new`, điền thông tin doanh nghiệp vào 4 trường nhập liệu cơ bản (Tên doanh nghiệp, Ngành nghề/Lĩnh vực, Mô tả ngắn, Mặt hàng/Dịch vụ). AI sẽ phân tích input và stream phản hồi, xây dựng tự động một website đa trang hoàn chỉnh (block-by-block) với quyền live preview ở khung bên phải. Khi hoàn tất, người dùng có thể kéo thả thay đổi vị trí block, tinh chỉnh trong Editor hoặc publish ngay lập tức.

---

## 4. Scope

### In Scope
- Nhập thông tin qua form (Tên, Lĩnh vực, Mô tả, Dịch vụ) → generate toàn bộ site thông qua SSE streaming (US-F01-01, US-F01-05)
- Validate form ngay tại chỗ trước khi gọi AI (US-F01-05)
- Tự động generate ảnh (AI image generation) cho hero banner (US-F01-03)
- Publish URL `{slug}.primeweb.app` chỉ với 1 click (US-F01-04)
- Tự động lưu bản nháp (Auto-save draft) + khôi phục phiên làm việc (session recovery)
- Nội dung site được generate theo ngôn ngữ input của người dùng, dự phòng (fallback) về tiếng Anh (US-F01-06)
- Bắt buộc tạo đủ 4 trang: Homepage, About Us, Products & Services, Contact Us (US-F01-01)
- Layout thay đổi linh hoạt tùy theo danh mục business (US-F01-01)
- Môi trường Mobile Web: Vertical input form trực quan, sau đó hiển thị chế độ Immersive Preview full-screen và UI Reordering thân thiện chạm (Touch-safe) (US-F01-09, US-F01-10)
- Cho phép người dùng thao tác Drag-and-drop đổi vị trí Block ở Preview Panel ngay tại màn hình builder (Desktop) (US-F01-08)

### Out of Scope
- Custom domain (Sẽ xử lý ở Wave 6+)
- Generate xuất nhiều ngôn ngữ (Multi-language site) trong cùng 1 lần chạy
- Luồng trò chuyện (Chatbot) thu thập thông tin qua nhiều bước
- Video background hoặc tùy chỉnh custom HTML/CSS code blocks

---

## 5. Success Metrics

| Metric | Target | Measured By |
|--------|--------|-------------|
| Time: register → first published site | < 10 min | PostHog funnel |
| AI generation success rate | > 95% | Sentry error rate |
| Generation time (p95) | < 60 seconds | Custom SSE timing |
| User satisfaction (post-generation) | > 8/10 | In-app survey |
| Form completion rate | > 80% | PostHog funnel |

---

## 6. User Story Summary

```
AS A   newly registered SME owner
I WANT TO điền thông tin vào ô nhập liệu (Tên doanh nghiệp, Ngành nghề/Lĩnh vực, Mô tả ngắn, Mặt hàng/Dịch vụ)
SO THAT AI tạo đầy đủ website phù hợp và chính xác
```

> Source: [US-F01-01](../stories/F01-ai-builder-stories.md#us-f01-01)

---

## 7. Functional Requirements

| FR-ID | Requirement | Story Ref | Priority | Notes |
|-------|-------------|-----------|----------|-------|
| FR-01 | AI must stream response within < 2 seconds of prompt submission | US-F01-01 | P0 | SSE streaming |
| FR-02 | Complete site generation in < 60 seconds | US-F01-01 | P0 | Min 8 blocks |
| FR-03 | Live preview updates block-by-block in realtime | US-F01-01 | P0 | iframe sandboxed |
| FR-04 | User inputs data via a fixed Form (Name, Industry, Description, Services) | US-F01-05 | P0 | No multi-turn chat |
| FR-05 | Form validates required fields before hitting AI endpoint | US-F01-05 | P0 | Avoid incomplete prompts |
| FR-06 | Auto-save draft to DB after generation | US-F01-01 | P0 | Payload CMS |
| FR-07 | Session recovery: return to /builder/new shows draft | US-F01-01 | P0 | 24h validity |
| FR-08 | Error toast + retry without re-entering form data | US-F01-01 | P0 | |
| FR-09 | Template flow: /templates → select → /editor/:id | US-F01-02 | P1 | Backup flow |
| FR-10 | AI generates hero image (1200×400px) via DALL-E | US-F01-03 | P0 | CDN upload |
| FR-11 | Fallback stock image if image API fails | US-F01-03 | P0 | Never broken image |
| FR-12 | User can regenerate any AI image | US-F01-03 | P1 | |
| FR-13 | One-click publish to {slug}.primeweb.app in < 30s | US-F01-04 | P0 | |
| FR-14 | Unpublish: site returns 404 | US-F01-04 | P0 | |
| FR-15 | Rate limit: Tất cả gói chỉ được generate 1 site duy nhất. Lỗi → cho retry, không tính quota. Thành công → ẩn builder. | US-F01-01 | P0 | Áp dụng mọi gói (freemium/starter/standard/professional). Chưa có rate limits khác nhau giữa các gói. |
| FR-16 | Site content generated in user's input language (BM / VI / EN) | US-F01-06 | P0 | Fallback to EN if language unsupported |
| FR-17 | Generated site must include 4 pages: Homepage, About, Products, Contact | US-F01-01 | P0 | Nav menu links to all 4 |
| FR-18 | Layout selected based on business category parsed from input | US-F01-01 | P0 | Color, font, block order per category |
| FR-19 | Post-publish screen: show `{slug}.primeweb.app` with copy-to-clipboard | US-F01-07 | P0 | Toast on copy |
| FR-20 | Post-publish: "Go to Admin Dashboard" redirects to /admin | US-F01-07 | P0 | No re-login required |
| FR-21 | Drag handle appears on hover for reorderable blocks in builder preview | US-F01-08 | P0 | Exclude Navigation & Footer |
| FR-22 | Block reorder persisted to DB (Page.layout sortOrder) on confirm/publish | US-F01-08 | P0 | Works on Desktop & Mobile |
| FR-23 | [Mobile] Layout thay form nhập liệu thành dạng dọc (Vertical) chữ >16px chống auto-zoom và nút Submit sticky dính cạnh đáy để không bị bàn phím che khuất. | US-F01-09 | P0 | Ergonomics |
| FR-24 | [Mobile] Khi nhấn Tạo Website ở mobile, form trượt đi nhường 100% diện tích màn hình cho Live Preview tự render (Immersive). | US-F01-09 | P0 | See-through view |
| FR-25 | [Mobile] Thông báo tiến trình khởi tạo (SSE events) và các lỗi phải hiển thị dưới dạng một thẻ (Floating Pill) nằm cuối màn hình để không chắn preview. | US-F01-09 | P0 | Bottom Sheet |
| FR-26 | [Mobile] Để đổi vị trí block trên màn hình hẹp, cung cấp List Mode chuyên sắp xếp (native DOM items dễ kéo chạm) hoặc nút Up/Down thay vì kéo thả iframe dễ xung đột với scroll. | US-F01-10 | P0 | Touch safe UI |

---

## 8. Business Rules

- **BR-01:** Mọi query phải scope theo `tenant` — user chỉ thấy sites của mình
- **BR-02:** Soft delete only — không bao giờ hard delete site record
- **BR-03:** Rate limit được bắt buộc kiểm tra TRƯỚC khi gọi OpenAI API (tránh lãng phí credits)
- **BR-04:** Content/Images do AI generate được dán nhãn "AI Generated ✨" trong editor, ẩn nhãn này trên site live (storefront)
- **BR-05:** Draft bản nháp có hiệu lực trong 24 giờ — sau đó có thể bị tự động clear
- **BR-06 (Content Safety):** Hệ thống phải từ chối các input form chứa từ khóa nhạy cảm, bạo lực, NSFW trước khi gọi AI API
- **BR-07 (Quota Protection):** Nếu quá trình generate thất bại do server/API (timeout), User KHÔNG bị trừ credit/quota 
- **BR-08 (Language Detection):** Hệ thống tự động nhận diện ngôn ngữ từ form input để tạo content phù hợp
- **BR-09 (Data Retention):** Các site ở trạng thái Draft sẽ bị cronjob (Payload CMS) xóa sau 30 ngày để dọn rác DB
- **BR-10 (SSO Status Block):** Nếu workspace đang ở trạng thái `suspended` (inactivated) hoặc `terminated`:
  - KHÔNG cho phép generate site mới (block trước khi gọi AI API).
  - KHÔNG cho phép publish website.
  - KHÔNG cho phép truy cập editor.
  - Hiển thị thông báo: "Tài khoản của bạn đang bị tạm khóa/đã bị xóa. Vui lòng liên hệ nhà cung cấp dịch vụ."
- **BR-11 (Terminated → Auto Unpublish):** Khi workspace chuyển sang trạng thái `terminated`, hệ thống tự động unpublish tất cả website của workspace đó. URL `{slug}.primeweb.app` trả về 404.

---

## 9. User Flow

```text
/builder/new (đã xác thực - authenticated)
  ↓
Hệ thống check workspace status:
  ├── suspended → hiển thị "Tài khoản đang bị tạm khóa" → DỪNG
  ├── terminated → hiển thị "Tài khoản đã bị xóa" → DỪNG
  └── active → tiếp tục
  ↓
User điền thông tin vào Form (Tên doanh nghiệp, Lĩnh vực, Mô tả, Dịch vụ)
  ↓
Hệ thống validate form input
  ↓
User click "Tạo Website"
  ↓
  ├── Sinh URL slug tự động (vd: /my-cake-shop)
  ├── AI stream quá trình generate site (SSE)
  │     ├── nhận sự kiện block_complete → preview cập nhật realtime
  │     ├── nhận sự kiện theme_set → giao diện apply color/font mới
  │     └── nhận sự kiện done → Màn hình chúc mừng + CTAs {"Tinh chỉnh" | "Publish ngay"}
  │
  ├── Lỗi → hiển thị toast đỏ + "Thử lại" (giữ nguyên state nhập liệu)
  └── Vượt quá giới hạn (Rate limit) → hiển thị modal mời upgrade (Upgrade Prompt)
```

---

## 10. Screen Layout

> **[Global CMS Constraint]** Đối với các tính năng quản trị, yêu cầu bắt buộc phải render bên trong Main Content Area của F18 CMS Layout (ngoại trừ các tính năng đặc thù cần Full-screen Editor).

> **[BẮT BUỘC]** Liệt kê chi tiết các màn hình (screens) và các state quan trọng (ví dụ: Empty, Loading, Error, Success). Mỗi màn hình cần mô tả UI component chính và luồng hiển thị.

> **[Wireframe & Design Rule]** Không cần dùng ASCII để minh hoạ. Dẫn nguồn trực tiếp từ wireframe ở thư mục design nếu có.
> **[Quy tắc Cập nhật]** Mỗi khi 1 design/wireframe mới được thêm, BẮT BUỘC phải bổ sung ở Screen Layout đường dẫn tới file đó.

### 10.1. Màn hình chính (Builder Screen)
- **Mô tả:** Màn hình chính cho phép user nhập form để AI generate website và xem live preview.
- **Components chính:**
  - Form Panel (Left): [Các trường input Tên DN, Lĩnh vực, Mô tả, Dịch vụ, Nút Generate]
  - Live Preview (Right): [Hiển thị website được generate block-by-block dạng iframe, thao tác drag-and-drop]
- **Design / Wireframe:**
  - [Link tới file wireframe/design trong thư mục docs/design/...]text
  - [Link tới file wireframe/design trong thư mục docs/design/...]

### 10.2. Các trạng thái UI (UI States) & Modals
- **Empty State:** Form sạch sẽ với placeholder rõ ràng. Banner preview trống.
- **Loading State:** Live Preview hiển thị skeleton UI và progress indicator block-by-block mượt mà bằng SSE.
- **Error State / Edge Cases:** Form giữ nguyên data, hiển thị Toast báo lỗi màu đỏ kèm nút "Thử lại". Rate limit popup thông báo Upgrade.
- **Success State (Post-Publish Modal):** Hiển thị Modal/Toast chúc mừng kèm liên kết copy link website (`{slug}.primeweb.app`) và nút "Đến Dashboard".

**Wireframe Mobile Reorder Mode (< 768px):**
```text
  - [Link tới file wireframe/design trong thư mục docs/design/...]

**Wireframe Success Modal:**
```text
  - [Link tới file wireframe/design trong thư mục docs/design/...]

---


## 11. Acceptance Criteria

> Note: All Chat ACs have been replaced with Form ACs mapped from `F01-ai-builder-stories.md`. Refer to the story file for detailed Gherkin ACs.

### AC-1: Generate Site từ Form Nhập Liệu
Khi người dùng nhập đúng Tên doanh nghiệp, Chọn lĩnh vực, Mô tả ngắn, Mặt hàng/Dịch vụ và nhấn "Tạo Website", AI phải sinh ra website thông qua SSE realtime trong vòng < 60 giây và đầy đủ 4 trang. *(Source: US-F01-01)*

### AC-2: Field Validation
Trường "Tên doanh nghiệp", "Lĩnh vực" và "Mặt hàng/Dịch vụ" bị bỏ trống sẽ báo lỗi và form không cho phép submit. Khóa input trong quá trình generate. *(Source: US-F01-05)*

### AC-3: Drag-and-Drop Block Reorder
Người dùng có thể kéo thả các sections trong live preview để thay đổi vị trí. Vị trí Footer và Navigation là cố định. *(Source: US-F01-08)*

### AC-4: CMS Redirect post-Generation
Sau khi ấn Confirm & Publish, URL thực (`{slug}.primeweb.app`) hiển thị, cùng tuỳ chọn redirect vào Admin Dashboard của CMS. *(Source: US-F01-07)*

### AC-5: Multilingual Output by Input Language
Nếu nội dung input ở form là tiếng Malay, trang web hoàn chỉnh ra tiếng Malay. Nếu tiếng Việt, ra tiếng Việt. *(Source: US-F01-06)*

### AC-6: AI Image Generation
Banner Hero sẽ được generate ảnh tự động (1200x400) thông qua DALL-E. Nếu call API thất bại, fallback sang stock image. *(Source: US-F01-03)*

### AC-7: Trải Nghiệm Nhập Form và Preview Mobile (Touch-Device)
Khi ở màn hình nhỏ (<768px), form nhập liệu xếp dọc với nút "Tạo Website" sticky ở đáy. Khi bấm Tạo, form tự động trượt (collapse/slide away) nhường chỗ cho Immersive Preview 100vh để user xem live generate, kèm theo 1 bảng Bottom Sheet mini (Floating Pill) góc dưới báo hiệu tiến trình đang diễn ra mà KHÔNG chắn mất UI site đang build ở chế độ nền. *(Source: US-F01-09)*

### AC-8: Sắp Xếp Block Thân Thiện Chạm (Touch-safe Mobile)
Người dùng mobile có View Mode "Sắp xếp bố cục" biến màn hình preview HTML thành một danh sách các Thẻ Khối (Card List). Kéo thả các Card nhỏ gọn được native hỗ trợ giúp tránh xung đột với scroll dọc gốc của iframe. *(Source: US-F01-10)*

---

## 12. Non-Functional Requirements

| Category | Requirement | Notes |
|----------|-------------|-------|
| **Performance** | SSE stream starts < 2s, full generation < 60s (p95) | |
| **Security** | Route requires auth — 401 → /login | |
| **Accessibility** | WCAG 2.1 AA, keyboard navigable | |
| **Mobile support** | Mobile 375px rendering with Form/Preview toggle | |
| **AI Cost** | GPT-4o cho generation, DALL-E cho images | Ref: SPEC §7.2 |

---

## 13. Technical Architecture

### 13.1 Components

| Component | File | Description |
|-----------|------|-------------|
| `BuilderPage` | `app/(builder)/builder/new/page.tsx` | Page layout orchestrator |
| `BuilderFormPanel` | `components/builder/BuilderFormPanel.tsx` | Left input form (380px) |
| `BuilderPreview` | `components/builder/BuilderPreview.tsx` | iframe preview |
| `BuilderProgress` | `components/builder/BuilderProgress.tsx` | Step-by-step progress |
| `useAIStream` | `hooks/useAIStream.ts` | SSE consumer hook |
| `builderStore` | `store/builderStore.ts` | Zustand state |

### 13.2 API Endpoints

```
POST /api/ai/generate-site → text/event-stream (SSE)
Request: { businessName: string, industry: string, description: string, services: string, siteId: string }
Response: SSE stream (step | block_complete | theme_set | seo_generated | error | done)
Auth: Bearer JWT (required)
Rate Limit: Tất cả gói = 1 lần duy nhất (thành công → ẩn builder, lỗi → cho retry). Chưa có rate limits khác nhau giữa các gói.
```

---

## 16. Open Questions

| # | Question | Owner | Status |
|---|----------|-------|--------|
| 1 | Tất cả gói chỉ gen 1 lần — có cần sandbox mode cho demo/test không? | PO | ⬜ Open |
| 2 | AI image generation (DALL-E) cost per call có được track riêng theo tenant không? | Tech Lead | ⬜ Open |
| 3 | ~~Sau khi generate xong, user có thể re-generate toàn bộ site?~~ | BA | ✅ Resolved — Không. Tất cả gói chỉ gen 1 lần. Lỗi → retry. Thành công → chỉ edit, không gen lại. |
| 4 | Mobile preview toggle ([📝 Form] [👁 Preview]) — Preview có cần hiển thị realtime update hay chỉ show kết quả cuối? | Design | ⬜ Open |

---

## 17. 9-Point Done Checklist

- [ ] Loading State — Progress indicator block-by-block khi AI đang stream
- [ ] Empty State — `/builder/new` hiển thị form clean với placeholders hướng dẫn
- [ ] Error State — Toast đỏ + "Thử lại" khi AI generation fail; giữ nguyên form data
- [ ] Form Validation — Tên doanh nghiệp, Lĩnh vực và Mặt hàng/Dịch vụ là required fields
- [ ] Button States — "Tạo Website" disabled trong khi generating; enabled sau khi done
- [ ] Toast Feedback — Toast xanh "Link copied! 🎉" khi copy domain; toast success post-publish
- [ ] Auth Redirect — Route /builder/new yêu cầu auth → 401 redirect /login
- [ ] Mobile 375px — Form full-width; Preview hidden mặc định với toggle [📝 Form] [👁 Preview]
- [ ] TypeScript Clean — `tsc --noEmit` pass

---

## 18. Definition of Ready

- [ ] PRD updated to Form Builder format (v2.1)
- [ ] User Stories (US-F01-01 to US-F01-08) approved và linked ở Section 0
- [ ] AC ở Section 11 đã được copy từ story file
- [ ] FR ở Section 7 có đầy đủ Story Ref
- [ ] Architecture diagrams updated to match Form Panel (`docs/architecture/F01-ai-builder.md`)
- [ ] API contract defined (SSE streaming endpoint)
- [x] Rate limit: đã chốt tất cả gói chỉ gen 1 lần. Chưa có rate limits khác nhau giữa các gói (freemium/starter/standard/professional).
- [ ] AI image fallback strategy confirmed với Dev

---

## 19. Definition of Done

- [ ] All FR items (FR-01 to FR-22) implemented và verified
- [ ] All AC in Section 11 pass (traced back to story)
- [ ] 9-Point Checklist all pass
- [ ] QA report written (`docs/qa/F01-ai-builder.md`)
- [ ] Generation time < 60s (p95) — verified trên staging
- [ ] Multilingual output: BM, VI, EN tested với real inputs
- [ ] Mobile 375px form/preview toggle verified on real device
- [ ] Non-Functional Requirements validated

