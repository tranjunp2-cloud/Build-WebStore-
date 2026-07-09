# [F03] Dashboard UI/UX Revamp — Hợp nhất 3 Tab → Layout 1 Cột (All-in-One)

> **Branch:** `feat/F03-dashboard-ui-ux-revamp`
> **Created:** 2026-06-24
> **Scope:** Thuần UI/UX. SEO Score History (backend) → tách PR riêng sau.
> **Type:** Frontend refactor + 1 schema change (tenant `dashboardPreferences`)

---

## 1. Mục tiêu

Gộp 3 view tab hiện tại (`OverviewView` / `AnalyticsView` / `SEOViewContent`) thành **một luồng cuộn dọc 1 cột** (single-column stream). Mỗi khối là 1 section full-width, hỗ trợ **reorder + ẩn/hiện thống nhất 1 cấp (flat list)** qua Customize Dashboard. Xử lý triệt để: empty states, tính năng TODO F10 (Revenue / Pending Orders / Top Products), và placeholder cho tính năng chờ backend (SEO History, Keyword Tracker).

**Không làm trong PR này:** SEO Score History (cần DB snapshot + cron), Revenue/Orders thật (F10) — chỉ render placeholder.

---

## 2. Quyết định kỹ thuật đã chốt

| # | Vấn đề | Quyết định |
|---|--------|-----------|
| 1 | SEO Score History line-chart | **Placeholder** (khung "đang phát triển" bên phải gauge). 0 dòng backend. Tách PR sau. |
| 2 | Customize Dashboard | **Flat list 1 cấp** — stat-card + section cùng cấp trong 1 mảng IDs |
| 3 | "Chưa có site khả dụng" | Giữ điều kiện `hasUsableSites`, **đổi cách render**: hiện `UnifiedEmptyState` dưới At-a-Glance thay vì ẩn cứng |
| 4 | Tab system | Bỏ `DashboardTabs` + `useTabContext` + `?tab=` param; convert click→scroll/anchor |

---

## 3. Schema change — `dashboardPreferences`

### Hiện tại
- **File:** `src/collections/Tenants.ts:302-305` — field `settings.dashboardPreferences`, type `json`, lưu `string[]`
- **Default:** `['views', 'leads', 'engagement']` (`'revenue'` cố tình loại — TODO F10)
- **Action:** `src/app/(dashboard)/actions.ts:9-36` — `updateDashboardPreferences(preferences: string[])`

### Mới (flat list — mở rộng namespace ID)
Giữ nguyên **type `string[]`** (không đổi schema DB, không cần migration cột) — chỉ **mở rộng tập giá trị hợp lệ** của các phần tử:

```ts
// Block ID namespace (flat, 1 cấp)
type DashboardBlockId =
  | 'stat-views' | 'stat-leads' | 'stat-engagement' | 'stat-revenue'  // At-a-Glance cards
  | 'section-analytics'       // Khối 3: Traffic & Performance
  | 'section-seo-health'      // Khối 4: SEO Health & Optimization
  | 'section-seo-tools'       // Khối 5: Sitemap/Meta + Issues/Keyword
  | 'section-pending-orders'  // Khối bổ sung (TODO F10)

const DEFAULT_DASHBOARD_BLOCKS: DashboardBlockId[] = [
  'stat-views', 'stat-leads', 'stat-engagement',
  'section-analytics', 'section-seo-health', 'section-seo-tools',
]
```

### ⚠️ Backward-compat (data cũ đang lưu `['views','leads','engagement']`)
Cần **migration mềm ở runtime** (không touch DB) — khi đọc preferences:
1. Nếu phần tử là tên cũ (`views`→`stat-views`, `leads`→`stat-leads`, `engagement`→`stat-engagement`, `revenue`→`stat-revenue`) → map sang ID mới.
2. Nếu preferences cũ **không chứa section nào** → append default sections vào cuối (`section-analytics`, `section-seo-health`, `section-seo-tools`) để user cũ vẫn thấy Analytics/SEO.

→ Tạo helper `normalizeDashboardBlocks(raw: string[] | null): DashboardBlockId[]` trong `src/lib/dashboard-utils.ts` (file đã tồn tại). Dùng cả ở `page.tsx` (render) lẫn `DashboardCustomizeModal` (hiển thị).

> **Không cần** entry trong `scripts/db-setup.js` MIGRATIONS vì cột `json` không đổi kiểu. (Xác nhận lại khi code: field đang là `json` → chỉ đổi *nội dung*, không đổi *cột*.)

---

## 4. Component changes

### 4.1 Xóa / Deprecate
| File | Hành động |
|------|-----------|
| `src/components/dashboard/DashboardTabs.tsx` | **Xóa** — không còn tab nav |
| `src/components/dashboard/DashboardTabContent.tsx` | **Xóa** (`useTabContext`, `TabPanel`, `TabId`, popstate/pushState) |
| `?tab=` URL param trong `page.tsx` | **Bỏ** logic chọn tab |

### 4.2 Sửa
| File | Thay đổi |
|------|----------|
| `src/app/(dashboard)/dashboard/page.tsx` | Bỏ `DashboardTabContent` wrapper + `defaultTab`. Render 1 cột: Toolbar → Onboarding → các block theo `normalizeDashboardBlocks(prefs)`. Map từng blockId → component tương ứng. Giữ data fetch hiện có; truyền `searchParams` cho Analytics/SEO như cũ. Khi `!hasUsableSites`: render At-a-Glance (zero data) + `UnifiedEmptyState`, **ẩn** section-analytics/seo. |
| `src/components/dashboard/SEOHealthWidget.tsx:52` | Bỏ `setActiveTab('seo')` → đổi thành **scroll-to** `#section-seo-health` (dùng `document.getElementById(...).scrollIntoView({behavior:'smooth'})`) |
| `src/components/dashboard/DashboardStats.tsx` | Thêm **Revenue card** (`stat-revenue`) ở trạng thái Coming Soon (overlay opacity ~60% + badge xám "Coming Soon" + tooltip hover). Giữ sparkline + badge %. |
| `src/components/dashboard/AnalyticsChart.tsx` | Thêm `<YAxis />` (Recharts) làm mốc tham chiếu. |
| `src/components/dashboard/TopPerformingList.tsx` | Button-group tinh gọn: Pages \| Blogs \| Referrers \| **Products (disabled + tag "Soon")**. Giữ rank badge / view count / % / cap 5000. |
| `src/components/dashboard/views/SEOViewContent.tsx` | Bên phải gauge: thêm **SEO History placeholder** (icon chart mờ + text "đang phát triển"). Footer card: preview lỗi nghiêm trọng nhất. Keyword Tracker: khung placeholder "chờ Google Search Console". |
| `src/components/dashboard/DashboardCustomizeModal.tsx` | Đổi `ALL_METRICS` → **`ALL_BLOCKS`** (flat list gồm stat + section). Mỗi block: id, label, type ('stat'\|'section'), badge (Soon nếu F10). Giữ @dnd-kit reorder + checkbox toggle. Save vẫn qua `updateDashboardPreferences`. |
| `src/components/dashboard/views/OverviewView.tsx` / `AnalyticsView.tsx` / `SEOView.tsx` | Bỏ vai trò "view của tab" → thành section component nhận props, render trong stream. Mỗi section bọc trong wrapper có `id` anchor (`section-analytics`, …) + draggable handle (nếu reorder inline) — hoặc giữ reorder chỉ trong modal (KISS, ưu tiên). |

### 4.3 Tạo mới
| File | Mục đích |
|------|----------|
| `src/components/dashboard/UnifiedEmptyState.tsx` | Empty state lớn khi `!hasUsableSites`: illustration + CTA "Hoàn thành onboarding để mở khóa Analytics & SEO". Render dưới At-a-Glance. |
| `src/components/dashboard/ComingSoonOverlay.tsx` | Wrapper tái sử dụng (DRY): overlay mờ + badge "Soon/Beta" + tooltip. Dùng cho Revenue card, Products tab, Pending Orders, SEO History, Keyword Tracker. |
| `src/lib/dashboard-utils.ts` (sửa, đã tồn tại) | `normalizeDashboardBlocks()` + const `DEFAULT_DASHBOARD_BLOCKS` + `ALL_BLOCKS` metadata. |

---

## 5. Layout 1 cột — thứ tự block mặc định

```
┌─ Toolbar (sticky top-right): PeriodSelector + Customize ─┐
├─ DashboardOnboarding (full-width, tự ẩn khi đủ bước) ────┤
├─ Khối 2: At-a-Glance — 4 cards (Views/Leads/Engagement/Revenue*) │
│   * Revenue = ComingSoonOverlay                          │
├─ [nếu !hasUsableSites → UnifiedEmptyState, dừng tại đây] │
├─ Khối 3: section-analytics (#section-analytics)          │
│   AnalyticsChart (+YAxis) → TopPerformingList            │
├─ Khối 4: section-seo-health (#section-seo-health)        │
│   Gauge | SEO History placeholder · 3 progress bars      │
│   · AI Fix All · footer preview lỗi                      │
├─ Khối 5: section-seo-tools                               │
│   Sitemap/AutoMeta · SEO Issues List · Keyword placeholder│
└─ (Optional) section-pending-orders (off mặc định, F10)   ┘
```

Reorder/ẩn-hiện: qua **Customize modal** (ưu tiên KISS — không drag inline trên page ở v1).

---

## 6. i18n keys mới (`src/i18n/locales/*.json`)

Thêm dưới namespace `dashboard`:
- `dashboard.comingSoon.badge`, `dashboard.comingSoon.revenueTooltip`
- `dashboard.unifiedEmpty.title`, `.description`, `.cta`
- `dashboard.seo.history.placeholder`
- `dashboard.analytics.products.soon`
- `dashboard.customizeModal.sections.*` (label cho mỗi block: analytics, seoHealth, seoTools, pendingOrders)

→ Cập nhật **cả `en.json` lẫn `vi.json`** (và locale khác nếu có). Giữ cấu trúc hiện tại (file `src/i18n/locales/en.json:780`).

---

## 7. 9-Point Checklist (CLAUDE.md)

- [ ] Loading: skeleton cho mỗi section (đã có pattern)
- [ ] Empty: `UnifiedEmptyState` + `AnalyticsEmptyState` (giữ) + SEO allGood
- [ ] Error: toast đỏ + retry (Analytics đã có `error`/`retry` keys)
- [ ] Form validation: N/A (chỉ Customize toggle)
- [ ] Button states: AI Fix All / Generate Sitemap disabled khi pending
- [ ] Toast: Customize save, AI Fix, Sitemap (giữ)
- [ ] Auth redirect: 401 → /login (page server-side, giữ)
- [ ] Mobile 375px: At-a-Glance 4 card → grid 2x2; sections stack; **test bắt buộc**
- [ ] TS clean: `tsc --noEmit`, zero `any`, type `DashboardBlockId`

---

## 8. Thứ tự thực thi (đề xuất)

1. **Foundation:** `dashboard-utils.ts` (block IDs + `normalizeDashboardBlocks` + `ALL_BLOCKS`) + `ComingSoonOverlay` + `UnifiedEmptyState`
2. **page.tsx:** bỏ tab system, render stream theo blocks; xóa `DashboardTabs`/`DashboardTabContent`
3. **Stats:** Revenue Coming Soon card
4. **Analytics:** YAxis + TopPerformingList button-group + Products Soon
5. **SEO:** History placeholder + footer preview + Keyword placeholder; SEOHealthWidget scroll-to
6. **Customize modal:** flat list stat+section
7. **i18n:** keys mới (en + vi)
8. **QA:** `tsc --noEmit`, mobile 375px, backward-compat preferences cũ

---

## 9. Quyết định bổ sung (đã chốt 2026-06-24)

1. **Reorder**: ✅ **Chỉ kéo-thả trong Customize Modal** (KISS). Không drag inline trên page. Pattern chuẩn như Shopify/Notion — tránh ức chế khi vừa drag vừa scroll qua section lớn.
2. **`section-pending-orders` (F10)**: ✅ **Đưa vào Customize Modal ngay, mặc định OFF**. User bật → render component + `ComingSoonOverlay` (skeleton/Beta). Dùng để test cơ chế ẩn/hiện block nhóm F10 + kích thích tò mò.
3. **Locale**: ✅ Dự án chỉ có **2 locale: `en` + `vi`**. Cập nhật đủ key mới vào cả 2 file là CI pass.

## 10. Rủi ro còn lại (verify khi code, không block)

1. **Field `dashboardPreferences` type `json`**: xác nhận khi code rằng đổi *nội dung* mảng KHÔNG cần entry migration trong `scripts/db-setup.js` (chỉ cần nếu đổi *kiểu cột*). Dự kiến: không cần.
2. **Backward-compat**: test kỹ `normalizeDashboardBlocks()` với data cũ (`['views','leads','engagement']`) → phải tự map + append default sections.
