# Architecture: Blog Management (F17)

> **Date:** 2026-03-17 | **Related PRD:** `docs/prd/F15-blog-management.md`  
> **Agent:** Architect Agent

---

## 1. Overview

Blog Management (F17) is a lightweight CMS feature integrated into the PrimeWeb Merchant Dashboard and Storefront. It allows merchants to create, categorize, and publish blog posts with the assistance of an AI text generator. 

The architecture is divided into two main areas:
1. **Dashboard (Merchant-facing):** A secure area to manage posts and categories using Server Actions and API endpoints. It includes a rich text editor and integrates with the F05 AI System for text generation.
2. **Storefront (Customer-facing):** A public, read-only set of pages (List and Detail views) heavily optimized for SEO using Server Components.

---

## 2. Component Architecture

### 2.1 Dashboard (Merchant Area)
```
app/(dashboard)/blog/
    ├── page.tsx                      ← Server Component (Blog List - shared Empty state)
    │       ├── BlogListTable.tsx     ← Client Component (Sorting, Bulk Actions)
    │       └── AdvancedFilters.tsx   ← Client Component (Search, Category, Status)
    ├── categories/
    │       └── page.tsx              ← Server Component (Category Management)
    │               └── CategoryListTree.tsx
    └── [id]/
            └── page.tsx              ← Server Component (Data fetching for Editor)
                    ├── BlogEditor.tsx        ← Client Component (Rich Text, Title, Thumbnail)
                    ├── CategorySelect.tsx    ← Dropdown for 1-level categories
                    ├── AIWritingAssistant.tsx← Modal/Sidebar for AI prompting
                    └── SEOFormPanel.tsx      ← Meta title, description, slug management
```

### 2.2 Storefront (Public Area)
```
app/(storefront)/[domain]/blog/
    ├── page.tsx                      ← Server Component (Public Blog List)
    │       ├── BlogGrid.tsx          
    │       └── CategoryPills.tsx     ← Quick filter by category
    └── [slug]/
            └── page.tsx              ← Server Component (Public Blog Detail)
                    ├── BlogArticle.tsx       ← Renders Rich Text to HTML securely
                    ├── AuthorCard.tsx
                    └── RelatedPosts.tsx
```

---

## 3. Data Model

The data uses Payload CMS collections mapping to MongoDB/PostgreSQL:

### 3.1 `blogs` Collection
| Field | Type | Description |
|-------|------|-------------|
| `id` | String/ObjectId | Unique identifier |
| `tenantId` | String | Links post to specific merchant store |
| `title` | String | Required. Title of post |
| `slug` | String | Unique within tenant, URL friendly |
| `content` | RichText/JSON | Main article body |
| `thumbnail_url` | String | URL to uploaded image cover |
| `status` | Enum | `DRAFT`, `PUBLISHED` |
| `categoryId` | Relation | Links to `blog_categories` |
| `meta_title` | String | SEO Title |
| `meta_description`| String | SEO Description |
| `authorId` | Relation | Links to `users` |
| `createdAt` | DateTime | |
| `updatedAt` | DateTime | |

### 3.2 `blog_categories` Collection
| Field | Type | Description |
|-------|------|-------------|
| `id` | String/ObjectId | Unique identifier |
| `tenantId` | String | Links category to specific merchant store |
| `name` | String | Required. Display name |
| `slug` | String | URL friendly name |

---

## 4. API Contract & Data Flow

All endpoints are protected by Merchant Auth (tenant check) except for public storefront reading.

### Backend Endpoints (Next.js App Router / Payload Local API)
- `GET /api/blogs` — Query posts with pagination, sort, search, and filter.
- `POST /api/blogs` — Create draft/published post.
- `PATCH /api/blogs/:id` — Update fields, handle Publish/Draft toggling.
- `DELETE /api/blogs` — Bulk delete or single delete.
- `GET/POST/PATCH/DELETE /api/blog-categories` — Manage simple categories.

### AI Integration Flow (Text Only)
```
[Client] BlogEditor
  │
  ├── 1. User selects text & clicks "Generate AI" or types prompt
  │
  ├── 2. POST /api/ai/blog-assist { prompt, context, command }
  │
  ├── 3. [Server] Validates request (Rejects image generation prompts inherently or explicitly via system prompt)
  │
  ├── 4. [Server] Calls internal LLM Service (e.g., OpenAI / Gemini)
  │
  └── 5. Streaming Response or JSON Response → inserted back into Editor state.
```

---

## 5. 6-Layer Architecture Checklist

```
✅ Layer 1 — PRODUCT/UX:
   - Shared empty state for No Data.
   - Bulk actions & Sorting to match Product Management UX.
   - Dedicated Storefront read layout.

✅ Layer 2 — API/BACKEND:
   - CRUD API for blogs and categories.
   - AI text-assist endpoint specialized for Blog context.

✅ Layer 3 — DATA/STORAGE:
   - `blogs` and `blog_categories` collections scoped by Tenant.
   - Rich Text storage format.

✅ Layer 4 — SECURITY/AUTH:
   - Role-based checking (`blog:manage`) in API routes.
   - XSS sanitization when rendering RichText on storefront.
   - AI Prompts sanitized; specific constraint to NOT generate images.

⬜ Layer 5 — OPS/RELIABILITY:
   - Image upload size limits (handled generically in media system, verify for thumbnails).
   - Rate limiting on AI generation endpoints to prevent billing abuse.

⬜ Layer 6 — BUSINESS:
   - Usage limits (e.g. number of AI generations per tier) (TODO: Await PO guidance on limits).
```
