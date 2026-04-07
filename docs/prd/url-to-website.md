# PRD: URL-to-Website AI Redesign

**Feature ID:** F-URL-IMPORT
**Author:** Claude AI (PM assistant)
**Date:** 2026-04-05
**Status:** Draft
**Priority:** P1
**Effort:** ~3 developer days
**Branch:** feat/rebuild-user-flow

---

## 1. Problem Statement

Hiện tại ECH Prime Web chỉ hỗ trợ tạo website bằng cách user tự nhập thông tin doanh nghiệp (tên, ngành, mô tả, sản phẩm). Đối với user đã có website sẵn, việc phải nhập lại thông tin là friction lớn. Đối thủ như ClickSites.ai đã có tính năng "URL-to-website redesign" — user chỉ cần paste URL là AI tự generate website mới.

**Pain point:** User có website cũ muốn redesign nhưng phải tự gõ lại tất cả thông tin doanh nghiệp → mất thời gian, dễ bỏ sót, tỷ lệ drop-off cao.

---

## 2. Goals

| Goal | Metric | Target |
|------|--------|--------|
| Giảm friction nhập thông tin | Time-to-first-generation | < 30s (vs ~2 min manual) |
| Tăng conversion builder flow | Completion rate | +15% |
| Mở rộng use case | % users chọn URL mode | > 20% trong 30 ngày đầu |
| Giữ chất lượng output | User satisfaction (NPS) | Không giảm vs manual mode |

---

## 3. User Stories

### US-01: Import website từ URL
**As a** SMB owner có website cũ,
**I want to** paste URL website hiện tại vào builder,
**so that** AI tự động trích xuất thông tin và tạo website mới mà không cần nhập tay.

### US-02: Review thông tin trích xuất
**As a** user đã paste URL,
**I want to** xem và chỉnh sửa thông tin AI trích xuất trước khi generate,
**so that** tôi đảm bảo website mới chính xác với ý muốn.

### US-03: Fallback manual khi URL fail
**As a** user paste URL nhưng AI không đọc được,
**I want to** chuyển sang nhập tay dễ dàng,
**so that** tôi không bị stuck ở bước nhập thông tin.

### US-04: Giữ option nhập tay
**As a** user mới chưa có website,
**I want to** vẫn dùng form nhập tay như trước,
**so that** tính năng cũ không bị ảnh hưởng.

---

## 4. Requirements

### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-01 | Thêm toggle "Describe Business" / "Import from URL" trên form nhập thông tin | P1 |
| FR-02 | URL mode: 1 ô input URL + nút "Extract" | P1 |
| FR-03 | Server-side scrape URL, trích xuất meta tags, OG data, main content text | P1 |
| FR-04 | AI (GPT-4o-mini) phân tích scraped content → trích xuất businessName, industry, shortDescription, products | P1 |
| FR-05 | Auto-fill form fields từ kết quả extraction → user review trước khi generate | P1 |
| FR-06 | Hiển thị confidence score (high/medium/low) cho kết quả extraction | P2 |
| FR-07 | Hiển thị warnings nếu extraction không đầy đủ | P2 |
| FR-08 | Khi extraction fail → hiển thị error message + link "Try manual entry" | P1 |
| FR-09 | SSRF prevention: block private IPs, validate protocol, timeout 10s | P1 |
| FR-10 | Content safety check trên scraped content (reuse existing filter) | P1 |
| FR-11 | Rate limit: 5 extractions/min per user | P1 |
| FR-12 | Detect language từ scraped content (English / Bahasa Melayu) | P2 |
| FR-13 | Gửi `businessUrl` + `source: 'url'` trong payload generate-site để tracking | P2 |

### Non-functional Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-01 | Extraction response time | < 5 seconds (scrape + AI) |
| NFR-02 | Scrape timeout | 10 seconds max |
| NFR-03 | Max response body from URL | 5 MB |
| NFR-04 | Extraction cost per call | < $0.005 (GPT-4o-mini) |
| NFR-05 | No new Docker dependencies | No browser binary (Puppeteer/Playwright) |
| NFR-06 | Backward compatible | Manual form mode unchanged |
| NFR-07 | Mobile responsive | URL input works on mobile |
| NFR-08 | Accessibility | URL input + toggle keyboard-navigable |

---

## 5. Acceptance Criteria

| ID | Criteria | Testable |
|----|----------|----------|
| AC-01 | User toggle giữa "Manual" và "From URL" mode — cả 2 đều hoạt động | Yes |
| AC-02 | Paste URL hợp lệ (https://example.com) + click Extract → form auto-fill trong < 5s | Yes |
| AC-03 | Extracted businessName, industry, shortDescription, products hiển thị đúng trong form | Yes |
| AC-04 | User có thể edit bất kỳ field nào sau khi auto-fill | Yes |
| AC-05 | Click "Generate Website" sau extraction → website tạo thành công (same as manual) | Yes |
| AC-06 | URL private IP (127.0.0.1, 10.x, 192.168.x) → bị block với error message rõ | Yes |
| AC-07 | URL invalid (abc, ftp://x) → validation error ngay client-side | Yes |
| AC-08 | URL timeout (site chậm > 10s) → error message "Could not access website" | Yes |
| AC-09 | URL trả về non-HTML → error message rõ ràng | Yes |
| AC-10 | URL blocked domain (localhost) → error message "URL not allowed" | Yes |
| AC-11 | Content unsafe (blocked terms) → error message "Content not allowed" | Yes |
| AC-12 | Rate limit exceeded (>5/min) → 429 error với retry message | Yes |
| AC-13 | Extraction thất bại → user có thể chuyển sang manual mode dễ dàng | Yes |
| AC-14 | Confidence badge hiển thị: green (high), yellow (medium), red (low) | Yes |
| AC-15 | Existing manual form mode hoạt động KHÔNG đổi so với trước | Yes |
| AC-16 | API endpoint yêu cầu authentication (401 nếu chưa login) | Yes |
| AC-17 | Analytics track `source: 'url'` khi user generate từ URL | Yes |

---

## 6. Out of Scope

| Item | Reason |
|------|--------|
| Color extraction từ CSS/images | Complexity cao, v2 enhancement |
| Screenshot/visual clone | Cần Puppeteer, tăng Docker size |
| Multi-page scraping | Chỉ scrape 1 URL, không crawl cả site |
| SPA/JS-rendered scraping | Static HTML only — covers 90% business sites |
| Caching scraped results | Có thể thêm sau với Redis |
| Suggested theme colors auto-apply | v2 — hiện chỉ extract, không tự apply |
| Image import từ source URL | v2 — chỉ extract text, không download images |

---

## 7. Data Model Changes

### BusinessInfo type update (builderStore.ts)
```typescript
// BEFORE
type BusinessInfo = {
  businessName: string
  shortDescription: string
  industry: string
  products: string
  language?: 'en' | 'ms' | 'vi' | 'auto'
}

// AFTER (backward compatible)
type BusinessInfo = {
  businessName: string
  shortDescription: string
  industry: string
  products: string
  language?: 'en' | 'ms' | 'vi' | 'auto'
  businessUrl?: string   // NEW — source URL if imported
  source?: 'form' | 'url' // NEW — for analytics tracking
}
```

### Zod schema update (ai.ts)
```typescript
// Add to generateSiteSchema.businessInfo:
businessUrl: z.string().url().optional()
source: z.enum(['form', 'url']).optional()
```

### New Zod schema
```typescript
// extractFromUrlSchema
{ url: z.string().url().max(2048) }
```

### No database changes required
- Sites collection: no new fields (businessUrl stored in `aiGenerationMetadata.originalPrompt`)
- Pages collection: no changes
- No new tables/migrations needed

---

## 8. Dependencies

### New npm packages
| Package | Purpose | Size |
|---------|---------|------|
| `open-graph-scraper` | OG/Twitter/meta extraction | ~200KB |
| `@mozilla/readability` | Main content text extraction | ~50KB |
| `cheerio` | HTML parsing (may already be dep of OGS) | ~2MB |

### Existing (no changes)
- `@ai-sdk/openai` — GPT-4o-mini call
- `zod` — validation
- `zustand` — state management

### External APIs
- OpenAI GPT-4o-mini — extraction ($0.001/call)
- OpenAI GPT-4o — generation (existing, $0.04/call)

---

## 9. Technical Architecture

```
┌─────────────────────────────────────────────────┐
│  Builder UI (AIBuilderPageClient)               │
│  ┌─────────────────────────────────────────┐    │
│  │  BusinessInfoForm                       │    │
│  │  ┌──────────┐ ┌────────────────┐        │    │
│  │  │ Manual   │ │  From URL      │        │    │
│  │  │ (existing)│ │  (NEW)         │        │    │
│  │  └──────────┘ └───────┬────────┘        │    │
│  │                       │ POST            │    │
│  └───────────────────────┼─────────────────┘    │
│                          │                      │
└──────────────────────────┼──────────────────────┘
                           │
           ┌───────────────▼──────────────────┐
           │  POST /api/ai/extract-from-url   │
           │  ┌─────────────────────────────┐ │
           │  │ 1. Auth + Rate Limit        │ │
           │  │ 2. SSRF Validate URL        │ │
           │  │ 3. Fetch HTML (10s timeout) │ │
           │  │ 4. Extract meta + content   │ │
           │  │ 5. Content safety check     │ │
           │  │ 6. GPT-4o-mini extraction   │ │
           │  │ 7. Zod validate response    │ │
           │  └─────────────────────────────┘ │
           └───────────────┬──────────────────┘
                           │ ExtractionResult
                           ▼
           ┌───────────────────────────────────┐
           │  Auto-fill form → User reviews    │
           │  → Click Generate                 │
           └───────────────┬───────────────────┘
                           │
           ┌───────────────▼──────────────────┐
           │  POST /api/ai/generate-site      │
           │  (EXISTING — no changes)         │
           │  GPT-4o → blocks → pages → site  │
           └──────────────────────────────────┘
```

---

## 10. Implementation Plan

| Phase | Description | Effort | Dependencies |
|-------|-------------|--------|--------------|
| Phase 1 | URL Scraper Library (`src/lib/ai/url-scraper.ts`) | 4h | None |
| Phase 2 | AI Extraction Endpoint (`POST /api/ai/extract-from-url`) | 4h | Phase 1 |
| Phase 3 | Builder UI (URL input + auto-fill) | 4h | Phase 2 |
| Phase 4 | Validation & Safety updates | 2h | Phase 1 |
| Phase 5 | Testing (27 test cases) | 4h | Phase 1-4 |
| **Total** | | **~18h (3 dev days)** | |

**Detailed plan:** `plans/260405-0524-url-to-website/plan.md`
