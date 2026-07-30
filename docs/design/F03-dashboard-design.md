# Design & Wireframes: Dashboard Suite (F03)

> **Feature:** F03 — Dashboard Overview, Analytics & SEO
> **Ref PRD:** [F03-dashboard.md](../prd/F03-dashboard.md)
> **Ref Stories:** [F03-dashboard-stories.md](../stories/F03-dashboard-stories.md)
> **Links figma:** https://www.figma.com/design/oFACZVA1oplxslloJWEkLp/TM_Prime-Web-V2.0?node-id=31015-1009&t=601og2GNCjvvkTka-4
> Link localhost: http://localhost:3000/F03-dashboard-ui-demo

Tài liệu này cung cấp wireframe thô (ASCII / cấu trúc text) để minh họa cho các tính năng Dashboard Overview, Analytics và SEO của tính năng F03, phục vụ việc xây dựng UI/UX cho frontend.

---

## 1. Màn hình chính (Dashboard Overview)

### 1.1 Desktop View (Màn hình lớn)

> **[Global CMS Constraint]:** Toàn bộ giao diện Dashboard được render bên trong khu vực `Main Content Area` (giữ nguyên Global Sidebar Navigation và Top Header).

```text
[ Global Sidebar Navigation ] | [ Global Top Header: Breadcrumbs, Store Selector, User Profile ]
                              |
[ Dashboard ]                 | [ Filter: Today | 7 days v | 30 days ] [ Tùy chỉnh Dashboard ]
                              |
---------------------------------------------------------------------------------------------------
| [ Views (Traffic)     ] | [ Clicks (Leads)      ] | [ Checkout (Engagement) ] | [ Revenue             ] |
| [ 15,240  (+12%) ↗    ] | [ 340     (-5%) ↘     ] | [ 1,200    (+8%) ↗      ] | [ RM 15,000 (+20%) ↗  ] |
| [ _--_/^--_/\_        ] | [ _--_/               ] | [ __/--\_/\_            ] | [ _--_/^--_/\_        ] |
---------------------------------------------------------------------------------------------------
                              |
[ Action Required (Pending) ] | [ SEO Health Widget                           ]
                              | 
- Order #1002 từ [John Doe]   |  Điểm SEO: [ 75/100 ] (Circle Chart)
  (Pending - RM 250)    [->]  |
                              |  [AI] Thiếu Meta Title ở 5 sản phẩm       [Fix]
- Order #1001 từ [Jane]       |  [You] Cần tối ưu hình ảnh                [Edit]
  (Pending - RM 150)    [->]  |
                              |  [ ✨ Fix all with AI ] (chỉ hiện khi còn metadata issue)
[ View all Orders ->        ] |
```

### 1.2 Empty State (Chưa có Website)

```text
                              |
                              |               [ (Illustration: Dashboard & Rocket) ]
                              |
                              |                      Chưa có dữ liệu website
                              |     Hãy tạo website đầu tiên để bắt đầu theo dõi hiệu quả kinh doanh.
                              |
                              |                       [ + Tạo Website mới ]
                              |
```

### 1.3 Mobile View (Màn hình nhỏ, Lưới 2x2)

```text
[ Hamburger ] [ Logo ] [ Profile ]
---------------------------------------
Dashboard         [ Filter: 7 days v ]
[ Tùy chỉnh ]
---------------------------------------
[ Views         ] | [ Clicks        ]
[ 15,240 (+12%) ] | [ 340 (-5%)     ]
[ _--_/^--_/\_  ] | [ _--_/         ]
---------------------------------------
[ Checkout      ] | [ Revenue       ]
[ 1,200 (+8%)   ] | [ RM 15,000     ]
[ __/--\_/\_    ] | [ _--_/^--_/\_  ]
---------------------------------------

[ Action Required ]
- Order #1002 (RM 250) [->]
- Order #1001 (RM 150) [->]
[ View all Orders ->]

---------------------------------------

[ SEO Health Widget ]
Điểm SEO: [ 75/100 ]
[AI] Thiếu Meta title [Fix]
[You] Chưa tối ưu ảnh [Edit]
[ ✨ Fix all with AI ] — conditional
```

---

## 2. Màn hình Chi tiết (Analytics Detail)

### 2.1 Desktop View

```text
[ Dashboard ] > [ Analytics ] | [ Filter: Today | 7 days v | 30 days ]
                              |
---------------------------------------------------------------------------------------------------
|  [Daily Traffic Bar Chart]                                                                      |
|                                                                                                 |
|   |         [ Hover Tooltip: May 20 - 1500 views ]                                              |
|   |           _                                                                                 |
|   |   _      | |      _                                                                         |
|   |  | |     | |     | |                                                                        |
|   |__|_|_____|_|_____|_|____________________________________________________________________    |
|      19/5   20/5    21/5                                                                        |
---------------------------------------------------------------------------------------------------
                              |
[ Top Pages (Tab) ] [ Top Products ] [ Top Blogs ]
                              |
1. /home                 - 5,000 views  (30%)
2. /products/ao-phong    - 2,000 views  (15%)
3. /blog/khuyen-mai      - 1,500 views  (10%)
4. /contact              - 500 views    (5%)
... (Max 10 rows)
```

*(Trên Mobile, trục X của Bar chart sẽ được giãn cách, ví dụ chỉ hiện 19/5, 23/5, 27/5 để tránh đè chữ, user có thể chạm, giữ và kéo để xem tooltip chi tiết từng ngày)*

---

## 3. Màn hình Chi tiết (SEO Dashboard)

### 3.1 Desktop View

```text
[ Dashboard ] > [ SEO Dashboard ]
┌ SEO Health ───────────────────────────────────────────────────────────┐
│  ┌─────────┐   Business Data        ██████░░  Needs work             │
│  │   67    │   Schema               ████░░░░  Needs work             │
│  │  /100   │   AI Discoverability   ████████  Good                   │
│  └─────────┘   Technical Health     █████░░░  Needs work             │
├──────────────────────────────────────────────────────────────────────┤
│ ✦ AI can fix 2 issues automatically              [ Fix all with AI ] │
├──────────────────────────────────────────────────────────────────────┤
│ SEO issues                                                   6 open  │
│ [AI]  3 meta descriptions missing [Fix] │ [YOU] Address incomplete [Edit] │
│ [AI]  2 meta titles missing       [Fix] │ [YOU] Opening hours      [Edit] │
│ [YOU] Map location missing       [Edit] │ [YOU] Price range missing [Edit] │
└──────────────────────────────────────────────────────────────────────┘

[ Keyword Tracker (Max 5) ]   | [ + Thêm Từ Khóa ]
| Keyword             | Rank on Google | Trend | Action   |
-----------------------------------------------------------
| "buy shoes online"  | #5             | [ ↗ ] | [ Del ]  |
| "best store VN"     | #12            | [ = ] | [ Del ]  |
| "giày thể thao nam" | #25            | [ ↘ ] | [ Del ]  |
| (Empty slot)        |                |       |          |
| (Empty slot)        |                |       |          |
```

**SEO Health interaction contract:**

- Remove the Score History placeholder; use the space for four compact 2×2 bucket bars without numeric bucket points.
- Show unresolved root causes only, in the existing two-column issue grid; never duplicate downstream schema metrics that share one missing field.
- `AI` rows use `Fix`; `You` rows use `Edit`, `Set up`, or `Publish` and open/perform the exact destination defined in F37 PRD §12.3.
- Show `Fix all with AI` only while at least one title/description issue is AI-fixable. Mobile collapses issue rows to one column.

---

## 4. UI States, Modals & Drawers

### 4.1 Modal Tùy chỉnh Dashboard (Desktop)

Khi click `[ Tùy chỉnh Dashboard ]` trên Desktop:

```text
+-------------------------------------------------------------+
| Tùy chỉnh Dashboard (Overview)                        [ X ] |
|-------------------------------------------------------------|
| Chọn các chỉ số bạn muốn hiển thị (Kéo thả để sắp xếp):     |
|                                                             |
| [::] [x] Views (Traffic)                                    |
| [::] [x] Clicks Widget (Leads)                              |
| [::] [x] Clicks Sản phẩm/Giỏ hàng (Engagement)              |
| [::] [x] Pending Orders / Revenue                           |
| [::] [ ] Lượt truy cập Blog nhiều nhất                    |
| [::] [ ] Lượt mở trang theo URL                             |
|                                                             |
|                                     [ Hủy ] [ Lưu thay đổi ]|
+-------------------------------------------------------------+
```

### 4.2 Bottom Sheet Tùy chỉnh (Mobile)

Thay vì kéo thả khó thao tác trên di động, mobile sử dụng nút Lên/Xuống:

```text
+---------------------------------------+
| [-] (Swipe down to close)             |
| Tùy chỉnh Dashboard                   |
|---------------------------------------|
| [x] Views               [ ⬇ ]         |
| [x] Clicks Widget   [ ⬆ ] [ ⬇ ]         |
| [x] Clicks Checkout [ ⬆ ] [ ⬇ ]         |
| [x] Pending Orders      [ ⬆ ]         |
| [ ] Top Blog Views                    |
|                                       |
| [ Lưu thay đổi ] (Full width button)  |
+---------------------------------------+
```

### 4.3 Quá trình AI SEO Fix All — metadata only (SSE Streaming)

Khi còn title/description issue và seller click `[ ✨ Fix all with AI ]` từ Overview hoặc SEO Dashboard:

```text
+-------------------------------------------------------------+
| ✨ Hệ thống AI đang tự động sửa lỗi SEO...                |
|-------------------------------------------------------------|
|                                                             |
| Tiến trình: [=========================>        ] 70%        |
|                                                             |
| - [x] Tạo Meta Title cho 12 sản phẩm                        |
| - [x] Tối ưu Meta Description cho trang chủ                 |
| - [ ] Tạo Meta Title cho blog posts... (Streaming)          |
| - [ ] Tối ưu Meta Description cho sản phẩm...               |
|                                                             |
| (Vui lòng không đóng cửa sổ này, quá trình mất khoảng 15s)  |
|                                     [ Dừng (Cancel) ]       |
+-------------------------------------------------------------+
```

Sau khi hoàn tất:

```text
+-------------------------------------------------------------+
| ✨ AI SEO Fix All hoàn tất!                           [ X ] |
|-------------------------------------------------------------|
|                                                             |
| Chúc mừng! Điểm SEO của bạn đã tăng lên: 95/100 [ ↗ +20 ]   |
|                                                             |
| 25 lỗi đã được khắc phục.                                   |
|                                                             |
|                                     [ Hoàn tác (Undo) ]     |
|                                     [ OK, Đóng ]            |
+-------------------------------------------------------------+
```

### 4.4 Cảnh báo / Toast Notification

- Fetch data lỗi (API Failure): Toasts màu đỏ *"Không thể tải dữ liệu Analytics. [Thử lại]"*
- SSE Timeout (Fix All > 15s): Toasts màu đỏ *"Không thể hoàn tất AI Fix All, vui lòng thử lại."*

---

## 5. REVAMP v2 — Hợp nhất 3 Tab → Layout 1 Cột (2026-06-24)

> **Branch:** `feat/F03-dashboard-ui-ux-revamp` · **Plan kỹ thuật:** [`plans/260624-1114-dashboard-single-column-revamp/IMPLEMENTATION_PLAN.md`](../../plans/260624-1114-dashboard-single-column-revamp/IMPLEMENTATION_PLAN.md)
> Section này **bổ sung** cho §1–§4 ở trên. Layout đổi từ 3 tab (Overview/Analytics/SEO) → **một luồng cuộn dọc 1 cột**. Reorder/ẩn-hiện block làm trong Customize Modal (không drag inline).

### 5.1 Vertical Anatomy & Information Hierarchy

Khi bỏ Tab, người dùng tiếp cận thông tin bằng **scroll**. Thứ tự block xếp theo **tần suất biến động dữ liệu** (động → tĩnh): chỉ số thay đổi hàng giờ đập vào mắt trước, chỉ số ổn định (tối ưu theo chu kỳ) nằm dưới.

```text
┌─────────────────────────────────────────────────────────────────────┐
│ [Toolbar — sticky top-right]   [ Filter: Today|7d|30d ] [ Tùy chỉnh ]│  ← luôn cố định
├─────────────────────────────────────────────────────────────────────┤
│ ① DashboardOnboarding (full-width, slide-up ẩn khi đủ checklist)     │  ← hành động cần làm NGAY
├─────────────────────────────────────────────────────────────────────┤
│ ② AT-A-GLANCE — 4 cards: Views · Leads · Engagement · Revenue*       │  ← ĐỘNG NHẤT (hàng giờ)
│    [ 15,240 +12%↗ ] [ 340 -5%↘ ] [ 1,200 +8%↗ ] [ Revenue (Soon)* ] │     → đập vào mắt đầu tiên
├─────────────────────────────────────────────────────────────────────┤
│ ③ TRAFFIC & PERFORMANCE  (#section-analytics)                        │  ← động (hàng ngày)
│    Daily Pageview Bar Chart (+ trục Y) → TopPerformingList           │
│    [ Pages | Blogs | Referrers | Products(Soon) ]                    │
├─────────────────────────────────────────────────────────────────────┤
│ ④ SEO HEALTH & OPTIMIZATION  (#section-seo-health)                   │  ← ỔN ĐỊNH hơn (theo chu kỳ)
│    [ Gauge 75/100 | 4 bucket bars 2×2 ] · SEO Issues 2 columns       │     → tối ưu định kỳ, ko cần
│    Conditional AI strip · issue rows with AI/You + destination CTA   │     đập mắt mỗi lần vào
├─────────────────────────────────────────────────────────────────────┤
│ ⑤ BASIC KEYWORD TRACKER (#section-keywords, P1)                      │  ← tác vụ SEO thủ công riêng
│    Up to 5 tracked keywords; không có Sitemap/Auto Meta/crawler tools│
├─────────────────────────────────────────────────────────────────────┤
│ ⑥ Pending Orders (OFF mặc định — F10, bật qua Customize)            │  ← cuối cùng
└─────────────────────────────────────────────────────────────────────┘
* Revenue = Coming Soon overlay (xem §5.2)
```

**Nguyên tắc thứ tự (lý do để chống misalignment khi UAT):**
- **Traffic trên SEO** vì traffic là chỉ số động — thay đổi theo giờ/ngày, user cần thấy ngay khi mở dashboard. SEO ổn định hơn, là việc tối ưu theo chu kỳ → đặt dưới.
- **Onboarding trên cùng** (trên cả At-a-Glance) vì là hành động bắt buộc để mở khóa dữ liệu.
- **F10/placeholder xuống đáy** — không chiếm vùng "above the fold".

**Điều hướng thay Tab:** SEOHealthWidget (nếu giữ ở Overview) + mọi link nội bộ → **scroll-to anchor** (`scrollIntoView({behavior:'smooth'})`) tới `#section-seo-health`, không còn `setActiveTab`.

**Mobile (375px):** At-a-Glance giữ lưới 2×2 (như §1.3); các section ③④⑤ stack dọc full-width.

### 5.2 Quy chuẩn "Coming Soon" / Preview State (F10)

Áp dụng cho: **Revenue card · Pending Orders section · Top Products tab · SEO History · Keyword Tracker**. Dùng 1 component tái sử dụng `ComingSoonOverlay` (DRY).

```text
┌──────────────────────────────┐
│ Revenue          [Coming Soon]│  ← Badge variant="secondary" (xám)
│ ┌──────────────────────────┐ │
│ │  RM ----    --%          │ │  ← nội dung mờ (opacity-60)
│ │  _--_/^--_/\_  (sparkline)│ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
   (hover → Tooltip giải thích)
```

| Thuộc tính | Quy chuẩn | Token / Class thực tế |
|------------|-----------|------------------------|
| **Opacity nội dung** | Mờ nhẹ phần data, giữ đọc được | `opacity-60` (đồng bộ precedent disabled/loading trong repo) |
| **Badge** | Pill xám low-contrast, chữ "Coming Soon" / "Soon" / "Beta" | `<Badge variant="secondary">` → `bg-slate-400/[0.14] text-slate-600 dark:text-slate-300` |
| **Vị trí badge** | Góc trên-phải của card/section | absolute top-right |
| **Cursor khi hover** | `not-allowed` cho vùng tương tác (tab/nút bị khóa) | `cursor-not-allowed`. Card chỉ-xem (Revenue) giữ cursor mặc định |
| **Tooltip** | Hiện khi hover, giải thích tính năng đang phát triển | shadcn `Tooltip` (Radix), bg `--popover`, text `--popover-foreground/0.85` |
| **Tooltip copy (Revenue)** | — | "Tính năng tính doanh thu từ đơn đã thanh toán đang được phát triển (F10)." |
| **Pending Orders (khi bật)** | Render skeleton data ảo + badge "Beta" | skeleton + `<Badge variant="secondary">Beta</Badge>` |

> Lưu ý: component có sẵn `studio/_components/coming-soon-empty.tsx` dùng token admin-scoped (`--accent*`). Dashboard **không** dùng lại trực tiếp — `ComingSoonOverlay` mới dùng token semantic của dashboard (`--primary`, `--muted-foreground`, Badge `secondary`) để đồng bộ màu.

### 5.3 Unified Empty State (chưa có site khả dụng)

Khi `!hasUsableSites`: render **At-a-Glance ở trạng thái zero-data** → ngay dưới hiện **MỘT** khối Empty State lớn, action-oriented (không rải empty state nhỏ rời rạc). **Ẩn hoàn toàn** section ③④⑤⑥.

```text
├─────────────────────────────────────────────────────────────────────┤
│ ② AT-A-GLANCE (zero data)                                            │
│    [ Views 0 ] [ Leads 0 ] [ Engagement 0 ] [ Revenue (Soon) ]      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│                  [ Illustration: Dashboard & Rocket ]                 │  ← khích lệ
│                     (glow primary/0.2, blur-60px)                     │
│                                                                       │
│              Website của bạn chưa được kích hoạt                      │  ← H2, --foreground
│   Hoàn thành các bước hướng dẫn phía trên để mở khóa                  │  ← --muted-foreground
│           hệ thống Phân tích dữ liệu & Tối ưu SEO.                    │
│                                                                       │
│                  [ ✨ Thiết lập Website ngay ]                        │  ← CTA gradient info→primary
│                                                                       │     scroll-up tới Onboarding ①
└─────────────────────────────────────────────────────────────────────┘
```

| Thành phần | Quy chuẩn (bám house style §1.2 / `DashboardEmptyState.tsx`) |
|------------|-------------------------------------------------------------|
| **Illustration** | Rocket hiện có (200–256px) + glow `hsl(var(--primary)/0.2) blur-60px`. **Tái dùng** illustration cũ (không vẽ mới). |
| **Container** | Centered, max-width ~448px, gap 18px icon↔text |
| **Title** | H2 30px bold, `hsl(var(--foreground))` |
| **Description** | 16px medium, `hsl(var(--muted-foreground))` |
| **CTA** | 1 nút mạnh duy nhất, gradient `from-[hsl(var(--info))] to-[hsl(var(--primary))]`, text trắng, hover scale 1.02 |
| **CTA target** | ⚠️ **Khác** `DashboardEmptyState` (vốn → `/builder/new`): nút này **scroll-up tới `#dashboard-onboarding`** để user hoàn thành checklist. (Nếu chưa có site nào cả → fallback `/builder/new`.) |

> Phân biệt 2 empty state: `DashboardEmptyState` (§1.2, chưa có *site nào* → tạo mới) vs `UnifiedEmptyState` (§5.3, *có site nhưng chưa khả dụng/chưa publish* → hoàn thành onboarding). Logic trigger: `hasUsableSites` (giữ nguyên điều kiện, đổi cách render — không `return null`).

### 5.4 Trạng thái "Không có data trong kỳ" (7d/30d rỗng)

Khác với §5.3 — site khả dụng nhưng kỳ lọc không có data: **không ẩn block**. AnalyticsChart + TopPerformingList tự render `AnalyticsEmptyState` riêng (giữ logic hiện tại). SEO Issues List rỗng → hiện trạng thái "allGood".

---
*(End of Wireframe Document — Revamp v2 added 2026-06-24)*
