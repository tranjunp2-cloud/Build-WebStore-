# PRD: Local SEO & Search Performance (F37)
> **Version:** 1.0 | **Created:** 2026-06-15 | **Agent:** `docs-engineer`
> **Priority:** P0/P1 | **Sprint:** Wave 4 — Sprint 2 | **Size:** XL
> **Depends on:** F03 Dashboard Suite ✅, F02 Auth ✅, F22 Tracking ⬜
> **Blocks:** Không có
> **Research:** [researcher-260615-1451-local-seo-aio-multitenant.md](../../plans/reports/researcher-260615-1451-local-seo-aio-multitenant.md)

---

> [!IMPORTANT]
> **Stories-First Rule:** PRD này được xây dựng từ User Stories đã approve.
> Mọi FR phải có Story Ref. AC được copy từ story file. Không tự mở rộng scope.
> **Boundary quan trọng:** F03 đã sở hữu General SEO score, AI Fix-All, keyword tracker, GSC/GA OAuth, sitemap, basic SEO dashboard. F37 KHÔNG tái implement các tính năng đó — chỉ mở rộng và bổ sung scope Local SEO.

---

## 0. Story Traceability

| Story ID | Title | File | Status |
|----------|-------|------|--------|
| US-F37-01 | Local Business Data Model | [F37-local-seo-stories.md](../stories/F37-local-seo-stories.md) | Draft |
| US-F37-02 | Enhanced LocalBusiness JSON-LD | [F37-local-seo-stories.md](../stories/F37-local-seo-stories.md) | Draft |
| US-F37-03 | AI Crawler Permissions & llms.txt | [F37-local-seo-stories.md](../stories/F37-local-seo-stories.md) | Draft |
| US-F37-04 | Local SEO Score & Checklist | [F37-local-seo-stories.md](../stories/F37-local-seo-stories.md) | Draft |
| US-F37-05 | Google Business Profile OAuth & Sync | [F37-local-seo-stories.md](../stories/F37-local-seo-stories.md) | Draft |
| US-F37-06 | GBP Insights Dashboard | [F37-local-seo-stories.md](../stories/F37-local-seo-stories.md) | Draft |
| US-F37-07 | NAP Consistency Checker | [F37-local-seo-stories.md](../stories/F37-local-seo-stories.md) | Draft |
| US-F37-08 | Auto SEO/AEO Generation for Tenant Sites | [F37-local-seo-stories.md](../stories/F37-local-seo-stories.md) | Draft |
| US-F37-09 | Malaysia Market Optimization | [F37-local-seo-stories.md](../stories/F37-local-seo-stories.md) | Draft |

> Mọi FR trong Section 7 đều map về các Story ID ở bảng trên.

---

## 1. Problem Statement

SME seller ở Malaysia xây dựng storefront qua PrimeCommerce nhưng phần lớn không xuất hiện trong tìm kiếm địa phương (Google Maps, Local Pack) và hoàn toàn vô hình với AI assistants (ChatGPT, Perplexity, Gemini). Theo nghiên cứu SOCi 2026, chỉ 1–11% doanh nghiệp địa phương được các AI assistant gợi ý, trong khi ít hơn 40% SME Đông Nam Á có Google Business Profile hoàn chỉnh. Platform hiện tại chưa có mô hình dữ liệu địa phương (địa chỉ cấu trúc, giờ mở cửa, tọa độ GPS), JSON-LD LocalBusiness thiếu các trường bắt buộc cho AI discoverability, và đang chặn hoàn toàn AI crawlers — làm mất cơ hội hiển thị trong AI search.

---

## 1.5 Why Connect to Google (GBP + GSC) — For Developers

**GBP Performance API** = the ONLY source of local action metrics: calls, direction requests, maps profile views, review interactions. These metrics directly power Maps/Local Pack visibility and prove search ROI. Without GBP connection, sellers see zero data in "Local SEO" dashboard even if storefront ranks.

**GSC (Google Search Console)** = organic search performance: queries, impressions, CTR, average position. Planned in F03-08; currently only manual text fields (`googleAnalyticsId`, `googleVerificationToken`) on Sites.seo exist — NOT authorized API access.

**Why OAuth 2.0 now:** Both require secure credential exchange + refresh tokens + Google verification for sensitive scopes. Building shared OAuth infrastructure once (this sprint) unblocks both GBP (F37) and GSC (F03-08 future). Google verification alone takes 4–6 weeks; do NOT wait until implementation.

---

## 2. Target User

- **Người dùng chính:** Chủ shop SME (F&B, bán lẻ, dịch vụ) đã có site trên PrimeCommerce, muốn khách địa phương tìm thấy trên Google Maps và AI assistants.
- **Trình độ kỹ thuật:** Không có chuyên môn SEO — cần hướng dẫn từng bước, ngôn ngữ đơn giản (không dùng thuật ngữ kỹ thuật), hành động rõ ràng.
- **Thị trường:** Malaysia (thị trường DUY NHẤT của F37). Locale en + ms. Không scope Vietnam.
- **Hành vi:** Truy cập dashboard trên mobile là chính; muốn thấy số liệu gắn với doanh thu thực (cuộc gọi, chỉ đường, khách đến), không phải số liệu kỹ thuật trừu tượng.

---

## 3. Solution Overview

F37 bổ sung **tầng Local SEO** lên trên F03 Dashboard Suite hiện có, gồm 3 lớp chính:

1. **Dữ liệu nền tảng (P0):** Mở rộng Sites collection với địa chỉ cấu trúc, giờ mở cửa, tọa độ GPS, danh mục kinh doanh — làm nguồn sự thật duy nhất cho toàn bộ tính năng Local SEO. Nâng cấp `generateLocalBusinessSchema()` hiện có để emit đầy đủ geo, openingHoursSpecification, priceRange, areaServed theo chuẩn Schema.org. Mở AI crawlers (hiện đang bị chặn trong `robots.txt/route.ts:53–69`) + thêm toggle opt-out per-seller.
2. **GBP Integration (P1):** Wizard setup cho seller chưa có GBP (ước tính >60% tại SE Asia), OAuth Google Business Profile API, sync giờ/ảnh hai chiều, kéo GBP Insights (cuộc gọi, chỉ đường, website clicks, lượt xem profile, AI overview appearances).
3. **Local Performance Dashboard (P1):** Tab "Local SEO" mới trong `/dashboard` — hiển thị điểm Local SEO riêng biệt với F03's general SEO score, checklist "Việc cần làm" ưu tiên cao/trung/thấp, và 4–6 card GBP Insights tập trung vào metric kết nối doanh thu (cuộc gọi, chỉ đường, leads). Mobile-first, reuse Recharts + DashboardStats components.
4. **Malaysia Market Optimization (P0/P1):** Bốn đòn bẩy dành riêng cho thị trường MY: (a) Waze deep-link button từ lat/lng — Waze visibility đến 100% qua GBP sync, không cần API riêng; (b) hreflang `en-MY` + `ms-MY` + `x-default` trong `generateMetadata` cho tất cả trang tenant — cả hai ngôn ngữ đều quan trọng do search behavior code-switching tại MY; (c) Halal toggle + `additionalProperty` schema injection — JAKIM là cơ quan duy nhất, toàn bộ e-Cert số hoá từ tháng 5/2025; (d) MY states dropdown (13 tỉnh + 3 vùng liên bang), MYR currency schema, phone format `+60`.
5. **Auto-Generation & AEO (P0/P1):** Mọi trang tenant storefront PHẢI luôn có metadata SEO đầy đủ ngay cả khi seller để trống — hệ thống tự fallback từ dữ liệu có sẵn (tên trang, tên site, danh mục). Ngoài ra, tự động emit FAQPage JSON-LD từ FAQ block có sẵn để tối ưu cho AI answer engines (ChatGPT, Perplexity, Gemini). Lưu ý: `llms.txt` là một tín hiệu nhỏ và thực nghiệm — các đòn bẩy AEO thực sự là structured data + auto metadata + FAQ. Toàn bộ auto-gen chỉ áp dụng cho `/sites/[slug]/*` (tenant storefront), KHÔNG áp dụng cho platform main site.

---

## 4. Scope

### In Scope

- **Local Business Data Model:** Thêm vào Sites: địa chỉ cấu trúc (street, city, state, postcode, country), tọa độ (latitude, longitude), giờ mở cửa theo ngày (per-day open/close/closed flag), danh mục kinh doanh (LocalBusiness sub-type), price range, service area. (US-F37-01)
- **Enhanced LocalBusiness JSON-LD:** Nâng cấp `src/lib/seo/json-ld.ts` function `generateLocalBusinessSchema()` — emit geo, openingHoursSpecification, priceRange, areaServed, hasMap, @type sub-type chính xác. (US-F37-02)
- **AI Crawler Permissions:** Mở GPTBot/ClaudeBot/Google-Extended/PerplexityBot/CCBot trong `robots.txt/route.ts` (default allow). Thêm toggle opt-out per-site trong site settings. (US-F37-03)
- **Dynamic llms.txt route:** Route `/llms.txt` per-tenant tự động tạo từ dữ liệu site (tóm tắt kinh doanh, sản phẩm nổi bật, contact, giờ mở cửa). (US-F37-03)
- **Local SEO Score:** Điểm Local SEO riêng (0–100), tách biệt với F03 general SEO score, tính từ completeness của business data, JSON-LD, GBP connection status, NAP consistency. (US-F37-04)
- **Actionable Local Checklist:** Checklist "Việc cần làm" seller-facing, ưu tiên high/medium/low, có one-click fix hoặc hướng dẫn từng bước. (US-F37-04)
- **GBP OAuth Integration:** Thêm Google Business Profile API scope vào OAuth flow của F03 (tách riêng GBP token từ GSC/GA token). Setup wizard cho seller chưa có GBP. (US-F37-05)
- **GBP Data Sync:** Sync giờ mở cửa và ảnh từ platform lên GBP; pull GBP info về platform để hiển thị. (US-F37-05)
- **GBP Insights Dashboard:** Tab "Local SEO" trong `/dashboard` với 4–6 card: phone calls, direction requests, GBP→site clicks, profile views, review rating, AI overview appearances (nếu API có). Recharts line chart trend 7/30 ngày. (US-F37-06)
- **NAP Consistency Checker:** Validate Name/Address/Phone nhất quán giữa Sites collection và GBP data đã kết nối; surface mismatches trong checklist. (US-F37-07)
- **Auto SEO Metadata Fallback (P0):** Đảm bảo hệ thống mọi trang tenant (page, product, blog) LUÔN render đầy đủ title, meta description, OG tags, canonical — dù seller để trống SEO fields. Tái dụng `generateMetadata()` hiện có trong các route `/sites/[slug]/*`. (US-F37-08)
- **Auto FAQ + FAQPage JSON-LD (P1, AEO):** Tự động emit FAQPage JSON-LD từ FAQ block có trên trang. Tái dụng generator hiện có trong `src/lib/seo/json-ld.ts`. Cải thiện khả năng được trích dẫn bởi AI answer engines. (US-F37-08)
- **Tenant-Only Auto-Gen Scope Guarantee (P0):** Toàn bộ auto-generation (SEO metadata, JSON-LD, llms.txt, sitemap, robots) chỉ áp dụng cho các route `/sites/[slug]/*`. Platform main site (`/`, `/admin`, v.v.) KHÔNG bị ảnh hưởng. (US-F37-08)
- **Waze Deep-Link (P1):** Storefront render nút "Navigate with Waze" từ lat/lng của seller — URL format `https://waze.com/ul?ll={LAT},{LNG}&navigate=yes`. Waze visibility của seller đến từ GBP sync (xem FR-15 GBP wizard), không cần API Waze riêng. (US-F37-09)
- **Hreflang en-MY + ms-MY (P1):** Emit `alternates.languages` (`en-MY`, `ms-MY`, `x-default`) trong `generateMetadata` cho tất cả trang tenant. Phục vụ search behavior code-switching tại Malaysia. (US-F37-09)
- **Halal Toggle + Schema (P1):** Seller bật toggle "Halal Certified" (+ tùy chọn nhập số chứng nhận JAKIM) trong site settings → render badge Halal trên storefront + inject `additionalProperty` vào LocalBusiness/Product JSON-LD. (US-F37-09)
- **MY States Dropdown + MYR + Phone Format (P0):** Thay free-text `state` bằng dropdown 13 tỉnh + 3 vùng liên bang Malaysia (tên tiếng Anh + Bahasa Melayu). Schema Offer dùng `priceCurrency="MYR"`, hiển thị "RM 25.50". `telephone` format `+60 12 345 6789`. (US-F37-09)

### Out of Scope

- Backlink analysis (không phải local SEO scope)
- Citation auto-sync đến 50+ thư mục (phase sau — nghiên cứu ghi nhận HIGH effort, cần đối tác dữ liệu)
- Phân tích đối thủ cạnh tranh (competitor analysis)
- Location pages generator (phase sau — P2)
- Review collection automation / review response templates (feature riêng)
- Multi-location seller với 10+ locations (scale phức tạp — deferred)
- Bing Webmaster Tools integration (Google chiếm >90% ở SE Asia)
- GrabFood/Foodpanda API sync (cần partnership trực tiếp; thương vụ Grab-Foodpanda đang pending)
- Foursquare/Mudah.my citation automation (không có verified API cho bulk listing)
- Chinese (zh-MY) localization — defer; ROI thấp hơn en-MY + ms-MY cho giai đoạn này

---

## 5. Success Metrics

| Metric | Target | Measured By |
|--------|--------|-------------|
| Seller hoàn thiện local business data | ≥ 60% trong 7 ngày sau khi feature live | DB query — % sites có latitude + openingHours |
| Local SEO score trung bình | Tăng từ ~30 lên ≥ 60 sau 30 ngày | Dashboard score tracking |
| Seller connect GBP | ≥ 30% active sites trong 60 ngày | GBP OAuth token count / active sites |
| AI crawlers unblocked | 100% storefronts (mặc định allow) | robots.txt audit |
| GBP Insights dashboard load time | < 2s | Timing |
| Local checklist completion rate | ≥ 40% sellers hoàn thành ≥ 3 items | Event tracking (F22) |

---

## 6. User Story Summary

```text
AS A   chủ shop SME không rành SEO
I WANT  hệ thống tự động tối ưu thông tin doanh nghiệp địa phương và kết nối Google Business Profile
SO THAT khách hàng gần đó có thể tìm thấy tôi trên Google Maps, Google Search, và AI assistants
        — và tôi thấy ngay được bao nhiêu cuộc gọi/chỉ đường đến từ Local Search mỗi tuần
```

---

## 7. Functional Requirements

> **Ký hiệu Priority:** P0 = MVP bắt buộc / P1 = quan trọng, sprint kế tiếp / P2 = nice to have

### 7.0 Phasing & OAuth Blocker

Timeline is tight; Google OAuth is the longest-pole dependency. Split into 2 phases:

- **Phase 1 (P0, No OAuth):** FR-01,02,03 (data model), FR-04,05,06 (JSON-LD), FR-07,08,09 (crawlers+llms.txt), FR-10,11,12,13 (score+checklist — note: GBP 25% + NAP 10% scores cannot be earned without OAuth; either re-weight for Phase 1 or mark as "locked"), FR-22,23,24 (auto SEO/AEO), FR-25,27,28 (Waze/Halal/MY states).
- **Phase 2 (P1, Requires OAuth):** FR-14,15,16 (GBP OAuth+wizard+sync), FR-17,18,19 (insights+charts), FR-20,21 (NAP). **PREREQUISITE:** Build shared Google OAuth infra + submit Google verification early (4–6 weeks lead time).
- **Deferred (P2):** FR-26 hreflang (blocked by client-side i18n — requires F21 URL-based routing).

| FR-ID | Requirement | Story Ref | Priority | Notes |
|-------|-------------|-----------|----------|-------|
| FR-01 | Hệ thống PHẢI thêm nhóm fields `localBusiness` vào Sites collection: `streetAddress`, `city`, `state`, `postcode`, `country` (text), `latitude` + `longitude` (number), `businessCategory` (select với LocalBusiness sub-types), `priceRange` (select: $/$$/$$$/$$$$), `serviceAreaDescription` (textarea) | US-F37-01 | P0 | Thay thế free-text `contactInfo.address` — giữ backward compat |
| FR-02 | Hệ thống PHẢI thêm array field `openingHours` vào Sites: mỗi item gồm `dayOfWeek` (select: Mo/Tu/We/Th/Fr/Sa/Su), `opens` (text HH:MM), `closes` (text HH:MM), `isClosed` (checkbox) | US-F37-01 | P0 | Array table `sites_opening_hours` — varchar id + `_parent_id` + `_order` |
| FR-03 | Form "Thông tin kinh doanh địa phương" PHẢI hiển thị đầy đủ fields FR-01 + FR-02 + map preview. **Lấy toạ độ: seller DÁN link Google Maps của họ → hệ thống tự trích lat/lng** (không bắt seller gõ toạ độ). Cơ chế 3 lớp ở §13.9. Input lat/lng tay là fallback nâng cao. | US-F37-01 | P0 | **RESOLVED (geocoding):** paste Google Maps link → regex/redirect/Geocoding fallback. Xem §13.9 |
| FR-04 | Hệ thống PHẢI nâng cấp `generateLocalBusinessSchema()` để emit: `geo` (GeoCoordinates), `openingHoursSpecification` (array), `priceRange`, `areaServed`, `hasMap` (GBP URL nếu có), `@type` đúng sub-type (Restaurant/Store/Service/...) | US-F37-02 | P0 | Nâng cấp `src/lib/seo/json-ld.ts` lines 127–157 |
| FR-05 | JSON-LD LocalBusiness PHẢI có `address` dạng `PostalAddress` đầy đủ (streetAddress, addressLocality, postalCode, addressCountry) — enhance the existing PostalAddress emission to include full sub-fields thay vì chỉ streetAddress | US-F37-02 | P0 | Chuẩn Schema.org — cần thiết cho Local Pack |
| FR-06 | JSON-LD LocalBusiness KHÔNG ĐƯỢC emit `aggregateRating` ở mức LocalBusiness type (policy 2025–2026: Google không hiển thị stars cho LocalBusiness trong SERP); `aggregateRating` CHỈ emit trên Product/Service types | US-F37-02 | P0 | Nghiên cứu: AI vẫn parse reviews nhưng Google không hiển thị rich snippet |
| FR-07 | Hệ thống PHẢI mở AI crawlers trong `robots.txt/route.ts`: flip GPTBot, ClaudeBot, Google-Extended, CCBot từ Disallow sang Allow (hiện tại bị chặn ở lines 53–69). Thêm PerplexityBot nếu cần (chưa trong blocklist hiện tại). Mặc định = allow. Per-site toggle để opt-out. | US-F37-03 | P0 | Quyết định đã được stakeholder approve |
| FR-08 | Site settings PHẢI có toggle "Cho phép AI crawlers index website" (default = ON). Khi OFF → robots.txt inject Disallow cho các AI user-agents tương ứng của site đó | US-F37-03 | P0 | Per-seller opt-out, không phải global |
| FR-09 | Hệ thống PHẢI tạo route `/llms.txt` per-tenant, trả về nội dung Markdown gồm: tên và mô tả doanh nghiệp, danh sách top 10 URL quan trọng (homepage, products, contact, blog posts mới nhất), thông tin liên lạc, giờ mở cửa, service area | US-F37-03 | P1 | Experimental — không oversell impact; low cost |
| FR-10 | Dashboard PHẢI hiển thị "Local SEO Score" (0–100) riêng biệt với F03 General SEO Score. Điểm **normalize trên các bucket đang áp dụng** (không có trần giả). **Phase 1** (4 bucket = 100%): Business Data 35% + Structured Data 30% + AI Discoverability 20% + Technical Health 15%. **Phase 2** thêm bucket GBP/Reviews/NAP/Citations và re-weight. Công thức + sub-signal chi tiết ở **§13.8**. | US-F37-04 | P0 | **RESOLVED (CF-4):** Phase 1 seller làm hết → đạt 100; bucket Phase 2 hiển thị "🔒 unlock" từ đầu nên không bị cảm giác tụt điểm. Xem §13.8 |
| FR-11 | Dashboard PHẢI hiển thị checklist "Việc cần làm" ưu tiên cao/trung/thấp. Mỗi item có: mô tả seller-friendly (không dùng thuật ngữ kỹ thuật), impact label (VD: "Tăng lượt gọi điện"), nút hành động (one-click fix hoặc "Xem hướng dẫn") | US-F37-04 | P0 | Tối đa 10 items — không overwhelm |
| FR-12 | Checklist items P0 (high impact): Thêm địa chỉ cấu trúc, Cập nhật giờ mở cửa, Kết nối Google Business Profile, Bật AI crawlers (nếu đang tắt), Thêm danh mục kinh doanh | US-F37-04 | P0 | |
| FR-13 | Checklist items P1 (medium impact): Thêm tọa độ GPS, Điền đủ thông tin liên lạc, Sync ảnh lên GBP, Kiểm tra NAP nhất quán | US-F37-04 | P1 | |
| FR-14 | Hệ thống PHẢI BUILD FROM SCRATCH shared Google OAuth infrastructure (consent URL builder, callback handler, encrypted token storage, auto-refresh logic, CSRF state validation) cho GBP + GSC (F03-08, future). OAuth scope: `https://www.googleapis.com/auth/business.manage` (GBP). Token GBP (access_token, refresh_token, token_expiry) và `gbp_location_id` lưu trên **Sites collection** (per-site, không phải per-tenant) — cho phép seller có nhiều sites, mỗi site kết nối GBP listing riêng. Tách biệt với GSC/GA tokens của F03 trên Tenants. **NOTE: Không có reuse infrastructure từ F03 — Google OAuth chưa được implement.** | US-F37-05 | P1 | **CRITICAL PREREQUISITE:** Build shared OAuth client. GCP project cần enable GBP API + submit Google OAuth verification sớm (~4–6 tuần lead time). Xem Dependencies §14. |
| FR-15 | Wizard "Kết nối Google Business Profile" PHẢI có 3 bước: (1) Chọn hoặc tạo GBP listing, (2) Xác nhận thông tin khớp với platform, (3) Authorize sync. Seller chưa có GBP → hướng dẫn tạo mới trên Google | US-F37-05 | P1 | <40% SME SE Asia có GBP |
| FR-16 | Sau khi connect GBP, hệ thống PHẢI cho phép seller sync giờ mở cửa từ platform → GBP bằng một nút "Đồng bộ lên GBP" | US-F37-05 | P1 | One-way push — platform là nguồn sự thật |
| FR-17 | Hệ thống PHẢI pull GBP Insights qua API, lưu cache, hiển thị trong dashboard: số cuộc gọi điện, số lượt chỉ đường, số website clicks từ GBP, tổng lượt xem profile, điểm đánh giá trung bình + số lượng reviews | US-F37-06 | P1 | Data từ GBP Business Profile Performance API |
| FR-18 | Dashboard "Local SEO" PHẢI hiển thị tối đa 6 metric cards (mobile-first 2x3 grid): Cuộc gọi, Chỉ đường, Clicks từ GBP, Lượt xem GBP, Đánh giá, AI appearances (nếu API có). Mỗi card có % change so với kỳ trước | US-F37-06 | P1 | Tập trung vào revenue-connected metrics, không vanity |
| FR-19 | Dashboard PHẢI có chart trend (line chart Recharts) cho 3 metrics chính: cuộc gọi, chỉ đường, website clicks — theo 7 ngày hoặc 30 ngày | US-F37-06 | P1 | Reuse Recharts đang dùng ở F03 Analytics |
| FR-20 | Hệ thống PHẢI kiểm tra NAP consistency: so sánh `name` (site name), `address` (từ localBusiness fields), `phone` (từ contactInfo) giữa Sites record và GBP data đã pull về; surface mismatch trong checklist với nội dung cụ thể ("Số điện thoại trên GBP khác với website") | US-F37-07 | P1 | Chỉ check khi GBP đã connected |
| FR-21 | Dashboard hiển thị trạng thái "NAP Consistency: Khớp / Không khớp" với badge màu rõ ràng. Khi không khớp, có nút "Xem chi tiết" dẫn đến item trong checklist | US-F37-07 | P1 | |
| FR-22 | Hệ thống PHẢI EXTEND + VERIFY existing metadata fallback cascading (SEO field → content field → site.name) trong `generateMetadata()` + ensure ultimate hardcoded fallback khi tất cả fields trống — đảm bảo mọi trang tenant storefront (page, product, blog post) LUÔN render đầy đủ title tag (50–60 chars), meta description (150–160 chars), OG tags (`og:title`, `og:description`, `og:url`, `og:image`), canonical — ngay cả khi seller để trống tất cả SEO fields. Verify routes missing generateMetadata (checkout/orders). Đây là systematic fallback guarantee — phân biệt với F03 AI Fix-All (on-demand bulk optimizer). Tái dụng `generateMetadata()` trong `src/app/sites/[slug]/...` routes + `seo` fields trên Sites/Pages/Products. | US-F37-08 | P0 | Không duplicate F03 AI Fix-All; F37 là systematic default |
| FR-23 | FAQPage JSON-LD schema emission ĐANG HOẠT ĐỘNG trong production qua `generateFAQSchema()` + `generatePageSchemas()` trong `src/lib/seo/json-ld.ts`. Công việc mới: thêm AI-generated FAQ draft (reuse OpenAI tại `src/lib/ai/generate-meta.ts`) để seller có cơ sở sửa đổi trước khi publish. Mục tiêu: cải thiện khả năng được trích dẫn bởi AI answer engines. **Nguồn FAQ content: AI-generated draft (reuse OpenAI đang có), seller có thể edit trước khi publish.** | US-F37-08 | P1 | Schema emission DONE; new work = AI draft + seller editorial workflow |
| FR-24 | Toàn bộ auto-generation (SEO metadata fallback, JSON-LD, llms.txt, sitemap, robots.txt AI crawler logic) PHẢI chỉ áp dụng cho các route thuộc tenant storefront (`/sites/[slug]/*`). Các route của platform main site (`/`, `/dashboard`, `/admin`, `/api/*` platform routes) KHÔNG được bị ảnh hưởng bởi bất kỳ auto-gen nào của F37. | US-F37-08 | P0 | Business rule cứng — scope isolation giữa tenant storefront và platform |
| FR-25 | Storefront PHẢI render nút "Navigate with Waze" trên section contact/maps khi site có latitude + longitude. URL format: `https://waze.com/ul?ll={latitude},{longitude}&navigate=yes`. Nút hiển thị song song với nút Google Maps. Lưu ý: Waze visibility của seller đến 100% qua GBP sync (~24h) — FR-15 GBP wizard chính là chiến lược Waze. Tùy chọn: include Waze URL vào `hasMap` trong LocalBusiness JSON-LD cùng với Google Maps URL. | US-F37-09 | P1 | Không cần API Waze riêng; deep-link hoạt động ngay khi có lat/lng |
| FR-26 | ~~Emit `alternates.languages` (hreflang `en-MY`, `ms-MY`, `x-default`) trong `generateMetadata` cho tất cả trang tenant storefront.~~ **DEFERRED → P2.** Lý do: i18n hiện tại là client-side only (localStorage/cookie, một URL duy nhất phục vụ cả en+ms — confirmed `src/i18n/index.tsx`); hreflang đúng chuẩn yêu cầu URL-based locale routing (`/en/`, `/ms/`) chưa tồn tại. Storefront vẫn rank theo ngôn ngữ render mặc định trong thời gian này. Unblock khi F21 triển khai subpath routing. | US-F37-09 | **P2** | **DEFERRED:** blocked by client-side i18n; requires URL-based locale routing first (future) |
| FR-27 | EXTEND halal field from Product level (`halalCertified` checkbox + `halalCertImage`) lên Site level: thêm field Payload `halalCertified` (boolean, default OFF — camelCase KHỚP convention Product, DB col `local_business_halal_certified`) + `halalCertNumber` (text, optional). Khi toggle ON: (a) render badge Halal trên storefront; (b) inject `additionalProperty` → `PropertyValue` vào LocalBusiness JSON-LD; (c) nếu có cert number → thêm link đến JAKIM registry. Reuse existing pattern từ Product level — không build từ zero. Schema.org không có property Halal native — `additionalProperty` là cách tiếp cận chuẩn. Google chưa có SERP feature Halal riêng nhưng cải thiện E-E-A-T + AI consumption. | US-F37-09 | P1 | **RESOLVED:** trust seller toggle + optional JAKIM cert number; không validate cert trong MVP. **Semantic tách bạch (CF-2 §7.2):** Site-level = doanh nghiệp đạt JAKIM → LocalBusiness schema + badge storefront; Product-level (`halalCertified`+`halalCertImage`, F08 giữ nguyên) = từng sản phẩm → Product schema. JAKIM = cơ quan duy nhất, e-Cert số hoá 5/2025. Xem BR-15 |
| FR-28 | Hệ thống PHẢI thay free-text field `state` bằng dropdown chọn từ danh sách cố định 13 tỉnh + 3 vùng liên bang Malaysia (lưu cả tên tiếng Anh + Bahasa Melayu, VD: "Penang / Pulau Pinang", "Wilayah Persekutuan Kuala Lumpur"). Dropdown dùng cho `areaServed` trong LocalBusiness schema và location pages tương lai. Schema Offer PHẢI dùng `priceCurrency="MYR"` và UI hiển thị "RM 25.50" — REUSE `formatPrice()` existing formatter trong `src/lib/utils.ts`, không tạo `src/lib/seo/currency.ts` mới (DRY). Field `telephone` trong LocalBusiness JSON-LD PHẢI format `+60 12 345 6789` (E.164 với khoảng cách). Amend FR-01: `state` field sử dụng dropdown Malaysia thay vì free-text cho thị trường MY. | US-F37-09 | P0 | **REUSE** `MY_STATES` đã có trong `src/lib/shipping/constants.ts` (F36) — KHÔNG tạo `src/lib/seo/my-states.ts`. Bổ sung bản đồ nhãn EN/MS (`MY_STATE_LABELS`) cùng file đó (single source of truth). MYR reuse `formatPrice()`. Xem CF-1 §7.2 |

---

### 7.1 FR Rationale — Tại sao F37 cần FR này (cho dev)

> Mục tiêu cốt lõi F37: SME địa phương **được khách tìm thấy** (Google Maps/Local Pack) và **được AI assistant gợi ý** (ChatGPT/Perplexity/Gemini), đo bằng metric gắn doanh thu.

| FR | Tại sao cần |
|----|-------------|
| FR-01 | Google/AI cần địa chỉ + tọa độ **cấu trúc** làm nguồn sự thật; free-text không parse được cho Local Pack |
| FR-02 | Maps + AI hiển thị "đang mở/đóng"; thiếu giờ → mất ranking signal + khách không biết khi nào ghé |
| FR-03 | Seller không rành kỹ thuật → cần 1 form + map preview để nhập tọa độ đúng (giảm sai sót) |
| FR-04 | Schema tối thiểu hiện tại thiếu trường Local Pack cần; thêm geo/hours/priceRange để Google + AI hiểu doanh nghiệp |
| FR-05 | Local Pack matching địa lý cần PostalAddress đầy đủ; chỉ `streetAddress` không đủ |
| FR-06 | `aggregateRating` ở LocalBusiness bị Google flag (policy 2025) → giữ markup hợp lệ, tránh mất rich result |
| FR-07 | Hiện chặn hết AI crawler → **vô hình với AI** (đây là lý do tồn tại của F37); mở để được gợi ý |
| FR-08 | Một số seller muốn opt-out (riêng tư/cạnh tranh) → kiểm soát per-site, không ép buộc |
| FR-09 | Cung cấp bản tóm tắt sạch cho AI crawler; tín hiệu experimental, chi phí thấp |
| FR-10 | General SEO score (F03) không phản ánh local; cần điểm riêng để đo tiến độ + thúc đẩy hành vi |
| FR-11 | Seller không biết làm gì → checklist ưu tiên + ngôn ngữ đơn giản dẫn dắt hành động |
| FR-12/13 | Định nghĩa item cụ thể theo impact → seller làm đúng thứ tự giá trị |
| FR-14 | GBP API là nguồn **DUY NHẤT** của local metrics (calls/directions); cần OAuth để truy cập data riêng tư của seller |
| FR-15 | >60% SME SE Asia chưa có GBP → phải hướng dẫn tạo, không chỉ connect |
| FR-16 | Tránh seller nhập 2 nơi; platform là nguồn sự thật → push 1 chiều lên GBP |
| FR-17 | Data thực (calls/directions) là giá trị cốt lõi seller thấy được ROI của Local SEO |
| FR-18 | Tập trung metric gắn doanh thu, bỏ vanity → seller hiểu giá trị thật |
| FR-19 | Thấy xu hướng theo thời gian để biết nỗ lực có hiệu quả không |
| FR-20 | NAP không nhất quán làm tụt local ranking + giảm trust; phát hiện tự động |
| FR-21 | Surface rõ ràng (badge) để seller hành động ngay |
| FR-22 | Seller để trống SEO → trang "undefined"/vô hình; fallback đảm bảo LUÔN index được |
| FR-23 | FAQ tốt tăng khả năng được AI trích dẫn; seller lười viết → AI draft giảm ma sát |
| FR-24 | Chặn auto-gen của tenant rò rỉ sang platform main site (bảo mật + đúng SEO) |
| FR-25 | MY dùng Waze nhiều; deep-link miễn phí từ lat/lng → tăng lượt chỉ đường |
| FR-26 | (Deferred) phục vụ search code-switching MY — nhưng cần URL locale routing trước |
| FR-27 | MY: Halal là yếu tố quyết định mua; badge + schema tăng trust + AI consumption |
| FR-28 | Chuẩn hoá dữ liệu MY (state/MYR/phone) → schema hợp lệ + hiển thị đúng định dạng |

### 7.2 Cross-Feature Conflicts & Resolutions

> Đối chiếu F37 với các feature đã có. 6 điểm; 3 cần quyết định, 3 actionable.

| ID | Conflict | Loại / Mức | Resolution |
|----|----------|-----------|------------|
| **CF-1** | MY states: F37 định tạo `src/lib/seo/my-states.ts` trùng `MY_STATES` đã có ở `src/lib/shipping/constants.ts` (F36) | DUPLICATION / High | **REUSE** `MY_STATES`; thêm `MY_STATE_LABELS` (en/ms) cùng file F36. Không tạo file mới. (Đã sửa FR-28, §13.5, §13.7) |
| **CF-2** | Halal: Site-level (F37) vs Product-level `halalCertified`+`halalCertImage` (F08) — naming + semantic | COLLISION / High | **Naming:** dùng `halalCertified` camelCase ở Site (khớp Product). **Semantic:** Site = business JAKIM cert (LocalBusiness schema + badge); Product = per-item (Product schema, giữ nguyên). Site ON auto-badge product. (Đã sửa FR-27, §13.7) |
| **CF-3** | robots.txt AI-crawler logic: route `/sites/[slug]/robots.txt` chưa feature nào sở hữu rõ | OWNERSHIP / High | **F37 sở hữu trọn** AI-crawler toggle + render. Ghi rõ trong Sites fields + comment route. Không đụng scope F09 (products/checkout/orders). Actionable |
| **CF-4** | Local SEO score Phase 1: GBP 25% + NAP 10% chưa earn được khi chưa có OAuth | CONTRADICTION / Med | **RESOLVED:** score normalize trên bucket đang áp dụng → Phase 1 (Data 35/Schema 30/AI 20/Tech 15) đạt 100; bucket GBP/Reviews/NAP/Citations hiện "🔒 unlock Phase 2" từ đầu → không tụt điểm. Chi tiết §13.8 |
| **CF-5** | FR-22 fallback: chưa rõ checkout/orders routes có thuộc `/sites/[slug]/*` không | BOUNDARY / Med | **Implementation verify sớm:** tìm route checkout/orders; nếu nằm trong `/sites/[slug]/*` thì thêm `generateMetadata()`. Đã ghi trong FR-22 |
| **CF-6** | hreflang (FR-26) phụ thuộc F21 chưa có URL locale routing | DEFERRED / Low | Đã defer P2; F21 nếu làm subpath routing thì báo F37. Không block |

> **Không conflict (đã verify):** OAuth (F03 không hề có OAuth — F37 build mới hoàn toàn), F19 settings form (F37 thêm section mới riêng), F22 events (tên event mới, không trùng), F36 address (warehouse address ≠ business address — khác level).

---

## 8. Business Rules

- **BR-01:** Mọi tính năng Local SEO chỉ hiển thị dữ liệu trong scope tenant của user đang đăng nhập — không bao giờ cross-tenant.
- **BR-02:** Địa chỉ cấu trúc (`localBusiness` group) là nguồn sự thật cho JSON-LD và GBP sync. Trường free-text `contactInfo.address` giữ nguyên cho backward compat nhưng không được dùng để generate LocalBusiness JSON-LD khi `localBusiness.streetAddress` đã có giá trị.
- **BR-03:** AI crawlers **mặc định = ALLOW** cho toàn bộ storefronts mới và hiện tại sau khi deploy F37. Seller có thể opt-out per-site; quyết định này được stakeholder approve.
- **BR-04:** `aggregateRating` KHÔNG được emit trong LocalBusiness JSON-LD (policy Google 2025–2026). Chỉ emit trên Product và Service schema types.
- **BR-05:** Token GBP OAuth (access_token, refresh_token, token_expiry, location_id) lưu trong **Sites collection**, field group `gbpIntegration` — per-site, không phải per-tenant. Mỗi site kết nối GBP listing riêng. GSC/GA tokens của F03 vẫn nằm trên Tenants — không ảnh hưởng. **[RESOLVED: GBP token = Site-level]**
- **BR-06:** Sync giờ mở cửa từ platform → GBP là one-way push. GBP không phải source of truth cho platform data.
- **BR-07:** Local SEO Score được tính lại mỗi khi seller save site settings hoặc khi GBP Insights được refresh (max 1 lần/24h).
- **BR-08:** GBP Insights data cache tối đa 6h — GBP Insights API có quota giới hạn. Hiển thị timestamp "Cập nhật lần cuối: X giờ trước".
- **BR-09:** `llms.txt` được generate động tại runtime, không cache lâu dài — đảm bảo luôn phản ánh nội dung mới nhất của seller.
- **BR-10:** Checklist "Việc cần làm" chỉ hiển thị items chưa hoàn thành. Items đã done tự động ẩn khỏi danh sách (hoặc hiển thị trong "Đã hoàn thành" collapsible section).
- **BR-11:** Thị trường Malaysia (duy nhất): PostalAddress chuẩn MY (streetAddress, addressLocality = city/town, postalCode 5 chữ số, addressCountry = "MY"). Field `state` dùng dropdown cố định 13 tỉnh + 3 vùng liên bang (FR-28) — không free-text. `telephone` format `+60 12 345 6789`. Schema Offer dùng `priceCurrency="MYR"`.
- **BR-12:** `businessCategory` dùng LocalBusiness sub-types của Schema.org — chỉ cho phép chọn từ danh sách định sẵn (không free-text) để đảm bảo JSON-LD hợp lệ.
- **BR-13:** Auto-generation scope isolation — mọi tính năng auto-gen của F37 (SEO metadata fallback, FAQPage JSON-LD, llms.txt, robots.txt AI crawler logic, sitemap tenant) chỉ được kích hoạt trong context route `/sites/[slug]/*`. Platform main site không được import, extend, hoặc bị side-effect bởi bất kỳ middleware hay route handler nào của F37.
- **BR-14:** SEO metadata fallback thực thi tại render time (`generateMetadata()`) — không phải job batch hay AI call. Độ trễ thêm vào phải < 1ms (pure function, không async). F03 AI Fix-All vẫn là lớp tối ưu riêng biệt, không thay thế fallback này.
- **BR-15:** Halal schema PHẢI dùng `additionalProperty` → `PropertyValue` — KHÔNG tạo property Schema.org tùy tiện. Nội dung: `name: "Halal Certified"`, `value: "JAKIM Certified"` (hoặc cert number nếu seller nhập). Google không có SERP snippet riêng cho Halal hiện tại — implement để cải thiện E-E-A-T + AI consumption; không oversell kết quả SERP tức thì.
- **BR-16:** Waze deep-link button PHẢI chỉ render khi site có đủ `latitude` VÀ `longitude`. Không render nút rỗng hoặc URL thiếu tọa độ. Waze không có listing API riêng — visibility qua Waze đến 100% từ GBP sync (BR liên quan: FR-15 GBP wizard).
- **BR-17:** hreflang chỉ emit khi platform có URL locale tương ứng thực tế. Không emit hreflang trỏ đến URL 404. **[FR-26 DEFERRED P2 — BR này không active trong MVP; unblock khi F21 triển khai subpath routing `/en/`, `/ms/`]**

---

## 9. User Flow

> **Detailed flow diagrams** (Mermaid, dev-presentation HTML) for all 9 user flows + 2 automatic processes are at [`docs/design/F37-local-seo-user-flows.html`](../design/F37-local-seo-user-flows.html). This section shows 3 primary happy-path flows; open the HTML for comprehensive coverage.

### Flow A: Seller thiết lập Local Business Data (P0 - Happy Path)

```text
Seller vào /dashboard → Click tab [Local SEO]
  ↓
Thấy Local SEO Score = 20/100 + checklist với 5 items "Việc cần làm"
  ↓
Click item đầu tiên: "Thêm địa chỉ kinh doanh"
  ↓
Mở form "Thông tin doanh nghiệp địa phương" trong Site Settings
  ↓
Điền: Địa chỉ, thành phố, mã bưu điện, quốc gia
Điền giờ mở cửa theo ngày (bảng 7 hàng cho T2–CN)
Chọn danh mục kinh doanh (dropdown: Nhà hàng / Cửa hàng / Dịch vụ / ...)
  ↓
Save → Hệ thống tính lại Local SEO Score → hiện 55/100
  ↓
JSON-LD LocalBusiness tự động cập nhật trên storefront (verified via Google Rich Results Test)
  ↓
Quay về checklist → Item "Thêm địa chỉ" đã tick xanh
  └── Tiếp theo: "Kết nối Google Business Profile"
```

### Flow B: Kết nối Google Business Profile (P1)

```text
Seller click "Kết nối Google Business Profile" trong checklist hoặc tab Local SEO
  ↓
Hệ thống kiểm tra GBP OAuth token
  ├── Chưa có GBP → Hiện wizard: Bước 1 "Bạn có Google Business Profile chưa?"
  │     ├── Có → Bước 2: Chọn listing từ danh sách GBP của Google account
  │     └── Chưa có → Hiện link + hướng dẫn tạo GBP trên Google (business.google.com)
  │
  └── Đã có → Redirect Google OAuth consent (scope: business.manage)
        ↓
      Callback → Lưu token vào Sites.gbpIntegration (per-site)
        ↓
      Hệ thống pull GBP info → So sánh NAP với platform data
        ├── Khớp → Hiện "Đã kết nối ✓" + nút "Đồng bộ giờ mở cửa lên GBP"
        └── Không khớp → Hiện chi tiết mismatch + hướng dẫn fix
```

### Flow C: Xem Local SEO Dashboard (P1)

```text
Seller vào /dashboard → Tab [Local SEO]
  ↓
Thấy 6 metric cards: Cuộc gọi / Chỉ đường / Clicks từ GBP / Lượt xem / Đánh giá / AI appearances
  ↓
Chọn khoảng thời gian: 7 ngày / 30 ngày
  ↓
Xem line chart trend 3 metrics chính
  ↓
Cuộn xuống → Local SEO Checklist → Các items còn lại
  └── Click item → one-click fix hoặc modal hướng dẫn
```

---

## 10. Screen Layout

> **[Global CMS Constraint]** Render bên trong Main Content Area của F18 CMS Layout.
> **[Wireframe & Design Rule]** Không dùng ASCII để minh hoạ; dẫn nguồn từ wireframe nếu có.

### 10.1. Tab "Local SEO" trong Dashboard

- **Mô tả:** Tab mới thêm vào thanh tabs của F03 Dashboard. Cấu trúc: extend `TabId` union type tại `src/components/dashboard/DashboardTabContent.tsx` to add `'local-seo'`, create `LocalSEOView` component, add entry to `TABS` array. Không tạo route file riêng — tab navigation dùng query param `?tab=local-seo`.
- **Components chính:**
  - **Header:** Tiêu đề "Local SEO", Time Period Filter (7 ngày / 30 ngày), badge trạng thái GBP (Đã kết nối / Chưa kết nối).
  - **Local SEO Score Card:** Vòng tròn điểm (0–100) + nhãn hạng (Yếu / Trung bình / Tốt / Xuất sắc), nút "Cải thiện điểm".
  - **GBP Insights Cards (2x3 grid, mobile 2x3):** 6 card: Cuộc gọi, Chỉ đường, Clicks từ GBP, Lượt xem GBP, Đánh giá trung bình (+ số reviews), AI appearances. Mỗi card: số liệu lớn + % change + mũi tên xu hướng.
  - **Trend Chart:** Line chart (Recharts) — 3 series: Cuộc gọi / Chỉ đường / Clicks. Period selector tích hợp.
  - **NAP Consistency Badge:** Một dòng status: "NAP: Khớp ✓" hoặc "NAP: Có sự khác biệt ⚠" + nút "Xem chi tiết".
  - **Checklist "Việc cần làm":** Card dọc có accordion. Items nhóm High/Medium impact. Mỗi item: icon trạng thái + mô tả ngắn + badge impact + nút action.
- **Empty State (chưa kết nối GBP):** Card placeholder cho GBP Insights với nút "Kết nối Google Business Profile" nổi bật.
- **Empty State (chưa có local business data):** Prompt "Bắt đầu với Local SEO" — dẫn đến form thiết lập.
- **Design / Wireframe:** `docs/design/F37-local-seo-dashboard.md` (sẽ tạo khi vào sprint)

### 10.2. Form "Thông tin doanh nghiệp địa phương" (trong Site Settings)

- **Mô tả:** Section mới trong Site Settings, phía dưới thông tin chung.
- **Components chính:**
  - **Địa chỉ cấu trúc:** Số nhà/Đường, Thành phố/Quận, Bang (dropdown 13 tỉnh + 3 vùng liên bang MY), Mã bưu điện (5 số), Quốc gia mặc định Malaysia.
  - **Vị trí (toạ độ):** input "Dán link Google Maps của bạn" → tự trích lat/lng (3 lớp, §13.9). Map preview cập nhật ngay. Fallback nâng cao: 2 ô Latitude/Longitude tay nếu trích thất bại.
  - **Danh mục kinh doanh:** Select dropdown với nhóm: Ăn uống (Restaurant, Cafe, Bar, Bakery...) / Bán lẻ (Store, Supermarket, Pharmacy...) / Dịch vụ (HairSalon, Spa, AutoRepair...) / Khác (LocalBusiness generic).
  - **Khoảng giá:** Select 4 mức: Bình dân ($) / Trung bình ($$) / Cao cấp ($$$) / Cao nhất ($$$$).
  - **Khu vực phục vụ:** Textarea tự do (VD: "Quận 1, Quận 3, TP.HCM").
  - **Giờ mở cửa:** Table 7 hàng (Thứ 2 → Chủ nhật), mỗi hàng: checkbox "Đóng cửa" + time picker Mở/Đóng.
- **Design / Wireframe:** `docs/design/F37-local-business-form.md` (sẽ tạo khi vào sprint)

### 10.3. Wizard "Kết nối Google Business Profile"

- **Mô tả:** Modal wizard 3 bước, xuất hiện khi click "Kết nối GBP" từ checklist hoặc dashboard.
- **Bước 1:** Câu hỏi "Bạn đã có Google Business Profile chưa?" — 2 nút Yes/No.
- **Bước 2a (Có GBP):** Nút "Đăng nhập bằng Google" → OAuth flow.
- **Bước 2b (Chưa có GBP):** Card hướng dẫn + link "Tạo GBP tại business.google.com" (external) + nút "Tôi đã tạo xong → Tiếp tục".
- **Bước 3:** Hiện thông tin GBP đã kết nối + NAP comparison + nút "Đồng bộ".

### 10.4. UI States

- **Loading State:** Skeleton shimmer cho GBP Insights cards và chart — không dùng spinner.
- **Error State (GBP API lỗi):** Toast "Không thể tải dữ liệu GBP" + nút "Thử lại". Cards hiện số liệu cache nếu có.
- **GBP Token hết hạn:** Banner inline "Kết nối GBP đã ngắt — Vui lòng kết nối lại" + nút reconnect.
- **Modal NAP Mismatch:** Bảng so sánh 2 cột: "Trên website" vs "Trên GBP" — highlight dòng không khớp.

---

## 11. Acceptance Criteria

> **[BẮT BUỘC]** AC copy từ story đã approve. AC kỹ thuật bổ sung qua story file trước.

### AC-1: Local Business Data Model — Happy Path

> Source: US-F37-01 — AC-1: Seller thiết lập địa chỉ cấu trúc

```gherkin
GIVEN seller đang trong Site Settings → tab "Thông tin doanh nghiệp địa phương"
WHEN  điền đầy đủ streetAddress, city, postcode, country, chọn businessCategory, nhập giờ mở cửa
  AND nhấn Save
THEN  dữ liệu được lưu vào Sites collection, localBusiness group
  AND LocalBusiness JSON-LD trên storefront homepage emit đầy đủ address (PostalAddress), openingHoursSpecification, @type đúng sub-type
  AND Local SEO Score tăng ≥ 20 điểm
  AND checklist items "Thêm địa chỉ" và "Cập nhật giờ mở cửa" đổi trạng thái sang ✓ Done
```

### AC-2: Giờ mở cửa — Ngày đóng cửa

> Source: US-F37-01 — AC-2: Ngày nghỉ được xử lý đúng

```gherkin
GIVEN seller đánh dấu Thứ 7 và Chủ nhật là "Đóng cửa" trong bảng giờ mở cửa
WHEN  Save thành công
THEN  JSON-LD openingHoursSpecification KHÔNG chứa entry cho Sa và Su
  AND GBP sync (nếu đã kết nối) gửi ngày đóng cửa đúng format về GBP
```

### AC-3: JSON-LD LocalBusiness — Đầy đủ và hợp lệ

> Source: US-F37-02 — AC-1: JSON-LD emit đúng chuẩn Schema.org

```gherkin
GIVEN site đã có đầy đủ localBusiness data (address, lat/lng, hours, category, priceRange)
WHEN  Google Rich Results Test fetch storefront homepage
THEN  JSON-LD LocalBusiness chứa: @type (sub-type chính xác), name, url, address (PostalAddress đầy đủ), telephone, geo (GeoCoordinates), openingHoursSpecification (array đúng format), priceRange, areaServed
  AND KHÔNG chứa aggregateRating ở mức LocalBusiness type
  AND validator không báo error
```

### AC-4: AI Crawlers — Mặc định mở

> Source: US-F37-03 — AC-1: AI crawlers unblocked by default

```gherkin
GIVEN storefront của bất kỳ tenant nào (không phân biệt setting, mặc định toggle ai_crawlers_enabled = true)
WHEN  fetch https://{storefront-domain}/robots.txt
THEN  robots.txt KHÔNG chứa "Disallow: /" cho GPTBot, ClaudeBot, Google-Extended, CCBot
  AND Allow: / hoặc không có user-agent rule nào (mặc định allow) cho các user-agents trên
  AND nếu PerplexityBot được thêm, cũng allow mặc định (hiện không trong blocklist)
```

### AC-5: AI Crawlers — Seller opt-out

> Source: US-F37-03 — AC-2: Per-seller opt-out hoạt động đúng

```gherkin
GIVEN seller vào Site Settings và TẮT toggle "Cho phép AI crawlers index website"
WHEN  fetch https://{storefront-domain}/robots.txt
THEN  robots.txt chứa Disallow: / cho GPTBot, ClaudeBot, Google-Extended, PerplexityBot, CCBot
  AND các crawler thông thường (Googlebot, Bingbot) KHÔNG bị block
```

### AC-6: llms.txt — Nội dung đúng cấu trúc

> Source: US-F37-03 — AC-3: llms.txt route trả về nội dung hợp lệ

```gherkin
GIVEN storefront đã có đủ site data (name, description, products, contact, hours)
WHEN  GET https://{storefront-domain}/llms.txt
THEN  response là text/plain, HTTP 200
  AND nội dung chứa: tên doanh nghiệp, mô tả ngắn, ≥ 5 URLs quan trọng, thông tin liên lạc, giờ mở cửa
  AND format là Markdown (headings + list items)
```

### AC-7: Local SEO Score — Tính đúng

> Source: US-F37-04 — AC-1: Score phản ánh completeness

```gherkin
GIVEN site chưa có local business data, chưa kết nối GBP
WHEN  vào tab Local SEO trong dashboard
THEN  Local SEO Score hiển thị ≤ 30/100
  AND checklist hiển thị ≥ 4 items "Việc cần làm" với priority High

GIVEN seller hoàn thành: địa chỉ cấu trúc + giờ mở cửa + connect GBP + bật AI crawlers
WHEN  hệ thống tính lại score
THEN  Local SEO Score ≥ 75/100
  AND số items High priority trong checklist = 0
```

### AC-8: Checklist — One-click fix

> Source: US-F37-04 — AC-2: Actionable items với quick fix

```gherkin
GIVEN seller thấy checklist item "Bật AI crawlers" với trạng thái Chưa hoàn thành
WHEN  click nút "Bật ngay" trên item đó
THEN  toggle "Cho phép AI crawlers" trong Site Settings tự động bật
  AND robots.txt của storefront được cập nhật ngay
  AND checklist item đổi sang ✓ Done
  AND Local SEO Score tăng 10 điểm
```

### AC-9: GBP OAuth — Connect flow

> Source: US-F37-05 — AC-1: OAuth connect thành công

```gherkin
GIVEN seller click "Kết nối Google Business Profile" (chưa connect)
WHEN  hoàn thành Google OAuth flow với account có GBP listing
THEN  hệ thống lưu access_token + refresh_token vào Sites.gbpIntegration (per-site)
  AND dashboard hiển thị badge "GBP: Đã kết nối ✓"
  AND hệ thống tự động pull GBP Insights trong vòng 30 giây
  AND GBP Insights cards hiển thị data thực (không còn empty state)
```

### AC-10: GBP Sync — Giờ mở cửa

> Source: US-F37-05 — AC-2: Sync giờ lên GBP

```gherkin
GIVEN seller đã connect GBP và đã thiết lập giờ mở cửa trên platform
WHEN  click nút "Đồng bộ giờ mở cửa lên GBP"
THEN  hệ thống gọi GBP API cập nhật opening hours trên GBP listing
  AND hiện toast "Đồng bộ thành công" sau khi API confirm
  AND nếu API lỗi → hiện toast lỗi với thông báo cụ thể (không nuốt lỗi)
```

### AC-11: GBP Insights — Hiển thị metric cards

> Source: US-F37-06 — AC-1: Dashboard hiển thị đúng metrics

```gherkin
GIVEN seller đã connect GBP và chọn khoảng 7 ngày
WHEN  vào tab Local SEO trong dashboard
THEN  hiển thị ≥ 4 metric cards (Cuộc gọi, Chỉ đường, Clicks từ GBP, Lượt xem GBP)
  AND mỗi card hiển thị: số liệu tuyệt đối + % change + mũi tên lên/xuống
  AND timestamp "Cập nhật: X giờ trước" hiển thị dưới cards
  AND loading state là skeleton shimmer (không phải spinner)
```

### AC-12: GBP Insights — Cache và fallback

> Source: US-F37-06 — AC-2: Graceful handling khi API không khả dụng

```gherkin
GIVEN GBP Insights API trả về lỗi hoặc timeout
WHEN  seller vào tab Local SEO
THEN  hệ thống hiển thị data từ cache (nếu cache < 6h)
  AND hiển thị banner "Đang dùng dữ liệu cache từ X giờ trước"
  AND nếu không có cache → hiện empty state với nút "Thử tải lại"
  AND không crash toàn bộ dashboard
```

### AC-13: NAP Consistency — Phát hiện mismatch

> Source: US-F37-07 — AC-1: NAP checker hoạt động đúng

```gherkin
GIVEN seller đã connect GBP và GBP listing có số điện thoại khác với Sites.contactInfo.phone
WHEN  hệ thống chạy NAP check (sau khi GBP connected hoặc sau khi seller save site settings)
THEN  dashboard hiển thị badge "NAP: Có sự khác biệt ⚠"
  AND checklist có item "Số điện thoại không khớp với GBP" với nội dung cụ thể: giá trị trên website vs trên GBP
  AND Local SEO Score trừ 10 điểm cho inconsistency
```

### AC-15: Auto SEO Metadata Fallback — Empty Fields

> Source: US-F37-08 — AC-1: Seller không điền SEO fields vẫn có metadata đầy đủ

```gherkin
GIVEN một trang product trên tenant storefront chưa được seller điền SEO title, meta description, hoặc OG fields
WHEN  crawler hoặc browser fetch trang đó tại /sites/[slug]/products/[product-slug]
THEN  HTML <head> chứa: <title> (50–60 chars), <meta name="description"> (150–160 chars), <meta property="og:title">, <meta property="og:description">, <meta property="og:url">, <link rel="canonical">
  AND title được auto-generated từ product name + business name (không để trống hoặc hiện "undefined")
  AND không có tag nào bị empty (content="") hoặc bị thiếu hoàn toàn
```

### AC-16: Auto FAQPage JSON-LD Emission

> Source: US-F37-08 — AC-2: FAQ block kích hoạt FAQPage schema

```gherkin
GIVEN trang tenant storefront có FAQ block với ít nhất 1 cặp câu hỏi/câu trả lời
WHEN  fetch HTML của trang đó
THEN  <head> hoặc <body> chứa JSON-LD script với @type = "FAQPage"
  AND mỗi câu hỏi trong FAQ block được map thành 1 entity @type "Question" với "acceptedAnswer"
  AND validator Schema.org không báo lỗi cho FAQPage block đó
```

### AC-17: Scope Isolation — Platform Main Site Không Bị Ảnh Hưởng

> Source: US-F37-08 — AC-3: Auto-gen chỉ áp dụng cho tenant storefront

```gherkin
GIVEN một request đến bất kỳ route nào của platform main site (VD: /, /dashboard, /admin, /api/v1/*)
WHEN  server xử lý request
THEN  không có llms.txt, AI crawler Disallow/Allow logic của F37, hoặc tenant SEO metadata fallback nào được áp dụng
  AND fetch https://{platform-domain}/llms.txt trả về 404 (không có route này trên main site)
  AND robots.txt của platform main site KHÔNG bị modify bởi logic F37
```

### AC-18: Waze Deep-Link — Render đúng URL

> Source: US-F37-09 — Malaysia Market Optimization

```gherkin
GIVEN site có latitude và longitude đã được seller nhập
WHEN  khách hàng truy cập trang contact hoặc maps section trên storefront
THEN  nút "Navigate with Waze" hiển thị
  AND URL của nút là https://waze.com/ul?ll={latitude},{longitude}&navigate=yes (đúng tọa độ)
  AND nút không render nếu site thiếu latitude hoặc longitude

GIVEN site chưa có latitude hoặc longitude
WHEN  khách hàng truy cập trang contact
THEN  nút "Navigate with Waze" KHÔNG hiển thị (không render href rỗng)
```

### AC-19: Halal Toggle — Badge + JSON-LD

> Source: US-F37-09 — Malaysia Market Optimization

```gherkin
GIVEN seller bật toggle "Halal Certified" trong site settings và nhấn Save
WHEN  khách hàng truy cập storefront homepage
THEN  badge "Halal Certified" hiển thị trên trang
  AND LocalBusiness JSON-LD chứa "additionalProperty" với @type "PropertyValue", name "Halal Certified"
  AND nếu seller đã nhập số chứng nhận JAKIM → JSON-LD value chứa cert number và sameAs link đến myehalal.halal.gov.my

GIVEN seller TẮT toggle "Halal Certified"
WHEN  khách hàng truy cập storefront
THEN  badge Halal KHÔNG hiển thị
  AND LocalBusiness JSON-LD KHÔNG chứa additionalProperty Halal Certified
```

### AC-20: hreflang — DEFERRED (P2)

> Source: US-F37-09 — Malaysia Market Optimization
> **DEFERRED → P2:** FR-26 bị hoãn do i18n client-side only. AC này không áp dụng cho MVP. Sẽ enable khi URL-based locale routing (F21 subpath `/en/`, `/ms/`) được triển khai.

```gherkin
[AC-20 DEFERRED — không test trong sprint này]
```

### AC-14: Mobile Responsive

> Source: US-F37-06 — AC-3: Mobile layout

```gherkin
GIVEN screen width < 768px
WHEN  seller vào tab Local SEO
THEN  GBP Insights cards hiển thị dạng 2 cột (2x3 grid)
  AND Trend chart thu nhỏ phù hợp viewport, có thể scroll ngang
  AND Checklist items hiển thị đầy đủ, nút action rõ ràng (min touch target 44px)
  AND không có horizontal overflow
```

---

## 12. Non-Functional Requirements

| Category | Requirement | Notes |
|----------|-------------|-------|
| **Performance** | Tab Local SEO load < 2s (skeleton → real data). GBP Insights cache 6h. | Cache key: `gbp_insights_{siteId}_{period}` |
| **Performance** | `generateLocalBusinessSchema()` không làm chậm render — pure function, < 5ms | Không có async call trong JSON-LD generator |
| **Security** | GBP access_token KHÔNG bao giờ expose ra client. Mọi GBP API call qua server-side route. | Token encrypt at rest nếu có thể |
| **Security** | Route `/api/local-seo/*` yêu cầu auth token + tenant validation. 401 → redirect /login | |
| **Security** | GBP OAuth redirect URI phải match chính xác URI trong GCP console. CSRF state param bắt buộc. | |
| **Accessibility** | WCAG 2.1 AA. Metric cards có aria-label rõ ràng. Checklist items keyboard navigable. | |
| **Browser Support** | Chrome, Safari, Edge (latest 2 versions). Mobile Safari iOS 16+. | |
| **Device Support** | Mobile 375px, Tablet 768px, Desktop 1280px+ | |
| **Data / Privacy** | GBP Insights data không chứa PII. Số liệu aggregated theo seller, không track cá nhân. | |
| **Reliability** | GBP API lỗi KHÔNG làm crash dashboard. Graceful fallback về cache hoặc empty state. | |
| **Quota** | GBP Insights API: max 5 requests/tenant/giờ. Implement request throttling. | Google Business Profile API quota |

---

## 13. Technical Architecture

### 13.1 Components

| Component | File | Description |
|-----------|------|-------------|
| `LocalSEOView` | `src/components/local-seo/LocalSEOView.tsx` | Tab Local SEO view component — extends F03 dashboard TabId union to include 'local-seo' |
| `LocalSEOScoreWidget` | `src/components/local-seo/LocalSEOScoreWidget.tsx` | Score circle + breakdown |
| `GBPInsightsCards` | `src/components/local-seo/GBPInsightsCards.tsx` | 6 metric cards (reuse DashboardStats pattern) |
| `LocalSEOTrendChart` | `src/components/local-seo/LocalSEOTrendChart.tsx` | Line chart Recharts — calls/directions/clicks |
| `LocalSEOChecklist` | `src/components/local-seo/LocalSEOChecklist.tsx` | Actionable checklist với one-click fixes |
| `NAPStatusBadge` | `src/components/local-seo/NAPStatusBadge.tsx` | Inline NAP consistency status |
| `GBPConnectWizard` | `src/components/local-seo/GBPConnectWizard.tsx` | Modal wizard 3 bước kết nối GBP |
| `LocalBusinessForm` | `src/components/local-seo/LocalBusinessForm.tsx` | Form địa chỉ cấu trúc + giờ mở cửa trong Site Settings |
| `generateLocalBusinessSchema` | `src/lib/seo/json-ld.ts` (extend lines 127–156) | Nâng cấp JSON-LD function — thêm geo, hours, priceRange |
| `localSEOScore` | `src/lib/seo/local-seo-score.ts` (new) | Pure function tính Local SEO Score từ site data |
| `napChecker` | `src/lib/seo/nap-checker.ts` (new) | So sánh NAP giữa Sites record và GBP data |
| `gbpClient` | `src/lib/gbp/gbp-client.ts` (new) | GBP API client — fetch insights, sync hours |
| `llms.txt route` | `src/app/sites/[slug]/llms.txt/route.ts` (new) | Dynamic llms.txt per-tenant |
| `robots.txt route` | `src/app/sites/[slug]/robots.txt/route.ts` (modify) | Remove blanket AI crawler block; add per-site toggle logic |

### 13.2 Data Model Changes (Schema Migration Required)

**Sites collection — thêm group `localBusiness`:**
```
sites.local_business_street_address      varchar
sites.local_business_city                varchar
sites.local_business_state               varchar
sites.local_business_postcode            varchar
sites.local_business_country             varchar
sites.local_business_latitude            numeric
sites.local_business_longitude           numeric
sites.local_business_category            varchar  (LocalBusiness sub-type)
sites.local_business_price_range         varchar  ($, $$, $$$, $$$$)
sites.local_business_service_area        text
sites.local_business_ai_crawlers_enabled boolean  DEFAULT true
```

**Array table `sites_opening_hours` (mới):**
```sql
CREATE TABLE IF NOT EXISTS sites_opening_hours (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  _order integer NOT NULL DEFAULT 0,
  _parent_id integer NOT NULL,
  _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
  day_of_week varchar,     -- Mo/Tu/We/Th/Fr/Sa/Su
  opens varchar,           -- HH:MM
  closes varchar,          -- HH:MM
  is_closed boolean DEFAULT false
);
```

**Sites collection — thêm group `gbpIntegration` (RESOLVED: per-site, không phải per-tenant):**
```
sites.gbp_integration_access_token      text
sites.gbp_integration_refresh_token     text
sites.gbp_integration_token_expiry      timestamptz
sites.gbp_integration_location_id       varchar  (GBP location resource name)
sites.gbp_integration_connected_at      timestamptz
```

> Mọi column trên PHẢI được thêm vào `scripts/db-setup.js` MIGRATIONS array theo convention của project. `scripts/check-migrations.js` sẽ block PR nếu thiếu.

### 13.3 API Endpoints

```text
GET  /api/local-seo/score?siteId=X
     → { score: number, breakdown: object, checklistItems: Array }
     Auth: tenant-scoped

GET  /api/local-seo/gbp-insights?siteId=X&period=7d|30d
     → { calls, directions, websiteClicks, profileViews, reviewRating, reviewCount, aiAppearances }
     Auth: tenant-scoped | Cache: 6h

POST /api/local-seo/gbp-sync-hours
     Body: { siteId: string }
     → { success: boolean, syncedAt: string }
     Auth: tenant-scoped

GET  /api/google/gbp/auth?siteId=X
     → Redirect to Google OAuth (scope: business.manage)

GET  /api/google/gbp/callback
     → Exchange code → store token → redirect /dashboard/local-seo

POST /api/local-seo/nap-check?siteId=X
     → { consistent: boolean, mismatches: Array<{ field, platform, gbp }> }
     Auth: tenant-scoped

GET  /sites/[slug]/llms.txt
     → text/plain, dynamic content per tenant (public route)
```

### 13.4 GBP OAuth Flow (BUILD FROM SCRATCH)

**IMPORTANT:** Google OAuth infrastructure does NOT exist in codebase. No `src/app/api/google/` directory, no token storage on Tenants, no GSC/GA OAuth. Implement shared OAuth client for GBP + GSC (future).

```text
1. GCP Console: Enable "My Business Business Information API" + "My Business Account Management API"
   Add scope: https://www.googleapis.com/auth/business.manage
   Thêm redirect URI: https://{cms-domain}/api/google/gbp/callback
   **ACTION:** Submit OAuth verification form (~4–6 tuần lead time)

2. Build shared OAuth infra: `src/lib/google/oauth-client.ts` (consent URL, callback, token exchange, refresh)
   Routes: `/api/google/gbp/auth?siteId=X`, `/api/google/gbp/callback?code=...&state=...`

3. Seller click "Kết nối GBP" → POST /api/google/gbp/auth?siteId=X
   → Build OAuth URL với state=siteId (CSRF)
   → Redirect seller → Google consent screen (scope: business.manage)

4. Google redirect về /api/google/gbp/callback?code=X&state=siteId
   → Verify state parameter → Exchange code → access_token + refresh_token
   → Encrypt + store vào Sites.gbpIntegration (per-site)
   → Fetch seller's GBP location_id qua GBP Locations API
   → Lưu location_id vào Sites.gbpIntegration → redirect /dashboard?tab=local-seo

5. Mọi GBP API call sau đó:
   → Check token expiry (Sites.gbpIntegration.token_expiry) → auto-refresh với refresh_token nếu cần
   → Gọi GBP API → Cache response 6h theo key gbp_insights_{siteId}_{period}
```

### 13.5 Codebase Reuse

- **Reuse:** `(dashboard)` route group + tab pattern của F03 (TabId union + TabPanel), Recharts, `DashboardStats.tsx` pattern, `src/lib/seo/json-ld.ts` (extend `generateLocalBusinessSchema()`), `contactInfo`/`socialLinks` trên Sites, `formatPrice()` currency formatter, `generateMetadata()` pattern, existing FAQSchema generator.
- **New files — Shared OAuth infra:** `src/lib/google/oauth-client.ts` (shared for GBP + GSC future), `/api/google/gbp/auth`, `/api/google/gbp/callback`.
- **New files — Local SEO:** `src/lib/gbp/gbp-client.ts`, `src/lib/seo/local-seo-score.ts`, `src/lib/seo/nap-checker.ts`, `src/lib/seo/map-links.ts`, `src/app/sites/[slug]/llms.txt/route.ts`, components trong `src/components/local-seo/`, modify `src/app/sites/[slug]/robots.txt/route.ts` để thêm toggle logic.
- **REUSE (không tạo mới):** `MY_STATES` từ `src/lib/shipping/constants.ts` (F36), `formatPrice()` từ `src/lib/utils.ts`, `generateLocalBusinessSchema()` + `generateFAQSchema()` từ `src/lib/seo/json-ld.ts`, `generateMetadata()` cascading hiện có, `DashboardStats` + Recharts. KHÔNG tạo `src/lib/seo/my-states.ts` hay `src/lib/seo/currency.ts`.

### 13.7 Malaysia Market Optimization — Technical Notes

- **Waze deep-link helper:** Pure function `getWazeUrl(lat, lng): string` trong `src/lib/seo/map-links.ts` — trả về `https://waze.com/ul?ll={lat},{lng}&navigate=yes`. Render trong storefront contact section chỉ khi cả `latitude` lẫn `longitude` có giá trị. **Không cần Waze API:** Waze seller visibility đến 100% từ GBP sync (~24h latency) — GBP wizard (FR-15) chính là chiến lược Waze. Tùy chọn: thêm Waze URL vào `hasMap` array của LocalBusiness JSON-LD song song Google Maps URL.
- **hreflang via `alternates.languages`:** **[FR-26 DEFERRED P2 — không implement trong sprint này.]** i18n hiện tại là client-side only (localStorage/cookie, single URL); hreflang yêu cầu URL-based subpath routing chưa có. Implement khi F21 triển khai `/en/`, `/ms/` subpath routing.
- **Halal field + schema injection:** Thêm field Payload `halalCertified` (boolean, camelCase khớp Product) + `halalCertNumber` (varchar, nullable) vào group `localBusiness` của Sites. Trong `generateLocalBusinessSchema()`: khi `halalCertified = true`, append `additionalProperty` block. Storefront đọc flag để render badge. Dùng `PropertyValue` chuẩn. **Tách bạch với Product-level Halal (F08):** Site = business JAKIM cert (LocalBusiness schema); Product = per-item (`halalCertified`+`halalCertImage` giữ nguyên, Product schema). Site ON có thể auto-badge product.
- **MY states — REUSE từ F36:** dùng `MY_STATES` đã có trong `src/lib/shipping/constants.ts` (16 entries). Bổ sung bản đồ nhãn song ngữ `MY_STATE_LABELS` (`{ en, ms }`) NGAY trong file đó để dùng chung cho cả shipping lẫn SEO (single source of truth). KHÔNG tạo `src/lib/seo/my-states.ts`. MYR reuse `formatPrice()` (`src/lib/utils.ts`) — KHÔNG tạo `currency.ts`.
- **Schema migration:** Thêm `sites.local_business_halal_certified` (boolean DEFAULT false) + `sites.local_business_halal_cert_number` (varchar) vào `scripts/db-setup.js` MIGRATIONS array.

### 13.6 Auto-Generation & AEO Technical Notes

- **SEO metadata fallback:** Tái dụng `generateMetadata()` đang có trong các route `src/app/sites/[slug]/page.tsx`, `src/app/sites/[slug]/products/[slug]/page.tsx`, v.v. Thêm một util nhỏ `src/lib/seo/auto-meta-fallback.ts` — pure function nhận site/page/product data, trả về `Metadata` object với fallback values. Không async, không gọi AI, không thêm infra mới.
- **FAQPage JSON-LD:** Tái dụng FAQPage schema generator đã có trong `src/lib/seo/json-ld.ts`. Logic mới chỉ là: khi render trang tenant, detect FAQ block trong page content → gọi generator hiện có → inject vào `<script type="application/ld+json">`. Không build schema từ đầu.
- **Scope guard:** Toàn bộ auto-gen logic được import và gọi chỉ trong `src/app/sites/[slug]/` route tree. Không có global middleware. Main site routes (`src/app/(marketing)/`, `src/app/(dashboard)/`) không import bất kỳ module nào của F37 auto-gen.

### 13.6.5 Scope Isolation Already Satisfied (FR-24)

Per-tenant scope isolation (FR-24) ALREADY met by existing codebase: `robots.txt` và `sitemap` là per-tenant routes under `src/app/sites/[slug]/`. F37 không cần thêm infra mới để satisfy FR-24.

---

### 13.8 Local SEO Score Formula

> Nguồn: [researcher-260618-1500-local-seo-score-methodology.md](../../plans/reports/researcher-260618-1500-local-seo-score-methodology.md). Trọng số bám Whitespark 2026 (GBP 32%, reviews 16%, on-page 19%, citations 7%). Pure function `src/lib/seo/local-seo-score.ts`.

**Nguyên tắc:** score = `earned / applicable × 100`. Chỉ tính các bucket **đang áp dụng** ở phase hiện tại (normalize). Bucket chưa khả dụng hiện dưới dạng item "🔒 unlock Phase 2" trong checklist — **không** vào mẫu số → seller làm hết Phase 1 đạt 100/100, và khi Phase 2 mở GBP thì đọc là "mở khoá thêm" chứ không phải "tụt điểm" (vì item khoá đã hiển thị từ đầu).

**Phase 1 (chưa có GBP) — 4 bucket = 100%:**

| Bucket | Weight | Sub-signals (điểm) |
|--------|--------|--------------------|
| Business Data | 35% | name, address, phone, hours, category, website, description — mỗi field 5pt |
| Structured Data | 30% | LocalBusiness JSON-LD 10 · industry subtype 5 · FAQPage 8 · Organization 7 |
| AI Discoverability | 20% | AI crawlers allowed (theo FR-07 allow-all) 12 · sitemap present 8 — *(KHÔNG dùng sub-signal "block training bot"; mâu thuẫn BR-03)* |
| Technical Health | 15% | reuse F03 `technical-score.ts` (HTTPS, mobile, basic CWV) |

**Phase 2 (có GBP) — re-weight, thêm bucket:**

| Bucket | Weight |
|--------|--------|
| GBP completeness | 25% |
| GBP Reviews & engagement | 15% |
| Business Data | 20% |
| Structured Data | 12% |
| On-Page signals | 10% |
| NAP consistency | 10% |
| Citations & links | 8% |

**No-drop rule:** item Phase 2 (GBP/Reviews/NAP/Citations) PHẢI hiển thị "🔒 +X điểm — mở khoá khi kết nối Google" ngay trong Phase 1. Headline ghi rõ "Phase 1 — Nền tảng". Khi Phase 2 deploy, mẫu số mở rộng nhưng vì đã thấy trước nên seller hiểu là cơ hội tăng thêm, không phải reset.

### 13.9 Geocoding — Paste Google Maps Link → lat/lng

> Nguồn: [researcher-260618-1500-gmaps-link-to-latlng.md](../../plans/reports/researcher-260618-1500-gmaps-link-to-latlng.md). Khả thi ~90–95%.

Seller KHÔNG gõ toạ độ. Họ dán link Google Maps → hệ thống trích lat/lng qua **3 lớp**:

1. **Client regex** (tức thì): bắt `@<lat>,<lng>` và `!3d<lat>!4d<lng>` trong URL đầy đủ. Tin `!3d!4d` (vị trí pin) hơn `@` (có thể là tâm viewport).
2. **Server redirect resolver** (~300–500ms): link rút gọn `maps.app.goo.gl/*` / `goo.gl/maps/*` không chứa toạ độ → route Next.js follow redirect lấy URL cuối → parse lại bằng lớp 1.
3. **Geocoding API fallback**: nếu vẫn không có toạ độ → geocode địa chỉ seller đã nhập (Google Geocoding API, $5/1k, free tier phủ phần lớn seller).

- Helper: `src/lib/seo/map-links.ts` (đã có trong new files) chứa cả parser + `getWazeUrl()`.
- UX form: input "Dán link Google Maps của bạn" + helper text; nếu cả 3 lớp fail → hiện 2 ô lat/lng tay (advanced fallback).
- ToS: parse URL do user tự dán là hợp lệ (không phải scraping tự động).

---

## 14. Dependencies

| Dependency | Status | Action Needed |
|-----------|--------|---------------|
| **Google OAuth Infrastructure (PREREQUISITE)** | **BLOCKED** | **BUILD SHARED OAUTH CLIENT FROM SCRATCH** (`src/lib/google/oauth-client.ts`) for GBP + GSC (future). No existing Google OAuth in codebase. **CRITICAL: Submit Google OAuth verification form immediately (~4–6 tuần lead time).** This is the longest-pole dependency; blocks GBP wizard implementation. |
| Google Business Profile API (My Business API v4) | Pending | Enable trong GCP Console — cùng project; requires successful OAuth verification |
| Google Maps Geocoding API | Pending (fallback layer) | Enable trong GCP Console — chỉ là lớp fallback 3 của geocoding (§13.9). Phần lớn seller dùng paste-link (lớp 1-2) không tốn quota. $5/1k, free tier phủ phần lớn. |
| F03 Dashboard Suite (tab pattern, Recharts, existing generateMetadata) | Done | Reuse existing TabId pattern + tab components |
| F02 Auth (Tenants, session) | Done | |
| F22 Analytics Tracking (event tracking cho checklist completion) | Pending | Cần track `local_seo_checklist_completed` event |
| `scripts/db-setup.js` migration entries | Pending | Dev thêm migration cho sites_opening_hours + sites.local_business_* + sites.gbp_integration_* fields |
| Waze deep-link (FR-25) | Depends on FR-15 GBP wizard | Waze visibility = GBP sync; không cần API riêng. Deep-link chỉ cần lat/lng |
| hreflang en-MY + ms-MY (FR-26) | **DEFERRED P2** | FR-26 hoãn sang P2 — i18n client-side only hiện tại; cần F21 URL-based locale routing trước |

---

## 15. API Contract

```text
GET /api/local-seo/gbp-insights
Request: ?siteId={string}&period={7d|30d}
Response: {
  success: boolean,
  data: {
    calls: number,
    callsChange: number,          // % so với kỳ trước
    directions: number,
    directionsChange: number,
    websiteClicks: number,
    websiteClicksChange: number,
    profileViews: number,
    reviewRating: number,         // 0–5
    reviewCount: number,
    aiAppearances: number | null, // null nếu API chưa cung cấp
    trend: Array<{
      date: string,               // YYYY-MM-DD
      calls: number,
      directions: number,
      websiteClicks: number
    }>,
    cachedAt: string,             // ISO timestamp
    cacheAge: number              // seconds
  },
  error?: { code: string, message: string }
}

GET /api/local-seo/score
Request: ?siteId={string}
Response: {
  success: boolean,
  data: {
    score: number,                // 0–100
    breakdown: {
      businessData: number,       // 0–30
      jsonLd: number,             // 0–25
      gbpConnected: number,       // 0–25
      aiCrawlers: number,         // 0–10
      napConsistency: number      // 0–10
    },
    checklistItems: Array<{
      id: string,
      title: string,
      impact: 'high' | 'medium' | 'low',
      done: boolean,
      quickFixAvailable: boolean,
      quickFixAction?: string     // API endpoint hoặc settings path
    }>
  }
}
```

---

## 16. Open Questions

> Không còn open question — tất cả đã chốt thành decision:
> - **#1 GBP OAuth verification timeline** → Dependencies: submit verification sớm (~4–6 tuần lead time)
> - **#2 AI Overview appearances field** → render card nếu API trả về field; ẩn nếu không (FR-18)
> - **#3 Geocoding** → RESOLVED: seller dán link Google Maps → trích lat/lng 3 lớp; Geocoding API chỉ là fallback (§13.9)
> - **#4 Multi-site GBP token scope** → token + location_id per-Site (FR-14, BR-05, §13.2)
> - **#5 Local SEO Score Phase 1 (CF-4)** → RESOLVED: normalize trên bucket áp dụng; Phase 1 đạt 100; bucket Phase 2 "🔒 unlock" (§13.8)
> - **#5 FAQ auto-gen source** → RESOLVED: AI-generated draft (reuse OpenAI hiện có), seller-editable (xem FR-23)
> - **#6 hreflang URL routing** → RESOLVED: FR-26 DEFERRED P2 — i18n client-side only hiện tại; unblock khi F21 có URL-based routing
> - **#7 Halal verification model** → RESOLVED: trust seller toggle + optional JAKIM cert number, không validate trong MVP (xem FR-27, BR-15)

---

## 17. 9-Point Done Checklist

- [ ] Loading State — Skeleton shimmer cho GBP Insights cards, trend chart, và score widget
- [ ] Empty State — Chưa có GBP: prompt connect; chưa có local business data: prompt thiết lập
- [ ] Error State — GBP API lỗi: toast + fallback cache; token hết hạn: banner reconnect
- [ ] Form Validation — Postcode MY (5 digits); lat range -90 đến 90; lng range -180 đến 180; opens/closes HH:MM format
- [ ] Button States — "Đồng bộ lên GBP" disabled khi đang gọi API; "Bật ngay" disabled sau khi đã toggle
- [ ] Toast Feedback — Thành công / Lỗi cho: Save local business data, GBP sync, GBP connect/disconnect
- [ ] Auth Redirect — 401 → /login; GBP token expired → reconnect flow
- [ ] Mobile 375px — GBP Insights 2x3 grid, checklist full width, wizard modal bottom-sheet friendly
- [ ] TypeScript Clean — `tsc --noEmit` pass; không có `any` mới trong local-seo components

---

## 18. Definition of Ready

- [ ] User Stories F37 approved và linked ở Section 0
- [ ] AC ở Section 11 đã được copy/approve từ story file
- [ ] FR ở Section 7 có đầy đủ Story Ref
- [x] ~~Open Question #1 (GBP OAuth verification timeline)~~ → Action item trong Dependencies: submit verification sớm
- [x] ~~Open Question #4 (multi-site GBP token scope)~~ → RESOLVED: token per-Site (xem FR-14, BR-05, §13.2)
- [x] Geocoding approach decided → paste Google Maps link, 3-layer (§13.9)
- [x] Local SEO Score formula decided → Phase 1/2 normalized buckets (§13.8)
- [ ] GBP API đã được enable trong GCP Console (hoặc test account setup)
- [ ] Architecture doc exists: `docs/architecture/F37-local-seo.md`
- [ ] Schema migration entries drafted và review bởi Dev lead
- [ ] Dependencies confirmed (F22 tracking, GBP API access)

---

## 19. Definition of Done

- [ ] Tất cả FR-01 đến FR-28 đã implement và verified
- [ ] Tất cả AC trong Section 11 pass (traced back to story)
- [ ] 9-Point Checklist hoàn thành
- [ ] QA test plan viết và pass: `docs/qa/F37-local-seo.md`
- [ ] `generateLocalBusinessSchema()` output validated bằng Google Rich Results Test
- [ ] robots.txt AI crawler behavior verified bằng automated test
- [ ] Mobile responsive verified (375px)
- [ ] GBP OAuth flow tested end-to-end với real Google account
- [ ] Schema migration pass `scripts/check-migrations.js` gate
- [ ] Non-Functional Requirements validated (performance < 2s, GBP cache working)
