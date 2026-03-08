# PRD: Publish Flow (F08)
> **Version:** 1.0 | **Created:** 2026-03-08 | **Agent:** `project-planner`  
> **Priority:** P0 | **Wave:** 3 | **Size:** M  
> **Depends on:** F05 AI Editor | **Blocks:** Storefront live access

---

## 1. Problem Statement

Users can create and edit websites but cannot publish them live. There's no publish/unpublish flow, no pre-publish checklist, and no subdomain activation. Without this, no created website can be accessed by the public.

## 2. User Story

```
AS A site owner who has finished editing
I WANT TO publish my site live with one click
SO THAT customers can access my website immediately
```

## 3. Acceptance Criteria

### AC-1: Pre-Publish Checklist
```gherkin
GIVEN user clicks "Publish" in editor toolbar
WHEN  publish modal opens
THEN  checklist shown:
  ✅ Has at least 1 page with content
  ⚠️ SEO score < 60 (warning only, does NOT block)
  ℹ️ Site URL: [slug].primeweb.app
AND  "Publish ngay" button active if ≥1 page exists
```

### AC-2: Publish Success
```gherkin
GIVEN user confirms publish
WHEN  clicked "Publish ngay"
THEN  site.isPublished = true (API call)
AND   subdomain becomes accessible: [slug].primeweb.app
AND   confetti animation plays
AND   toast "🎉 Website đã live!" with link opening new tab
AND   toolbar badge changes from "Draft" to "Published"
```

### AC-3: Unpublish
```gherkin
GIVEN site is currently published
WHEN  user clicks "Unpublish" in settings
THEN  confirmation dialog: "Visitors won't be able to access your site"
AND   confirmed → site.isPublished = false
AND   subdomain returns 404
AND   toast "Website đã offline"
```

### AC-4: Re-publish After Edit
```gherkin
GIVEN site is published, user makes changes
WHEN  changes saved
THEN  badge shows "Published · Unsaved changes"
AND   "Update" button appears alongside "Publish"
AND   clicking "Update" pushes changes live immediately
```

## 4. Technical Requirements

### API
- `PATCH /api/sites/:id` — `{ isPublished: true/false }`
- Middleware checks `isPublished` for storefront routes

### Components
| Component | File |
|-----------|------|
| PublishModal | `components/editor/PublishModal.tsx` |
| PublishChecklist | `components/editor/PublishChecklist.tsx` |

## 5. 9-Point Done Checklist

- [ ] Loading State — Spinner on publish button during API call
- [ ] Empty State — N/A
- [ ] Error State — Toast "Publish thất bại. Thử lại"
- [ ] Form Validation — Checklist blocks if 0 pages
- [ ] Button States — Publish disabled during API call
- [ ] Toast Feedback — Success + link, Error + retry
- [ ] Auth Redirect — Must be authenticated
- [ ] Mobile 375px — Modal responsive
- [ ] TypeScript Clean
