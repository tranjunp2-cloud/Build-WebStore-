# F37 — SEO/Local SEO/AEO Primer + GBP OAuth Deep Dive

> Cheat-sheet cá nhân, tổng hợp từ session giải thích SEO cho dev + đào sâu GBP OAuth flow. Không phải architecture doc chính thức (`docs/architecture/F37-local-seo.md` vẫn chưa tồn tại, cần viết riêng khi vào sprint).

## 1. SEO cơ bản (mindset dev)

```
Crawler (bot fetch HTML) → Indexer (build inverted index) → Ranker (scoring algorithm)
```

- **Crawler** = scraper bot (Googlebot, GPTBot...) fetch trang định kỳ.
- **Indexer** = giống Elasticsearch — parse HTML, lưu vào index theo keyword/entity.
- **Ranker** = scoring/recommendation algorithm, hàng trăm signal quyết định thứ tự kết quả.

**On-page SEO** = kiểm soát trong chính HTML/content (title, meta, heading, structured data, page speed).
**Off-page SEO** = tín hiệu ngoài site (backlink, review, mention) — chứng minh uy tín.

## 2. Structured Data / JSON-LD — "API contract" cho search engine

JSON-LD (Schema.org) = nhúng 1 object JSON có `@type` rõ ràng vào trang, giống đính kèm OpenAPI spec vào response thay vì để consumer tự đoán.

```html
<script type="application/ld+json">
{ "@type": "LocalBusiness", "name": "...", "address": {...}, "openingHours": [...] }
</script>
```

Không có JSON-LD → Google/AI phải tự NLP-parse text, dễ sai/sót. Có JSON-LD → parse trực tiếp field, chính xác 100%.

`generateLocalBusinessSchema()` trong F37 = serialize Sites collection data → JSON-LD contract.

## 3. Local SEO — index riêng biệt

SEO thường xếp hạng cho tìm kiếm chung. **Local SEO** xếp hạng cho query có tính địa lý, quyết định xuất hiện ở **Local Pack** (3 kết quả kèm bản đồ) hay không.

- **3 pillar ranking:** Proximity (khoảng cách), Relevance (liên quan), Prominence (uy tín) — cần geo data **cấu trúc** (lat/lng, address, hours), không phải free-text.
- **NAP Consistency** (Name/Address/Phone) — Google đối chiếu website vs GBP vs directories khác. Giống fraud-detection đối chiếu identity data giữa nhiều hệ thống — lệch nhau → giảm trust score. → lý do US-F37-07 (NAP Checker) tồn tại: 1 reconciliation/diff job giữa 2 nguồn dữ liệu.
- **Google Business Profile (GBP)** = sản phẩm/database **riêng biệt của Google**, chuyên phục vụ Maps/Local Pack, không tự sync từ website — phải claim + connect qua OAuth.

## 4. AEO (Answer Engine Optimization)

SEO truyền thống tối ưu "10 blue links". **AEO** tối ưu để AI (ChatGPT/Perplexity/Gemini) trích dẫn mình khi user hỏi tự nhiên.

- **AI crawler** (GPTBot, ClaudeBot, PerplexityBot) = user-agent riêng scrape data cho training/RAG.
- **`robots.txt`** = ACL khai báo bot nào được/không fetch — honor-system tự nguyện, không phải enforcement kỹ thuật thật.
- **`llms.txt`** = convention mới (chưa chính thức), file markdown tóm tắt sạch cho AI đọc, tránh AI tự parse HTML/JS phức tạp.
- **FAQPage schema** = đánh dấu Q&A có cấu trúc để AI trích dẫn verbatim, tăng khả năng được cite trong AI Overview.

## 5. Map 9 US của F37 vào khái niệm

| US | Bản chất |
|---|---|
| US-01 Data Model | Data layer nguồn sự thật (address/hours/geo cấu trúc) |
| US-02 JSON-LD | Serialize data model → Schema.org contract |
| US-03 AI Crawler + llms.txt | Permission layer (ACL) + file tóm tắt tay cho AEO |
| US-04 Score + Checklist | Linter/CI gate — chấm % hoàn thiện, gamify onboarding |
| US-05 GBP OAuth | Integrate external system (GBP) qua OAuth |
| US-06 GBP Insights | Pull analytics từ external API đã connect |
| US-07 NAP Checker | Reconciliation/diff job 2 nguồn dữ liệu |
| US-08 Auto SEO/AEO fallback | Defensive default — contract không bao giờ null |
| US-09 Malaysia Optimization | Localization layer — signal tăng relevance cho MY |

## 6. GBP OAuth Flow — chi tiết

Chuẩn **OAuth 2.0 Authorization Code Grant** — giống "Login with Google/GitHub", chỉ khác scope xin (`business.manage` thay vì email/profile).

```
Seller                Server (Next.js)                Google
  |-- click "Kết nối GBP" -->|                              |
  |                          | POST /api/google/gbp/auth?siteId=X
  |                          | build consent URL, state=siteId (CSRF)
  |<---- redirect -----------|
  |----------- GET consent screen (scope=business.manage) -->|
  |<----------------- "Cho phép truy cập?" -------------------|
  |------------------- click "Allow" -------------------------->|
  |<---- redirect ?code=X&state=siteId ------------------------|
  |-- GET /api/google/gbp/callback?code=X&state=siteId ------->|
  |     1. verify state == siteId (CSRF check)
  |     2. POST code → Google token endpoint (exchange)
  |     3. encrypt + lưu Sites.gbpIntegration
  |     4. gọi GBP Locations API lấy location_id
  |<--- redirect /dashboard?tab=local-seo ----------------------|
```

**Khái niệm quan trọng:**
- `state=siteId` = CSRF token chuẩn OAuth, chống login-CSRF/account-takeover.
- `code` → token exchange server-side = lý do gọi "Authorization Code" Grant — token không bao giờ qua browser/URL.
- `access_token` (ngắn hạn, gọi API) vs `refresh_token` (dài hạn, renew access_token âm thầm) — check `token_expiry` mỗi lần gọi GBP API, auto-refresh nếu cần.
- Encrypt at rest bắt buộc vì token = credential toàn quyền chỉnh sửa GBP listing thật.
- **Token lưu per-Site, không phải per-Tenant** — 1 seller có thể sở hữu nhiều Site = nhiều địa điểm vật lý = nhiều GBP listing riêng biệt (domain model của Google, không phải sở thích design).
- Shared OAuth infra (`src/lib/google/oauth-client.ts`) dùng chung cho GBP (F37) + GSC (F03-08 tương lai) — DRY, chỉ khác `scope`.

**Open questions chưa rõ trong PRD:**
- Refresh_token bị Google revoke (seller đổi pass/revoke thủ công) → flow hiện tại chưa phân biệt rõ "access_token hết hạn (auto-refresh được)" vs "refresh_token revoke (bắt buộc reconnect từ đầu)".
- PKCE chưa được nhắc — chuẩn OAuth hiện đại khuyến nghị dùng kể cả cho confidential client.

## 7. Setup GCP thực tế + phát hiện quan trọng (2026-07-03)

Các bước setup: tạo GCP project → enable "Business Profile Business Information API" + "Business Profile Account Management API" → config OAuth consent screen (External, thêm scope `business.manage`) → tạo OAuth Client ID (Web app, redirect URI `https://{domain}/api/google/gbp/callback`) → lưu Client ID/Secret vào **Vercel Dashboard** (không phải GitHub Secrets, theo `.claude/rules/env-vars.md`) + `.env.*.example`.

**⚠️ CORRECTION quan trọng — khác với giả định ban đầu của PRD:**

PRD §14 giả định `business.manage` là scope **sensitive/restricted**, coi verification (~4-6 tuần, cần video demo + security review) là **longest-pole dependency** block Phase 2.

Kiểm tra thực tế GCP Console project "Prime Web V2" (2026-07-03):
- `.../auth/business.manage` được xếp vào **"non-sensitive scopes"** (không phải sensitive/restricted)
- OAuth consent screen Publishing status đã là **"In production"** — đạt được **không cần** submit verification form / video demo
- Google UI note xác nhận: "user cap does not apply if you are requesting only approved sensitive or restricted scopes" → app chỉ dùng non-sensitive scope thì không bị giới hạn 100-user cap thật sự

**→ Rủi ro block Phase 2 vì Google verification thấp hơn nhiều so với PRD document.** Xem thêm memory `project-f37-gbp-oauth-verification-lighter.md`.

**Caveat cho tương lai:** hạ tầng OAuth này share với GSC (F03-08). Nếu sau này thêm scope Search Console (nhiều khả năng LÀ sensitive/restricted) vào cùng OAuth consent screen, có thể kéo cả app quay lại yêu cầu verification đầy đủ — cần re-check lúc làm F03-08.

## Unresolved questions

- Refresh_token revocation handling — chưa rõ trong PRD, cần làm rõ lúc implement US-05.
- PKCE — có nên thêm dù server-side confidential client hay không.
- GSC scope sensitivity — chưa verify thực tế trong GCP console (chỉ mới verify GBP scope).
