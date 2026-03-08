# User Stories: Dashboard (F03)

> **Feature:** F03 — Dashboard Overview  
> **Wave:** 1 | **Priority:** P0 | **Ref PRD:** [F03-dashboard.md](../prd/F03-dashboard.md)

---

## US-006: Dashboard — Overview

**Wave 1** | **P0** | **M** | Status: Ready

### Story
```
As a   site owner đã có website
I want thấy tổng quan khi login
So that tôi biết status, actions cần làm
```

### AC-006A: Dashboard — Has Sites
```gherkin
GIVEN user login, có site
WHEN  vào /dashboard
THEN  hiện: Total Sites, Total Views, Storage Used, AI Credits
AND   site cards grid: thumbnail + name + status badge + actions
```

### AC-006B: Dashboard — Empty State
```gherkin
GIVEN chưa có site
WHEN  vào dashboard
THEN  empty state: icon + "Tạo website đầu tiên" + CTA → /onboarding
```

### AC-006C: Dashboard — Unpublished Banner
```gherkin
GIVEN site chưa publish
WHEN  vào dashboard
THEN  banner: "Website chưa live. Publish ngay →"
```

### AC-006D: Dashboard — Loading
```gherkin
GIVEN user vào /dashboard
WHEN  data đang fetch
THEN  hiện skeleton: 4 card placeholders + 3 site card skeletons
AND   skeleton animate shimmer
AND   KHÔNG hiện spinner tròn
```

### Definition of Done
- [ ] 9-Point Checklist pass
- [ ] Empty state renders correctly
- [ ] Stats cards hiện đúng data
