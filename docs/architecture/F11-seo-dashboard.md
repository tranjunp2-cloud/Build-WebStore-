# Architecture: SEO Dashboard (F11)

> **Lưu ý:** File này mang tên F11 nhưng nội dung thuộc về F03 SEO Dashboard. F11 PRD thực tế là Undo/Redo (`docs/prd/F11-undo-redo.md`). Sẽ đổi tên khi refactor docs.

> **Version:** 1.0 | **PRD:** [F11-seo-dashboard.md](../prd/F11-seo-dashboard.md)  
> **Tech:** Next.js 15 + Payload CMS 3 + OpenAI

---

## 1. System Overview

```
┌─ /dashboard/seo ──────────────────────────────────────┐
│                                                        │
│  ┌─ SeoHealth ───────────────────────────────────────┐ │
│  │ 67/100  Business │ Schema │ AI │ Technical       │ │
│  │ [Fix all with AI] — only when metadata is fixable │ │
│  │ SEO Issues: [AI] Fix │ [You] Edit/Set up/Enable   │ │
│  └───────────────────────────────────────────────────┘ │
│  ┌─ SeoTools ────────────────────────────────────────┐ │
│  │ AI crawlers │ sitemap │ other existing tools      │ │
│  └───────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

## 2. SEO Score Algorithm

F37 PRD §5 is the only score contract: Business Data 20, Schema 35, AI Discoverability 15, Technical Health 30. The Dashboard must not calculate or display the legacy Meta/Content/Technical weighted score.

Four bucket bars use qualitative status only. Point values remain internal to score calculation and never appear beside issue rows.

## 3. API Routes

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/sites/[siteId]/local-seo-score` | Return authoritative F37 score + bucket breakdown |
| POST | `/api/seo/fix-all` | Existing AI fix flow for metadata only |
| POST | `/api/seo/ai-crawlers-toggle` | Update the seller-owned crawler toggle |
| GET | `/sites/[slug]/sitemap.xml` | Storefront sitemap signal |
| GET | `/sites/[slug]/llms.txt` | Storefront llms.txt signal |

## 4. AI Fix-All Flow

```
AI-owned title/description issue exists
       ↓
Show "Fix all with AI"
       ↓
Open existing AIFixModal with metadata records only
       ↓
Show preview of all proposed fixes
       ↓
User approves → batch update via Payload CMS
       ↓
Recalculate score → resolved rows disappear
```

## 5. Component Tree

```
Dashboard SEO section
├── SeoHealth
│   ├── Gauge
│   ├── BucketBars × 4 (2×2 desktop)
│   ├── ConditionalAiFixStrip
│   └── SeoIssues
│       └── IssueRow × unresolved root cause
│           ├── AI | You badge
│           ├── seller-friendly issue text
│           └── Fix | Edit | Set up | Enable | Publish
├── AIFixModal (metadata only)
└── SeoTools (separate existing card)
```

Issue derivation, root-cause deduplication, and destinations follow F37 PRD §12.3. Organization and indexability are platform-managed and never create seller issue rows.

## 6. Error Matrix

| Error | Action |
|-------|--------|
| OpenAI API failure | Toast error, keep manual edit option |
| Score calculation error | Show "Unable to calculate" with retry |
| Sitemap generation fail | Toast + manual retry |

## 6.1 Business Rules

| Rule | Mô tả |
|------|-------|
| BR-06 | Khi AI sinh meta: trường trống → tự điền. Trường đã có nội dung thủ công → đề xuất chỉnh sửa, hiển thị so sánh bản cũ vs bản mới, chỉ ghi đè khi người dùng đồng ý |
| Keyword-aware | AI Generate sử dụng `trackedKeywords` từ site settings để kết hợp từ khoá mục tiêu vào meta tự nhiên |
