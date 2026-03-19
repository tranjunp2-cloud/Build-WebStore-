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
| US-F06-02 | Welcome Screen — Zero Friction | [F06-onboarding-stories.md](../stories/F06-onboarding-stories.md) | Ready |
| US-F06-03 | AI Feature Discovery Wizard | [F06-onboarding-stories.md](../stories/F06-onboarding-stories.md) | Ready |
| US-F06-04 | Mobile Web UX — Fullscreen Onboarding | [F06-onboarding-stories.md](../stories/F06-onboarding-stories.md) | Ready |

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

2-step optimized onboarding (sau khi Authentication ở F02 hoàn tất):
(1) Welcome screen with a single CTA → Jump straight to AI Builder.
(2) AI Discovery Wizard (CMS Welcome): When users enter the CMS dashboard for the first time, a minimal, 3-slide visual Carousel educates them strictly on *how* the core AI features (Editor, Content, SEO) support them. Zero commerce configuration here.

---

## 4. Scope

### In Scope
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
| FR-04 | Welcome screen: single CTA "Create My Store" | US-F06-02 | P0 | No competing actions |
| FR-05 | CTA navigate /builder/new trong < 300ms | US-F06-02 | P0 | |
| FR-06 | Skip option / set up later → navigate /dashboard | US-F06-02 | P1 | |
| FR-07 | Hiển thị Modal Carousel "AI Discovery" 1 lần duy nhất tại CMS | US-F06-03 | P0 | Lần đầu truy cập Dashboard |
| FR-08 | Carousel Slide 1: Giới thiệu chức năng AI Editor | US-F06-03 | P0 | Title, Description, GIF |
| FR-09 | Carousel Slide 2: Giới thiệu chức năng AI Content | US-F06-03 | P0 | Title, Description, GIF |
| FR-10 | Carousel Slide 3: Giới thiệu chức năng AI SEO | US-F06-03 | P0 | Title, Description, GIF |
| FR-11 | Nút "Bỏ qua hướng dẫn" / "Khám phá CMS" đóng modal & lưu state | US-F06-03 | P0 | |
| FR-12 | **[Mobile]** Layout Welcome screen: Nút thiết lập tràn viền 100% và dính (fixed) dưới cùng màn hình (Thumb zone). | US-F06-04 | P1 | |
| FR-13 | **[Mobile]** AI Discovery Carousel hỗ trợ Swipe gestures qua lại trên màn hình cảm ứng. | US-F06-04 | P1 | Tránh chạm nhầm nút nhỏ |

---

## 8. Business Rules

- **BR-01:** Redirect đã có site → /dashboard (skip welcome intro)
- **BR-02:** AI Discovery Wizard status (`has_seen_ai_wizard`) must be saved to user profile in DB so it doesn't show again on other devices or refreshes.

---

## 9. User Flow & Onboarding Logic

### 9.1 The "First Time" Logic
The Onboarding Wizard (AI Discovery) relies on a database flag: `has_seen_ai_wizard` (boolean).
- If `false` (default for new accounts): Trigger Wizard immediately on CMS Dashboard load.
- If `true`: Skip Wizard, load normal Dashboard.

### 9.2 Step-by-Step Flow
```text
[1] User Auth Success (F02) → Redirect to /onboarding
    ↓
[2] Welcome Screen (1 CTA: "Create My Store" → /builder/new)
    ↓
[3] User interacts with AI Builder (F01) → Completes or saves site draft
    ↓
[4] User navigates back to CMS Admin Dashboard (/dashboard)
    ↓
[5] System checks `has_seen_ai_wizard` == false
    ↓
[6] Trigger AI Discovery Wizard (Modal Carousel)
    ├── Slide 1 (AI Editor) → User clicks "Tiếp tục"
    ├── Slide 2 (AI Content) → User clicks "Tiếp tục"
    └── Slide 3 (AI SEO) → User clicks "Khám phá CMS ngay"
    ↓
[7] Close Modal
    ↓
[8] Fire API Patch: Update user record `has_seen_ai_wizard = true`
    ↓
[9] Full CMS Dashboard Access (Wizard never shows again)
```

---

## 10. Screen Layout

> **[Global CMS Constraint]** Tính năng Onboarding khởi tạo một Welcome Screen trọn vẹn màn hình và một Carousel Wizard Overlay đè lên Dashboard CMS.

> **[BẮT BUỘC]** Liệt kê chi tiết các màn hình (screens) và các state quan trọng (ví dụ: Empty, Loading, Error, Success). Mỗi màn hình cần mô tả UI component chính và luồng hiển thị.

### 10.1. Màn hình Welcome (Zero-Friction Welcome)
- **Mô tả:** Màn hình chào mừng siêu tốc sau khi Sign Up.
- **Components chính:**
  - Tiêu đề thông điệp chào mừng trung tâm.
  - Only ONE Primary Action: Nút CTA lớn "Create My Store".
  - Một link phụ bên dưới: "Bỏ qua & Đi tới Dashboard".
- **Wireframe:**
```text
┌──────────────────────────────────────────┐
│                                          │
│        🎉 Chào mừng tới PrimeWeb         │
│     Bắt đầu xây dựng cửa hàng của bạn    │
│                                          │
│       [ 🚀 Create My Store ]             │
│                                          │
│       Bỏ qua & Đi tới Dashboard          │
│                                          │
└──────────────────────────────────────────┘
```

### 10.2. Màn hình AI Discovery Wizard (CMS Overlay Carousel)
- **Mô tả:** Modal tự bật hiện tại Dashboard hướng dẫn sử dụng AI CMS.
- **Principle thiết kế:** Focus, Làm Mờ background (opacity 0.6), không phức tạp form input.
- **Components chính:**
  - Header: Simple Title + Nút X Close.
  - Media Box: Khung hiển thị GIF/Video (16:9 ratio, max 500KB).
  - Content Text: Heading, Body (14-16px).
  - Navigation Footer: Nút Skip (phụ), Nút Next (chính), Progress dots (● ○ ○).
- **Wireframe:**
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

### 10.3. Mobile View (Stack Onboarding)
- **Mô tả:** Màn hình Welcome và CMS AI Wizard trên Mobile, tối ưu cho việc sử dụng ngón cái (Thumb-zone) và trình diễn theo chiều dọc.
- **Wireframe:**
```text
┌─ 📱 Mobile Browser ─────────────────────────┐
│        🎉 Chào mừng tới PrimeWeb           │
│     Bắt đầu xây dựng cửa hàng của           │
│     bạn ngay hôm nay!                       │
│                                             │
│       [ 🚀 Create My Store ]                │
│                                             │
│       Bỏ qua & Đi tới Dashboard             │
└─────────────────────────────────────────────┘

┌─ 📱 Mobile AI Wizard (Overlay) ─────────────┐
│ ✦ Khám phá Quyền năng AI               [✕]  │
│                                             │
│   ┌──────────────────────────────────┐      │
│   │        [ 🖼️ GIF/Video ]          │      │
│   └──────────────────────────────────┘      │
│                                             │
│  [Tiêu đề] Thiết kế bằng AI                 │
│  [Mô tả] Hỗ trợ bạn thay đổi thiết kế       │
│  chỉ với một cú chạm.                       │
│                                             │
│               (●) (○) (○)                   │
│                                             │
│  [ Bỏ qua ]              [ ➔ Tiếp tục ]     │
└─────────────────────────────────────────────┘
```

### 10.4. Các trạng thái UI (UI States) & Modals
- **Loading State:** Có Shimmer skeleton chờ GIF tải xong bên trong hộp ảnh 16:9. Nút CTA Disable lúc transition slide.
- **Error State / Edge Cases:** Fallback ảnh tĩnh nếu video/GIF không load được.
- **Success State:** Fade-out mượt khi hoàn tất Carousel và Update state vô db.

---

## 11. Acceptance Criteria

> AC được copy từ `F06-onboarding-stories.md`. Không tự thêm AC không có trong story.

### AC-1: Welcome Screen Single CTA
> 📌 Source: [US-F06-02](../stories/F06-onboarding-stories.md) — AC-1

```gherkin
GIVEN user vừa authenticate thành công thông qua F02
WHEN  vào /onboarding
THEN  welcome screen có single primary CTA: "Create My Store"
  AND không có competing actions khác
  AND progress indicator: "Step 1 of 2: Create Store"
```

### AC-2: CMS AI Wizard - Slide Content
> 📌 Source: [US-F06-03](../stories/F06-onboarding-stories.md) — AC-2, AC-3, AC-4

```gherkin
GIVEN user đang xem AI Wizard lần đầu
WHEN  chuyển các slide
THEN  hiển thị đúng thông điệp hỗ trợ:
  - Slide 1: "AI Editor" (Hỗ trợ thay đổi thiết kế nhanh chóng qua chat)
  - Slide 2: "AI Content" (Hỗ trợ viết mô tả, blog tự động khi bí ý tưởng)
  - Slide 3: "AI SEO" (Hỗ trợ phân tích từ khóa, chấm điểm SEO tự động)
```

### AC-3: CMS AI Wizard - Dismissal
> 📌 Source: [US-F06-03](../stories/F06-onboarding-stories.md) — AC-5

```gherkin
GIVEN user mở Modal Wizard
WHEN  click "Bỏ qua hướng dẫn" hoặc hoàn thành Step 3
THEN  Modal đóng lại
  AND không bao giờ tự động hiện lại trong các lần đăng nhập sau (lưu state has_seen_onboarding_wizard = true)
```

### AC-4: Mobile Web Experience
> 📌 Source: [US-F06-04](../stories/F06-onboarding-stories.md)

Trên giao diện điện thoại (< 768px), Onboarding Welcome view có nút CTA tràn viền, cố định ở mép dưới màn hình. Modal Carousel chiếm toàn bộ không gian (fullscreen) làm mờ background hoàn toàn và cho phép vuốt (swipe) để đổi slide, ẩn đi các nút tới/lui nhỏ để tối ưu touch target.

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
PATCH /api/users/{id}                       → update has_seen_ai_wizard: true
Auth: required
```

---

## 14. Dependencies

| Dependency | Status | Action Needed |
|-----------|--------|---------------|
| F02 Auth | ✅ Done | — |
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
