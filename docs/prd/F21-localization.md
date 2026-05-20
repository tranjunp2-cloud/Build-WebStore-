# PRD: Localization & Multi-language (F21)
> **Version:** 1.0 | **Created:** 2026-03-19 | **Agent:** `project-planner`
> **Priority:** P0 | **Sprint:** Wave 1 — Sprint 1 | **Size:** M
> **Depends on:** F02 Auth, F18 CMS Layout | **Blocks:** None

---

> [!IMPORTANT]
> **Stories-First Rule:**
> PRD này được xây dựng dựa trên các User Stories đã tồn tại và được approve từ file `F21-localization-stories.md`.


---

## 0. Story Traceability

| Story ID | Title | File | Status |
|----------|-------|------|--------|
| US-F21-01 | Language Switcher on Login/Auth Screens | [F21-localization-stories.md](../stories/F21-localization-stories.md) | Ready |
| US-F21-02 | Language Switcher on CMS Layout Header | [F21-localization-stories.md](../stories/F21-localization-stories.md) | Ready |
| US-F21-03 | Language Preference Persistence | [F21-localization-stories.md](../stories/F21-localization-stories.md) | Ready |
| US-F21-04 | Mobile Web UX — Language Switcher Placement | [F21-localization-stories.md](../stories/F21-localization-stories.md) | Ready |

---

## 1. Problem Statement

Do đối tượng khách hàng mục tiêu là SME tại thị trường Malaysia, hệ thống PrimeWeb 2.0 bắt buộc phải hỗ trợ trôi chảy 2 ngôn ngữ chính là English (EN) và Bahasa Melayu (BM). Nếu thiếu công cụ chuyển đổi ngôn ngữ dễ tiếp cận từ vòng ngoài (Trang Auth) cho đến vòng trong (CMS Dashboard), người dùng nội địa sẽ gặp rào cản lớn về UX, dẫn đến tỷ lệ drop-off (rời bỏ) cao.

---

## 2. Target User

- Store Owner (Merchant) & Staff người Malaysia.
- Đặc trưng: Đa phần kinh doanh nội địa (Local Commerce), quen với tiếng mẹ đẻ (BM) nhưng cũng thường dùng thuật ngữ tiếng Anh trong quản lý. Cần chức năng chuyển đổi nhanh chóng và hiển thị rõ ràng.

---

## 3. Solution Overview

Tính năng **F21 Localization** cho phép người dùng thay đổi ngôn ngữ hiển thị của toàn bộ hệ thống ngay tức thì mà không cần load lại trang. 
- **Vị trí đề xuất tối ưu:** Nút chuyển đổi (Language Toggle / Dropdown) sẽ được đưa ra hẳn trên **Top Header** của CMS Layout (cạnh Notification Bell) thay vì giấu sâu trong Profile Avatar. 
- Tại màn hình Auth (Login/Register/Forgot Password), nút này nằm ở góc phải trên cùng.
- Trạng thái ưu tiên ngôn ngữ sẽ được lưu ở LocalStorage đối với khách và đồng bộ lên Database đối với user đã đăng nhập.

---

## 4. Scope

### In Scope
- Tích hợp i18n context provider cho toàn bộ React/Next.js app.
- Giao diện Language Switcher trên màn hình Auth (F02).
- Giao diện Language Switcher trên Top Header màn hình CMS (F18).
- Quản lý state persistence (LocalStorage & User Profile DB).
- Chuyển đổi ngôn ngữ realtime (Smooth transition, no reload).

### Out of Scope
- Dịch tự động dữ liệu do user nhập vào (Product data, Blog content). Tính năng này chỉ dịch tĩnh các thành phần UI (Static CMS UI labels).
- Hỗ trợ các ngôn ngữ thứ 3 (Chỉ focus Phase 1 là EN và BM).

---

## 5. Success Metrics

| Metric | Target | Measured By |
|--------|--------|-------------|
| Language Switch Usage | Lựa chọn ngôn ngữ phản hồi ngay lập tức (<100ms) | Client-side metrics |
| User Profile Sync | 100% user preference được đồng bộ về DB | Backend logs |
| Text Overflow Issues | 0 lỗi UI layout bị vỡ khi chuyển BM/EN | QA Automation / Visual Test |

---

## 6. Functional Requirements

| FR-ID | Requirement | Story Ref | Priority | Notes |
|-------|-------------|-----------|----------|-------|
| FR-01 | Màn Auth Header hiển thị nút đổi EN/BM | US-F21-01 | P0 | Nằm góc phải trên cùng |
| FR-02 | CMS Header hiển thị nút đổi `🌐 EN / BM` | US-F21-02 | P0 | Nằm trên thanh top bar, trái Notification Bell |
| FR-03 | Chuyển đổi ngôn ngữ áp dụng cập nhật React tree thay vì full reload | US-F21-01 | P0 | Tăng UX mượt mà |
| FR-04 | Lưu tuỳ chọn ngôn ngữ vào `localStorage` nếu chưa login | US-F21-03 | P0 | Key: `prefer_lang` |
| FR-05 | Lưu tuỳ chọn ngôn ngữ vào User Database qua API | US-F21-03 | P0 | Kích hoạt khi có Auth Token |
| FR-06 | UI Component text tự động fallback sang English nếu key BM bị thiếu | N/A | P1 | Safe fallback mechanisms |
| FR-07 | **[Mobile]** Thu gọn hoặc di chuyển nút Language Switcher vào trong Hamburger menu trên màn hình mobile để tiết kiệm diện tích Header. | US-F21-04 | P1 | Mobile UX |
| FR-08 | Máy chủ i18n phải hỗ trợ cơ chế truyền params cho Pluralization (số nhiều) để xử lý ngữ pháp khác biệt giữa tiếng Anh và tiếng Mã Lai. | N/A | P0 | Language Accuracy |

---

## 7. Business Rules

- **BR-01:** Ngôn ngữ mặc định (Default language) của hệ thống khi user truy cập lần đầu là **English**.
- **BR-02:** User Data (ví dụ tên Item, mô tả sản phẩm user gõ) sẽ giữ nguyên ngôn ngữ gốc do user nhập, hệ thống chỉ can thiệp dịch (translate) các Navigation/UI strings.
- **BR-03:** Khi đổi ngôn ngữ, định dạng Ngày tháng khóa cứng format `DD/MM/YYYY`. Định dạng Tiền tệ fix thành `RM 1,200.50` (có tiền tố RM, phân cách ngàn bằng dấu phẩy, phân cách thập phân bằng dấu chấm).
- **BR-04:** Sync Priority: Khi user đăng nhập thành công, hệ thống ưu tiên lấy trạng thái ngôn ngữ từ User Database Profile để hiển thị, và tự động ghi đè (override) lên giá trị `prefer_lang` dưới LocalStorage của thiết bị truy cập.
- **BR-05:** Error Fallback: Nếu API backend trả về Text mã lỗi không tồn tại trong i18n dictionary (uncaught error tiếng Anh dư thừa), frontend phải tự động fallback sang thông báo lỗi chung chung đã được dịch (VD: Lỗi kết nối hệ thống) để bảo vệ trải nghiệm.

---

## 8. Screen & Layout Optimizations

> **Tối ưu UX/UI:** Đưa Localization ra vùng tương tác chính.

> **[Wireframe & Design Rule]** Không cần dùng ASCII để minh hoạ. Dẫn nguồn trực tiếp từ wireframe ở thư mục design nếu có.
> **[Quy tắc Cập nhật]** Mỗi khi 1 design/wireframe mới được thêm, BẮT BUỘC phải bổ sung ở Screen Layout đường dẫn tới file đó.

### 8.1. Màn hình Auth (F02) - Cập nhật
Nút Language Switcher dạng Text Toggle gọn nhẹ hoặc Select Box tuỳ design.
  - [Link tới file wireframe/design trong thư mục docs/design/...]

### 8.2. Màn hình CMS Layout (F18) - Cập nhật
Đưa Language Switcher ra ngoài Avatar dropdown, đặt trực tiếp lên Header để dễ nhìn nhất.
  - [Link tới file wireframe/design trong thư mục docs/design/...]
*(Dropdown của ngôn ngữ hiển thị dạng cờ hoặc text: 🇲🇾 Bahasa Melayu | 🇬🇧 English)*

### 8.3. Mobile View (Language Switcher Hamburger)
- **Mô tả:** Không gian Header mobile là giới hạn, do đó nút 🌐 EN/BM được nhét vào bên trong Hamburger menu drawer hoặc Avatar profile list để giao diện Header không bị vỡ.
- **Design / Wireframe:**
  - [Link tới file wireframe/design trong thư mục docs/design/...]

---


## 9. Acceptance Criteria

### AC-1: Display Switcher on Auth Header
> 📌 Source: [US-F21-01](../stories/F21-localization-stories.md) — AC-1

```gherkin
GIVEN the user is on the Login, Register, or Forgot Password screen
WHEN  they look at the top right corner of the header
THEN  they should see a Language Switcher toggle (e.g., EN | BM)
```

### AC-2: CMS Header Navigation
> 📌 Source: [US-F21-02](../stories/F21-localization-stories.md) — AC-1

```gherkin
GIVEN the user is logged into the CMS
WHEN  they look at the Top Header (F18 Layout)
THEN  they should see a quick Language Switcher (e.g., 🌐 EN / BM) placed directly on the header, next to the Notification Bell
```

### AC-3: Profile Synchronization
> 📌 Source: [US-F21-03](../stories/F21-localization-stories.md) — AC-2

```gherkin
GIVEN a logged-in user changes the language in the CMS to BM
WHEN  they log out and log back in from another device
THEN  their CMS dashboard should automatically load in BM based on their saved profile settings
```

---

## 10. Technical Architecture

### 10.1 Components & Library

| Component/Lib | Description |
|-----------|-------------|
| `next-intl` (hoặc `react-i18next`) | Thư viện core xử lý Locale cho Next.js App Router. |
| `LanguageSwitcher` | `src/components/ui/LanguageSwitcher.tsx` - Nút Dropdown đổi ngôn ngữ. |
| `User Preference API` | Endpoint `PATCH /api/users/me/preferences` để lưu prefer_lang. |

### 10.2 Data Flow

```
User Clicks 'BM' 
  → Set 'prefer_lang=BM' in cookies & localStorage
  → React Context/Provider update Locale string
  → Re-render UI text with mapped 'bm.json' dictionary
  → [Async/Background] Call API PATCH /api/users/me/preferences if logged in
```

---

## 11. Open Questions

| # | Question | Owner | Status |
|---|----------|-------|--------|
| 1 | Có cần hiển thị Quốc kỳ (Flags) cạnh ngôn ngữ không, hay chỉ dùng Text (EN/BM) để tối giản thiết kế? | Design | ⬜ Open |

---

## 12. 9-Point Done Checklist

- [x] Loading State — Skeleton layout không bị vỡ khi render dictionary text
- [x] Empty State — N/A
- [x] Error State — Lỗi dictionary config thiếu tự động fallback sang English
- [x] Form Validation — Text báo lỗi validation (Zod) phải được dịch
- [x] Button States — N/A
- [x] Toast Feedback — Tên lỗi API cũng phải trả về mã (ErrorCode) để frontend map với i18n toast text
- [x] Auth Redirect — 401 → /login
- [x] Mobile 375px — Nút thu gọn trên góc header auth và CMS hiển thị tốt không đẩy icon
- [x] TypeScript Clean — `tsc --noEmit` pass

---

## 13. Definition of Ready

- [x] User Stories approved
- [x] Dictionary structure (key-value) mẫu được approved bởi dev/design

---

## 14. Definition of Done

- [ ] Toàn bộ màn hình Auth (F02) và CMS (F03->F20) text static đều dùng i18n Hook.
- [ ] Chuyển đổi ngôn ngữ lưu database thành công.
- [ ] Không full-page reload khi bấm đổi.
