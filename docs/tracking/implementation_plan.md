# Wave 3: AI Website Builder — Wire Real Generation

## Problem

AI Builder page `/builder/new` exists with chat UI + live preview panel, but uses `setTimeout` mock. Need to:
1. Generate real page blocks from user description
2. Create Site + Page in Payload DB
3. Show live preview
4. Redirect to editor/dashboard

## Architecture Decision

> [!IMPORTANT]
> **Phase 1 (this PR)**: Rule-based block generation — parse user intent (business type, name) → generate matching blocks JSON. No LLM API key needed.
>
> **Phase 2 (future)**: Wire real LLM (OpenAI/Claude) via Vercel AI SDK for intelligent content writing.
>
> Reason: Get the full flow working end-to-end first, then improve AI quality later.

## Proposed Changes

### 1. AI Generation API Route

#### [NEW] `src/app/api/ai/generate-site/route.ts`

Server-side API route that:
- Receives `{ prompt, tenantId }` 
- Parses business intent (name, type, style)
- Generates blocks JSON array matching Pages collection schema
- Creates Site in DB → Creates homepage Page with blocks → Returns site ID

```
POST /api/ai/generate-site
Body: { prompt: "Bakery cakes shop called Sweet Dreams", tenantId: "..." }
Response: { siteId: "...", pageId: "...", siteName: "...", blocks: [...] }
```

### 2. Block Generator Logic

#### [NEW] `src/lib/ai/generate-blocks.ts`

Rule-based block generator:
- Parse prompt → extract business name, type, description
- Map business type → appropriate block template
- Generate 5–6 blocks: navigation, hero, about/features, testimonials, contact, footer
- Fill in realistic content based on business type

### 3. Wire AI Builder Page

#### [MODIFY] `src/app/(builder)/builder/new/page.tsx`

Replace `setTimeout` mock with real API call:
- Send user message to `/api/ai/generate-site`
- Show progress steps during generation
- Load live preview via iframe after site is created
- Add "Go to Dashboard" button on completion

### 4. Pages Collection Access

#### [MODIFY] `src/collections/Pages.ts`

Add access control (currently missing — same pattern as Sites):
- Tenant-scoped via site relationship

---

## Verification Plan

1. Go to `/builder/new` → type "Bakery shop tên Sweet Dreams"
2. AI generates → creates Site + Page in DB
3. Preview shows real blocks
4. Dashboard shows new site card
