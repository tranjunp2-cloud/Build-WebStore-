# Plan: F32 — Email Template CMS Settings (MVP)

> Implement PRD `docs/prd/F32-email-template-cms-settings.md` MVP scope: per-tenant config cho 4 fields (subject/greeting/CTA/closing) + toggle on/off + realtime preview.

## Context

- **Branch base:** `staging`
- **Branch new:** `feat/F32-XX-email-cms-settings` (chờ map US sau)
- **PRD:** `docs/prd/F32-email-template-cms-settings.md`
- **Related plans:** `plans/260519-1549-commerce-email-rollout/` (cần merge trước — provides 8 commerce templates làm baseline)
- **Out of scope:** Branding (logo/color/font) — Phase 2 plan riêng

## Decisions (locked với user 2026-05-21)

| Decision | Choice | Reason |
|----------|--------|--------|
| MVP scope | 4 fields edit + toggle on/off + preview | KISS, ship nhanh, validate với seller |
| Branding | Defer Phase 2 | Reduce scope ~3-5 days |
| F-code | F32 | Next available sau F25/F30/F31 |
| Variable syntax | `{varName}` (single brace) | Simple, hiển thị tốt trong text inputs |
| i18n required | EN required, MS optional fallback EN | Avoid blocking seller MS-only |

## Phases

| # | Phase | Status | Files (chính) | Phụ thuộc |
|---|-------|--------|---------------|-----------|
| 01 | [Foundation: collection + render flow](phase-01-foundation-collection-render.md) | ⏳ Pending | `src/collections/EmailTemplateSettings.ts`, `src/lib/email/send.ts`, `scripts/db-setup.js` | Commerce email plan merged |
| 02 | [Default config seeder + lookup cache](phase-02-defaults-lookup-cache.md) | ⏳ Pending | `src/lib/email/get-template-config.ts`, `scripts/seed.ts` | 01 |
| 03 | [Admin UI: form + preview](phase-03-admin-ui-preview.md) | ⏳ Pending | `src/admin/views/EmailTemplateSettings/*.tsx`, `src/admin/components/EmailPreview.tsx` | 01 |
| 04 | [Template render integration](phase-04-render-integration.md) | ⏳ Pending | `src/lib/email/templates/*.ts` (refactor 16+ files), tests | 02, 03 |
| 05 | [Tests + docs sync](phase-05-tests-docs.md) | ⏳ Pending | `src/__tests__/integration/email-settings/*`, `docs/architecture/email-templates.md`, `docs/qa/F32-*.md` | 04 |

## Deliverables

| Item | Type |
|------|------|
| `email-template-settings` Payload collection | NEW |
| Render flow: lookup → merge → fallback | REFACTOR |
| Lookup cache (per-tenant LRU 5min) | NEW |
| Admin UI: list view (grouped Buyer/Seller) | NEW |
| Admin UI: edit form với split preview | NEW |
| Default seed data cho 16+ templates | NEW |
| Refactor 16+ template render files để accept custom fields | REFACTOR |
| QA testcases `docs/qa/F32-*.md` | NEW |

## Parallel execution opportunities

- Phase 02 (cache helper) + Phase 03 (admin UI) có thể chạy parallel sau Phase 01 (collection schema)
- Phase 04 (render integration) tuần tự sau cả 02 + 03 vì cần config lookup + UI fixtures cho preview
- Phase 05 tests tuần tự cuối

## Success criteria (MVP)

- Seller có thể toggle on/off bất kỳ template nào → email gửi đúng theo state
- Seller edit 4 fields → save → buyer/seller nhận email với content mới
- Preview render khớp với production email (visual parity)
- Multi-tenant isolation: Owner A không access được config Owner B
- Performance: lookup config < 50ms p99 (cached)
- Fallback graceful: nếu setting deleted → revert default hardcoded template
- All 16+ existing templates support custom config injection
- Unit + integration tests cover render flow + cache + multi-tenant ACL

## Risks

- **Refactor scope:** 16+ template files cần accept custom fields qua interface mới. Mỗi file ~50-100 lines change. Tester có thể bị nặng.
  - Mitigation: Tạo helper `mergeTemplateConfig()` → templates chỉ gọi helper, tránh repeat logic
- **Preview accuracy:** Render server-side với fake data có thể không 100% khớp production
  - Mitigation: Reuse cùng template function — chỉ swap real data → fake data, không có 2nd rendering path
- **Cache invalidation:** Cache stale sau khi seller save
  - Mitigation: Invalidate cache key trên Payload `afterChange` hook
- **Migration breaking:** Render flow refactor có thể break production emails đang chạy
  - Mitigation: Feature flag — default OFF, opt-in per tenant. Toggle on khi ready
- **Variable substitution edge cases:** Variables không match (vd `{customerNam}` typo) → render literal hay error?
  - Mitigation: Render literal (no error) — seller thấy ngay typo trong preview
- **i18n MS fallback:** Logic fallback EN khi MS empty cần test kỹ
  - Mitigation: Explicit unit test for each fallback path

## Open questions (resolve trước Phase 01)

1. Cache backend: Redis (Upstash đã dùng cho rate limit) hay in-memory LRU? — Đề xuất Redis (multi-instance Vercel functions)
2. Variable picker UI: dropdown insert vs hint text dưới field? — Đề xuất hint text Phase 1, dropdown Phase 2
3. Send Test Email button: Phase 1 hay Phase 2? — PRD ghi Phase 2 (defer)
4. Permission granularity: 1 permission `email_settings` cho tất cả templates hay per-template? — Đề xuất 1 permission Phase 1

## Companion docs

- `docs/qa/F32-email-template-cms-settings.md` — cần tạo sau khi PRD approved
- `docs/architecture/F32-email-template-cms-settings.md` — cần tạo trong Phase 01 (data model + render flow diagram)
- `docs/design/F32-email-cms-settings-design.md` — admin UI mockups (cần design)
