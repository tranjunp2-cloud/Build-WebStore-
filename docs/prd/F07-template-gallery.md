# PRD: Template Gallery (F07)
> **Version:** 1.0 | **Created:** 2026-03-08 | **Agent:** `project-planner`  
> **Priority:** P1 | **Wave:** 3.5 | **Size:** M  
> **Depends on:** F04 Block Renderer | **Alternative to:** F01 AI Builder

---

## 1. Problem Statement

Not all users want to chat with AI to create a website. Some prefer browsing pre-made designs and customizing from there. Currently the template page is static with no real data. Users need a gallery with category filters, live preview, and one-click apply.

## 2. User Story

```
AS A SME owner who prefers choosing a design
I WANT TO browse professional templates by category
SO THAT I can start editing from a solid foundation without waiting for AI
```

## 3. Acceptance Criteria

### AC-1: Template Gallery
```gherkin
GIVEN user navigates to /templates
WHEN  page loads
THEN  grid of template cards (3-col desktop, 1-col mobile)
AND   each card: preview thumbnail, name, category badge, "Use Template" CTA
AND   category filter tabs: All, F&B, Fashion, Services, Tech, Portfolio
```

### AC-2: Template Preview
```gherkin
GIVEN user clicks on a template card
WHEN  preview modal opens
THEN  full-page preview in iframe (desktop + mobile toggle)
AND   "Use This Template" CTA button
AND   block list sidebar showing what's included
```

### AC-3: Apply Template
```gherkin
GIVEN user clicks "Use This Template"
WHEN  confirmed
THEN  new site created with template blocks pre-loaded
AND   redirect to /editor/:newSiteId
AND   toast "Template applied! Start customizing."
```

### AC-4: MY Category Templates
```gherkin
GIVEN MY market focus
THEN  templates include:
  - Modest Wear / Fashion → rose/cream palette
  - Halal F&B / Bakery → orange/amber palette
  - Beauty / Cosmetics → pink/gold palette
  - Services / Freelancer → blue/teal palette
  - Tech / SaaS → dark/blue palette
```

## 4. Technical Requirements

### Data
- Templates stored in Payload CMS `templates` collection
- Each template: `{ name, slug, category, blocks[], theme, thumbnail }`
- Seed ≥6 templates at launch

### Components
| Component | File |
|-----------|------|
| TemplatesPage | `app/(frontend)/templates/page.tsx` |
| TemplateCard | `components/frontend/TemplateCard.tsx` |
| TemplatePreviewModal | `components/frontend/TemplatePreviewModal.tsx` |

## 5. 9-Point Done Checklist

- [ ] Loading State — Skeleton cards during fetch
- [ ] Empty State — "No templates in this category" + suggestion
- [ ] Error State — Toast + retry if API fails
- [ ] Form Validation — N/A
- [ ] Button States — "Use Template" loading state during site creation
- [ ] Toast Feedback — "Template applied!"
- [ ] Auth Redirect — Must be authenticated to apply template
- [ ] Mobile 375px — Single column grid, modal full-screen
- [ ] TypeScript Clean
