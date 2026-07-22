# User Stories: Local SEO & Search Performance (F37)



> **Feature:** F37 — Local SEO & Search Performance
> **Wave:** 4 | **Priority:** P0/P1 | **Ref PRD:** [F37-local-seo-search-performance.md](../prd/F37-local-seo-search-performance.md)

---

## Phasing (timeline-driven)

> F37 chia 2 phase. Phase 1 không phụ thuộc Google Business Profile connection — ship sớm. Phase 2 cần GBP-only Google authorization (hiện **chưa tồn tại** trong codebase — xem note ở US-F37-05). Analytics dùng PostHog, không dùng GA4/GSC.


| Phase             | Stories                       | Điều kiện                                                                             |
| ----------------- | ----------------------------- | ------------------------------------------------------------------------------------- |
| **Phase 1 (P0)**  | US-F37-01, 02, 03, 04, 08, 09 | Không cần Google connection. Reuse nhiều thành phần đã có, thêm PostHog nếu thiếu     |
| **Phase 2 (P1)**  | US-F37-05, 06, 07             | Cần build GBP-only Google authorization + Google verification (~4–6 tuần lead time)   |
| **Deferred (P2)** | hreflang (trong US-F37-09)    | Blocked bởi i18n client-side; chờ F21 URL-based locale routing                        |


---

## Global Acceptance Criteria (CMS Layout Compliance)

> **Áp dụng cho mọi User Story dashboard-facing trong file này.**

```gherkin
GIVEN user truy cập tab/tính năng trang quản trị (Dashboard → SEO)
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
WHEN  điền streetAddress, city, state, postcode, country, chọn businessCategory rồi chọn schemaSubtype tương thích, nhập giờ mở cửa
  AND nhấn Save
THEN  dữ liệu lưu vào Sites collection, group `localBusiness`
  AND LocalBusiness JSON-LD trên storefront homepage emit đầy đủ PostalAddress, openingHoursSpecification, @type đúng schemaSubtype đã chọn
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

- [x] `generateLocalBusinessSchema()` là pure function, không async (verified: no async/await, no I/O in function body)
- [x] `hasMap` — implemented as Google Maps URL fallback từ `localBusiness` lat/lng (`https://www.google.com/maps?q={lat},{lng}`), omit khi thiếu toạ độ. Nâng cấp lên GBP URL/Waze URL khi US-F37-05/US-F37-09 hoàn thành (chưa build, không đổi scope US-02).
- [x] Address ưu tiên `localBusiness.streetAddress`; fallback `contactInfo.address` nếu trống (BR-02)

### Definition of Done

- [ ] 9-Point Checklist pass
- [ ] Output validated bằng Google Rich Results Test

> **Update 2026-07-10 (issue #1310):** AC-1, AC-2, BR-02 và `hasMap` fallback đã code + test xong (`local-business-json-ld.test.ts`, TC-F37-02-12). Còn lại 2 mục Definition of Done cần review/QA thủ công (không tự-certify được từ code): 9-Point Checklist và chạy Google Rich Results Test thật trên 1 site có đủ local business data.

---

## US-F37-03: Platform-managed AI Discoverability

**Wave 4** | **P0 (crawler) / P1 (llms.txt)** | **M** | **Status:** Draft

### Story

```
As a   chủ shop SME muốn xuất hiện trên AI assistants
I want platform tự duy trì crawler access, sitemap và llms.txt
So that ChatGPT, Perplexity, Gemini có thể tìm doanh nghiệp mà tôi không phải quản lý technical settings
```

### Acceptance Criteria

#### AC-1: Happy Path — AI crawlers luôn mở

```gherkin
GIVEN storefront của bất kỳ tenant nào
WHEN  fetch https://{storefront-domain}/robots.txt
THEN  robots.txt KHÔNG chứa "Disallow: /" cho GPTBot, ClaudeBot, Google-Extended, PerplexityBot, CCBot
  AND platform luôn allow các user-agent trên
  AND score luôn cộng 9 điểm crawler access
```

#### AC-2: No seller control

```gherkin
GIVEN seller mở Dashboard hoặc Site Settings
WHEN  UI render
THEN  không hiển thị AI crawler toggle, Sitemap Resubmit, Auto Meta toggle, hoặc SEO Action Tools section
```

#### AC-3: llms.txt — Nội dung đúng cấu trúc

```gherkin
GIVEN storefront có đủ site data (name, description, products, contact, hours)
WHEN  GET https://{storefront-domain}/llms.txt
THEN  response là text/plain, HTTP 200, format Markdown
  AND chứa: tên doanh nghiệp, mô tả ngắn, ≥ 5 URL quan trọng, thông tin liên lạc, giờ mở cửa
```

### Additional Criteria

- [ ] `llms.txt` generate động runtime, không cache lâu (BR-09); route mới `src/app/sites/[slug]/llms.txt/route.ts`
- [ ] llms.txt là tín hiệu experimental — không oversell impact
- [ ] Sitemap tự sinh từ published content; không có manual resubmit control

### Market Notes

- AI crawler access là platform invariant, không phải seller preference.

### Analytics / Tracking Notes

- Không track crawler-toggle event vì seller không có toggle.

### Definition of Done

- [ ] 9-Point Checklist pass
- [ ] robots.txt AI crawler behavior verified bằng automated test

---

## US-F37-04: Unified SEO Health Score & Actions

**Wave 4** | **P0** | **L** | **Status:** Draft

F37 replaces the existing F03 score contents. Dashboard shows one SEO Health score only: Business Data 20 / Schema 35 / AI Discoverability 15 / Technical Health 30.

### Story

```
As a   chủ shop SME không rành kỹ thuật
I want một điểm SEO Health và danh sách root-cause issues có actor + CTA rõ ràng
So that tôi biết AI xử lý được gì và mình phải sửa ở đâu
```

### Acceptance Criteria

#### AC-1: Happy Path — Score phản ánh completeness

```gherkin
GIVEN site còn thiếu các signal trong scorecard F37 §5
WHEN  vào `Dashboard > SEO`
THEN  một SEO Health Score hiển thị đúng tổng điểm đã earn
  AND bốn bucket bars hiển thị dạng 2×2 mà không hiện điểm bucket
  AND unresolved root causes hiển thị trong SEO Issues, không lặp derived metrics
  AND mỗi issue có badge AI/You, CTA và destination đúng theo F37 PRD §12.3

GIVEN seller hoàn thành địa chỉ cấu trúc + giờ mở cửa
WHEN  hệ thống tính lại score
THEN  SEO Health Score tăng tương ứng các hạng mục đã earn
  AND các root-cause issues tương ứng biến mất
```

#### AC-2: Platform-managed crawler signal

```gherkin
GIVEN seller mở SEO Health
WHEN  score và SEO Issues render
THEN  AI crawler access đã earn 9 điểm mặc định
  AND không có crawler issue, toggle, hoặc CTA
```

### Additional Criteria

- [ ] Công thức: Business Data 20 / Schema 35 / AI Discoverability 15 / Technical Health 30 — xem F37 PRD §5
- [ ] Score tính lại khi seller thay đổi signal thuộc §5; PostHog website analytics không ảnh hưởng score
- [ ] Chỉ unresolved root causes hiển thị; completed, derived duplicates, Organization và indexability không tạo seller issue
- [ ] AI Fix All chỉ hiển thị khi còn title/description issue AI-fixable
- [ ] Pure function `src/lib/seo/local-seo-score.ts` (mới)
- [ ] Mỗi issue: seller-friendly copy, badge AI/You, CTA và destination theo PRD §12.3; không hiển thị điểm cộng/trừ

### Analytics / Tracking Notes

- Track `local_seo_issue_action_clicked` với `item_id`, `actor`, `cta`, và `destination` khi F22 sẵn sàng.

### Definition of Done

- [ ] 9-Point Checklist pass
- [ ] Score calculation works correctly cho cả Phase 1 (chưa có GBP) và Phase 2

---

## US-F37-05: Google Business Profile Connect & Sync

**Wave 4** | **P1** | **XL** | **Status:** Draft — **PHASE 2**

> **Reality note:** Codebase **chưa có GBP authorization** — không có `src/app/api/google/`, không có token GBP trên Sites. Build GBP-only authorization từ đầu: consent URL builder, callback handler, encrypted token store, auto-refresh, CSRF state. Không thêm GA4/GSC scopes. Cần submit Google verification sớm (~4–6 tuần lead time).

### Story

```
As a   chủ shop SME
I want kết nối Google Business Profile của tôi vào platform
So that tôi xem được số liệu thực (cuộc gọi, chỉ đường) và đồng bộ thông tin lên Google
```

### Acceptance Criteria

#### AC-1: Happy Path — Google Business Profile connect thành công

```gherkin
GIVEN seller click "Connect Google Business Profile" trong `Settings > Business Info`
WHEN  hoàn thành Google authorization flow với account có GBP listing (scope business.manage)
THEN  hệ thống lưu access_token + refresh_token vào Sites.gbpIntegration (per-site)
  AND `Settings > Business Info` hiển thị trạng thái "Connected"
  AND hệ thống tự động pull Google Business Profile info trong vòng 30 giây
```

#### AC-2: Sync giờ mở cửa lên GBP

```gherkin
GIVEN seller đã connect Google Business Profile và đã thiết lập giờ mở cửa trên platform
WHEN  click "Sync to Google"
THEN  hệ thống gọi GBP API cập nhật opening hours trên GBP listing (one-way push)
  AND hiện toast "Đồng bộ thành công" sau khi API confirm
  AND nếu API lỗi → toast lỗi cụ thể (không nuốt lỗi)
```

#### AC-3: Seller chưa có GBP

```gherkin
GIVEN seller chưa có Google Business Profile
WHEN  mở card Google Business Profile trong `Settings > Business Info`
THEN  UI hiển thị link tạo GBP tại business.google.com
  AND seller có thể quay lại bấm "Connect Google" sau khi tạo xong
```

### Additional Criteria

- [ ] Token GBP lưu **per-Site** (`Sites.gbpIntegration`), không tạo GSC/GA token (BR-05)
- [ ] access_token KHÔNG bao giờ expose ra client; mọi GBP call qua server-side (NFR Security)
- [ ] Google redirect URI match chính xác GCP console; CSRF state param bắt buộc
- [ ] Authorization scope chỉ có `business.manage`
- [ ] GCP prerequisite: enable "My Business Business Information API" + "My Business Account Management API"

### Market Notes

- <40% SME SE Asia có GBP → link tạo mới phải rõ, nhưng không tạo wizard nhiều bước trong MVP.

### Analytics / Tracking Notes

- Track `gbp_connect_started`, `gbp_connect_completed`, `gbp_sync_hours_clicked`.

### Definition of Done

- [ ] 9-Point Checklist pass
- [ ] GBP authorization flow tested end-to-end với real Google account
- [ ] Token encrypt at rest; auto-refresh hoạt động

---

## US-F37-06: Google Activity in SEO Dashboard

**Wave 4** | **P1** | **L** | **Status:** Draft — **PHASE 2**

> **Reality note:** Không tạo tab Local SEO mới. Reuse `Dashboard > SEO` hiện có. Website analytics dùng PostHog trong `Dashboard > Analytics`; Google local actions dùng GBP trong `Dashboard > SEO`. Không dùng GA4/GSC, không build chart dashboard trong SEO MVP.

### Story

```
As a   chủ shop SME
I want xem số liệu dễ hiểu từ Google Business Profile
So that tôi biết Local SEO mang lại bao nhiêu khách thực mỗi tuần
```

### Acceptance Criteria

#### AC-1: Happy Path — Hiển thị metric cards

```gherkin
GIVEN seller đã connect Google Business Profile và chọn khoảng 7 ngày
WHEN  vào `Dashboard > SEO`
THEN  hiển thị Google activity từ GBP: Calls, Directions, Website visits
  AND mỗi card hiển thị số liệu tuyệt đối
  AND timestamp "Cập nhật: X giờ trước" hiển thị dưới cards
  AND loading state là skeleton shimmer (không phải spinner)
```

#### AC-2: Cache và graceful fallback

```gherkin
GIVEN GBP metrics API trả về lỗi hoặc timeout
WHEN  seller vào `Dashboard > SEO`
THEN  hiển thị data từ cache (nếu cache < 6h) + banner "Đang dùng dữ liệu cache từ X giờ trước"
  AND nếu không có cache → empty state với nút "Thử tải lại"
  AND dashboard KHÔNG crash
```

#### AC-3: Mobile responsive

```gherkin
GIVEN screen width < 768px
WHEN  seller vào `Dashboard > SEO`
THEN  Google activity cards xếp 1 cột hoặc 2 cột theo pattern dashboard hiện có
  AND SEO issue rows xếp một cột; CTA full width, touch target ≥ 44px
  AND không có horizontal overflow
```

### Additional Criteria

- [ ] Không quá 3 metrics trong SEO: Calls/Directions/Website visits từ GBP
- [ ] GBP metrics cache 6h, cache key `gbp_metrics_{siteId}_{period}` (BR-08)
- [ ] GBP metrics API throttle: max 5 requests/tenant/giờ (NFR Quota)
- [ ] Tab load < 2s (NFR)

### Definition of Done

- [ ] 9-Point Checklist pass
- [ ] Mobile responsive verified (375px)

---

## US-F37-07: Business Info Difference Checker

**Wave 4** | **P1** | **M** | **Status:** Draft — **PHASE 2**

> **Reality note:** Chỉ chạy được khi GBP đã connected (cần GBP data để so sánh) → phụ thuộc US-F37-05. Seller-facing UI không dùng chữ NAP.

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
WHEN  hệ thống chạy business info difference check (sau khi GBP connected hoặc sau khi save site settings)
THEN  `Settings > Business Info` hiển thị "Phone number is different"
  AND SEO Issues trong `Dashboard > SEO` có root-cause item dẫn về Business Info
  AND Local SEO Score trừ 10 điểm cho inconsistency
```

#### AC-2: Khớp hoàn toàn

```gherkin
GIVEN Name/Address/Phone khớp giữa Sites record và GBP
WHEN  business info difference check chạy
THEN  không hiển thị warning trong `Settings > Business Info`
  AND không có SEO issue về business info differences
```

### Additional Criteria

- [ ] Pure comparison util `src/lib/seo/business-info-diff-checker.ts` (mới)
- [ ] Inline review panel so sánh từng field Website vs Google, highlight dòng lệch
- [ ] Chỉ check khi GBP connected (FR-20)

### Definition of Done

- [ ] 9-Point Checklist pass
- [ ] Business info differences surface đúng trong Business Info và SEO Issues

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
| US-F37-01 | FR-01..03                       | Current                   |
| US-F37-02 | FR-04..11                       | Current                   |
| US-F37-03 | FR-12..14                       | Current                   |
| US-F37-04 | FR-15..21                       | Current                   |


---

## Unresolved Questions

Không còn — tất cả đã chốt thành decision.

> Đã chốt: thị trường MY duy nhất; scorecard theo F37 PRD §5; Geocoding paste-link 3 lớp.
