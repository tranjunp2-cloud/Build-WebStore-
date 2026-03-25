# PRD: Dashboard Suite (F03)
> **Version:** 2.0 | **Updated:** 2026-03-17 | **Agent:** `project-planner`
> **Priority:** P0 | **Sprint:** Wave 3 | **Size:** XL
> **Depends on:** F02 Auth ✅, Published site exists

---

> [!IMPORTANT]
> **Stories-First Rule:** PRD này được xây dựng từ các User Stories đã approve.
> Mọi FR phải có Story Ref. AC được copy từ story file. Không tự mở rộng scope.


---

## 0. Story Traceability

| Story ID | Title | File | Status |
|----------|-------|------|--------|
| US-F03-01 | Dashboard — Overview | [F03-dashboard-stories.md](../stories/F03-dashboard-stories.md) | Ready |
| US-F03-02 | Analytics Details | [F03-dashboard-stories.md](../stories/F03-dashboard-stories.md) | Ready |
| US-F03-03 | SEO Dashboard Overview ⭐ | [F03-dashboard-stories.md](../stories/F03-dashboard-stories.md) | Ready |
| US-F03-04 | Auto SEO Meta Generation | [F03-dashboard-stories.md](../stories/F03-dashboard-stories.md) | Ready |
| US-F03-05 | AI SEO Fix All Issues | [F03-dashboard-stories.md](../stories/F03-dashboard-stories.md) | Ready |
| US-F03-07 | Mobile Web UX — Responsive Dashboard Metrics & Charts | [F03-dashboard-stories.md](../stories/F03-dashboard-stories.md) | Ready |

---

## 1. Problem Statement

Sau khi login, user (chủ shop SME) cần thấy **tổng quan ngay lập tức** sức khỏe của website đang vận hành: doanh thu, lượng khách truy cập, số lượng leads (WhatsApp clicks, Orders), và SEO score. Họ không có chuyên môn sâu về Analytics và SEO nên cần mọi thứ được trực quan hóa trên một hệ thống Dashboard tập trung (Dashboard Suite) và có AI hỗ trợ optimize tự động.

---

## 2. Target User

- SME owner đã đăng ký và có website (thường là 1 site).
- Cần xem overview nhanh khi mở app (Focus vào tiền và lượt xem).
- Không rành tech, không hiểu sâu về SEO/Analytics — cần UI rõ ràng, AI-driven.

---

## 3. Solution Overview

`F03 Dashboard Suite` quy hoạch lại thành 3 màn hình:
1. **Home / Dashboard Overview (`/dashboard`):** Là Command Center lấy top metrics từ Analytics và phần Orders. Theo mặc định, hiển thị Traffic, Leads, Clicks/Engagement, và Revenue/Pending orders. Có hỗ trợ filter thời gian và cho phép user **tuỳ chỉnh (thêm/bớt/sắp xếp)** các widget theo ý muốn.
2. **Analytics Detail (`/dashboard/analytics`):** Màn hình chi tiết chứa daily bar chart và danh sách các hạng mục hiệu quả nhất (Top Pages, Top Products, Top Blogs).
3. **SEO Dashboard (`/dashboard/seo`):** Màn hình chi tiết chứa page-level analysis, Keyword Tracker cơ bản, và tính năng AI Fix All Issues thần thánh với chuẩn SEO MY market.

---

## 4. Scope

### In Scope
- **Dashboard Overview:** Top 4 Metrics mặc định (Traffic, Leads, Engagement, Sales/Orders), Action Required list, và SEO Widget.
- **Customization:** Cho phép user chọn khoảng thời gian (Today, 7d, 30d) và tùy chỉnh (thêm/ẩn/sắp xếp) các metrics hiển thị trên Dashboard.
- **Analytics Details:** % change vs previous period, Daily bar chart, Top hạng mục hiệu suất cao (Pages, Products, Blogs) max 10 rows.
- **SEO Health:** Overall score (0-100) and breakdown, Basic Keyword Tracker (max 5 keywords), AI "Fix All Issues ✨" với SSE streaming progress, Auto meta tag generation khi publish (title, description), Sitemap generation, JSON-LD Schema.

### Out of Scope
- Real-time Analytics phức tạp (chỉ fetch batch).
- Custom event tracking ngoài các metrics được định nghĩa sẵn.
- Google Search Console integration (Wave 7+).
- Keyword rank tracking, Backlink analysis.

---

## 5. Success Metrics

| Metric | Target | Measured By |
|--------|--------|-------------|
| Dashboard Overview load | < 2s | Timing |
| AI Fix All resolves issues | ≥ 80% auto-fixable | Before/after score |
| Fix All time | < 15 seconds | SSE timing |
| Data accuracy | ≥ 99% | Validation |

---

## 6. User Story Summary

```text
AS A   site owner đang vận hành website
I WANT có một Command Center tổng hợp Analytics, SEO, và to-do list
SO THAT tôi nắm bắt được tình hình kinh doanh và tăng trưởng traffic dễ dàng
```

---

## 7. Functional Requirements

| FR-ID | Requirement | Story Ref | Priority | Notes |
|-------|-------------|-----------|----------|-------|
| FR-01 | **Overview:** Hiển thị 4 Top Metrics mặc định (Traffic, Leads, Engagement, Orders/Revenue) | US-F03-01 | P0 | Nguồn từ F12, F10 |
| FR-02 | **Overview:** Bộ lọc thời gian (Today, 7d, 30d) áp dụng cho toàn dashboard overview | US-F03-01 | P0 | |
| FR-03 | **Overview:** Tùy chỉnh hiển thị (Thêm/ẩn/sắp xếp vị trí) các metrics widget | US-F03-01 | P1 | Lưu preference vào DB/Local |
| FR-04 | **Overview:** Action Required list (3-5 Pending Orders/Messages mới nhất) | US-F03-01 | P0 | Nguồn từ F10 |
| FR-05 | **Overview:** SEO Widget (Score + CTA [AI Fix All]) | US-F03-01 | P0 | |
| FR-06 | **Analytics:** 4 stat cards + % change so với kỳ trước | US-F03-02 | P0 | |
| FR-07 | **Analytics:** Daily bar chart with hover tooltip & Period selector (Today, 7d, 30d) | US-F03-02 | P0 | |
| FR-08 | **Analytics:** Danh sách Top (Pages, Products, Blogs) chia tab/list (max 10 rows) | US-F03-02 | P0 | Nguồn từ F12 tracking |
| FR-09 | **SEO:** Overall SEO score (0-100) + 4 category breakdown | US-F03-03 | P0 | |
| FR-10 | **SEO:** Basic Keyword Tracker (add/remove max 5 keywords, view rank & trend) | US-F03-06 | P1 | Third-party fetch hoặc scrape cơ bản |
| FR-11 | **SEO:** "Fix All Issues ✨" → SSE streaming progress per issue | US-F03-05 | P0 | < 15s |
| FR-12 | **SEO:** Fix All batch undoable (1 Ctrl+Z reverts all) | US-F03-05 | P0 | |
| FR-13 | **SEO:** Auto-generate meta title (≤60) & description (≤160) on first publish | US-F03-04 | P0 | |
| FR-14 | **Shared:** Empty state khi chưa có site/data | US-F03-01 | P0 | |
| FR-15 | **Shared:** Loading skeleton components có shimmer | US-F03-01 | P0 | Không spinner |
| FR-16 | **[Mobile]** Layout Dashboard hiển thị 4 stat cards thành lưới 2x2. | US-F03-07 | P0 | Không hiển thị 4x1 (scroll mỏi tay) |
| FR-17 | **[Mobile]** Biểu đồ Analytics giản lược nhãn trục X (tick labels) và hỗ trợ tooltips khi chạm-giữ. | US-F03-07 | P0 | Trống chữ đè nhau |
| FR-18 | **[Mobile]** Tùy chỉnh Dashboard dùng nút Up/Down thay vì Drag-drop hoặc render dưới dạng Bottom Sheet để chạm đổi vị trí. | US-F03-07 | P0 | Mobile friendly |

---

## 8. Business Rules

- **BR-01:** Chỉ hiển thị Data scope theo tenant của user hiện hành.
- **BR-02:** Analytics IP hashed SHA-256 cho anonymization (No PII stored), events fail gracefully.
- **BR-03:** Auto-generated SEO meta là overridable (user can edit manually), nhưng limits length được enforced.
- **BR-04:** Fix All Issues trong SEO thực thi dưới 15s và là một single batch cho mục đích Undo/Redo.
- **BR-05:** MY market: Nếu locale='ms', target BM keywords; format address/JSON-LD theo MY.

---

## 9. User Flow

```text
/login → /dashboard (Command Center)
  │
  ├── Xem Top Metrics (Tiền & Leads)
  ├── Click vào Pending Order → Chuyển sang /orders (F10)
  ├── Click tab [Analytics] → Chuyển sang /dashboard/analytics
  │     └── Chọn biểu đồ, lọc theo 30 days
  └── Click [AI Fix All SEO Issues] trực tiếp từ khung Overview hoặc chuyển tab [SEO]
        └── Call API → Streaming fix → Update điểm SEO
```

---

## 10. Screen Layout

> **[Global CMS Constraint]** Đối với các tính năng quản trị, yêu cầu bắt buộc phải render bên trong Main Content Area của F18 CMS Layout (ngoại trừ các tính năng đặc thù cần Full-screen Editor).

> **[BẮT BUỘC]** Liệt kê chi tiết các màn hình (screens) và các state quan trọng (ví dụ: Empty, Loading, Error, Success). Mỗi màn hình cần mô tả UI component chính và luồng hiển thị.

> **[Wireframe & Design Rule]** Không cần dùng ASCII để minh hoạ. Dẫn nguồn trực tiếp từ wireframe ở thư mục design nếu có.
> **[Quy tắc Cập nhật]** Mỗi khi 1 design/wireframe mới được thêm, BẮT BUỘC phải bổ sung ở Screen Layout đường dẫn tới file đó.

### 10.1. Màn hình chính (Dashboard Overview)
- **Mô tả:** Trang chủ trung tâm hiển thị top metrics và widgets quản lý chung.
- **Components chính:**
  - Header: Lời chào user, Time Period Filter (Today, 7d, 30d).
  - Tabs Navigation: Toolbar gồm 3 tab `[Overview]`, `[Analytics]`, `[SEO Health]` để chuyển đổi màn hình.
  - Stat Cards View (4 cột): Traffic, Leads, Orders, Revenue.
  - Action Required List: Các tác vụ đang pending.
  - SEO Health Widget: Biểu đồ tròn điểm tổng quát và CTA AI Fix.
- **Design / Wireframe:**
  - [Link tới file wireframe/design trong thư mục docs/design/...]text
  - [Link tới file wireframe/design trong thư mục docs/design/...]

### 10.2. Màn hình Chi tiết (Analytics Detail & SEO Dashboard)
- **Mô tả:** Các màn hình mở rộng Analytics và SEO.
- **Components chính:**
  - **Tabs Navigation:** Thanh Tab giống màn hình Overview (đang active ở tab tương ứng).
  - **Analytics:** Daily Bar Chart lớn, Bảng xếp hạng Top Pages/Products/Blogs.
  - **SEO Dashboard:** Bảng Breakdown điểm từng hạng mục, danh sách Keywords Tracker, tiến trình AI Fix All (SSE real-time streaming bar).

- **Design / Wireframe (Analytics Detail):**
```text
  - [Link tới file wireframe/design trong thư mục docs/design/...]

- **Design / Wireframe (SEO Dashboard):**
```text
  - [Link tới file wireframe/design trong thư mục docs/design/...]

### 10.3. Các trạng thái UI (UI States) & Modals
- **Empty State:** User chưa có site -> Hiển thị Prompt tạo website đầu tiên (Illustration box). Dashboards khác sẽ báo "Chưa có dữ liệu" với số liệu là 0.
- **Loading State:** Skeleton Shimmer thay vì Spinner cho các widget để trải nghiệm mượt.
- **Error State / Edge Cases:** Toast lỗi "Không thể tải dữ liệu" + Nút "Thử lại".
- **Modals:** Modal "Tùy chỉnh Dashboard" cho phép user gạch/chọn (checkbox) và Drag-and-drop để reorder các Stat Cards.

---


## 11. Acceptance Criteria

> **[BẮT BUỘC]** AC ở đây được copy từ file story đã approve. KHÔNG tự viết AC mới.
> Nếu cần thêm AC kỹ thuật → bổ sung vào file story trước, sau đó copy sang đây.

### AC-1: Happy Path — Default Dashboard Overview

> 📌 Source: [US-F03-01](../stories/F03-dashboard-stories.md) — AC-1: Happy Path — Default Dashboard Overview

```gherkin
GIVEN user login và có 1 site đang active
WHEN  vào /dashboard (mặc định filter 7 ngày qua)
THEN  hiện 4 stats cards mặc định (theo thứ tự ưu tiên):
      1. Tỉ lệ người dùng truy cập / Lượt views (Traffic)
      2. Số lượng clicks vào widgets/call (Leads)
      3. Tổng số lượng clicks vào sản phẩm/giỏ hàng (Engagement/Sales intent)
      4. Doanh thu hoặc Pending Orders (Nguồn: F10)
  AND hiện danh sách 3-5 Pending Orders mới nhất
  AND hiện SEO Health Widget (Score + CTA Fix)
```

### AC-2: Time Period Filter on Overview

> 📌 Source: [US-F03-01](../stories/F03-dashboard-stories.md) — AC-2: Time Period Filter on Overview

```gherkin
GIVEN user ở /dashboard
WHEN  chọn bộ lọc thời gian (Today, 7 days, 30 days)
THEN  các giá trị ở stats cards và biểu đồ (nếu có) update ngay lập tức theo khoảng thời gian mới
  AND lưu lại lựa chọn này cho session hiện tại
```

### AC-3: Customizing Widgets (Sắp xếp / Ẩn hiện)

> 📌 Source: [US-F03-01](../stories/F03-dashboard-stories.md) — AC-3: Customizing Widgets (Sắp xếp / Ẩn hiện)

```gherkin
GIVEN user ở /dashboard
WHEN  click vào nút "Tùy chỉnh Dashboard"
THEN  hiển thị modal/panel cho phép user chọn các metrics muốn hiển thị:
      - Views tổng
      - Lượt mở trang (Page views) theo URL cụ thể
      - Lượt truy cập Blog nhiều nhất
      - Lượt Clicks Widget
      - Checkout/Cart clicks
  AND user có thể kéo thả để reorder vị trí các metrics
  AND save lại configuration vào account preference
```

### AC-4: Empty State

> 📌 Source: [US-F03-01](../stories/F03-dashboard-stories.md) — AC-4: Empty State

```gherkin
GIVEN user login nhưng chưa có site nào
WHEN  vào /dashboard
THEN  empty state: icon + "Tạo website đầu tiên" + CTA → /onboarding
```

### AC-5: Analytics View

> 📌 Source: [US-F03-02](../stories/F03-dashboard-stories.md) — AC-1: Analytics View

```gherkin
GIVEN user ở /dashboard/analytics
WHEN  page load
THEN  hiện Daily Bar Chart (theo Today, 7d, 30d)
  AND hiện danh sách hạng mục hiệu quả nhất (chia tab hoặc list):
      - Top Pages (Lượt mở trang nhiều nhất)
      - Top Products (Sản phẩm được click nhiều nhất)
      - Top Blogs (Bài blog nhiều page views nhất)
  AND có so sánh % change so với kỳ trước đó
```

### AC-6: Analytics Empty Data State

> 📌 Source: [US-F03-02](../stories/F03-dashboard-stories.md) — AC-2: Empty Data State

```gherkin
GIVEN user ở /dashboard/analytics
WHEN  chưa có dữ liệu tracking nào trong kỳ được chọn
THEN  hiện empty state cho chart: "Chưa có dữ liệu trong khoảng thời gian này"
  AND giá trị các metrics đều là 0
```

### AC-5: Analytics API Failure

> 📌 Source: [US-F03-02](../stories/F03-dashboard-stories.md) — AC-3: API Failure

```gherkin
GIVEN user đang ở /dashboard/analytics
WHEN  fetch data bị lỗi (timeout hoặc server error)
THEN  hiển thị toast error "Không thể tải dữ liệu Analytics"
  AND cho phép user nhấn "Thử lại"
```

### AC-10: AC-11, AC-12, AC-13, AC-14: (Đã dịch index +2 do thêm AC-2, AC-3)

*(Đã update ngầm thứ tự AC cho phù hợp)*

### AC-11: Manage Tracked Keywords

> 📌 Source: [US-F03-06](../stories/F03-dashboard-stories.md) — AC-1: Happy Path — Manage Tracked Keywords

```gherkin
GIVEN user ở /dashboard/seo
WHEN  cuộn đến phần "Keyword Tracker"
THEN  hiển thị dashboard nhỏ cho phép add tối đa 5 từ khóa (Core keywords)
  AND có ô input để "Thêm từ khóa mới" (disable nếu đã đủ 5)
```

### AC-12: View Keyword Ranks

> 📌 Source: [US-F03-06](../stories/F03-dashboard-stories.md) — AC-2: View Keyword Ranks

```gherkin
GIVEN user đã add ít nhất 1 từ khóa vào tracker
WHEN  ở /dashboard/seo
THEN  hiển thị list các từ khóa đang track
  AND hiển thị Thứ hạng (Rank) hiện tại trên SERP (Search Engine Results Page)
  AND hiển thị mũi tên lên/xuống (Trend) so với lần audit trước đó
```

### AC-13: Auto Update Frequency

> 📌 Source: [US-F03-06](../stories/F03-dashboard-stories.md) — AC-3: Auto Update Frequency

```gherkin
GIVEN hệ thống có danh sách tracking keywords của user
WHEN  cron job chạy (vd: 1 tuần 1 lần hoặc manual fetch)
THEN  hệ thống tự động query hạng của website theo từng keyword
  AND cập nhật kết quả mới nhất vào database
```

### AC-14: Trải Nghiệm Dashboard trên Mobile (Responsive UI)
> 📌 Source: [US-F03-07](../stories/F03-dashboard-stories.md)

Khi truy cập màn hình `<768px`, 4 Stat Cards ở Overview tự động quy hoạch thành lưới `2x2 CSS Grid` giúp nắm bắt cùng lúc 4 chỉ số mà KHÔNG CẦN cuộn sâu. Biểu đồ trong Analytics sẽ giản lược các nhãn ngày tháng (e.g., nhảy cách 3-5 ngày hiển thị 1 nhãn) để không tràn chữ, cho phép scrub/chạm để xem chi tiết. Form tùy chỉnh hiển thị Dashboard thay Drag-and-drop bằng bảng danh sách có thao tác Tap nút `Lên/Xuống` hoặc hiện dưới dạng Bottom Sheet tiện lợi vuốt đóng (swipe-to-close).

---

## 12. Non-Functional Requirements

- **Performance:** Sites visible < 2s sau login. AI Fix All < 15s (SSE streaming). Analytics query cache.
- **Security:** Requires auth (401). Tenant validation. Anonymized IP for analytics.
- **Device Support:** Mobile 375px (collapsed sidebar, stat cards 2x2 grid), Desktop 1280px+.
- **SEO Compliance:** Length enforcement strict.

---

## 13. Technical Architecture

### 13.1 Components

| Component | File | Description |
|-----------|------|-------------|
| `DashboardPage` | `app/(dashboard)/dashboard/page.tsx` | Overview |
| `AnalyticsPage` | `app/(dashboard)/dashboard/analytics/page.tsx` | Analytics Details |
| `SEODashboardPage` | `app/(dashboard)/dashboard/seo/page.tsx` | SEO Details |
| `StatCardsView` | `components/dashboard/StatCardsView.tsx` | Shared |
| `DailyChart` | `components/analytics/DailyChart.tsx` | Bar chart |
| `SEOScoreWidget` | `components/seo/SEOScoreWidget.tsx` | Circle chart + CTA |

### 13.2 API Endpoints

```text
GET /api/dashboard/summary?tenantId=X      → Phục vụ overview
GET /api/analytics/summary?tenantId=X&period=7d
POST /api/analytics/track                  → Public tracking
POST /api/seo/analyze                      → Trigger SEO scan
POST /api/seo/fix                          → AI fix (SSE stream)
```

---

## 14. Dependencies

| Dependency | Status | Action Needed |
|-----------|--------|---------------|
| F02 Auth | ✅ Done | |
| F10 Orders | ⬜ Pending | Cần có API đếm số Pending Orders |
| OpenAI API | ✅ Setup | Phục vụ SEO Fix All |

---

## 15. API Contract

> Full details in SPEC.md §8 or AI_BUILDER_SPEC.md §14

```json
GET /api/dashboard/summary
Request: ?tenantId={string}&period={today|7d|30d}
Response: { success: boolean, data: { metrics: Array<{id: string, value: number, label: string, change: number}>, pendingOrders: Array<object> } }

POST /api/dashboard/preferences
Request: { tenantId: string, widgetOrder: Array<string>, hiddenWidgets: Array<string> }
Response: { success: boolean }

GET /api/analytics/summary
Request: ?tenantId={string}&period={today|7d|30d}
Response: { success: boolean, data: { chart: Array<{date: string, views: number}>, topPages: Array<object>, topProducts: Array<object>, topBlogs: Array<object>, changes: object } }

POST /api/seo/analyze
Request: { tenantId: string }
Response: { success: boolean, data: { score: number, breakdown: object, issues: Array<object> } }

GET /api/seo/keywords
Request: ?tenantId={string}
Response: { success: boolean, data: { keywords: Array<{id: string, keyword: string, rank: number, trend: 'up'|'down'|'same'}> } }

POST /api/seo/keywords
Request: { tenantId: string, keyword: string }
Response: { success: boolean, data: { ... } }

DELETE /api/seo/keywords/[id]
Request: { tenantId: string }
Response: { success: boolean }

POST /api/seo/fix
Request: { tenantId: string, issueIds?: Array<string> }
Response: [SSE Stream]
```

---

## 16. Open Questions

| # | Question | Owner | Status |
|---|----------|-------|--------|
| 1 | AI SEO Fix rate limit cho user miễn phí so với có phí là bao nhiêu? | PO | ⬜ Open |
| 2 | SEO Data lưu cache bao lâu để tối ưu performace? | Dev | ⬜ Open |
| 3 | Có hỗ trợ export báo cáo SEO/Analytics ra PDF không? | BA | ⬜ Open |

---

## 17. 9-Point Done Checklist
- [ ] Loading State — Skeleton shimmer components
- [ ] Empty State — Prompt publish/onboard
- [ ] Error State — Toast on fetch or AI stream fail
- [ ] Form Validation — N/A
- [ ] Button States — "Fix All" disabled while streaming
- [ ] Toast Feedback — Progress & Completion toast for AI tools
- [ ] Auth Redirect — 401 → /login
- [ ] Mobile 375px — Responsive layout check
- [ ] TypeScript Clean — `tsc --noEmit` pass

---
## 18. Definition of Ready
- [ ] User Stories approved and grouped.
- [ ] Auth module ready.

---
## 19. Definition of Done
- [ ] All components created and data fetched successfully.
- [ ] SSE AI streaming operates under 15s.
- [ ] Mobile UI passes tests.
