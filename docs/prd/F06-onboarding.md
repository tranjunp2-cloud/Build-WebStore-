# PRD: Onboarding Flow (F06)
> **Version:** 3.0 | **Updated:** 2026-03-17 | **Agent:** `project-planner`
> **Priority:** P0 | **Sprint:** Wave 1 | **Size:** M
> **Depends on:** F02 Auth ✅ | **Blocks:** F01 AI Builder, F07 Templates

---

> [!IMPORTANT]
> **Stories-First Rule:** PRD này được xây dựng từ các User Stories đã approve.
> Mọi FR phải có Story Ref. AC được copy từ story file. Không tự mở rộng scope.

---

## 0. Story Traceability

| Story ID | Title | File | Status |
|----------|-------|------|--------|
| US-F06-01 | User Registration & Auto-Login | [F06-onboarding-stories.md](../stories/F06-onboarding-stories.md) | Ready |
| US-F06-02 | Welcome Screen — Zero Friction | [F06-onboarding-stories.md](../stories/F06-onboarding-stories.md) | Ready |
| US-F06-03 | AI Feature Discovery Wizard | [F06-onboarding-stories.md](../stories/F06-onboarding-stories.md) | Ready |

---

## 1. Problem Statement

After registering, users arrive at a platform powered by AI but might treat it like a traditional CMS. If we force them to set up ecommerce details (slug, delivery fees) immediately, we create friction and delay their "Aha! Moment" with the AI capabilities. The onboarding flow must smoothly transition users into the platform and clearly explain *how* the AI features will support their work, rather than asking for administrative setups.

---

## 2. Target User

- SME owner newly signed up (Persona A from malaysia-market-context.md)
- No technical skills, first time using a website builder
- Wants to understand how the platform helps them instantly, with minimal typing.

---

## 3. Solution Overview

3-step optimized onboarding: 
(1) Registration + auto-login.
(2) Welcome screen with a single CTA → Jump straight to AI Builder.
(3) AI Discovery Wizard (CMS Welcome): When users enter the CMS dashboard for the first time, a minimal, 3-slide visual Carousel educates them strictly on *how* the core AI features (Editor, Content, SEO) support them. Zero commerce configuration here.

---

## 4. Scope

### In Scope
- Registration + email verification + auto-login (US-F06-01)
- Welcome screen with single CTA, skip option (US-F06-02)
- Fast-paced Carousel Modal (Wizard) explaining AI capabilities on first CMS visit (US-F06-03)

### Out of Scope
- Social login (Wave 6+)
- Store slug generation, delivery zones, taxation (Moved to F08 Publish Flow/Settings)
- Mandatory tasks or checklists that require user data entry.

---

## 5. Success Metrics

| Metric | Target | Measured By |
|--------|--------|-------------|
| Onboarding completion rate | > 80% | PostHog funnel |
| Registration to AI Builder time | < 30 seconds | Timing |
| Wizard Skip Rate | < 20% | PostHog (indicates wizard is truly quick/interesting) |

---

## 6. User Story Summary

```
AS A   newly registered user
I WANT được thấy cách các tính năng AI hỗ trợ công việc thay vì phải cài đặt thủ công
SO THAT tôi hiểu ngay giá trị của nền tảng và bắt đầu tạo website không rào cản
```

> Source: [US-F06-03](../stories/F06-onboarding-stories.md#us-f06-03)

---

## 7. Functional Requirements

| FR-ID | Requirement | Story Ref | Priority | Notes |
|-------|-------------|-----------|----------|-------|
| FR-01 | Verification email delivered < 60s sau register | US-F06-01 | P0 | Resend |
| FR-02 | Auto-login sau verify token (< 24h) + redirect /onboarding | US-F06-01 | P0 | |
| FR-03 | Duplicate email: inline error với link /login | US-F06-01 | P0 | NOT generic error |
| FR-04 | Welcome screen: single CTA "Create My Store" | US-F06-02 | P0 | No competing actions |
| FR-05 | CTA navigate /builder/new trong < 300ms | US-F06-02 | P0 | |
| FR-06 | Skip option / set up later → navigate /dashboard | US-F06-02 | P1 | |
| FR-07 | Hiển thị Modal Carousel "AI Discovery" 1 lần duy nhất tại CMS | US-F06-03 | P0 | Lần đầu truy cập Dashboard |
| FR-08 | Carousel Slide 1: Giới thiệu chức năng AI Editor | US-F06-03 | P0 | Title, Description, GIF |
| FR-09 | Carousel Slide 2: Giới thiệu chức năng AI Content | US-F06-03 | P0 | Title, Description, GIF |
| FR-10 | Carousel Slide 3: Giới thiệu chức năng AI SEO | US-F06-03 | P0 | Title, Description, GIF |
| FR-11 | Nút "Bỏ qua hướng dẫn" / "Khám phá CMS" đóng modal & lưu state | US-F06-03 | P0 | |

---

## 8. Business Rules

- **BR-01:** Redirect đã có site → /dashboard (skip welcome intro)
- **BR-02:** AI Discovery Wizard status (`has_seen_ai_wizard`) must be saved to user profile in DB so it doesn't show again on other devices or refreshes.
- **BR-03:** Verification token expires sau 24 giờ

---

## 9. User Flow & Onboarding Logic

### 9.1 The "First Time" Logic
The Onboarding Wizard (AI Discovery) relies on a database flag: `has_seen_ai_wizard` (boolean).
- If `false` (default for new accounts): Trigger Wizard immediately on CMS Dashboard load.
- If `true`: Skip Wizard, load normal Dashboard.

### 9.2 Step-by-Step Flow
```text
[1] User clicks Verify Email Link
    ↓ 
[2] Auto-Login Success → Redirect to /onboarding
    ↓
[3] Welcome Screen (1 CTA: "Bắt đầu thiết kế" → /builder/new)
    ↓
[4] User interacts with AI Builder (F01) → Completes or saves site draft
    ↓
[5] User navigates back to CMS Admin Dashboard (/dashboard)
    ↓
[6] System checks `has_seen_ai_wizard` == false
    ↓
[7] Trigger AI Discovery Wizard (Modal Carousel)
    ├── Slide 1 (AI Editor) → User clicks "Tiếp tục"
    ├── Slide 2 (AI Content) → User clicks "Tiếp tục"
    └── Slide 3 (AI SEO) → User clicks "Khám phá CMS ngay"
    ↓
[8] Close Modal
    ↓
[9] Fire API Patch: Update user record `has_seen_ai_wizard = true`
    ↓
[10] Full CMS Dashboard Access (Wizard never shows again)
```

---

## 10. Screen Layout & UI Philosophy

### 10.1 Design Principle
**"Minimal, Focus, No Complex Interaction"**
- The UI must be highly focused. Darken the background (backdrop) so the user only sees the modal.
- No form inputs, no checkboxes, no complicated nested settings.
- The visual (GIF/Image) must do the heavy lifting of explanation.

### 10.2 Modal Structure

```text
CMS Dashboard - Background is darkened (opacity 0.6)
┌──────────────────────────────────────────┐
│ ✦ Khám phá Quyền năng AI            [✕]  │
│                                          │
│   ┌──────────────────────────────────┐   │
│   │                                  │   │
│   │        [ 🖼️ GIF/Video ]          │   │
│   │      (Looping, Max 500KB)        │   │
│   │                                  │   │
│   └──────────────────────────────────┘   │
│                                          │
│  [Tiêu đề] Thiết kế bằng AI              │
│  [Mô tả] Hỗ trợ bạn thay đổi thiết kế... │
│                                          │
│           (●) (○) (○)  Indicator         │
│                                          │
│  [ Bỏ qua ] ───────────── [ Tiếp tục ]   │
└──────────────────────────────────────────┘
```

### 10.3 UI Components Requirements
- **Container:** Centered Modal (Max-width: 600px).
- **Header:** Simple Title + Close Button (Top Right).
- **Media Box:** 16:9 ratio container for the GIF. Must handle loading skeleton gracefully.
- **Typography:** Very readable. Heading (H3/H4), Body (14px-16px).
- **Actions:** 
  - Secondary Action (Left): "Bỏ qua hướng dẫn" (Text button).
  - Primary Action (Right): "Tiếp tục" (Solid button). On the last slide, changes to "Khám phá CMS ngay".
- **Pagination:** Simple dots `(●) (○) (○)` to show progress.

---

## 11. Acceptance Criteria

> AC được copy từ `F06-onboarding-stories.md`. Không tự thêm AC không có trong story.

### AC-1: Registration + Verification Email
> 📌 Source: [US-F06-01](../stories/F06-onboarding-stories.md) — AC-1

```gherkin
GIVEN I am on the registration page
WHEN  I submit a valid email + password (min 8 chars)
THEN  I receive a verification email within 60 seconds
  AND the page shows "Check your email" state
```

### AC-2: Auto-Login after Verification
> 📌 Source: [US-F06-01](../stories/F06-onboarding-stories.md) — AC-2

```gherkin
GIVEN I click the verification link in the email
WHEN  the token is valid and not expired (< 24h)
THEN  I am automatically logged in
  AND redirected to /onboarding (Welcome screen)
```

### AC-3: Welcome Screen Single CTA
> 📌 Source: [US-F06-02](../stories/F06-onboarding-stories.md) — AC-1

```gherkin
GIVEN user vừa register và xác thực thành công
WHEN  vào /onboarding
THEN  welcome screen có single primary CTA: "Create My Store"
  AND không có competing actions khác
  AND progress indicator: "Step 1 of 2: Create Store"
```

### AC-4: CMS AI Wizard - Slide Content
> 📌 Source: [US-F06-03](../stories/F06-onboarding-stories.md) — AC-2, AC-3, AC-4

```gherkin
GIVEN user đang xem AI Wizard lần đầu
WHEN  chuyển các slide
THEN  hiển thị đúng thông điệp hỗ trợ:
  - Slide 1: "AI Editor" (Hỗ trợ thay đổi thiết kế nhanh chóng qua chat)
  - Slide 2: "AI Content" (Hỗ trợ viết mô tả, blog tự động khi bí ý tưởng)
  - Slide 3: "AI SEO" (Hỗ trợ phân tích từ khóa, chấm điểm SEO tự động)
```

### AC-5: CMS AI Wizard - Dismissal
> 📌 Source: [US-F06-03](../stories/F06-onboarding-stories.md) — AC-5

```gherkin
GIVEN user mở Modal Wizard
WHEN  click "Bỏ qua hướng dẫn" hoặc hoàn thành Step 3
THEN  Modal đóng lại
  AND không bao giờ tự động hiện lại trong các lần đăng nhập sau (lưu state has_seen_onboarding_wizard = true)
```

---

## 12. Non-Functional Requirements

| Category | Requirement | Notes |
|----------|-------------|-------|
| **Performance** | CTA navigate < 300ms | No loading screen |
| **Media Delivery** | Wizard GIFs < 500KB each | Use optimized lazy-loading |
| **Device support** | Wizard scales down clean on 375px | |

---

## 13. Technical Architecture

### 13.1 Components

| Component | File | Description |
|-----------|------|-------------|
| `OnboardingPage` | `app/(frontend)/onboarding/page.tsx` | Welcome screen |
| `AIDiscoveryWizard` | `components/dashboard/AIDiscoveryWizard.tsx`| Carousel Modal for AI Features |

### 13.2 API Endpoints

```
PATCH /api/users/{id}                       → update has_seen_settings_wizard (or ai_wizard): true
Auth: required
```

---

## 14. Dependencies

| Dependency | Status | Action Needed |
|-----------|--------|---------------|
| F02 Auth | ✅ Done | — |
| Resend email | ✅ Configured | — |
| High-quality AI demo GIFs | ⏳ Pending | Designer cần thiết kế GIF |

---

## 17. 9-Point Done Checklist

| Item | Status |
|------|--------|
| Loading State | Skeleton / spinner khi load GIFs |
| Empty State | N/A |
| Error State | Toast lưu state fail |
| Form Validation | N/A |
| Button States | CTA Disabled while transitioning slides |
| Toast Feedback | N/A |
| Auth Redirect | 401 → /login |
| Mobile 375px | Modal fills screen natively, no overflow |
| TypeScript Clean | `tsc --noEmit` pass |

---

## 18. Definition of Ready

- [ ] User Stories approved và linked ở Section 0
- [ ] F02 Auth done ✅
- [ ] Asset GIFs/Videos cho 3 Slides đã sẵn sàng

---

## 19. Definition of Done

- [ ] All FR items implemented
- [ ] All AC pass
- [ ] Onboarding completion rate measurable in PostHog
- [ ] Wizard properly updates user document flag
