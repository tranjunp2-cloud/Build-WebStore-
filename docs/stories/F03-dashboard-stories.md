# User Stories: Dashboard Suite (F03)

> **Feature:** F03 — Dashboard Overview, Analytics & SEO
> **Wave:** 3 | **Priority:** P0 | **Ref PRD:** [F03-dashboard.md](../prd/F03-dashboard.md)

---

## 🌍 Global Acceptance Criteria (CMS Layout Compliance)

> **Áp dụng cho mọi User Story trong file này.**

```gherkin
GIVEN user truy cập tính năng trang quản trị (Dashboard, Products, Orders, v.v.)
THEN  nội dung của tính năng phải được render gọn bên trong Main Content Area (tuân thủ F18-03)
  AND Global Top Header (F18-02) và Global Sidebar Navigation (F18-01) vẫn giữ nguyên và hoạt động bình thường, không bị che khuất hay re-render toàn trang.
```

---

## 🌍 Global Acceptance Criteria (CMS Layout Compliance)

> **Áp dụng cho mọi User Story trong file này.**

```gherkin
GIVEN user truy cập tính năng trang quản trị (Dashboard, Products, Orders, v.v.)
THEN  nội dung của tính năng phải được render gọn bên trong Main Content Area (tuân thủ F18-03)
  AND Global Top Header (F18-02) và Global Sidebar Navigation (F18-01) vẫn giữ nguyên và hoạt động bình thường, không bị che khuất hay re-render toàn trang.
```

---

## US-F03-01: Dashboard — Overview

**Wave 3** | **P0** | **M** | **Status:** Ready

### Story

```
As a   site owner đang vận hành website
I want thấy tổng quan Metrics và Action List theo nhu cầu tại Dashboard
  AND có thể chọn khoảng thời gian (Hôm nay, 7 ngày, 30 ngày)
So that tôi kiểm soát những chỉ số mình quan tâm nhất một cách linh hoạt
```

### Acceptance Criteria

#### AC-1: Happy Path — Dashboard Overview

#### AC-1: Happy Path — Default Dashboard Overview

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

#### AC-2: Time Period Filter on Overview

```gherkin
GIVEN user ở /dashboard
WHEN  chọn bộ lọc thời gian (Today, 7 days, 30 days)
THEN  các giá trị ở stats cards và biểu đồ (nếu có) update ngay lập tức theo khoảng thời gian mới
  AND lưu lại lựa chọn này cho session hiện tại
```

#### AC-3: Customizing Widgets (Sắp xếp / Ẩn hiện)

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

#### AC-2: Empty State

```gherkin
GIVEN user login nhưng chưa có site nào
WHEN  vào /dashboard
THEN  empty state: icon + "Tạo website đầu tiên" + CTA → /onboarding
```

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] Overview fetch đúng dữ liệu từ Analytics và Orders.

---

## US-F03-02: Analytics Details

**Wave 3** | **P0** | **M** | **Status:** Ready

### Story

```
As a   site owner
I want xem website activity bằng số liệu dễ hiểu
So that tôi hiểu hành vi khách hàng
```

### Acceptance Criteria

#### AC-1: Analytics View

```gherkin
GIVEN user ở `Dashboard > Analytics`
WHEN  page load
THEN  hiện 4 stat cards: Visitors, Clicks, Orders, Sales
  AND hiện Daily Bar Chart (theo Today, 7d, 30d)
  AND hiện danh sách hạng mục hiệu quả nhất:
      - Top Pages (Lượt mở trang nhiều nhất)
      - Top Products (Sản phẩm được click nhiều nhất)
  AND không hiển thị GA4/Search Console hoặc thuật ngữ kỹ thuật
```

#### AC-2: Empty Data State

```gherkin
GIVEN user ở `Dashboard > Analytics`
WHEN  chưa có dữ liệu tracking nào trong kỳ được chọn
THEN  hiện empty state cho chart: "Chưa có dữ liệu trong khoảng thời gian này"
  AND giá trị các metrics đều là 0
```

#### AC-3: API Failure

```gherkin
GIVEN user đang ở `Dashboard > Analytics`
WHEN  fetch data bị lỗi (timeout hoặc server error)
THEN  hiển thị toast error "Không thể tải dữ liệu Analytics"
  AND cho phép user nhấn "Thử lại"
```

### Analytics / Tracking Notes
- Track sự kiện `view_analytics_dashboard` với properties `period_selected`.
- Track sự kiện `change_analytics_period`.

### Definition of Done

- [ ] 9-Point Checklist pass
- [ ] Date period selector filters charts correctly.

---

## US-F03-03: SEO Dashboard Overview ⭐

**Wave 3** | **P0 🌟** | **L** | **Status:** Ready

### Story

```
As a   site owner muốn traffic organic
I want thấy SEO health tổng quan và fix bằng AI
So that Google index site tốt hơn
```

### Acceptance Criteria

#### AC-1: Happy Path — SEO Score Dashboard

```gherkin
GIVEN user ở /dashboard/seo
WHEN  page load
THEN  Overall SEO Score (0-100) hiển thị rõ
  AND đây là score duy nhất, không có Local SEO card thứ hai
  AND bốn bucket bars hiển thị Business Data, Schema, AI Discoverability, Technical Health theo layout 2×2 mà không hiện điểm bucket
  AND mỗi unresolved root-cause issue hiển thị đúng badge AI/You, CTA và destination theo F37 §12.3
  AND AI Fix chỉ áp dụng metadata; derived/platform metrics không tạo issue trùng
  AND người dùng nhìn vào biết ngay cần cải thiện phần nào
```

#### AC-2: Generate Sitemap

```gherkin
GIVEN click "Generate Sitemap"
WHEN  click
THEN  auto-generate sitemap.xml
  AND toast "Sitemap đã tạo"
```

#### AC-3: Auto-scan Failure

```gherkin
GIVEN user ở /dashboard/seo
WHEN  hệ thống backend không thể scan trang (API error)
THEN  hiển thị state lỗi cho widget thay vì score
  AND có nút "Thử scan lại"
```

### Analytics / Tracking Notes
- Track sự kiện `view_seo_dashboard`.
- Track sự kiện `generate_sitemap_clicked`.
- Track sự kiện `seo_category_breakdown_viewed`.

### Definition of Done

- [ ] Score calculation works correctly

---

## US-F03-04: Auto SEO Meta Generation

**Wave 3** | **P0** | **M** | **Status:** Ready

### Story

```
As a   store owner with no SEO knowledge
I want store tự động có proper meta tags khi publish
So that tôi xuất hiện trên Google không cần thuê SEO consultant
```

### Acceptance Criteria

#### AC-1: Happy Path — Auto Meta on First Publish

```gherkin
GIVEN I publish my store for the first time và chưa manually set bất kỳ SEO meta nào
WHEN  publish action completes
THEN  all published pages have AI-generated:
      meta title (≤ 60 chars, includes business name + primary keyword)
  AND meta description (≤ 160 chars, compelling, includes a call-to-action)
  AND AI sử dụng trackedKeywords từ cài đặt site để kết hợp từ khoá mục tiêu vào meta một cách tự nhiên (không nhồi nhét)
```

#### AC-2: Retry mechanism if generation fails

```gherkin
GIVEN AI service fail khi đang generate meta tags
WHEN  tiến trình publish hoàn tất
THEN  hệ thống lưu lại log lỗi và queue để tự động retry background
```

#### AC-3: AI đề xuất chỉnh sửa meta đã có sẵn

```gherkin
GIVEN một trang đã có meta title/description do người dùng nhập thủ công
WHEN  AI sinh meta mới (qua Fix All hoặc Auto-generate khi publish)
THEN  hiển thị so sánh bản cũ vs bản mới
  AND người dùng có thể chọn "Giữ bản cũ" hoặc "Áp dụng bản mới"
  AND chỉ ghi đè khi người dùng đồng ý
```

### Analytics / Tracking Notes
- Track sự kiện `auto_seo_meta_generated` (background).

### Additional Criteria

- [ ] Product pages: format = "{Product Name} | {Shop Name} | Buy Online Malaysia"
- [ ] Homepage: format = "{Shop Name} | {Business Category} Online Malaysia"
- [ ] JSON-LD Product schema auto-injected on every product page
- [ ] Sitemap.xml auto-generated on publish
- [ ] AI Generate sử dụng trackedKeywords từ site settings
- [ ] Nếu meta đã có nội dung thủ công → hiển thị so sánh, chỉ ghi đè khi đồng ý

### Definition of Done

- [ ] Meta limits enforced.

---

## US-F03-05: AI Metadata Fix All

**Wave 3** | **P0** | **L** | **Status:** Ready

### Story

```
As a   store owner reviewing SEO dashboard
I want một nút fix toàn bộ metadata issues mà AI được phép xử lý
So that tôi cải thiện meta coverage mà không ghi đè seller-owned data
```

### Acceptance Criteria

#### AC-1: Happy Path — Fix All với Preview

```gherkin
GIVEN my SEO dashboard has at least one missing meta title or description
WHEN  I click "Fix all with AI"
THEN  AI proposes changes — user can approve or skip individual fixes
  AND SEO score updates to reflect improvements
  AND không thay đổi Local Business, schema, content, alt text, crawler, publish, domain, hoặc verification data
  AND tất cả trong 15 giây
  AND all fixes undoable as single batch action
```

#### AC-2: Timeout or Partial Failure

```gherkin
GIVEN I click "Fix all with AI"
WHEN  tiến trình bị quá 15 giây hoặc lỗi nội bộ
THEN  hiển thị toast lỗi: "Không thể hoàn tất AI Fix All, vui lòng thử lại"
  AND giữ nguyên tiến trình đã sinh và cho phép resume (Thử lại)
```

#### AC-3: Prompt Cost Optimization & Content Standards

```gherkin
GIVEN hệ thống chuẩn bị gửi lệnh Prompt đến LLM cho AI Fix All
WHEN  phân tích đầu vào (Input Context)
THEN  hệ thống chỉ gửi mảng batch 5-10 items gồm [Tên, Chuyên mục, 150 chữ đầu tiên của bài]
  AND ép Output dưới định dạng JSON thuần
  AND sinh Meta Tags tuân thủ chuẩn SEO: Title 50-60 ký tự, Meta Desc 150-160 ký tự kết hợp CTA.
  AND sử dụng trackedKeywords từ cài đặt site để từ khoá mục tiêu xuất hiện tự nhiên trong meta sinh ra

GIVEN không còn missing meta title hoặc description
WHEN  SEO Issues render
THEN  nút "Fix all with AI" không hiển thị
```

### Analytics / Tracking Notes
- Track sự kiện `ai_fix_all_seo_started`.
- Track sự kiện `ai_fix_all_seo_completed` với properties `issues_fixed_count`.

### Definition of Done

- [ ] Fix-all completes trong < 15 giây
- [ ] Undo batch fix hoạt động đúng

---

## US-F03-06: Basic SEO Keyword Tracker

**Wave 3** | **P1** | **M** | **Status:** Ready

### Story

```
As a   site owner
I want theo dõi thứ hạng của một vài từ khóa quan trọng nhất trên Google
So that tôi biết nỗ lực SEO của mình có đang mang lại kết quả thiết thực không
```

### Acceptance Criteria

#### AC-1: Happy Path — Manage Tracked Keywords

```gherkin
GIVEN user ở /dashboard/seo
WHEN  cuộn đến phần "Keyword Tracker"
THEN  hiển thị dashboard nhỏ cho phép add tối đa 5 từ khóa (Core keywords)
  AND có ô input để "Thêm từ khóa mới" (disable nếu đã đủ 5)
```

#### AC-2: View Keyword Ranks

```gherkin
GIVEN user đã add ít nhất 1 từ khóa vào tracker
WHEN  ở /dashboard/seo
THEN  hiển thị list các từ khóa đang track
  AND hiển thị Thứ hạng (Rank) hiện tại trên SERP (Search Engine Results Page)
  AND hiển thị mũi tên lên/xuống (Trend) so với lần audit trước đó
```

#### AC-3: Auto Update Frequency

```gherkin
GIVEN hệ thống có danh sách tracking keywords của user
WHEN  cron job chạy (vd: 1 tuần 1 lần hoặc manual fetch)
THEN  hệ thống tự động query hạng của website theo từng keyword
  AND cập nhật kết quả mới nhất vào database
```

### Analytics / Tracking Notes
- Track sự kiện `add_seo_keyword`.
- Track sự kiện `remove_seo_keyword`.

### Definition of Done

- [ ] Giới hạn đúng 5 keywords/tenant để kiểm soát API cost.
- [ ] Cron job hoặc API fetch rank hoạt động chính xác (dùng third-party API rẻ/scrape cơ bản).

---

## US-F03-07: Mobile Web UX — Responsive Dashboard Metrics & Charts

**Wave 3** | **P0 🌟** | **M** | **Status:** Ready

### Story

```
As a   mobile user (Store Owner)
I want my dashboard to concisely display metrics in a thumb-friendly grid and simplify complex charts
So that I can quickly check my business health on-the-go without aggressive scrolling or squinting
```

### Acceptance Criteria

#### AC-1: Metrics 2x2 Grid Layout

```gherkin
GIVEN the user accesses /dashboard on a mobile device (< 768px)
WHEN  the page loads
THEN  the 4 top stat cards (Traffic, Leads, Orders, Revenue) are rendered in a 2x2 CSS Grid
  AND the padding within each card is tightened appropriately to ensure text fits without truncating critical figures
  AND the "Action Required" list is shown immediately below the grid
```

#### AC-2: Touch-Optimized Charts (Analytics)

```gherkin
GIVEN the user navigates to /dashboard/analytics on mobile
WHEN  viewing the Daily Bar Chart
THEN  the chart's X-Axis (dates) automatically skips rendering some labels (e.g., shows every 5th day) to prevent overlapping text
  AND the user can scrub/touch-drag across the bars to see precise daily values in a tooltip positioned above their finger
```

#### AC-3: Customization Panel on Mobile

```gherkin
GIVEN the user taps "Tùy chỉnh Dashboard" on mobile
WHEN  the customization modal/bottom sheet opens
THEN  instead of drag-and-drop, the user can reorder widgets using large native `[⬆]` and `[⬇]` buttons next to each widget name in the list
  AND the modal acts as a bottom sheet (Swipeable drawer) easily closable with a downward swipe gesture
```

### Definition of Done

- [ ] 9-Point Checklist pass
- [ ] Responsive UI grid breaks down smoothly from 4-col (desktop) to 2-col (tablet/mobile).
- [ ] Recharts/Chart.js mobile touch events verified.

---

## US-F03-08: PostHog Analytics Integration

**Wave 3** | **P0 🌟** | **L** | **Status:** Ready

### Story

```
As a   site owner trên hệ thống
I want dashboard analytics tự động hoạt động trên platform subdomain
So that tôi xem được traffic/clicks mà không cần tự cài GA4 hoặc Search Console
```

### Acceptance Criteria

#### AC-1: PostHog client tracking
```gherkin
GIVEN user đang ở Dashboard nhưng chưa có Data
WHEN  storefront nhận visitor/click events
THEN  hệ thống gửi events vào PostHog
  AND dashboard có thể đọc website traffic/click/funnel metrics
```

#### AC-2: Internal analytics fallback
```gherkin
GIVEN PostHog chưa có data hoặc query lỗi
WHEN  user mở Dashboard hoặc Analytics Detail
THEN  hệ thống fallback về `/api/analytics/track` + `analytics` collection nếu có data
  AND UI không bị trắng
```

#### AC-3: Empty state
```gherkin
GIVEN cả PostHog và internal analytics đều chưa có data
WHEN  user mở Dashboard hoặc Analytics Detail
THEN  UI hiển thị empty state rõ ràng
  AND không yêu cầu user tự connect GA4/Search Console
```
