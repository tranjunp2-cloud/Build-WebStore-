# PRD: AI Chat Builder (F-01)
> **Version:** 1.0 | **Created:** 2026-03-08 | **Agent:** `project-planner`  
> **Priority:** P0 🌟 | **Sprint:** Wave 3 — Sprint 2 | **Size:** XL  
> **Depends on:** F-05 Block Renderer ✅ | **Blocks:** F-02, F-09

---

## 1. Problem Statement

SME owners currently spend 30-60 minutes configuring website builders (choose template → fill forms → upload images → configure SEO). They need a way to **describe their business in natural language** and get a complete, beautiful website instantly.

v1 of Web Store had a manual builder. v2 makes AI the primary experience — the **#1 USP**.

## 2. Target User

- SME owner (chủ tiệm nhỏ, freelancer), no technical skills
- Speaks Vietnamese (primary) or English
- Wants professional website in **< 5 minutes** (register → publish)
- Has never built a website before

## 3. Success Metrics

| Metric | Target | Measured By |
|--------|--------|-------------|
| Time: register → first published site | < 10 min | PostHog funnel |
| AI generation success rate | > 95% | Sentry error rate |
| Generation time (p95) | < 60 seconds | Custom timing |
| User satisfaction (post-generation) | > 8/10 | In-app survey |
| Onboarding completion rate | > 70% | PostHog funnel |

## 4. User Story

```
AS A newly registered SME owner
I WANT TO describe my business in natural language
SO THAT AI creates a complete website without me needing design or coding skills
```

## 5. Screen Layout

```
┌─ /builder/new ─────────────────────────────────────────┐
│  ┌──────────────┐          ┌──────────────────────┐    │
│  │  CHAT PANEL  │          │    LIVE PREVIEW       │    │
│  │  (380px)     │          │    (remaining width)  │    │
│  │              │          │                        │    │
│  │  AI Welcome  │          │  [skeleton loading]    │    │
│  │  ↓           │          │  ↓                     │    │
│  │  User types  │  ──→     │  Nav appears           │    │
│  │  description │          │  Hero appears           │    │
│  │  ↓           │          │  Products appear        │    │
│  │  AI confirms │          │  About appears          │    │
│  │  + generates │          │  Contact appears        │    │
│  │  ↓           │          │  Footer appears         │    │
│  │  "Done! 🎉"  │          │  [full site visible]    │    │
│  │              │          │                        │    │
│  │  [Refine] [Publish]     │  Draft badge           │    │
│  └──────────────┘          └──────────────────────┘    │
└─────────────────────────────────────────────────────────┘

Mobile (< 768px):
  Chat = full width | Preview hidden (toggle: [💬 Chat] [👁 Preview])
```

## 6. Acceptance Criteria

### AC-1: Happy Path — Generate Complete Site
```gherkin
GIVEN user is on /builder/new (authenticated)
WHEN user types "Shop thời trang nữ, tên Mira Boutique, bán váy và phụ kiện"
AND clicks "Tạo website" or presses Enter
THEN AI begins SSE streaming within < 2 seconds
AND progress steps appear: "Phân tích yêu cầu... Chọn giao diện... Tạo header..."
AND live preview (right panel) builds block-by-block in real-time
AND complete site finishes in < 60 seconds
AND minimum 8 blocks generated (nav, hero, features, about, testimonials, faq, contact, footer)
AND theme matches category (fashion → pink/rose palette)
AND all copy is in user's language (Vietnamese detected from prompt)
AND SEO meta auto-generated (title ≤ 60 chars, description ≤ 160 chars)
AND 2 CTAs appear: "Tinh chỉnh →" (→ /editor/:siteId) and "Publish ngay"
AND draft auto-saved to database
```

### AC-2: Clarifying Questions — Missing Business Name
```gherkin
GIVEN user types a prompt without a business name (e.g., "tôi bán quần áo online")
WHEN AI cannot extract businessName
THEN AI asks: "Tên shop/website của bạn là gì?" (single clarifying question)
AND does NOT start generation until name is provided

GIVEN user types a prompt without clear category
WHEN AI cannot infer category
THEN AI asks: "Bạn kinh doanh lĩnh vực nào? (thời trang, F&B, dịch vụ...)"
AND maximum 2 clarifying questions total
AND after 2 questions → generate with reasonable assumptions (no more questions)
```

### AC-3: Error — AI API Failure
```gherkin
GIVEN AI API fails during generation (timeout, 500, rate limit)
WHEN error occurs mid-generation
THEN red toast appears: "Không thể tạo website. Thử lại"
AND "Thử lại" button resumes from last successful step (NOT from scratch)
AND partial blocks already generated are saved as draft
AND if error is rate limit → toast: "Đã hết lượt tạo website miễn phí" + upgrade prompt
```

### AC-4: Draft Recovery — Navigating Away
```gherkin
GIVEN user has started generation (or completed it)
AND user navigates away or closes tab
WHEN user returns to /builder/new
THEN dialog appears: "Bạn có bản nháp chưa hoàn thành"
AND options: "Tiếp tục" (→ load draft in /editor) | "Tạo mới" (→ confirm → fresh start)
AND draft is valid for 24 hours
AND "Tạo mới" requires confirmation: "Xóa bản nháp?" before proceeding
```

### AC-5: Category Detection → Theme Selection
```gherkin
GIVEN user describes their business
WHEN AI detects category (fashion, F&B, tech, etc.)
THEN category-appropriate template is used:
  - fashion → pink/rose palette, Plus Jakarta Sans
  - food → orange/amber palette, DM Sans
  - tech → blue palette, Inter
AND color preference in prompt overrides template (e.g., "màu xanh mint" → #A8E6CF)
```

### AC-6: Rate Limiting
```gherkin
GIVEN free tier user
WHEN attempting 2nd site generation (limit: 1 total)
THEN generation blocked before API call
AND toast: "Đã hết lượt tạo website miễn phí"
AND upgrade prompt with plan comparison modal
```

### AC-7: Mobile Responsive
```gherkin
GIVEN screen width < 768px
WHEN user accesses /builder/new
THEN chat panel takes full width
AND preview hidden by default
AND toggle buttons: [💬 Chat] [👁 Preview]
AND generation progress shows in chat (no split view)
```

## 7. Technical Architecture

### 7.1 Components

| Component | File | Description |
|-----------|------|-------------|
| `BuilderPage` | `app/(builder)/builder/new/page.tsx` | Page layout orchestrator |
| `BuilderChatPanel` | `components/builder/BuilderChatPanel.tsx` | Left chat panel (380px) |
| `BuilderPreview` | `components/builder/BuilderPreview.tsx` | iframe preview |
| `BuilderProgress` | `components/builder/BuilderProgress.tsx` | Step-by-step progress |
| `BuilderWelcome` | `components/builder/BuilderWelcome.tsx` | Welcome message + example prompts |
| `DraftRecoveryDialog` | `components/builder/DraftRecoveryDialog.tsx` | Resume draft dialog |
| `useAIStream` | `hooks/useAIStream.ts` | SSE consumer hook |
| `builderStore` | `store/builderStore.ts` | Zustand state |

### 7.2 Server Action

```typescript
// app/actions/ai/generateSite.ts
'use server'
export async function generateSite(formData: FormData): Promise<ReadableStream> {
  // 1. Extract: prompt, siteId, language
  // 2. Validate: auth + rate limit + tenant scope
  // 3. Extract business info from prompt (businessName, category, etc.)
  // 4. Select category template (colors, fonts, default blocks)
  // 5. Build system prompt with template context
  // 6. Call OpenAI GPT-4o with streaming
  // 7. Parse JSON blocks from AI response stream
  // 8. For each complete block:
  //    a. Validate with Zod schema (from block registry)
  //    b. Save to Payload CMS
  //    c. Emit SSE event: block_complete
  // 9. Generate SEO meta
  // 10. Emit SSE event: done
}
```

### 7.3 SSE Events

| Event | Data | UI Action |
|-------|------|-----------|
| `step` | `{step, label, progress}` | Update progress bar |
| `block_complete` | `{block: BlockConfig}` | Add block to preview |
| `theme_set` | `{theme: ThemeConfig}` | Apply theme to preview |
| `seo_generated` | `{title, description}` | Store SEO meta |
| `error` | `{code, message, retryable}` | Show toast, enable retry |
| `done` | `{siteId, totalBlocks, timeMs}` | Show success CTAs |

### 7.4 State Management (Zustand)

```typescript
// store/builderStore.ts
type BuilderStore = {
  // State
  status: 'idle' | 'streaming' | 'done' | 'error'
  messages: Message[]
  blocks: BlockConfig[]
  theme: ThemeConfig | null
  progress: { step: string; label: string; percent: number }
  siteId: string | null
  error: { code: string; message: string; retryable: boolean } | null

  // Actions
  startGeneration: (prompt: string) => void
  addBlock: (block: BlockConfig) => void
  setTheme: (theme: ThemeConfig) => void
  setError: (error: BuilderStore['error']) => void
  reset: () => void
}
```

### 7.5 Data Flow

```
User prompt → generateSite() Server Action
                   │
                   ├── Rate limit check (Redis)
                   ├── Create/update Site record (Payload)
                   ├── Call OpenAI GPT-4o (streaming)
                   │     └── System prompt = SPEC §8.1 + category template
                   ├── Parse AI response (JSON blocks)
                   ├── Validate each block (Zod from block registry)
                   ├── Save blocks to Page.layout (Payload)
                   └── Stream SSE events back to client
                         │
                         └── Client: builderStore.addBlock() → Preview updates
```

## 8. Dependencies

| Dependency | Status | Action Needed |
|-----------|--------|---------------|
| F-05 Block Renderer | Must build first | Sprint 1 |
| Payload collections (Sites, Pages) | ✅ Exists | — |
| OpenAI API key | ⬜ Not configured | Add to .env |
| Docker environment | ✅ Working | — |
| Zustand | ✅ In package.json | — |

## 9. API Contract

> Full details in [AI_BUILDER_SPEC.md §14.1](AI_BUILDER_SPEC.md#141-ai-chat-builder--generate-site)

```
POST /api/ai/generate-site → text/event-stream (SSE)

Request: { prompt: string, siteId: string, language?: 'vi' | 'en' }
Response: SSE stream (see §7.3 above)
Auth: Bearer JWT (required)
Rate Limit: Free=1 total, Starter=5/mo, Pro=20/mo, Business=unlimited
```

## 10. 9-Point Done Checklist

- [ ] Loading State — Skeleton for preview, typing indicator for chat
- [ ] Empty State — Welcome message + 3 example prompts
- [ ] Error State — Toast + retry button (different messages per error type)
- [ ] Form Validation — Rate limit check before generation
- [ ] Button States — Send button disabled during streaming
- [ ] Toast Feedback — Success/Error/Rate limit toasts
- [ ] Auth Redirect — 401 → /login
- [ ] Mobile 375px — Chat full-width, preview toggle
- [ ] TypeScript Clean — tsc --noEmit pass

## 11. Definition of Ready

- [x] This PRD reviewed and approved
- [x] AI_BUILDER_SPEC.md §2, §8.1, §9 referenced
- [ ] F-05 Block Renderer done (Sprint 1 prerequisite)
- [ ] OpenAI API key configured
- [ ] Docker environment working

## 12. Definition of Done

- [ ] 9-Point Checklist all pass
- [ ] Generation time < 60s (p95 measured)
- [ ] Rate limit blocks excess usage
- [ ] SSE streaming works (all event types)
- [ ] Draft recovery works (close tab → return)
- [ ] Mobile responsive (375px)
- [ ] Backward compatible with existing pages
