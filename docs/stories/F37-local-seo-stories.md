# User Stories: Local SEO & Search Performance (F37)



> **Feature:** F37 — Local SEO & Search Performance
> **Wave:** 4 | **Priority:** P0/P1 | **Ref PRD:** [F37-local-seo-search-performance.md](../prd/F37-local-seo-search-performance.md)

---

## Phasing (timeline-driven)

> F37 chia 2 phase. Phase 1 KHÔNG phụ thuộc OAuth Google — ship sớm. Phase 2 cần hạ tầng Google OAuth (hiện **chưa tồn tại** trong codebase — xem note ở US-F37-05).


| Phase             | Stories                       | Điều kiện                                                                             |
| ----------------- | ----------------------------- | ------------------------------------------------------------------------------------- |
| **Phase 1 (P0)**  | US-F37-01, 02, 03, 04, 08, 09 | Không cần OAuth. Reuse nhiều thành phần đã có                                         |
| **Phase 2 (P1)**  | US-F37-05, 06, 07             | Cần build Google OAuth từ đầu (GBP + GSC) + Google verification (~4–6 tuần lead time) |
| **Deferred (P2)** | hreflang (trong US-F37-09)    | Blocked bởi i18n client-side; chờ F21 URL-based locale routing                        |


---

## Global Acceptance Criteria (CMS Layout Compliance)

> **Áp dụng cho mọi User Story dashboard-facing trong file này.**

```gherkin
GIVEN user truy cập tab/tính năng trang quản trị (Dashboard → Local SEO)
THEN  nội dung render gọn bên trong Main Content Area (tuân thủ F18-03)
  AND Global Top Header (F18-02) và Global Sidebar Navigation (F18-01) giữ nguyên, không re-render toàn trang
```

## Global Acceptance Criteria (Scope Isolation)

> **Áp dụng cho mọi auto-generation trong file này.**

```gherkin
GIVEN bất kỳ auto-gen nào của F37 (metadata fallback, JSON-LD, llms.txt, robots AI-crawler logic)
THEN  chỉ kích hoạt trong route tenant storefront `/sites/[slug]/*`
  AND platform main site (`/`, `/dashboard`, `/admin`, `/api/*`) KHÔNG bị ảnh hưởng
```

---

## US-F37-01: Local Business Data Model

**Wave 4** | **P0** | **L** | **Status:** Draft

### Story

```
As a   chủ shop SME không rành SEO
I want nhập địa chỉ cấu trúc, giờ mở cửa và danh mục kinh doanh cho website
So that hệ thống có dữ liệu chuẩn để hiển thị tôi trên Google Maps và AI assistants
```

### Acceptance Criteria

#### AC-1: Happy Path — Thiết lập địa chỉ cấu trúc

```gherkin
GIVEN seller ở Site Settings → section "Thông tin doanh nghiệp địa phương"
WHEN  điền streetAddress, city, state, postcode, country, chọn businessCategory, nhập giờ mở cửa
  AND nhấn Save
THEN  dữ liệu lưu vào Sites collection, group `localBusiness`
  AND LocalBusiness JSON-LD trên storefront homepage emit đầy đủ PostalAddress, openingHoursSpecification, @type đúng sub-type
  AND Local SEO Score tăng ≥ 20 điểm
  AND checklist items "Thêm địa chỉ" và "Cập nhật giờ mở cửa" đổi sang ✓ Done
```

#### AC-2: Ngày đóng cửa được xử lý đúng

```gherkin
GIVEN seller đánh dấu Thứ 7 và Chủ nhật là "Đóng cửa" trong bảng giờ mở cửa
WHEN  Save thành công
THEN  JSON-LD openingHoursSpecification KHÔNG chứa entry cho Sa và Su
  AND dữ liệu giờ lưu đúng vào array table `sites_opening_hours`
```

#### AC-3: Validation — Tọa độ và mã bưu điện

```gherkin
GIVEN seller nhập latitude ngoài khoảng [-90, 90] hoặc longitude ngoài [-180, 180]
WHEN  nhấn Save
THEN  hiển thị lỗi inline, không lưu giá trị sai
  AND postcode validate chuẩn MY = 5 chữ số
```

### Additional Criteria

- [ ] `localBusiness` group thay thế free-text `contactInfo.address` nhưng giữ field cũ cho backward compat (BR-02)
- [ ] Array table `sites_opening_hours` theo convention: varchar id + `_parent_id` + `_order` (đăng ký trong `scripts/db-setup.js` MIGRATIONS)
- [ ] Form có Google Maps embed preview từ lat/lng
- [ ] `state` tại MY dùng dropdown 13 tỉnh + 3 vùng liên bang (xem US-F37-09)

### Market Notes

- MY market (duy nhất): PostalAddress chuẩn MY (postcode 5 chữ số, addressCountry "MY").

### Analytics / Tracking Notes

- Track `local_business_data_saved` với property `fields_completed_count` (F22).

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] Schema migration pass `scripts/check-migrations.js` gate

---

## US-F37-02: Enhanced LocalBusiness JSON-LD

**Wave 4** | **P0** | **M** | **Status:** Draft

> **Reality note:** `generateLocalBusinessSchema()` đã tồn tại (`src/lib/seo/json-ld.ts:127-157`) và đã emit `address` dạng PostalAddress (tối thiểu). Story này **ENHANCE**, không build từ đầu.

### Story

```
As a   chủ shop SME
I want JSON-LD LocalBusiness của tôi đầy đủ và hợp lệ theo Schema.org
So that Google hiển thị tôi trong Local Pack và AI có thể parse thông tin chính xác
```

### Acceptance Criteria

#### AC-1: Happy Path — JSON-LD đầy đủ và hợp lệ

```gherkin
GIVEN site đã có đầy đủ localBusiness data (address, lat/lng, hours, category, priceRange)
WHEN  Google Rich Results Test fetch storefront homepage
THEN  JSON-LD LocalBusiness chứa: @type (sub-type chính xác), name, url, address (PostalAddress đầy đủ), telephone, geo (GeoCoordinates), openingHoursSpecification (array đúng format), priceRange, areaServed
  AND validator không báo error
```

#### AC-2: aggregateRating KHÔNG emit ở mức LocalBusiness

```gherkin
GIVEN site có review data
WHEN  render JSON-LD LocalBusiness
THEN  KHÔNG có `aggregateRating` trong LocalBusiness type (policy Google 2025–2026)
  AND `aggregateRating` chỉ emit trên Product/Service types nếu áp dụng
```

### Additional Criteria

- [ ] `generateLocalBusinessSchema()` là pure function, không async, < 5ms (NFR)
- [ ] `hasMap` chứa GBP URL (nếu connected) và/hoặc Waze URL
- [ ] Address ưu tiên `localBusiness.streetAddress`; fallback `contactInfo.address` nếu trống (BR-02)

### Definition of Done

- [ ] 9-Point Checklist pass
- [ ] Output validated bằng Google Rich Results Test

---

## US-F37-03: AI Crawler Permissions & llms.txt

**Wave 4** | **P0 (crawler) / P1 (llms.txt)** | **M** | **Status:** Draft

> **Reality note:** `robots.txt` đã là per-tenant tại `src/app/sites/[slug]/robots.txt/route.ts:53-69` và đang **chặn** AI crawler (CCBot, ClaudeBot, Google-Extended, GPTBot — lưu ý **PerplexityBot hiện CHƯA có trong list**). Story này lật từ block → allow + thêm toggle.

### Story

```
As a   chủ shop SME muốn xuất hiện trên AI assistants
I want website của tôi cho phép AI crawler index mặc định, nhưng vẫn tắt được nếu muốn
So that ChatGPT, Perplexity, Gemini có thể gợi ý doanh nghiệp của tôi
```

### Acceptance Criteria

#### AC-1: Happy Path — AI crawlers mặc định mở

```gherkin
GIVEN storefront của bất kỳ tenant nào (không phân biệt setting)
WHEN  fetch https://{storefront-domain}/robots.txt
THEN  robots.txt KHÔNG chứa "Disallow: /" cho GPTBot, ClaudeBot, Google-Extended, PerplexityBot, CCBot
  AND mặc định allow cho các user-agent trên
```

#### AC-2: Seller opt-out per-site

```gherkin
GIVEN seller TẮT toggle "Cho phép AI crawlers index website" trong Site Settings
WHEN  fetch https://{storefront-domain}/robots.txt
THEN  robots.txt chứa Disallow: / cho các AI user-agent tương ứng của site đó
  AND crawler thông thường (Googlebot, Bingbot) KHÔNG bị block
```

#### AC-3: llms.txt — Nội dung đúng cấu trúc

```gherkin
GIVEN storefront có đủ site data (name, description, products, contact, hours)
WHEN  GET https://{storefront-domain}/llms.txt
THEN  response là text/plain, HTTP 200, format Markdown
  AND chứa: tên doanh nghiệp, mô tả ngắn, ≥ 5 URL quan trọng, thông tin liên lạc, giờ mở cửa
```

### Additional Criteria

- [ ] `ai_crawlers_enabled` boolean DEFAULT true trên Sites
- [ ] `llms.txt` generate động runtime, không cache lâu (BR-09); route mới `src/app/sites/[slug]/llms.txt/route.ts`
- [ ] llms.txt là tín hiệu experimental — không oversell impact

### Market Notes

- Quyết định "default allow" đã được stakeholder approve (BR-03).

### Analytics / Tracking Notes

- Track `ai_crawler_toggle_changed` với property `enabled`.

### Definition of Done

- [ ] 9-Point Checklist pass
- [ ] robots.txt AI crawler behavior verified bằng automated test

---

## US-F37-04: Local SEO Score & Actionable Checklist

**Wave 4** | **P0** | **L** | **Status:** Draft

> **Reality note:** F03 đã có general SEO score (`SEOView.tsx`). Local SEO Score là điểm **riêng biệt**, không thay thế. **RESOLVED (CF-4):** score normalize trên bucket đang áp dụng. Phase 1 (Business Data 35% / Structured Data 30% / AI Discoverability 20% / Technical Health 15%) đạt 100; bucket GBP/Reviews/NAP/Citations hiển thị "🔒 unlock Phase 2" từ đầu → không tụt điểm. Công thức đầy đủ ở PRD §13.8.

### Story

```
As a   chủ shop SME không rành kỹ thuật
I want một điểm Local SEO và danh sách "Việc cần làm" ưu tiên rõ ràng
So that tôi biết chính xác phải làm gì tiếp theo để khách tìm thấy mình
```

### Acceptance Criteria

#### AC-1: Happy Path — Score phản ánh completeness

```gherkin
GIVEN site chưa có local business data, chưa kết nối GBP
WHEN  vào tab Local SEO trong dashboard
THEN  Local SEO Score hiển thị ≤ 30/100
  AND checklist hiển thị ≥ 4 items "Việc cần làm" priority High

GIVEN seller hoàn thành địa chỉ cấu trúc + giờ mở cửa + bật AI crawlers (Phase 1)
WHEN  hệ thống tính lại score
THEN  Local SEO Score tăng tương ứng các hạng mục đã earn
  AND số items High priority (không phụ thuộc GBP) = 0
```

#### AC-2: One-click fix

```gherkin
GIVEN seller thấy checklist item "Bật AI crawlers" trạng thái Chưa hoàn thành
WHEN  click nút "Bật ngay"
THEN  toggle "Cho phép AI crawlers" tự động bật
  AND robots.txt của storefront cập nhật ngay
  AND checklist item đổi sang ✓ Done và Score tăng tương ứng
```

### Additional Criteria

- [ ] Công thức Phase 1: Business Data 35% / Structured Data 30% / AI Discoverability 20% / Technical Health 15% (normalize, đạt 100). Phase 2 thêm GBP/Reviews/NAP/Citations — xem PRD §13.8
- [ ] Score tính lại khi save site settings hoặc khi GBP Insights refresh (max 1 lần/24h) — BR-07
- [ ] Checklist tối đa 10 items, ẩn item đã done (BR-10)
- [ ] Pure function `src/lib/seo/local-seo-score.ts` (mới)
- [ ] Mỗi item: mô tả seller-friendly, impact label, nút action

### Analytics / Tracking Notes

- Track `local_seo_checklist_completed` với property `item_id` (F22).

### Definition of Done

- [ ] 9-Point Checklist pass
- [ ] Score calculation works correctly cho cả Phase 1 (chưa có GBP) và Phase 2

---

## US-F37-05: Google Business Profile OAuth & Sync

**Wave 4** | **P1** | **XL** | **Status:** Draft — **PHASE 2**

> **⚠️ Reality note (quan trọng nhất):** Codebase **KHÔNG có hạ tầng Google OAuth nào** — không có `src/app/api/google/`, không có token Google trên Tenants (chỉ Stripe/Xendit). US-F03-08 mới chỉ là *story plan*, chưa implement. Cái gọi là "GSC OAuth của F03" thực chất chỉ là 2 text field nhập tay (`googleAnalyticsId`, `googleVerificationToken`) — KHÔNG phải OAuth.
> **→ Phải build Google OAuth từ đầu:** consent URL builder, callback handler, encrypted token store, auto-refresh, CSRF state. Hạ tầng này dùng chung cho cả **GBP** (story này) và **GSC** (F03-08). Cần submit Google verification sớm (~4–6 tuần lead time).

### Story

```
As a   chủ shop SME
I want kết nối Google Business Profile của tôi vào platform
So that tôi xem được số liệu thực (cuộc gọi, chỉ đường) và đồng bộ thông tin lên Google
```

### Acceptance Criteria

#### AC-1: Happy Path — OAuth connect thành công

```gherkin
GIVEN seller click "Kết nối Google Business Profile" (chưa connect)
WHEN  hoàn thành Google OAuth flow với account có GBP listing (scope business.manage)
THEN  hệ thống lưu access_token + refresh_token vào Sites.gbpIntegration (per-site)
  AND dashboard hiển thị badge "GBP: Đã kết nối ✓"
  AND hệ thống tự động pull GBP Insights trong vòng 30 giây
```

#### AC-2: Sync giờ mở cửa lên GBP

```gherkin
GIVEN seller đã connect GBP và đã thiết lập giờ mở cửa trên platform
WHEN  click "Đồng bộ giờ mở cửa lên GBP"
THEN  hệ thống gọi GBP API cập nhật opening hours trên GBP listing (one-way push)
  AND hiện toast "Đồng bộ thành công" sau khi API confirm
  AND nếu API lỗi → toast lỗi cụ thể (không nuốt lỗi)
```

#### AC-3: Wizard cho seller chưa có GBP

```gherkin
GIVEN seller chưa có Google Business Profile
WHEN  mở wizard "Kết nối GBP"
THEN  bước 1 hỏi "Bạn đã có GBP chưa?", chọn "Chưa"
  AND hiển thị link + hướng dẫn tạo GBP tại business.google.com
  AND nút "Tôi đã tạo xong → Tiếp tục" để quay lại OAuth flow
```

### Additional Criteria

- [ ] Token GBP lưu **per-Site** (`Sites.gbpIntegration`), tách biệt token GSC/GA (BR-05)
- [ ] access_token KHÔNG bao giờ expose ra client; mọi GBP call qua server-side (NFR Security)
- [ ] OAuth redirect URI match chính xác GCP console; CSRF state param bắt buộc
- [ ] Hạ tầng OAuth dùng chung cho GBP + GSC (build once)
- [ ] GCP prerequisite: enable "My Business Business Information API" + "My Business Account Management API"

### Market Notes

- <40% SME SE Asia có GBP → wizard tạo mới là bắt buộc.

### Analytics / Tracking Notes

- Track `gbp_connect_started`, `gbp_connect_completed`, `gbp_sync_hours_clicked`.

### Definition of Done

- [ ] 9-Point Checklist pass
- [ ] GBP OAuth flow tested end-to-end với real Google account
- [ ] Token encrypt at rest; auto-refresh hoạt động

---

## US-F37-06: GBP Insights Dashboard

**Wave 4** | **P1** | **L** | **Status:** Draft — **PHASE 2**

> **Reality note:** Reuse `DashboardStats.tsx` (card pattern) + Recharts (đã dùng ở `AnalyticsChart.tsx`). Tab dùng **client-side tab system** (`TabId` union + `<TabPanel>` + `?tab=`), KHÔNG phải route file riêng — thêm `'local-seo'` vào `TabId` + `LocalSEOView`, không tạo `dashboard/local-seo/page.tsx`.

### Story

```
As a   chủ shop SME
I want xem số liệu Local Search gắn với doanh thu (cuộc gọi, chỉ đường, clicks)
So that tôi biết Local SEO mang lại bao nhiêu khách thực mỗi tuần
```

### Acceptance Criteria

#### AC-1: Happy Path — Hiển thị metric cards

```gherkin
GIVEN seller đã connect GBP và chọn khoảng 7 ngày
WHEN  vào tab Local SEO trong dashboard
THEN  hiển thị ≥ 4 metric cards (Cuộc gọi, Chỉ đường, Clicks từ GBP, Lượt xem GBP)
  AND mỗi card: số liệu tuyệt đối + % change + mũi tên xu hướng
  AND timestamp "Cập nhật: X giờ trước" hiển thị dưới cards
  AND loading state là skeleton shimmer (không phải spinner)
  AND line chart Recharts trend 3 metrics chính theo 7/30 ngày
```

#### AC-2: Cache và graceful fallback

```gherkin
GIVEN GBP Insights API trả về lỗi hoặc timeout
WHEN  seller vào tab Local SEO
THEN  hiển thị data từ cache (nếu cache < 6h) + banner "Đang dùng dữ liệu cache từ X giờ trước"
  AND nếu không có cache → empty state với nút "Thử tải lại"
  AND dashboard KHÔNG crash
```

#### AC-3: Mobile responsive

```gherkin
GIVEN screen width < 768px
WHEN  seller vào tab Local SEO
THEN  GBP Insights cards hiển thị 2x3 grid
  AND trend chart thu nhỏ phù hợp viewport
  AND checklist items full width, touch target ≥ 44px
  AND không có horizontal overflow
```

### Additional Criteria

- [ ] Tối đa 6 cards; card "AI appearances" chỉ render nếu API trả về field, ẩn nếu không (không block launch)
- [ ] GBP Insights cache 6h, cache key `gbp_insights_{siteId}_{period}` (BR-08)
- [ ] GBP Insights API throttle: max 5 requests/tenant/giờ (NFR Quota)
- [ ] Tab load < 2s (NFR)

### Definition of Done

- [ ] 9-Point Checklist pass
- [ ] Mobile responsive verified (375px)

---

## US-F37-07: NAP Consistency Checker

**Wave 4** | **P1** | **M** | **Status:** Draft — **PHASE 2**

> **Reality note:** Chỉ chạy được khi GBP đã connected (cần GBP data để so sánh) → phụ thuộc US-F37-05.

### Story

```
As a   chủ shop SME
I want hệ thống cảnh báo khi Tên/Địa chỉ/SĐT của tôi không khớp giữa website và Google
So that thông tin doanh nghiệp nhất quán, tăng độ tin cậy với Google và khách
```

### Acceptance Criteria

#### AC-1: Happy Path — Phát hiện mismatch

```gherkin
GIVEN seller đã connect GBP và GBP listing có SĐT khác Sites.contactInfo.phone
WHEN  hệ thống chạy NAP check (sau khi GBP connected hoặc sau khi save site settings)
THEN  dashboard hiển thị badge "NAP: Có sự khác biệt ⚠"
  AND checklist có item cụ thể: giá trị trên website vs trên GBP
  AND Local SEO Score trừ 10 điểm cho inconsistency
```

#### AC-2: Khớp hoàn toàn

```gherkin
GIVEN Name/Address/Phone khớp giữa Sites record và GBP
WHEN  NAP check chạy
THEN  badge "NAP: Khớp ✓" hiển thị
  AND không có checklist item NAP nào
```

### Additional Criteria

- [ ] Pure comparison util `src/lib/seo/nap-checker.ts` (mới)
- [ ] Modal "Xem chi tiết" so sánh 2 cột Website vs GBP, highlight dòng lệch
- [ ] Chỉ check khi GBP connected (FR-20)

### Definition of Done

- [ ] 9-Point Checklist pass
- [ ] NAP mismatch surfaces đúng trong checklist

---

## US-F37-08: Auto SEO/AEO Generation for Tenant Sites

**Wave 4** | **P0 (metadata fallback) / P1 (AI FAQ)** | **M** | **Status:** Draft

> **Reality note:** Phần lớn đã có sẵn. ① Metadata fallback cascading đã chạy (`sites/[slug]/[[...path]]/page.tsx:191`, `autoMetaEnabled` đã có). ② FAQPage JSON-LD đã auto-emit (`generateFAQSchema()` + `generatePageSchemas()`). ③ Scope isolation đã đúng (robots/sitemap per-tenant). → Story này **VERIFY + bịt gap**, phần **mới** chỉ là: fallback cuối cùng khi mọi field trống + AI-generated FAQ draft.

### Story

```
As a   chủ shop SME không điền SEO fields
I want mọi trang storefront luôn có metadata đầy đủ và FAQ schema tự động
So that tôi không bao giờ vô hình với Google/AI dù không biết gì về SEO
```

### Acceptance Criteria

#### AC-1: Happy Path — Empty fields vẫn có metadata đầy đủ

```gherkin
GIVEN một trang product trên tenant storefront chưa được điền SEO title/description/OG fields
WHEN  crawler hoặc browser fetch /sites/[slug]/products/[product-slug]
THEN  HTML <head> chứa: <title> (50–60 chars), <meta name="description"> (150–160 chars), og:title, og:description, og:url, <link rel="canonical">
  AND title auto-generated từ product name + business name (không "undefined", không rỗng)
  AND không tag nào bị content="" hoặc thiếu hoàn toàn
```

#### AC-2: Auto FAQPage JSON-LD

```gherkin
GIVEN trang tenant storefront có FAQ block với ≥ 1 cặp câu hỏi/trả lời
WHEN  fetch HTML của trang
THEN  chứa JSON-LD script @type "FAQPage"
  AND mỗi câu hỏi map thành entity "Question" với "acceptedAnswer"
  AND validator Schema.org không báo lỗi
```

#### AC-3: Scope isolation — Platform không bị ảnh hưởng

```gherkin
GIVEN request đến route platform main site (/, /dashboard, /admin, /api/v1/*)
WHEN  server xử lý request
THEN  không áp dụng llms.txt, AI crawler logic, hay metadata fallback của F37
  AND fetch {platform-domain}/llms.txt trả về 404
  AND robots.txt của platform KHÔNG bị modify bởi logic F37
```

### Additional Criteria

- [ ] Util mới `src/lib/seo/auto-meta-fallback.ts` — pure function, < 1ms, không async, không gọi AI (BR-14)
- [ ] FAQ content: AI-generated draft (reuse OpenAI hiện có `src/lib/ai/generate-meta.ts`), seller edit trước khi publish
- [ ] KHÔNG duplicate F03 AI Fix-All (on-demand bulk); F37 là systematic always-on default
- [ ] Verify các route storefront thiếu generateMetadata (checkout/orders) có cần fallback không

### Definition of Done

- [ ] 9-Point Checklist pass
- [ ] Metadata fallback verified trên page/product/blog với fields trống

---

## US-F37-09: Malaysia Market Optimization

**Wave 4** | **P0 (states/MYR/phone) / P1 (Waze/Halal)** | **L** | **Status:** Draft

> **Reality note:** Halal field đã tồn tại ở **Product level** (`Products.ts` `halalCertified` + `halalCertImage`) và menu-display dietary tags → **extend** lên Site-level + JSON-LD, không build từ đầu. MYR formatter đã có (`formatPrice()` trong `utils.ts` xử lý "RM") → reuse, không tạo `currency.ts` mới. hreflang **DEFERRED P2** (i18n client-side only, chỉ en+ms, không có URL locale routing — confirmed `src/i18n/index.tsx`).

### Story

```
As a   chủ shop SME tại Malaysia
I want website tối ưu cho khách MY (Waze, Halal badge, địa chỉ bang, giá MYR)
So that khách địa phương dễ tìm, tin tưởng và đến cửa hàng tôi
```

### Acceptance Criteria

#### AC-1: Happy Path — Waze deep-link

```gherkin
GIVEN site có latitude và longitude đã nhập
WHEN  khách truy cập section contact/maps trên storefront
THEN  nút "Navigate with Waze" hiển thị với URL https://waze.com/ul?ll={lat},{lng}&navigate=yes
  AND hiển thị song song nút Google Maps

GIVEN site thiếu latitude hoặc longitude
WHEN  khách truy cập section contact
THEN  nút "Navigate with Waze" KHÔNG render (không href rỗng)
```

#### AC-2: Halal Toggle — Badge + JSON-LD

```gherkin
GIVEN seller bật toggle "Halal Certified" (Site-level) và Save
WHEN  khách truy cập storefront homepage
THEN  badge "Halal Certified" hiển thị
  AND LocalBusiness JSON-LD chứa additionalProperty @type "PropertyValue", name "Halal Certified"
  AND nếu có số chứng nhận JAKIM → value chứa cert number + sameAs link myehalal.halal.gov.my

GIVEN seller TẮT toggle Halal
WHEN  khách truy cập storefront
THEN  badge KHÔNG hiển thị AND JSON-LD KHÔNG chứa additionalProperty Halal
```

#### AC-3: MY States + MYR + Phone format

```gherkin
GIVEN seller ở MY chọn bang trong form địa chỉ
WHEN  mở dropdown `state`
THEN  hiển thị 13 tỉnh + 3 vùng liên bang (tên EN + Bahasa Melayu), không free-text
  AND Schema Offer dùng priceCurrency="MYR", UI hiển thị "RM 25.50"
  AND telephone trong JSON-LD format "+60 12 345 6789"
```

#### AC-4: hreflang — DEFERRED (P2)

```gherkin
[DEFERRED → P2 — không test trong sprint này]
GIVEN i18n hiện là client-side only (một URL phục vụ cả en+ms)
THEN  hreflang chưa implement; unblock khi F21 có URL-based locale routing /en/ /ms/
```

### Additional Criteria

- [ ] Waze: pure helper `getWazeUrl(lat, lng)` trong `src/lib/seo/map-links.ts` (mới); không cần Waze API (visibility qua GBP sync)
- [ ] Halal: field `halalCertified` (boolean, camelCase khớp Product F08) + `halalCertNumber` (text) Site-level; semantic tách Site (business JAKIM) vs Product (per-item); `additionalProperty`/`PropertyValue` (BR-15); không validate cert trong MVP — xem CF-2
- [ ] MY states: **REUSE** `MY_STATES` từ `src/lib/shipping/constants.ts` (F36) + thêm `MY_STATE_LABELS` (en/ms) cùng file — KHÔNG tạo `src/lib/seo/my-states.ts` (xem CF-1)
- [ ] MYR: reuse `formatPrice()` trong `utils.ts` (KHÔNG tạo file currency mới)

### Market Notes

- JAKIM là cơ quan Halal duy nhất tại MY; e-Cert số hoá từ 5/2025 → trust seller toggle + optional cert number.
- MY search code-switching en/ms → cả 2 ngôn ngữ quan trọng (nhưng hreflang deferred).
- Google chưa có SERP feature Halal riêng → cải thiện E-E-A-T + AI consumption, không oversell SERP tức thì.

### Definition of Done

- [ ] 9-Point Checklist pass
- [ ] Waze button render đúng có/không có lat-lng
- [ ] Halal badge + JSON-LD verified bằng Rich Results Test

---

## Story → PRD FR Traceability


| Story     | PRD FR                          | Phase                     |
| --------- | ------------------------------- | ------------------------- |
| US-F37-01 | FR-01, FR-02, FR-03             | 1                         |
| US-F37-02 | FR-04, FR-05, FR-06             | 1                         |
| US-F37-03 | FR-07, FR-08, FR-09             | 1                         |
| US-F37-04 | FR-10, FR-11, FR-12, FR-13      | 1                         |
| US-F37-05 | FR-14, FR-15, FR-16             | 2                         |
| US-F37-06 | FR-17, FR-18, FR-19             | 2                         |
| US-F37-07 | FR-20, FR-21                    | 2                         |
| US-F37-08 | FR-22, FR-23, FR-24             | 1                         |
| US-F37-09 | FR-25, FR-26 (P2), FR-27, FR-28 | 1 (hreflang → 2/deferred) |


---

## Unresolved Questions

Không còn — tất cả đã chốt thành decision.

> Đã chốt: thị trường MY duy nhất (không scope VN), Local SEO Score Phase 1/2 (PRD §13.8), Geocoding paste-link 3 lớp (PRD §13.9).

