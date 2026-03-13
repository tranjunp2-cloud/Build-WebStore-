# Architecture: SEO Dashboard (F12)

> **Version:** 1.0 | **PRD:** [F12-seo-dashboard.md](../prd/F12-seo-dashboard.md)  
> **Tech:** Next.js 15 + Payload CMS 3 + OpenAI

---

## 1. System Overview

```
┌─ /dashboard/seo ──────────────────────────────────────┐
│                                                        │
│  ┌─ SEO Score Card ──────────────────────────────────┐ │
│  │  Overall Score: 72/100                            │ │
│  │  [Fix All Issues ✨]                              │ │
│  │  12 auto-fixable issues                           │ │
│  └───────────────────────────────────────────────────┘ │
│                                                        │
│  ┌─ Category Scores ─────────────────────────────────┐ │
│  │ Meta Tags: 65  |  Content: 80  |  Technical: 71   │ │
│  └───────────────────────────────────────────────────┘ │
│                                                        │
│  ┌─ Issues List ─────────────────────────────────────┐ │
│  │ ⚠️ 2 pages missing meta description               │ │
│  │ ⚠️ 3 images missing alt text                      │ │
│  │ ⚠️ 1 page title > 60 chars                        │ │
│  │ ✅ JSON-LD Product schema OK                       │ │
│  └───────────────────────────────────────────────────┘ │
│                                                        │
│  ┌─ Per-Page SEO ────────────────────────────────────┐ │
│  │ Homepage    72/100  [Edit] [AI Generate]           │ │
│  │ Products    85/100  [Edit] [AI Generate]           │ │
│  │ About       60/100  [Edit] [AI Generate]           │ │
│  └───────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

## 2. SEO Score Algorithm

```typescript
interface SEOScore {
  overall: number       // 0-100 weighted average
  metaTags: number      // 40% weight
  content: number       // 35% weight
  technical: number     // 25% weight
}

// Meta Tags scoring (40%)
// - Each page has title (≤60 chars): +10 per page
// - Each page has description (≤160 chars): +10 per page
// - All images have alt text: +10

// Content scoring (35%)
// - H1 exists on each page: +10 per page
// - Content length > 300 words: +10 per page
// - No duplicate titles: +10

// Technical scoring (25%)
// - JSON-LD schema on product pages: +15
// - Sitemap exists: +10
```

## 3. API Routes

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/seo/[siteId]/score` | Calculate and return SEO score |
| GET | `/api/seo/[siteId]/issues` | List all SEO issues |
| POST | `/api/seo/[siteId]/fix-all` | AI fix all auto-fixable issues |
| POST | `/api/seo/[siteId]/generate-meta` | AI generate meta for specific page |
| GET | `/api/seo/[siteId]/sitemap` | Generate and return sitemap.xml |

## 4. AI Fix-All Flow

```
User clicks "Fix All Issues ✨"
       ↓
GET /api/seo/[siteId]/issues → list of fixable issues
       ↓
For each issue:
  - Missing meta title → OpenAI generate (≤60 chars)
  - Missing meta description → OpenAI generate (≤160 chars)
  - Missing alt text → OpenAI analyze image + generate alt
  - Title too long → OpenAI rewrite shorter
       ↓
Show preview of all proposed fixes
       ↓
User approves → batch update via Payload CMS
       ↓
Recalculate score → show improvement
```

## 5. Component Tree

```
SEODashboard
├── SEOScoreCard (overall + breakdown)
├── FixAllButton (+ preview modal)
├── IssuesList
│   └── IssueItem × N (icon, description, fix button)
├── PageSEOList
│   └── PageSEORow × N
│       ├── Page name + score
│       ├── Meta title (editable)
│       ├── Meta description (editable)
│       ├── Character counters
│       ├── Google SERP preview
│       └── "AI Generate" button
└── SitemapSection
    ├── Last generated timestamp
    └── "Regenerate" button
```

## 6. Error Matrix

| Error | Action |
|-------|--------|
| OpenAI API failure | Toast error, keep manual edit option |
| Score calculation error | Show "Unable to calculate" with retry |
| Sitemap generation fail | Toast + manual retry |
