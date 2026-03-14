# User Stories: SEO Dashboard (F12)

> **Feature:** F12 — SEO Dashboard  
> **Wave:** 4 | **Priority:** P0 🌟 | **Ref PRD:** [F12-seo-dashboard.md](../prd/F12-seo-dashboard.md) (pending)

---

## US-009: SEO Dashboard ⭐

**Wave 4** | **P0 🌟** | **L** | Status: Draft

### Story
```
As a   site owner muốn traffic organic
I want thấy SEO health và fix bằng AI
So that Google index site tốt hơn
```

### Acceptance Criteria
```gherkin
GIVEN user ở /dashboard/seo
WHEN  load
THEN  Overall SEO Score (0-100), breakdown: Meta Tags, Content, Technical

GIVEN score < 70
WHEN  click "Fix All Issues"
THEN  AI fix missing meta titles, descriptions, alt texts
AND   progress: "Đang fix 12 issues..."
AND   done: score update + toast "Đã fix. Score: 72 → 89"

GIVEN click "Generate Sitemap"
WHEN  click
THEN  auto-generate sitemap.xml
AND   toast "Sitemap đã tạo"
```

### MY Market Notes
- SEO keywords should target MY market (e.g., "Baju Raya 2026", "Kuih Raya murah")
- AI should generate meta descriptions in BM or EN based on site language
- Support JSON-LD for LocalBusiness with Malaysian address format

### Definition of Done
- [ ] 9-Point Checklist pass
- [ ] Score calculation works correctly
- [ ] AI fix-all resolves ≥80% of auto-fixable issues

---

## US-010: Auto SEO Meta Generation on Publish

**Wave 4** | **P0** | **M** | Status: Draft

### Story
```
As a   store owner with no SEO knowledge
I want my store to automatically have proper meta tags when I publish
So that I can appear in Google search results without an SEO consultant
```

### Acceptance Criteria
```gherkin
GIVEN I publish my store for the first time and have not manually set any SEO meta
WHEN  publish action completes
THEN  all published pages have AI-generated:
      meta title (≤60 chars, includes business name + primary keyword)
  AND meta description (≤160 chars, compelling, includes a call-to-action)
```

### Additional Criteria
- [ ] Product pages: meta title format = "{Product Name} | {Shop Name} | Buy Online Malaysia"
- [ ] Homepage: meta title format = "{Shop Name} | {Business Category} Online Malaysia"
- [ ] JSON-LD Product schema auto-injected on every product page
- [ ] Sitemap.xml auto-generated on publish
- [ ] Auto-generated SEO can be overridden — user can edit manually in /seo dashboard

---

## US-011: AI SEO Fix All Issues (Detailed)

**Wave 4** | **P0** | **L** | Status: Draft

### Story
```
As a   store owner reviewing my SEO dashboard
I want a single button to fix all detected SEO issues automatically
So that I can improve my search ranking in one action
```

### Acceptance Criteria
```gherkin
GIVEN my SEO dashboard shows 3 warnings:
      2 product pages missing alt text, 1 page with meta title over 60 chars
WHEN  I click "AI Fix All Issues"
THEN  AI generates alt text for all missing images
  AND truncates/rewrites the over-length meta title
  AND SEO score updates to reflect improvements
  AND all within 15 seconds
```

### Additional Criteria
- [ ] "AI Fix All" shows a preview of all proposed changes before applying — user can approve or skip individual fixes
- [ ] After applying fixes, SEO score is recalculated and displayed
- [ ] All fixes are undoable as a single batch action (one Ctrl+Z undoes all)
