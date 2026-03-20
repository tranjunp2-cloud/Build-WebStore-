# User Stories: Blog Management (F17)

<!-- Rules & ID Convention: docs/stories/user-stories-p0.md | SPEC.md §2.4 -->

> **Feature:** F17 — Blog Management
> **Wave:** 4 | **Priority:** P1 | **Ref PRD:** [F17-blog-management.md](../prd/F17-blog-management.md)

---

## 🌍 Global Acceptance Criteria (CMS Layout Compliance)

> **Áp dụng cho mọi User Story trong file này.**

```gherkin
GIVEN user truy cập tính năng trang quản trị (Dashboard, Products, Orders, v.v.)
THEN  nội dung của tính năng phải được render gọn bên trong Main Content Area (tuân thủ F18-03)
  AND Global Top Header (F18-02) và Global Sidebar Navigation (F18-01) vẫn giữ nguyên và hoạt động bình thường, không bị che khuất hay re-render toàn trang.
```

---

## 🌍 Global Acceptance Criteria (CMS Layout Compliance)

> **Áp dụng cho mọi User Story trong file này.**

```gherkin
GIVEN user truy cập tính năng trang quản trị (Dashboard, Products, Orders, v.v.)
THEN  nội dung của tính năng phải được render gọn bên trong Main Content Area (tuân thủ F18-03)
  AND Global Top Header (F18-02) và Global Sidebar Navigation (F18-01) vẫn giữ nguyên và hoạt động bình thường, không bị che khuất hay re-render toàn trang.
```

---

## US-F17-01: Blog Management Dashboard

**Wave 4** | **P1** | **M** | **Status:** Ready

### Story

```
As a   Store Owner
I want to view a list of all my blog posts
So that I can manage my content and see what is published or in draft
```

### Acceptance Criteria

#### AC-1: View Blog List Empty State (Shared Component)

```gherkin
GIVEN the user has no blog posts
WHEN  they access the Blog Management page
THEN  they see a shared "No Data" Empty State component
  AND it displays an illustration, a message "Chưa có bài viết nào", and a "Create First Post" button
```

#### AC-2: View Blog List Populated (Search, Sort, Filter & Bulk Actions)

```gherkin
GIVEN the user has existing blog posts
WHEN  they access the Blog Management page
THEN  they see a table/list of posts displaying Title, Status (Draft/Published), Author, and Last Modified Date
  AND they have a Search bar to find posts by Title
  AND they can Sort by: Date (Newest/Oldest), Title (A-Z)
  AND they can Filter by Status (Draft/Published) or Category
  AND they can select multiple posts via checkboxes to perform bulk actions (e.g., Bulk Delete, Bulk Publish)
```

### Additional Criteria

- [ ] Empty State component must follow the same shared design system layout used in Products (F08) and Orders (F10).
- [ ] Support basic search and filtering by status (Draft/Published).

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)

---

## US-F17-02: Create & Edit Blog Post

**Wave 4** | **P1** | **M** | **Status:** Ready

### Story

```
As a   Store Owner
I want to create and edit the content of my blog posts using a simple editor
So that I can publish news and updates for my customers
```

### Acceptance Criteria

#### AC-1: Create New Post

```gherkin
GIVEN the user is on the Blog Management page
WHEN  they click "Create Post"
THEN  they are taken to the Blog Editor screen
  AND they can enter a Title, Content, assign a Category, and upload a thumbnail
```

#### AC-2: Validation for Saving

```gherkin
GIVEN the user is editing a post
WHEN  they attempt to save the post without a Title
THEN  the system shows a validation error "Title is required"
  AND the post is not saved
```

#### AC-3: Auto-generate SEO Metadata

```gherkin
GIVEN the user is editing a post with some content
WHEN  they click "✨ Tối ưu SEO bằng AI"
THEN  the AI reads the blog content
  AND automatically generates and fills the Meta Title and Meta Description fields
  AND the user can review and edit them before saving
```

### Additional Criteria

- [ ] Auto-generate URL slug from Title (can be manually edited).
- [ ] Basic SEO fields (Meta Title, Meta Description) are available.

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)

---

## US-F17-03: AI Blog Writing Assistant (Text Only)

**Wave 4** | **P1** | **M** | **Status:** Ready

### Story

```
As a   Store Owner
I want AI to help me generate or improve my blog post content
So that I can write high-quality posts faster without struggling for ideas
```

### Acceptance Criteria

#### AC-1: Generate Content from Prompt

```gherkin
GIVEN the user is in the Blog Editor
WHEN  they click "Generate with AI" and enter a topic prompt
THEN  the AI generates text content (paragraphs, lists) based on the prompt
  AND the generated content is inserted into the editor
```

#### AC-2: NO Image Generation Allowed

```gherkin
GIVEN the user asks the AI to create an image for the blog
WHEN  the prompt is submitted
THEN  the AI explains it can only assist with text and suggests manual upload for images
  AND no images are generated
```

#### AC-3: Improve Existing Text

```gherkin
GIVEN the user has selected text in the editor
WHEN  they click "Improve Text" (Rewrite, Make Shorter, Make Professional)
THEN  the AI replaces or suggests a revision of the selected text
```

### Additional Criteria

- [ ] Ensure AI tone matches the store's general branding context if available.
- [ ] AI prompt UI should be simple and unobtrusive.

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)

---

## US-F17-04: Publish, Draft, and Delete Posts

**Wave 4** | **P1** | **S** | **Status:** Ready

### Story

```
As a   Store Owner
I want to control the visibility of my blog posts (Publish/Unpublish) and delete old ones
So that I have full control over what my customers see on the storefront
```

### Acceptance Criteria

#### AC-1: Publish / Draft Toggle

```gherkin
GIVEN the user is editing a blog post
WHEN  they change the status from "Draft" to "Published" and save
THEN  the post becomes visible on the storefront blog page
```

#### AC-2: Unpublish a Post

```gherkin
GIVEN the user is viewing a Published post in the blog list
WHEN  they change the status back to "Draft" and save
THEN  the post is hidden from the storefront immediately
  AND the post remains editable in the CMS
```

#### AC-3: Delete Post

```gherkin
GIVEN the user is viewing the blog list
WHEN  they click "Delete" on a post and confirm the action
THEN  the post is permanently removed from the system
  AND a success toast is shown
```

### Additional Criteria

- [ ] Warn user before deleting a published post (confirmation dialog with warning text).
- [ ] Bulk delete phải hiển thị cảnh báo rõ ràng trước khi xóa.

### Market Notes

- SME owners MY thường viết blog theo mùa (Raya, CNY) — Unpublish sau sự kiện là workflow phổ biến, cần dễ dàng.
- Delete confirmation dialog cần bằng ngôn ngữ site (BM/EN).

### Open Questions

- **Q:** Khi xóa một post đã Published, có cần redirect URL sang 404 hay hiển thị custom "Post not found" page không?
- **Assumption:** Delete là hard delete — không có trash/recycle bin trong Phase 1.

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] Publish/Unpublish cập nhật đúng visibility trên storefront trong < 30 giây
- [ ] Delete confirmation dialog hiển thị trước khi xóa published post

---

## US-F17-05: Simple Category Management

**Wave 4** | **P2** | **S** | **Status:** Ready

### Story

```
As a   Store Owner
I want to group my blog posts into simple, single-level categories
So that my customers can easily find content they are interested in on the storefront
```

### Acceptance Criteria

#### AC-1: Manage Categories

```gherkin
GIVEN the user is on the Blog Management settings/categories page
WHEN  they create, edit, or delete a Category name
THEN  the updates are saved and reflected in the drop-down menu for assigning categories to posts
```

#### AC-2: Assign Category to Post

```gherkin
GIVEN the user is editing a post
WHEN  they select a Category from a drop-down list and save
THEN  the post is associated with that Category
```

#### AC-3: Delete Category — Posts Fallback

```gherkin
GIVEN a category has posts assigned to it
WHEN  the user deletes that category
THEN  all posts that were in that category revert to "Uncategorized" state
  AND the posts are NOT deleted
```

### Additional Criteria

- [ ] Categories are strictly 1-level deep (no sub-categories).
- [ ] Category name phải unique — không cho phép duplicate names.

### Market Notes

- Categories đơn giản (1-level) phù hợp với SME MY chưa quen content strategy phức tạp.
- Gợi ý category mặc định: "Promosi", "Berita", "Tips" cho BM; "Promotions", "News", "Tips" cho EN.

### Open Questions

- **Q:** Category có hiển thị trên storefront như filter/tag navigation không trong Phase 1?
- **Assumption:** Categories không có slug riêng — filter bằng category ID, không ảnh hưởng SEO URL.

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] Category xóa → posts phải revert về Uncategorized (không mất bài viết)
- [ ] Duplicate category name bị block với error message

---

## US-F17-06: Mobile Web UX — On-the-Go Blogging

**Wave 4** | **P1** | **S** | **Status:** Ready

### Story

```
As a   Store Owner
I want to manage and write blog posts from my smartphone
So that I can quickly publish updates or fix typos without waiting to use a laptop
```

### Acceptance Criteria

#### AC-1: Sticky Formatting Toolbar

```gherkin
GIVEN the user is writing a blog post on a mobile device
WHEN  the virtual keyboard is active
THEN  the Rich Text formatting toolbar (B, I, U, Link) sticks to the bottom of the screen (just above the keyboard)
  AND it remains accessible while scrolling through the content
```

#### AC-2: Tap-Friendly AI Assistant

```gherkin
GIVEN the user opens the AI Assistant on mobile
WHEN  the generative modal appears
THEN  it opens as a full-screen drawer
  AND the buttons (Generate, Insert, Regenerate) are full-width and easy to tap with one thumb
```

### Definition of Done
- [ ] 9-Point Checklist pass for mobile mode.

---

## US-F17-07: Public Blog List (Storefront)

**Wave 4** | **P1** | **M** | **Status:** Ready

### Story

```text
As a   Site Visitor (Customer)
I want to view a list of published blog posts on the storefront
So that I can read news, updates, and articles from the store
```

### Acceptance Criteria

#### AC-1: View Blog List
```gherkin
GIVEN a published site with active blog posts
WHEN  visitor navigates to /sites/[slug]/blogs
THEN  they see a list of published blog posts (grid or list view)
  AND each post card displays: Thumbnail image, Category, Title, Excerpt, and Publish Date
  AND only posts with status="Published" are visible
```

#### AC-2: Blog Pagination
```gherkin
GIVEN there are more than 12 published blog posts
WHEN  viewing the blog list
THEN  posts are paginated (e.g., 12 posts per page or Load More button)
```

#### AC-3: Filter by Category
```gherkin
GIVEN the visitor is on the public blog list
WHEN  they click on a specific Category tag/link
THEN  the list filters to show only posts belonging to that category
```

### Additional Criteria
- [ ] If there are no published posts, show a friendly Empty State ("Chưa có bài viết nào").
- [ ] Mobile responsive: 1-column layout on < 768px screens.

### Definition of Done
- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)

---

## US-F17-08: Public Blog Detail (Storefront)

**Wave 4** | **P1** | **S** | **Status:** Ready

### Story

```text
As a   Site Visitor (Customer)
I want to read the full content of a blog post
So that I can consume the information and potentially share it
```

### Acceptance Criteria

#### AC-1: Read Blog Post
```gherkin
GIVEN the visitor clicks on a blog post from the list
WHEN  they navigate to the post detail page (/sites/[slug]/blogs/[post-slug])
THEN  they see the full Thumbnail, Title, Publish Date, Category, and the Rich Text Content
  AND the content is formatted correctly as styled in the editor (headings, links, bold/italic, etc.)
```

#### AC-2: SEO Metadata & Meta Tags
```gherkin
GIVEN the visitor accesses a specific blog post
WHEN  the page loads
THEN  the HTML `<title>` and `<meta name="description">` tags use the Meta Title and Meta Description defined by the seller
  AND JSON-LD Article Schema is rendered for SEO
```

#### AC-3: Navigation Back
```gherkin
GIVEN the visitor is reading a blog post
WHEN  they scroll or look at the top/bottom of the article
THEN  there is a "Back to Blogs" link or Breadcrumb to return to the list
```

### Definition of Done
- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] Responsive design ensures text is readable on mobile devices with proper padding.


