---
title: "URL-to-Website AI Redesign"
description: "Paste URL → AI scrapes & extracts business info → generates full website with CMS"
status: pending
priority: P1
effort: 3d
branch: feat/rebuild-user-flow
tags: [ai-builder, scraping, url-import, feature]
created: 2026-04-05
---

# URL-to-Website AI Redesign

## Related Docs (PHẢI ĐỌC trước khi implement)
- **PRD**: [`docs/prd/url-to-website.md`](../../docs/prd/url-to-website.md) — 13 FR, 8 NFR, 17 ACs, 4 User Stories
- **QA Test Plan**: [`docs/testcases/url-to-website.md`](../../docs/testcases/url-to-website.md) — test cases + edge cases (nếu có)
- **UI Specs**: [`docs/ui-specs/url-to-website.md`](../../docs/ui-specs/url-to-website.md) — screens, components, responsive (nếu có)

⛔ **Cook PHẢI đọc các docs trên trước khi code. Code phải đúng PRD requirements + QA test cases + UI specs.**

## Overview

Cho phép user paste URL website hiện có → AI scrape + phân tích nội dung → trích xuất business info + design cues → generate website mới bằng block system + Payload CMS hiện có.

**Approach:** Two-step (Scrape → Extract BusinessInfo via GPT-4o-mini → User review → Generate via existing pipeline). Zero changes to core generate-site flow.

## Architecture Decision

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Approach | Two-step (extract → generate) | Reuses 100% existing pipeline, user review step |
| Scraping | `cheerio` + native `fetch` | Lightweight (~2MB), Docker-friendly, no browser binary |
| Metadata | `open-graph-scraper` | 114K weekly downloads, batteries-included |
| Content | `@mozilla/readability` | Industry standard (Firefox), main content extraction |
| Extraction model | GPT-4o-mini ($0.001/call) | Structured extraction doesn't need GPT-4o |
| Generation model | GPT-4o (unchanged) | Existing pipeline, proven quality |
| SSRF prevention | Custom DNS + IP validation | Libraries have had bypasses |
| Output format | `json_object` + Zod validation | Same pattern as existing codebase |

## Cost

| Step | Model | Cost/call |
|------|-------|-----------|
| URL extraction | GPT-4o-mini | ~$0.001 |
| Site generation | GPT-4o (existing) | ~$0.040 |
| Hero image | DALL-E (existing) | ~$0.040 |
| **Total** | | **~$0.081** |

## Implementation Phases

| Phase | File | Status | Description |
|-------|------|--------|-------------|
| [Phase 1](phase-01-url-scraper-lib.md) | `src/lib/ai/url-scraper.ts` | pending | URL scraper + SSRF prevention + content extraction |
| [Phase 2](phase-02-ai-extraction-endpoint.md) | `src/app/api/ai/extract-from-url/route.ts` | pending | API endpoint: URL → BusinessInfo extraction via GPT-4o-mini |
| [Phase 3](phase-03-builder-ui.md) | `BusinessInfoForm.tsx` + `builderStore.ts` | pending | UI: URL input toggle + auto-fill form from extraction |
| [Phase 4](phase-04-validation-safety.md) | `ai.ts` + `content-safety.ts` | pending | Zod schema update + URL domain safety + SSRF middleware |
| [Phase 5](phase-05-testing.md) | `__tests__/` | pending | Unit tests + integration tests |

## Dependencies

**New npm packages:**
```bash
npm i open-graph-scraper @mozilla/readability cheerio
```

**Existing (no changes):** `@ai-sdk/openai`, `zod`, `zustand`

## Out of Scope
- ~~Color extraction from CSS/images (v2 enhancement)~~ → **IN SCOPE** (extract via AI + meta theme-color)
- Screenshot/visual clone of source URL
- Multi-page scraping (only scrapes single URL)
- SPA/JS-rendered site scraping (static HTML only)
- Caching scraped results in Redis (can add later)

## Validation Summary

**Validated:** 2026-04-05
**Questions asked:** 5

### Confirmed Decisions

| # | Decision | User Choice |
|---|----------|-------------|
| 1 | UX sau extraction | **Auto-fill form → user review** — switch sang Manual view với fields đã điền, user xem/sửa rồi Generate |
| 2 | Billing / FR-15 | **Không tính credit** — extraction chỉ là bước chuẩn bị, chỉ tính khi Generate. Rate limit riêng (5/min) |
| 3 | Low confidence handling | **Vẫn hiện form + cảnh báo** — dù chỉ extract 0-1 fields, vẫn hiện form với warning banner, user tự bổ sung |
| 4 | Theme colors | **Có extract, đề xuất** — AI extract primary/secondary colors → hiện suggestion, user chọn dùng hay không |
| 5 | Plan gating | **Mở cho tất cả plans** — Free + Pro đều dùng được URL import, extraction cost $0.001 không đáng gate |
| 6 | Error language | **Theo locale user** — EN hoặc MS tùy user setting. Cần i18n cho error messages |

### Action Items (cần update phase files)

- [ ] Phase 2: Thêm `suggestedTheme.primaryColor` + `secondaryColor` vào extraction prompt (đã có trong schema nhưng cần confirm priority)
- [ ] Phase 3: Thêm i18n cho error messages (EN + MS)
- [ ] Phase 3: Thêm color suggestion UI (optional color swatches từ extraction)
- [ ] Phase 3: Warning banner cho low confidence case
- [ ] Phase 4: Không cần plan-gating logic — extraction endpoint mở cho tất cả authenticated users
