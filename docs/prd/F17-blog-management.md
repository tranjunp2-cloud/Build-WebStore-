# PRD: Blog Management (F17)
> **Version:** 1.0 | **Created:** 2026-03-17 | **Agent:** `project-planner`
> **Priority:** P1 | **Sprint:** Wave 4 | **Size:** M
> **Depends on:** F02, F05 | **Blocks:** None

---

## 0. Story Traceability

| Story ID | Title | File | Status |
|----------|-------|------|--------|
| US-F17-01 | Blog Management Dashboard | [F17-blog-management-stories.md](../stories/F17-blog-management-stories.md) | Ready |
| US-F17-02 | Create & Edit Blog Post | [F17-blog-management-stories.md](../stories/F17-blog-management-stories.md) | Ready |
| US-F17-03 | AI Blog Writing Assistant (Text Only) | [F17-blog-management-stories.md](../stories/F17-blog-management-stories.md) | Ready |
| US-F17-04 | Publish, Draft, and Delete Posts | [F17-blog-management-stories.md](../stories/F17-blog-management-stories.md) | Ready |
| US-F17-05 | Simple Category Management | [F17-blog-management-stories.md](../stories/F17-blog-management-stories.md) | Ready |

---

## 1. Problem Statement

Store owners need a simple, integrated way to publish news, updates, and content to engage their audience and improve SEO, without relying on complex external CMS platforms.

---

## 2. Target User

- Store Owners (SME).
- Low to Medium technical capability.
- Often lacks time to write lengthy blog posts from scratch, hence the need for an AI assistant.

---

## 3. Solution Overview

A lightweight, built-in blog management module in the dashboard. Users can view, create, edit, categorize, and publish posts. It includes an AI text assistant that helps draft or refine content based on prompts, avoiding writer's block. To keep it simple, complex features like AI image generation or user comments are excluded. The public-facing blog interface on the storefront will have its own dedicated layout, separate from standard product storefront themes.

---

## 4. Scope

### In Scope
- Blog list view with Search, Sort, Filter, and Bulk Actions (Publish/Delete). (US-F17-01)
- Shared "No Data" Empty state design consistent with Products/Orders. (US-F17-01)
- Rich text editor for basic blog content (Title, Body, Category, manual Thumbnail upload). (US-F17-02)
- AI text assistant to generate content or improve selected text. (US-F17-03)
- Publish/Draft state toggling. (US-F17-04)
- Delete post functionality. (US-F17-04)
- Basic SEO fields (Meta Title, Meta Description, auto-generated URL Slug). (US-F17-02)
- Simple 1-level Category management (Create/Edit/Delete/Assign). (US-F17-05)

### Out of Scope
- AI Generation of Blog Images (explicitly excluded based on requirements).
- Blog Comments or user engagement features.
- Complex taxonomy (Multi-level Sub-categories).
- Scheduling posts for future dates.

---

## 5. Success Metrics

| Metric | Target | Measured By |
|--------|--------|-------------|
| Feature Adoption | 30% of active stores publish at least 1 post | DB query (stores with > 0 published posts) |
| AI Assistant Usage | 50% of published posts use AI at least once | Event tracking (clicks on AI generate per post creation) |

---

## 6. User Story Summary

```
AS A Store Owner
I WANT TO manage a simple blog with AI text assistance
SO THAT I can easily create and publish content for my customers
```

> Source Story: [US-F17-01 to US-F17-04](../stories/F17-blog-management-stories.md)

---

## 7. Functional Requirements

| FR-ID | Requirement | Story Ref | Priority | Notes |
|-------|-------------|-----------|----------|-------|
| FR-01 | System must display a list of all blog posts with Title, Status, Author, and Date, and provide Search, Sort, and Filter capabilities. | US-F17-01 | P1 | Matches Product List UX. |
| FR-01b| System must allow bulk selection to Publish or Delete multiple posts. | US-F17-01 | P2 | Matches Product List UX. |
| FR-01c| System must use the shared "No Data" Empty State component when there are no blogs. | US-F17-01 | P1 | Shared with F08, F10. |
| FR-02 | User can create a new post with Title, Content, Category, and Thumbnail. | US-F17-02 | P1 | Thumbnail is manual upload only. |
| FR-03 | System must require Title to save a post. | US-F17-02 | P1 | |
| FR-04 | System must provide basic SEO fields (Meta Title, Description) and auto-generate Slug from Title. Bổ sung nút "✨ Tối ưu SEO bằng AI" để tự sinh Meta Title/Description từ bài blog. | US-F17-02 | P2 | Slug must be editable. |
| FR-05 | System must provide an AI assistant to generate or refine text based on user prompt. | US-F17-03 | P1 | |
| FR-06 | System MUST NOT generate images via AI on the blog editor. | US-F17-03 | P0 | Explicitly requested by user. |
| FR-07 | User can toggle post status between Draft and Published. | US-F17-04 | P1 | |
| FR-08 | User can delete a post permanently, with a confirmation warning. | US-F17-04 | P1 | |
| FR-09 | User can manage (create, edit, delete) flat, single-level categories for posts. | US-F17-05 | P2 | Deleting a category moves posts to unassigned. |

---

## 8. Business Rules

- **BR-01:** Only the Store Owner or users with `blog:manage` permission can create/edit/delete posts.
- **BR-02:** URL slugs must be unique within the store.
- **BR-03:** AI requests for image generation in the blog editor must return a predefined rejection message explaining the constraint.

---

## 9. User Flow

```
[Entry point: Dashboard > "Blog" menu]
  ↓
Step 1: User sees list of Blog Posts (Empty state if none).
  ↓
Step 2: User clicks "Create Post".
  ↓
Step 3: Editor opens. User enters Title, clicks "Generate with AI" for content.
  ↓
  ├── AI returns text content → User refines/edits manually.
  └── User attempts AI image request → System blocks and suggests manual upload.
  ↓
Step 4: User uploads thumbnail manually, sets status to "Published", and saves.
  ↓
  ├── Success → Toast "Post Published", return to Blog List.
  └── Failure (e.g. No title) → Show validation error.
```

---

## 10. Screen Layout

```
[Blog List]
+---------------------------------------------------+
| Blog                           [+ Create Post]    |
|                                                   |
| Title                Status      Date       Action|
| 1. My First Post     Published   Today      [Edit]|
| 2. Draft Post        Draft       Yesterday  [Edit]|
+---------------------------------------------------+

[Blog Editor]
+---------------------------------------------------+
| Title: [_____________________]      [Unpublish]   |
| Slug:  /my-first-post                             |
| Category: [ Select Category v ]                   |
|                                                   |
| Content:                                          |
| [ B  I  U  Link  |  ✨ Generate with AI ]         |
| +-----------------------------------------------+ |
| |                                               | |
| | (Rich Text Area)                              | |
| |                                               | |
| +-----------------------------------------------+ |
|                                                   |
| SEO Metadata (Optional)                           |
| Meta Title: [_________] Meta Desc: [_________]    |
| [ ✨ Tối ưu SEO bằng AI ]                         |
| Thumbnail: [ Upload Image ]                       |
|                                     [ Save ]      |
+---------------------------------------------------+
```

---

## 11. Acceptance Criteria

### AC-1: View Blog List Empty State (Shared Component)
> 📌 Source: [US-F17-01](../stories/F17-blog-management-stories.md) — AC-1

```gherkin
GIVEN the user has no blog posts
WHEN  they access the Blog Management page
THEN  they see a shared "No Data" Empty State component
  AND it displays an illustration, a message "Chưa có bài viết nào", and a "Create First Post" button
```

### AC-2: View Blog List Populated (Search, Sort, Filter & Bulk Actions)
> 📌 Source: [US-F17-01](../stories/F17-blog-management-stories.md) — AC-2

```gherkin
GIVEN the user has existing blog posts
WHEN  they access the Blog Management page
THEN  they see a table/list of posts displaying Title, Status (Draft/Published), Author, and Last Modified Date
  AND they have a Search bar to find posts by Title
  AND they can Sort by: Date (Newest/Oldest), Title (A-Z)
  AND they can Filter by Status (Draft/Published) or Category
  AND they can select multiple posts via checkboxes to perform bulk actions (e.g., Bulk Delete, Bulk Publish)
```

### AC-3: Create New Post
> 📌 Source: [US-F17-02](../stories/F17-blog-management-stories.md) — AC-1

```gherkin
GIVEN the user is on the Blog Management page
WHEN  they click "Create Post"
THEN  they are taken to the Blog Editor screen
  AND they can enter a Title, Content, assign a Category, and upload a thumbnail
```

### AC-4: Validation for Saving
> 📌 Source: [US-F17-02](../stories/F17-blog-management-stories.md) — AC-2

```gherkin
GIVEN the user is editing a post
WHEN  they attempt to save the post without a Title
THEN  the system shows a validation error "Title is required"
  AND the post is not saved
```

### AC-5: Generate Content from Prompt
> 📌 Source: [US-F17-03](../stories/F17-blog-management-stories.md) — AC-1

```gherkin
GIVEN the user is in the Blog Editor
WHEN  they click "Generate with AI" and enter a topic prompt
THEN  the AI generates text content (paragraphs, lists) based on the prompt
  AND the generated content is inserted into the editor
```

### AC-6: NO Image Generation Allowed
> 📌 Source: [US-F17-03](../stories/F17-blog-management-stories.md) — AC-2

```gherkin
GIVEN the user asks the AI to create an image for the blog
WHEN  the prompt is submitted
THEN  the AI explains it can only assist with text and suggests manual upload for images
  AND no images are generated
```

### AC-7: Improve Existing Text
> 📌 Source: [US-F17-03](../stories/F17-blog-management-stories.md) — AC-3

```gherkin
GIVEN the user has selected text in the editor
WHEN  they click "Improve Text" (Rewrite, Make Shorter, Make Professional)
THEN  the AI replaces or suggests a revision of the selected text
```

### AC-8: Publish / Draft Toggle
> 📌 Source: [US-F17-04](../stories/F17-blog-management-stories.md) — AC-1

```gherkin
GIVEN the user is editing a blog post
WHEN  they change the status from "Draft" to "Published" and save
THEN  the post becomes visible on the storefront blog page
```

### AC-9: Delete Post
> 📌 Source: [US-F17-04](../stories/F17-blog-management-stories.md) — AC-2

```gherkin
GIVEN the user is viewing the blog list
WHEN  they click "Delete" on a post and confirm the action
THEN  the post is permanently removed from the system
  AND a success toast is shown
```

### AC-10: Manage Categories
> 📌 Source: [US-F17-05](../stories/F17-blog-management-stories.md) — AC-1

```gherkin
GIVEN the user is on the Blog Management settings/categories page
WHEN  they create, edit, or delete a Category name
THEN  the updates are saved and reflected in the drop-down menu for assigning categories to posts
```

### AC-11: Assign Category to Post
> 📌 Source: [US-F17-05](../stories/F17-blog-management-stories.md) — AC-2

```gherkin
GIVEN the user is editing a post
WHEN  they select a Category from a drop-down list and save
THEN  the post is associated with that Category
```

---

## 12. Non-Functional Requirements

| Category | Requirement | Notes |
|----------|-------------|-------|
| **Performance** | Editor initializes in < 1s | |
| **Security** | AI Prompts must be sanitized. SSR/XSS protection for blog content. | |
| **Data / Privacy** | Do not log full AI prompt/response content permanently, only metrics. | |

---

## 13. Technical Architecture

### 13.1 Components

| Component | File | Description |
|-----------|------|-------------|
| `BlogList` | `app/(dashboard)/blog/page.tsx` | View listing drafts/published posts |
| `BlogEditor` | `app/(dashboard)/blog/[id]/page.tsx` | Rich text editor with AI button |

### 13.2 API Endpoints

```
GET /api/blogs → List blogs
POST /api/blogs → Create a new blog post
PUT /api/blogs/:id → Update blog post (save content/status)
DELETE /api/blogs/:id → Delete post

GET /api/blogs/categories → List simple categories
POST /api/blogs/categories → Create category
PUT /api/blogs/categories/:id → Update category
DELETE /api/blogs/categories/:id → Delete category

POST /api/ai/blog-assist → AI Text generation
Request: { prompt: string, action: 'generate' | 'rewrite' | 'shorten', textContext?: string }
Response: { success: boolean, data: { text: string } }
```

---

## 14. Dependencies

| Dependency | Status | Action Needed |
|-----------|--------|---------------|
| F02 Auth (Roles) | ✅ | Ensure `blog:manage` / owner check works. |
| F05 AI System | ✅ | Use existing text generation endpoints, apply prompt constraints to reject image requests. |
| F09 Storefront | ⬜ | Requires a completely separate storefront UI layout dedicated for blog reading, distinct from the eCommerce flows. |

---

## 15. API Contract

```json
// Example: POST /api/blogs
Request: {
  "title": "Welcome to our new store",
  "content": "<p>We are live!</p>",
  "status": "PUBLISHED",
  "meta_title": "Welcome to our new store",
  "meta_description": "We are officially open",
  "slug": "welcome-to-our-new-store",
  "thumbnail_url": "https://..."
}
Response: {
  "success": true,
  "data": { "id": "123", ... }
}
```

---

## 16. Open Questions

| # | Question | Owner | Status |
|---|----------|-------|--------|
| 1 | Do we want to limit the frequency/amount of AI generation per store per day? | PO | ⬜ Open |

---

## 17. 9-Point Done Checklist

- [x] Loading State
- [x] Empty State
- [x] Error State
- [x] Form Validation (Title required)
- [x] Button States (Disable while AI generating)
- [x] Toast Feedback (Saved, Published, Deleted)
- [x] Auth Redirect
- [x] Mobile 375px
- [x] TypeScript Clean

---

## 18. Definition of Ready

- [x] User Stories approved và linked ở Section 0
- [x] AC ở Section 11 đã được copy từ story file
- [x] FR ở Section 7 có đầy đủ Story Ref
- [x] Architecture doc exists (`docs/architecture/F17-blog-management.md`)
- [x] API contract defined
- [x] Dependencies confirmed
- [x] Business Rules confirmed với PO
- [ ] Open Questions resolved

---

## 19. Definition of Done

- [ ] All FR items implemented và verified
- [ ] All AC in Section 11 pass (traced back to story)
- [ ] 9-Point Checklist all pass
- [ ] QA report written (`docs/qa/F17-blog-management.md`)
- [ ] Bilingual EN/MY verified
- [ ] Mobile responsive verified (375px)
- [ ] Non-Functional Requirements validated
