# User Stories: Publish Flow (F08)

> **Feature:** F08 — Publish Flow  
> **Wave:** 3 | **Priority:** P0 | **Ref PRD:** [F08-publish-flow.md](../prd/F08-publish-flow.md) (pending)

---

## US-010: Publish Site

**Wave 3** | **P0** | **M** | Status: Ready

### Story
```
As a   site owner chuẩn bị xong
I want publish site live
So that khách hàng truy cập được
```

### Acceptance Criteria
```gherkin
GIVEN click "Publish" trong editor
WHEN  click
THEN  checklist: ✅ Có trang Home, ⚠️ SEO score (warning, không block)
AND   nút "Publish ngay" active

GIVEN confirm publish
WHEN  click "Publish ngay"
THEN  site.isPublished = true
AND   subdomain live: [slug].primeweb.app
AND   toast "🎉 Website đã live!" + link mở tab mới

GIVEN site live, muốn unpublish
WHEN  click "Unpublish"
THEN  site offline, subdomain 404
```

### Definition of Done
- [ ] 9-Point Checklist pass
- [ ] Subdomain accessible after publish
- [ ] Unpublish works (404 after)
