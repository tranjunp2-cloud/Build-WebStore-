# PRD: SEO Dashboard (F12)
> **Version:** 1.0 | **Created:** 2026-03-08 | **Agent:** `project-planner`  
> **Priority:** P0 🌟 | **Wave:** 4 | **Size:** L  
> **Depends on:** Published site exists | **Ref:** SPEC.md §12

---

## 1. Problem Statement

SME owners don't understand SEO and can't afford SEO consultants. They need an automated dashboard that analyzes their site, shows a simple score, and lets AI fix issues with one click.

## 2. User Story

```
AS A site owner who wants more traffic
I WANT an SEO score with one-click AI fix
SO THAT Google indexes my site properly without me learning SEO
```

## 3. Screen Layout

```
┌─ /dashboard/seo ───────────────────────────────────┐
│  SEO Dashboard                                       │
│                                                      │
│  ┌─ Overall Score ────────────────────────────────┐ │
│  │           ┌───┐                                │ │
│  │           │ 72│ / 100                          │ │
│  │           └───┘                                │ │
│  │  [Fix All Issues ✨]    12 auto-fixable issues  │ │
│  └───────────────────────────────────────────────┘ │
│                                                      │
│  ┌─ Breakdown ───────────────────────────────────┐  │
│  │ Meta Tags:  18/25  │ Content:   20/25          │  │
│  │ Technical:  22/25  │ Performance: 12/25        │  │
│  └───────────────────────────────────────────────┘  │
│                                                      │
│  ┌─ Page Analysis ───────────────────────────────┐  │
│  │ Page         │ Score │ Issues │ Action          │  │
│  │ Home         │ 85    │ 2      │ [Fix]           │  │
│  │ Products     │ 62    │ 5      │ [Fix]           │  │
│  │ About        │ 45    │ 8      │ [Fix]           │  │
│  └───────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

## 4. Acceptance Criteria

### AC-1: Overall Score
```gherkin
GIVEN user navigates to /dashboard/seo
WHEN  page loads
THEN  overall SEO score (0-100) displayed as circle chart
AND   breakdown by 4 categories (25 points each):
  - Meta Tags: title, description, OG tags
  - Content: headings, alt text, keyword density
  - Technical: sitemap, structured data, canonical URLs
  - Performance: page speed, image optimization
```

### AC-2: Fix All Issues (AI)
```gherkin
GIVEN score < 100 and auto-fixable issues exist
WHEN  user clicks "Fix All Issues ✨"
THEN  SSE streaming progress: "Fixing 12 issues... 4/12... done"
AND   each fix shown: "Added meta description to Products page"
AND   score updates: "Score: 52 → 89"
AND   toast "✅ Fixed 12 issues. Score improved by 37 points!"
```

### AC-3: Per-Page Analysis
```gherkin
GIVEN page analysis table
WHEN  displayed
THEN  each page shows: name, individual score, issue count, [Fix] button
AND   clicking [Fix] fixes that page's issues only
AND   expanding row shows specific issues list
```

### AC-4: SEO Checks (Scoring Rules)

| Check | Points | Auto-fixable |
|-------|--------|-------------|
| Page title exists (≤ 60 chars) | 5 | ✅ AI generates |
| Meta description (≤ 160 chars) | 5 | ✅ AI generates |
| OG tags (title, desc, image) | 5 | ✅ AI generates |
| JSON-LD structured data | 5 | ✅ AI generates |
| Alt text on all images | 5 | ✅ AI generates |
| Single H1 per page | 5 | ⚠️ Manual fix needed |
| Proper heading hierarchy | 5 | ⚠️ Manual fix needed |
| Sitemap.xml exists | 5 | ✅ Auto-generate |
| Canonical URLs | 5 | ✅ Auto-add |
| Mobile responsive | 5 | ⚠️ Manual fix needed |
| Page load < 3s | 5 | ⚠️ Manual fix needed |
| Image optimization (WebP, lazy) | 5 | ✅ Auto-optimize |

### AC-5: MY SEO Keywords
```gherkin
GIVEN site is in BM language
WHEN  AI generates meta tags
THEN  keywords target MY market:
  - Fashion: "Baju Raya 2026", "Baju Kurung online"
  - F&B: "Kuih Raya delivery KL", "Nasi lemak catering"
  - Beauty: "Skincare halal Malaysia"
AND   structured data uses Malaysian address format
```

## 5. Technical Requirements

### API
- `POST /api/seo/analyze` — Analyze all pages, return scores
- `POST /api/seo/fix` — AI fix issues (SSE stream)

### Components
| Component | File |
|-----------|------|
| SEODashboardPage | `app/(dashboard)/dashboard/seo/page.tsx` |
| SEOScoreCircle | `components/dashboard/SEOScoreCircle.tsx` |
| SEOBreakdown | `components/dashboard/SEOBreakdown.tsx` |
| SEOPageList | `components/dashboard/SEOPageList.tsx` |
| SEOFixProgress | `components/dashboard/SEOFixProgress.tsx` |

## 6. 9-Point Done Checklist

- [ ] Loading State — Skeleton for score circle and page list
- [ ] Empty State — "Publish your site first to see SEO score"
- [ ] Error State — Toast on analysis/fix failure
- [ ] Form Validation — N/A
- [ ] Button States — Fix All disabled during streaming
- [ ] Toast Feedback — "Fixed X issues!" with score improvement
- [ ] Auth Redirect — 401 → /login
- [ ] Mobile 375px — Score circle stacked, page list as cards
- [ ] TypeScript Clean
