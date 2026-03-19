# User Stories: Blog Management (F17)

<!-- Rules & ID Convention: docs/stories/user-stories-p0.md | SPEC.md §2.4 -->

> **Feature:** F17 — Blog Management
> **Wave:** 4 | **Priority:** P1 | **Ref PRD:** [F17-blog-management.md](../prd/F17-blog-management.md)

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

- [ ] Empty State component must follow the same shared design system layout used in Products (F17) and Orders (F17).
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

### Additional Criteria

- [ ] Categories are strictly 1-level deep (no sub-categories).
- [ ] If a category is deleted, its assigned posts should revert to an "Uncategorized" state or default category.

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

#### AC-2: Delete Post

```gherkin
GIVEN the user is viewing the blog list
WHEN  they click "Delete" on a post and confirm the action
THEN  the post is permanently removed from the system
  AND a success toast is shown
```

### Additional Criteria

- [ ] Warn user before deleting a published post.

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
