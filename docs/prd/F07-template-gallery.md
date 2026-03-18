# PRD: Template Gallery (F07)
> **Version:** 1.1 | **Updated:** 2026-03-16 | **Agent:** `project-planner`
> **Priority:** P1 | **Sprint:** Wave 2 | **Size:** M
> **Depends on:** F04 Block Renderer | **Alternative to:** F01 AI Builder

---

> [!IMPORTANT]
> **Stories-First Rule:** PRD này được xây dựng từ các User Stories đã approve.
> Mọi FR phải có Story Ref. AC được copy từ story file. Không tự mở rộng scope.

---

## 0. Story Traceability

| Story ID | Title | File | Status |
|----------|-------|------|--------|
| US-F07-01 | Browse Templates by Category | [F07-template-gallery-stories.md](../stories/F07-template-gallery-stories.md) | Draft |
| US-F07-02 | Preview Template Before Use | [F07-template-gallery-stories.md](../stories/F07-template-gallery-stories.md) | Draft |
| US-F07-03 | Create Site from Template | [F07-template-gallery-stories.md](../stories/F07-template-gallery-stories.md) | Draft |

---

## 1. Problem Statement

Not all users want to chat with AI. Some prefer browsing pre-made designs and customizing from there. Currently the template page is static with no real data. Users need a gallery with category filters, live preview, and one-click apply.

---

## 2. Target User

- SME owner who prefers visual starting point
- Not comfortable with AI chat
- Wants to see và chọn design yêu thích trước

---

## 3. Solution Overview

Template gallery `/templates` với category filters, card thumbnails, full-page preview (desktop + mobile toggle), và one-click "Use Template" tạo site mới từ template và redirect sang editor.

---

## 4. Scope

### In Scope
- Template listing với category filter (US-F07-01)
- Full-page preview trong iframe, desktop/mobile toggle (US-F07-02)
- One-click create site from template (US-F07-03)
- Min 3 templates per category tại launch

### Out of Scope
- User-created custom templates
- Template search by keyword
- Paid/premium templates (Wave 6+)

---

## 5. Success Metrics

| Metric | Target | Measured By |
|--------|--------|-------------|
| Template to editor (create time) | < 5 seconds | Timing |
| Templates per category | ≥ 3 | Content count |

---

## 6. User Story Summary

```
AS A   user who prefers a visual starting point
I WANT browse pre-built templates by business category
SO THAT tôi tìm design phù hợp với ngành mình nhanh chóng
```

> Source: [US-F07-01](../stories/F07-template-gallery-stories.md#us-f07-01)

---

## 7. Functional Requirements

| FR-ID | Requirement | Story Ref | Priority | Notes |
|-------|-------------|-----------|----------|-------|
| FR-01 | Template cards grid: thumbnail, name, category tag | US-F07-01 | P0 | |
| FR-02 | Category filter changes displayed templates, URL reflects state | US-F07-01 | P0 | /templates?category=fashion |
| FR-03 | Cards sorted by popularity (most used first) | US-F07-01 | P1 | |
| FR-04 | Preview: full template in iframe, Desktop + Mobile (375px) toggle | US-F07-02 | P0 | |
| FR-05 | Preview loads < 2 seconds | US-F07-02 | P0 | |
| FR-06 | "Use This Template" → create new site in Payload CMS | US-F07-03 | P0 | |
| FR-07 | Create site from template: redirect /editor/{siteId} | US-F07-03 | P0 | < 5s |
| FR-08 | Template content is a copy — editing không affect original | US-F07-03 | P0 | |
| FR-09 | Min 3 templates per category at launch | US-F07-01 | P0 | |

---

## 8. Business Rules

- **BR-01:** Template categories: Fashion, F&B, Services, Tech, Portfolio, Beauty
- **BR-02:** Template content copied — không shared với original
- **BR-03:** Hệ thống seed ≥ 6 templates tại launch
- **BR-04:** Auth required để "Use Template"

---

## 9. User Flow

```
/templates
  ↓
Browse template cards (default: All categories)
  ↓ click category filter
Categories filtered → URL updated
  ↓ click "Preview"
Full preview in iframe (Desktop/Mobile toggle)
  ├── Click "Use This Template"
  │     → slug setup (nếu chưa có)
  │     → POST /api/sites với template blocks
  │     → redirect /editor/:siteId
  └── Close preview → back to listing
```

---

## 10. Screen Layout

```
┌─ /templates ───────────────────────────────────────────┐
│  [All] [Fashion] [F&B] [Services] [Beauty] [Tech]      │
│                                                         │
│  ┌───────┐ ┌───────┐ ┌───────┐  ← 3-col desktop       │
│  │thumb  │ │thumb  │ │thumb  │                         │
│  │Fashion│ │F&B    │ │Beauty │                         │
│  │[Use]  │ │[Use]  │ │[Use]  │                         │
│  └───────┘ └───────┘ └───────┘                         │
│                                                         │
│ Mobile: 1-col, full-width cards                        │
└────────────────────────────────────────────────────────┘
```

---

## 11. Acceptance Criteria

> AC được copy từ `F07-template-gallery-stories.md`. Không tự thêm AC không có trong story.

### AC-1: Template Listing
> 📌 Source: [US-F07-01](../stories/F07-template-gallery-stories.md) — AC-1

```gherkin
GIVEN I navigate to /templates
WHEN  the page loads
THEN  I see template cards organized by category (Fashion, F&B, Services, etc.)
  AND each card shows: thumbnail preview, template name, category tag
  AND templates sorted by popularity (most used first)
```

### AC-2: Category Filter
> 📌 Source: [US-F07-01](../stories/F07-template-gallery-stories.md) — AC-2

```gherkin
GIVEN I am on the templates page
WHEN  I click a category filter (e.g., "Fashion")
THEN  only templates from that category are shown
  AND the filter state is reflected in URL (/templates?category=fashion)
```

### AC-3: Full Preview
> 📌 Source: [US-F07-02](../stories/F07-template-gallery-stories.md) — AC-1

```gherkin
GIVEN I click "Preview" on a template card
WHEN  the preview loads
THEN  I see the full template rendered in an iframe
  AND I can toggle between Desktop và Mobile view (375px)
  AND a "Use This Template" button is always visible
```

### AC-4: Create Site from Template
> 📌 Source: [US-F07-03](../stories/F07-template-gallery-stories.md) — AC-1

```gherkin
GIVEN I click "Use This Template"
WHEN  the creation process completes
THEN  a new site is created in Payload CMS with template content pre-filled
  AND I am redirected to /editor/{siteId}
  AND all template content is editable
```

---

## 12. Non-Functional Requirements

| Category | Requirement | Notes |
|----------|-------------|-------|
| **Performance** | Preview load < 2s, site creation < 5s | |
| **Security** | Auth required to apply template | |
| **Device support** | Mobile 375px: 1-col grid, full-screen modal | |

---

## 13. Technical Architecture

### 13.1 Components

| Component | File | Description |
|-----------|------|-------------|
| `TemplatesPage` | `app/(frontend)/templates/page.tsx` | Gallery page |
| `TemplateCard` | `components/frontend/TemplateCard.tsx` | Card với thumbnail |
| `TemplatePreviewModal` | `components/frontend/TemplatePreviewModal.tsx` | Full iframe preview |

### 13.2 API Endpoints

```
GET /api/templates?where[category][equals]={cat}  → list templates
POST /api/sites (with templateId)                  → create site from template
Auth: required for create
```

---

## 14. Dependencies

| Dependency | Status | Action Needed |
|-----------|--------|---------------|
| F04 Block Renderer | ✅ Done | — |
| Payload CMS templates collection | ✅ Exists | Seed ≥ 6 templates |

---

## 17. 9-Point Done Checklist

- [ ] Loading State — Skeleton cards during fetch
- [ ] Empty State — "No templates in this category"
- [ ] Error State — Toast + retry nếu API fail
- [ ] Form Validation — N/A
- [ ] Button States — "Use Template" loading khi tạo site
- [ ] Toast Feedback — "Template applied! Customizing..."
- [ ] Auth Redirect — 401 → /login
- [ ] Mobile 375px — 1-col grid, modal full-screen
- [ ] TypeScript Clean — `tsc --noEmit` pass

---

## 18. Definition of Ready

- [ ] User Stories approved và linked ở Section 0
- [ ] F04 Block Renderer done ✅
- [ ] ≥ 6 seed templates ready

---

## 19. Definition of Done

- [ ] All FR items implemented
- [ ] All AC pass
- [ ] ≥ 3 templates per category seeded
- [ ] Create site < 5s measured
