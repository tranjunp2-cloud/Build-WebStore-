# PRD: Help Center (F20)
> **Version:** 1.0 | **Created:** 2026-03-19 | **Agent:** `project-planner`
> **Priority:** P1 | **Sprint:** Wave 4 — Sprint 1 | **Size:** M
> **Depends on:** F18 | **Blocks:** None

---

> [!IMPORTANT]
> **Stories-First Rule:**
> PRD này PHẢI được xây dựng dựa trên các User Stories đã tồn tại và được approve.


---

## 0. Story Traceability

| Story ID | Title | File | Status |
|----------|-------|------|--------|
| US-F20-01 | View 1-Page User Guideline | [F20-help-center-stories.md](../stories/F20-help-center-stories.md) | Ready |
| US-F20-02 | View Detailed Q&A | [F20-help-center-stories.md](../stories/F20-help-center-stories.md) | Ready |
| US-F20-03 | View Module-Specific Instructions with Screenshots | [F20-help-center-stories.md](../stories/F20-help-center-stories.md) | Ready |
| US-F20-04 | Mobile Web UX — Pinch-to-Zoom Lightbox | [F20-help-center-stories.md](../stories/F20-help-center-stories.md) | Ready |

---

## 1. Problem Statement

Người dùng (Merchant/Staff) mới sử dụng hệ thống thường gặp khó khăn trong việc nắm bắt toàn bộ tính năng và cách sử dụng từng module. Cần có một trang Help Center tập trung, cung cấp tài liệu hướng dẫn trực quan (kèm screenshot) và giải đáp thắc mắc (Q&A) để giảm tải cho bộ phận support và giúp người dùng tự phục vụ (self-serve).

---

## 2. Target User

- Store Owner (Merchant) & Staff.
- Technical level: Beginner to Intermediate.
- Language: English / Malaysian.

---

## 3. Solution Overview

Xây dựng trang **Help Center** bao gồm 3 phần chính nằm gọn trong một giao diện dễ điều hướng: (1) Tổng quan 1 trang (1-page guideline) giới thiệu tất cả tính năng, (2) Mục Q&A giải đáp thắc mắc chi tiết, (3) Hướng dẫn chi tiết từng module kèm theo screenshot trực quan. Tính năng này giúp người dùng tự tra cứu cách sử dụng màn hình/chức năng mà không cần thoát khỏi hệ thống CMS.

---

## 4. Scope

### In Scope
- Trang Help Center tổng quan (1-page guideline).
- Danh sách Q&A theo danh mục (Accordion style).
- Tài liệu hướng dẫn sử dụng chi tiết từng module (Dashboard, AI Builder, Products, Orders, v.v.) kèm screenshots.
- Chức năng phóng to ảnh (Lightbox) cho screenshots.

### Out of Scope
- Live chat / Ticketing system (giữ Help Center ở dạng tĩnh/tài liệu).
- Tích hợp AI Chatbot để trả lời (đây là tài liệu đọc tĩnh định sẵn).

---

## 5. Success Metrics

| Metric | Target | Measured By |
|--------|--------|-------------|
| Help Center Usage | > 50% users visit within first 7 days | Analytics (Pageviews) |
| Time spent on page | > 2 mins per session | Analytics |
| Support Ticket Reduction | Giảm 20% các câu hỏi cơ bản | Support tool tracking |

---

## 6. User Story Summary

```
AS A Store Owner or Staff
I WANT TO view a 1-page user guideline, Q&A, and module instructions with screenshots
SO THAT I can quickly learn how to use the system and troubleshoot issues independently
```

> Source Story: [US-F20-01](../stories/F20-help-center-stories.md#us-f20-01)

---

## 7. Functional Requirements

| FR-ID | Requirement | Story Ref | Priority | Notes |
|-------|-------------|-----------|----------|-------|
| FR-01 | Hệ thống phải hiển thị bản tóm tắt 1-page guideline | US-F20-01 | P1 | |
| FR-02 | Hệ thống phải hiển thị danh sách Q&A phân chia theo danh mục | US-F20-02 | P1 | Dạng accordion |
| FR-03 | Mỗi module phải có trang hướng dẫn riêng kèm text và screenshots | US-F20-03 | P1 | |
| FR-04 | User có thể click vào screenshot để phóng to (Lightbox) | US-F20-03 | P2 | Tăng trải nghiệm nhìn |
| FR-05 | **[Mobile]** Khung Lightbox cho phép Pinch-to-zoom và double-tap zoom trên mobile. | US-F20-04 | P2 | Tối ưu đọc text nhỏ |

---

## 8. Business Rules

- **BR-01:** Mọi user (Owner, Staff) đã đăng nhập đều có quyền truy cập Help Center.
- **BR-02:** Nội dung Help Center được coi là read-only đối với end-user (quản lý bởi Super Admin, không nằm trong scope ticket này).

---

## 9. User Flow

```
[Entry point: User clicks "Help Center" or "Góc hỗ trợ" on the Sidebar (F18 layout)]
  ↓
Step 1: User lands on the "1-Page Guideline" (Default view) 
  ↓
Step 2: User selects a tab / menu item:
  ├── "Q&A" → Sees categorized questions. Expands a question to read the answer.
  └── "Module Guides" → Selects a specific module (e.g., Products).
        ↓
        User reviews step-by-step instructions.
        ↓
        User clicks a screenshot to view it in full size (Lightbox).
        ↓
        User closes Lightbox and returns to reading.
```

---

## 10. Screen Layout

> **[Global CMS Constraint]** Render bên trong Main Content Area của F18 CMS Layout.

> **[Wireframe & Design Rule]** Không cần dùng ASCII để minh hoạ. Dẫn nguồn trực tiếp từ wireframe ở thư mục design nếu có.
> **[Quy tắc Cập nhật]** Mỗi khi 1 design/wireframe mới được thêm, BẮT BUỘC phải bổ sung ở Screen Layout đường dẫn tới file đó.

### 10.1. Help Center Main Screen
- **Mô tả:** Màn hình chính chứa Table of Contents (hoặc Sidebar phụ) và nội dung chính.
- **Components chính:**
  - Sidebar phụ (hoặc Tabs): Guideline, Q&A, Modules (Products, Orders, v.v.).
  - Main Area: Nội dung dạng văn bản giàu định dạng (Rich text), Headings, Lists.
- **Design / Wireframe:**
  ```text
  +-----------------------------------------------------------+
  | [H1] Help Center / Hướng dẫn sử dụng                        |
  +---------------------------+-------------------------------+
  | Navigation               | Content Area                   |
  | - 1-Page Guideline (Active)| [H2] Chào mừng!                |
  | - Q&A                    | Đây là tổng quan về hệ thống...|
  | - Modules                |                                |
  |   - Auth / Login         | [H3] Tính năng chính           |
  |   - Dashboard            | 1. ...                         |
  |   - Products             | 2. ...                         |
  +---------------------------+-------------------------------+
  ```

### 10.2. Module Guide with Screenshots
- **Mô tả:** Màn hình hiển thị chi tiết một module khi user chọn từ menu trái.
- **Components chính:**
  - Content Text: Các text hướng dẫn từng bước.
  - Image blocks: Screenshot chèn giữa các text.
- **Design / Wireframe:**
  ```text
  +-----------------------------------------------------------+
  | [H2] Hướng dẫn sử dụng module: Products                     |
  +-----------------------------------------------------------+
  | Bước 1: Truy cập mục "Products" trên thanh menu chính.    |
  | [ Screenshot Image Thumbnail ]                            |
  |                                                           |
  | Bước 2: Nhấn nút "Tạo Sản Phẩm Mới".                      |
  | Điền thông tin vào form...                                |
  | [ Screenshot Image Thumbnail ]                            |
  +-----------------------------------------------------------+
  ```

### 10.3. Các trạng thái UI (UI States) & Modals
- **Lightbox Modal:** Khi click vào ảnh thumbnail, ảnh hiển thị to đè lên giao diện hiện tại với nền tối mờ (overlay). Có nút [X] góc trên bên phải để đóng.

### 10.4. Mobile View (Pinch-to-zoom Lightbox)
- **Mô tả:** Do screenshot trên mobile khá bé và khó đọc text, Lightbox mở ra phải chiếm full-screen và cho phép user chụm 2 ngón tay lại để Zoom chữ (Pinch-to-zoom) để đọc detail dễ dàng. Sidebar navigation chuyển thành sticky top dropdown.
- **Design / Wireframe:**
```text
  - [Link tới file wireframe/design trong thư mục docs/design/...]

  - [Link tới file wireframe/design trong thư mục docs/design/...]

---


## 11. Acceptance Criteria

### AC-1: Display 1-Page Guideline
> 📌 Source: [US-F20-01](../stories/F20-help-center-stories.md) — AC-1: Display 1-Page Guideline

```gherkin
GIVEN the user is logged into the CMS
WHEN  they navigate to the Help Center
THEN  they should see a 1-page user guideline
  AND the guideline should summarize all main features of the system
```

### AC-2: Display Q&A Section
> 📌 Source: [US-F20-02](../stories/F20-help-center-stories.md) — AC-1: Display Q&A Section

```gherkin
GIVEN the user is in the Help Center
WHEN  they view the Q&A section or search for a question
THEN  they should see a list of detailed, categorized questions and answers
  AND they can expand/collapse answers (accordion style)
```

### AC-3: Display Module Instructions
> 📌 Source: [US-F20-03](../stories/F20-help-center-stories.md) — AC-1: Display Module Instructions

```gherkin
GIVEN the user is in the Help Center
WHEN  they select a specific module (e.g., Products, Orders, AI Editor)
THEN  they should see step-by-step text instructions
  AND each major step should be accompanied by clear screenshots
```

### AC-4: Expand Screenshots
> 📌 Source: [US-F20-03](../stories/F20-help-center-stories.md) — AC-2: Expand Screenshots

```gherkin
GIVEN the user is viewing module instructions
WHEN  they click on a screenshot
THEN  the screenshot should expand in a lightbox/modal for better visibility
  AND they can close it to return to the text
```

---

## 12. Non-Functional Requirements

| Category | Requirement | Notes |
|----------|-------------|-------|
| **Performance** | Tải nội dung trang tĩnh < 1s | Sử dụng static generation/hydration |
| **Media** | Hình ảnh screenshot phải được optimize dung lượng định dạng WebP | Để trang load nhanh |

---

## 13. Technical Architecture

### 13.1 Components

| Component | File | Description |
|-----------|------|-------------|
| `HelpCenterLayout` | `src/components/help/HelpCenterLayout.tsx` | Layout 2 cột (nav trái, content phải) |
| `GuidelinePage` | `src/app/(cms)/help/page.tsx` | 1-page guideline |
| `QnAAccordion` | `src/components/help/QnAAccordion.tsx` | Component đóng mở Q&A |
| `LightboxImage` | `src/components/ui/LightboxImage.tsx` | Component xem ảnh phóng to |

---

## 14. Dependencies

| Dependency | Status | Action Needed |
|-----------|--------|---------------|
| F18 (CMS Layout) | ✅ | Help Center render trong content container của layout F18 |

---

## 15. API Contract

*(Nội dung chủ yếu là tĩnh (Static Content), có thể load từ file markdown/JSON cục bộ MDX hoặc CMS. Không yêu cầu API backend phức tạp cho MVP)*.

---

## 16. Open Questions

| # | Question | Owner | Status |
|---|----------|-------|--------|
| 1 | Nội dung Guideline và Q&A sẽ hardcode vào source (MDX) hay lấy từ Backend/Headless CMS? | BA/PO/Dev | ⬜ Open |

---

## 17. 9-Point Done Checklist

- [x] Loading State — Skeleton cho layout Help Center
- [x] Empty State — N/A (luôn có content giả định hợp lệ)
- [x] Error State — Lỗi tải hình ảnh sẽ hiển thị placeholder hoặc alt text
- [x] Form Validation — N/A
- [x] Button States — N/A
- [x] Toast Feedback — N/A
- [x] Auth Redirect — 401 → /login
- [x] Mobile 375px — Chuyển Navigation trái sang Sidebar rút gọn/Dropdown
- [x] TypeScript Clean — `tsc --noEmit` pass

---

## 18. Definition of Ready

- [x] User Stories approved và linked ở Section 0
- [x] AC ở Section 11 đã được copy từ story file
- [x] FR ở Section 7 có đầy đủ Story Ref

---

## 19. Definition of Done

- [ ] All FR items implemented và verified
- [ ] All AC in Section 11 pass
- [ ] 9-Point Checklist all pass
