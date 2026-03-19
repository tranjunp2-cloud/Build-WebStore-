# User Stories: Template Gallery (F07)

> **Feature:** F07 — Template Gallery
> **Wave:** 2 | **Priority:** P1 | **Ref PRD:** [F07-template-gallery.md](../prd/F07-template-gallery.md)

---

## US-F07-01: Browse Templates by Category

**Wave 2** | **P1** | **M** | **Status:** Draft

### Story

```
As a   user who prefers a visual starting point
I want browse pre-built templates organized by business category
So that tôi tìm được design phù hợp với ngành mình nhanh chóng
```

### Acceptance Criteria

#### AC-1: Happy Path — Template Listing

```gherkin
GIVEN I navigate to /templates
WHEN  the page loads
THEN  I see template cards organized by category (Fashion, F&B, Services, etc.)
  AND each card shows: thumbnail preview, template name, category tag
  AND templates sorted by popularity (most used first)
```

#### AC-2: Category Filter

```gherkin
GIVEN I am on the templates page
WHEN  I click a category filter (e.g., "Fashion")
THEN  only templates from that category are shown
  AND the filter state is reflected in URL (/templates?category=fashion)
```

### Additional Criteria

- [ ] Template cards show preview on hover (animated or enlarged)
- [ ] "Use Template" CTA on each card → creates new site from template
- [ ] Minimum 3 templates per category at launch
- [ ] Mobile: cards stack vertically, full-width below 480px

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] ≥ 3 templates per category available at launch

---

## US-F07-02: Preview Template Before Use

**Wave 2** | **P1** | **M** | **Status:** Draft

### Story

```
As a   user evaluating templates
I want preview template đầy đủ trước khi confirm chọn
So that tôi thấy chính xác website mình sẽ có
```

### Acceptance Criteria

#### AC-1: Happy Path — Full Preview

```gherkin
GIVEN I click "Preview" on a template card
WHEN  the preview loads
THEN  I see the full template rendered in an iframe
  AND I can toggle between Desktop và Mobile view (375px)
  AND a "Use This Template" button is always visible
```

### Additional Criteria

- [ ] Preview loads within 2 seconds
- [ ] Close preview returns to template listing with scroll position preserved
- [ ] Preview includes all template pages (Home, About, Products if applicable)

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] Preview load < 2 giây

---

## US-F07-03: Create Site from Template

**Wave 2** | **P1** | **M** | **Status:** Draft

### Story

```
As a   user đã tìm được template phù hợp
I want tạo site từ template này với một click
So that tôi bắt đầu customize ngay
```

### Acceptance Criteria

#### AC-1: Happy Path — Site Creation

```gherkin
GIVEN I click "Use This Template" on a template
WHEN  the creation process completes
THEN  a new site is created in Payload CMS with template content pre-filled
  AND I am redirected to /editor/{siteId}
  AND all template content is editable
```

### Additional Criteria

- [ ] Template content is a copy — editing does NOT affect original template
- [ ] Store slug must be set before creation (inline input or redirect to setup)
- [ ] Creation takes < 5 seconds

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] Template copy là independent — không ảnh hưởng original
