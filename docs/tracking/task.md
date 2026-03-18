# PrimeWeb — Build Checklist (Auth-First Flow)

## Wave 1: Foundation (✅ Done)
- [x] Next.js 15 + Payload CMS 3 + Docker
- [x] 7 Payload Collections (Tenants, Users, Sites, Pages, Media, Templates, Subscriptions)
- [x] Multi-tenant middleware (subdomain + custom domain)
- [x] SSR Site Renderer + 8 core blocks
- [x] Marketing homepage
- [x] Cursor rules (always, frontend, ai-features, cms-blocks)
- [x] SPEC.md v3.0 (BMAD, 19 sections)
- [x] BMAD AI-Factory Lite (.ai/ + docs/)
- [x] Git + GitHub setup (clean structure)

## Wave 2: Auth + Onboarding (🔄 Current — follows user journey)

### 2.1 Auth Flow ← **NEXT**
> **Chi tiết từ PRD F02**
**Backend & Database**
- [ ] Cập nhật DB: `Users` (thêm Role, 2FaConfig), `Tenants` (thêm Company, BRN, Phone)
- [ ] API Endpoints: `/api/users/register`, `login`, `verify-otp`, `logout`, `forgot-password`, `reset-password`
- [ ] Logic Register: Auto-create 1 Tenant cho Owner, check email unique toàn hệ thống
- [ ] Xử lý Email: Tích hợp Resend gửi Welcome Email (HTML banner) và 2FA OTP
- [ ] Auth Guard: Middleware bảo vệ (/dashboard, /builder...), auto-route Owner vs Staff, redirect 401 về /login

**Frontend UI/UX**
- [ ] `AuthLayout`: Dựng layout Split-Screen (Banner trái + Form card phải)
- [ ] `LoginPage`: Giao diện login, trim khoảng trắng, call API login xử lý OTP/Direct
- [ ] `RegisterPage`: Form đăng ký chi tiết (Email, Pass validation 8 ký tự, Name, Company, BRN...)
- [ ] `OTPPage`: Form nhập 6 số xác thực 2FA
- [ ] `ForgotPasswordPage` & `ResetPasswordPage`: Luồng quên mật khẩu bảo mật (always success UI)
- [ ] Test Mobile responsive: Stack column layout, 44px tap targets

### 2.2 Onboarding
- [ ] Onboarding Welcome (`/onboarding`) — post-register landing
- [ ] Store Basic Setup (`/onboarding/setup`) — slug, delivery defaults
- [ ] → redirects to AI Builder

### 2.3 Dashboard (✅ Done)
- [x] Dashboard BMAD Run (PRD → Arch → Dev → QA ✅ PASS)
- [x] 6 components (Greeting, Stats, SiteGrid, EmptyState, Banner, Skeleton)

## Wave 2.5: UX Quick Wins (Done)
- [x] Sidebar: remove "Soon" items (SEO, Analytics, Billing)
- [x] Site cards: gradient thumbnails + initials (no more globe icons)
- [x] Stats: only real data (total sites, published count, storage)
- [x] Empty state: two-path cards (AI Builder + Template Gallery)
- [x] Editor: block fields editable (headline, subheadline, ctaText, description)
- [x] UX Audit report created and copied to docs/tracking/

## Wave 3: AI Core (Done)

### 3.1 AI Chat Builder
> **Chi tiết từ PRD F01**
**Backend & Database**
- [x] Rule-based block generator (5 business types × 7 blocks)
- [x] Hành vi tạo Site + Page vào DB (POST `/api/ai/generate-site`)
- [ ] Tích hợp OpenAI GPT-4o cho generation stream
- [ ] Server Action: `generateSite` hỗ trợ SSE streaming (step, block_complete, theme_set)
- [ ] Payload CMS: Thêm `sites.aiContext` và bảng `ai-messages`
- [ ] Kiểm tra Rate limit: Free = 1 generation
- [ ] AI Image: Tích hợp DALL-E 3 tạo Hero banner tự động + CDN upload

**Frontend UI/UX**
- [x] Khung UI: Full-screen chat + preview layout cơ bản
- [ ] `BuilderPage`: Orchestrator layout quản lý state
- [ ] `BuilderChatPanel`: AI Welcome (tiếng Anh có gợi ý), auto detect ngôn ngữ chat user
- [ ] `BuilderPreview`: iframe render blocks realtime từ SSE `block_complete` event
- [ ] `BuilderProgress`: Thanh tiến trình (tiến độ theo từng step)
- [ ] `useAIStream` Hook: Tiêu thụ SSE, xử lý event
- [ ] Store `builderStore`: Zustand state (messages, blocks, theme, status)
- [ ] Tính năng kéo thả: DND block reorder trong UI Preview (lưu Payload DB layout sortOrder)
- [ ] Draft recovery: Khôi phục bản nháp khi user quay lại (`DraftRecoveryDialog`)
- [ ] Luồng Post-Generation: Confirm & hiển thị domain copy link, tuỳ chọn "Tinh chỉnh" / "Publish chạy"

### 3.2 AI Editor
- [x] 3-panel layout: block list + live iframe preview + settings panel
- [x] Live preview via /api/preview/[siteId] (8 block types → standalone HTML)
- [x] Publish flow (1-click → update status + timestamp)
- [x] Save API (/api/sites/[siteId]/save) — blocks + theme to DB
- [x] Live theme editing (color picker, font selectors, dark/light toggle)
- [x] Block delete/duplicate with unsaved changes indicator
- [ ] Inline text editing in preview (Phase 2)
- [ ] Drag-and-drop block reorder

### 3.3 Template Gallery
- [x] Template Gallery page (/templates) with category filter + search
- [x] 6 preset templates (Business, Restaurant, E-commerce, Portfolio, Blog, Agency)
- [x] Seed API (/api/templates/seed)
- [x] Apply-template API (creates site from template's default blocks)
- [ ] Template thumbnail previews (screenshots)

## Wave 4: Commerce + SEO + Storefront
- [ ] Products CRUD + AI description
- [ ] Orders management
- [ ] Payment (FPX, GrabPay, card)
- [ ] Delivery (J&T, Pos Laju)
- [ ] SEO Dashboard + AI SEO
- [ ] Public storefront SSR + JSON-LD

## Wave 5: Polish + Test + Launch
- [ ] Playwright E2E tests
- [ ] Core Web Vitals > 90
- [ ] Custom domain (Cloudflare API)
- [ ] Security audit
- [ ] UAT + Launch
