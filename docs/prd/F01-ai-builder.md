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

---

## 1. Problem Statement

Hiện tại, các chủ doanh nghiệp SME thường mất từ 30-60 phút để cấu hình các website builder (chọn template → điền form dài → upload ảnh → cấu hình SEO). Họ cần một cách để **cung cấp thông tin cơ bản về doanh nghiệp** thông qua một form đơn giản, và có ngay một website hoàn chỉnh, đẹp mắt lập tức nhờ AI.

Phiên bản v1 chỉ có builder thủ công. Phiên bản v2 lấy AI làm trải nghiệm cốt lõi — đây là **#1 USP** (Unique Selling Proposition) của PrimeWeb. Cập nhật từ Chat-based sang Form-based (Structured Input) giúp thu thập dữ liệu chính xác và dự đoán được kết quả tốt hơn.

---

## 2. Target User

- Chủ doanh nghiệp SME (tiệm nhỏ, freelancer), không có kỹ năng lập trình (no technical skills)
- Có thể nhập dữ liệu bằng Tiếng Việt, Bahasa Melayu, Tiếng Anh, hoặc Manglish
- Muốn có một website chuyên nghiệp trong **< 5 phút** (từ lúc đăng ký → publish)
- Muốn cung cấp thông tin rõ ràng một lần, thay vì phải chat qua lại nhiều bước gây bối rối

---

## 3. Solution Overview

Người dùng truy cập vào `/builder/new`, điền thông tin doanh nghiệp vào 3 trường nhập liệu cơ bản (Tên doanh nghiệp, Mô tả ngắn, Mặt hàng/Dịch vụ). AI sẽ phân tích input và stream phản hồi, xây dựng tự động một website đa trang hoàn chỉnh (block-by-block) với quyền live preview ở khung bên phải. Khi hoàn tất, người dùng có thể kéo thả thay đổi vị trí block, tinh chỉnh trong Editor hoặc publish ngay lập tức.

---

## 4. Scope

### In Scope
- Nhập thông tin qua form (Tên, Mô tả, Dịch vụ) → generate toàn bộ site thông qua SSE streaming (US-F01-01, US-F01-05)
- Validate form ngay tại chỗ trước khi gọi AI (US-F01-05)
- Tự động generate ảnh (AI image generation) cho hero banner (US-F01-03)
- Publish URL `{slug}.primeweb.app` chỉ với 1 click (US-F01-04)
- Tự động lưu bản nháp (Auto-save draft) + khôi phục phiên làm việc (session recovery)
- Nội dung site được generate theo ngôn ngữ input của người dùng, dự phòng (fallback) về tiếng Anh (US-F01-06)
- Bắt buộc tạo đủ 4 trang: Homepage, About Us, Products & Services, Contact Us (US-F01-01)
- Layout thay đổi linh hoạt tùy theo danh mục business (US-F01-01)
- Cho phép người dùng thao tác Drag-and-drop đổi vị trí Block ở Preview Panel ngay tại màn hình builder (US-F01-08)

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
I WANT TO điền thông tin vào ô nhập liệu (Tên doanh nghiệp, Mô tả ngắn, Mặt hàng/Dịch vụ)
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
| FR-04 | User inputs data via a fixed Form (Name, Description, Services) | US-F01-05 | P0 | No multi-turn chat |
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
| FR-15 | Rate limit: Free tier = 1 generation total | US-F01-01 | P0 | Ref: SPEC §7.3 |
| FR-16 | Site content generated in user's input language (BM / VI / EN) | US-F01-06 | P0 | Fallback to EN if language unsupported |
| FR-17 | Generated site must include 4 pages: Homepage, About, Products, Contact | US-F01-01 | P0 | Nav menu links to all 4 |
| FR-18 | Layout selected based on business category parsed from input | US-F01-01 | P0 | Color, font, block order per category |
| FR-19 | Post-publish screen: show `{slug}.primeweb.app` with copy-to-clipboard | US-F01-07 | P0 | Toast on copy |
| FR-20 | Post-publish: "Go to Admin Dashboard" redirects to /admin | US-F01-07 | P0 | No re-login required |
| FR-21 | Drag handle appears on hover for reorderable blocks in builder preview | US-F01-08 | P0 | Exclude Navigation & Footer |
| FR-22 | Block reorder persisted to DB (Page.layout sortOrder) on confirm/publish | US-F01-08 | P0 | Works on Desktop & Mobile |

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

---

## 9. User Flow

```text
/builder/new (đã xác thực - authenticated)
  ↓
User điền thông tin vào Form (Tên doanh nghiệp, Mô tả, Dịch vụ)
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

```
┌─ /builder/new ─────────────────────────────────────────┐
│  ┌──────────────┐          ┌──────────────────────┐    │
│  │  FORM PANEL  │          │    LIVE PREVIEW       │    │
│  │  (380px)     │          │    (remaining width)  │    │
│  │ [Tên DN]     │          │  [skeleton loading]   │    │
│  │ [Mô tả]      │  ──→     │  Nav → Hero → About   │    │
│  │ [Dịch vụ]    │          │  → Contact → Footer   │    │
│  │              │          │                       │    │
│  │ [Generate]   │          │                       │    │
│  │              │          │  Draft badge          │    │
│  │              │          │                       │    │
│  └──────────────┘          └──────────────────────┘    │
└─────────────────────────────────────────────────────────┘

Mobile (< 768px):
  Form = full width | Preview hidden (toggle: [📝 Form] [👁 Preview])
```

---

## 11. Acceptance Criteria

> Note: All Chat ACs have been replaced with Form ACs mapped from `F01-ai-builder-stories.md`. Refer to the story file for detailed Gherkin ACs.

### AC-1: Generate Site từ Form Nhập Liệu
Khi người dùng nhập đúng Tên doanh nghiệp, Mô tả ngắn, Mặt hàng/Dịch vụ và nhấn "Tạo Website", AI phải sinh ra website thông qua SSE realtime trong vòng < 60 giây và đầy đủ 4 trang. *(Source: US-F01-01)*

### AC-2: Field Validation
Trường "Tên doanh nghiệp" và "Mặt hàng/Dịch vụ" bị bỏ trống sẽ báo lỗi và form không cho phép submit. Khóa input trong quá trình generate. *(Source: US-F01-05)*

### AC-3: Drag-and-Drop Block Reorder
Người dùng có thể kéo thả các sections trong live preview để thay đổi vị trí. Vị trí Footer và Navigation là cố định. *(Source: US-F01-08)*

### AC-4: CMS Redirect post-Generation
Sau khi ấn Confirm & Publish, URL thực (`{slug}.primeweb.app`) hiển thị, cùng tuỳ chọn redirect vào Admin Dashboard của CMS. *(Source: US-F01-07)*

### AC-5: Multilingual Output by Input Language
Nếu nội dung input ở form là tiếng Malay, trang web hoàn chỉnh ra tiếng Malay. Nếu tiếng Việt, ra tiếng Việt. *(Source: US-F01-06)*

### AC-6: AI Image Generation
Banner Hero sẽ được generate ảnh tự động (1200x400) thông qua DALL-E. Nếu call API thất bại, fallback sang stock image. *(Source: US-F01-03)*

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
Request: { businessName: string, description: string, services: string, siteId: string }
Response: SSE stream (step | block_complete | theme_set | seo_generated | error | done)
Auth: Bearer JWT (required)
Rate Limit: Free=1 total, Starter=5/mo, Pro=20/mo, Business=unlimited
```

---

## 14. Definition of Ready & Done
- [ ] PRD updated to Form Builder format.
- [ ] Stories tracked.
- [ ] Architecture diagrams updated to match Form Panel.

*(Remaining checks equivalent to F01 v2.0 checklist)*
