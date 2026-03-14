# User Stories: Template Gallery (F07)

> **Feature:** F07 — Template Gallery  
> **PRD:** [F07-template-gallery.md](../prd/F07-template-gallery.md)  
> **Note:** Built new — HTML PRD reference did not contain template stories

---

## US-TG-001 — Browse Templates by Category

**As a** user who prefers a visual starting point  
**I want to** browse pre-built templates organized by business category  
**So that** I can find a design that fits my industry quickly

### Acceptance Criteria

**AC-1: Template Listing**
```gherkin
GIVEN I navigate to /templates
WHEN  the page loads
THEN  I see template cards organized by category (Fashion, F&B, Services, etc.)
  AND each card shows a thumbnail preview, template name, and category tag
  AND templates are sorted by popularity (most used first)
```

**AC-2: Category Filter**
```gherkin
GIVEN I am on the templates page
WHEN  I click a category filter (e.g., "Fashion")
THEN  only templates from that category are shown
  AND the filter state is reflected in the URL (/templates?category=fashion)
```

### Additional Criteria

- [ ] Template cards show preview on hover (animated or enlarged)
- [ ] "Use Template" CTA on each card → creates a new site from template
- [ ] Minimum 3 templates per category at launch
- [ ] Mobile: cards stack vertically, full-width below 480px

---

## US-TG-002 — Preview Template Before Use

**As a** user evaluating templates  
**I want to** preview a template in full before committing  
**So that** I can see exactly how my site will look

### Acceptance Criteria

**AC-1: Full Preview**
```gherkin
GIVEN I click "Preview" on a template card
WHEN  the preview loads
THEN  I see the full template rendered in an iframe
  AND I can toggle between Desktop and Mobile view (375px)
  AND a "Use This Template" button is always visible
```

### Additional Criteria

- [ ] Preview loads within 2 seconds
- [ ] Close preview returns to template listing with scroll position preserved
- [ ] Preview includes all template pages (Home, About, Products if applicable)

---

## US-TG-003 — Create Site from Template

**As a** user who found a template I like  
**I want to** create my site from this template with one click  
**So that** I can start customizing immediately

### Acceptance Criteria

**AC-1: Site Creation**
```gherkin
GIVEN I click "Use This Template" on a template
WHEN  the creation process completes
THEN  a new site is created in Payload CMS with template content pre-filled
  AND I am redirected to /editor/{siteId}
  AND all template content is editable
```

### Additional Criteria

- [ ] Template content is a copy — editing does not affect the original template
- [ ] Store slug must be set before creation (inline input or redirect to setup)
- [ ] Creation takes < 5 seconds
