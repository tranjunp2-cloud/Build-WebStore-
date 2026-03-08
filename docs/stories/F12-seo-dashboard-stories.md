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
