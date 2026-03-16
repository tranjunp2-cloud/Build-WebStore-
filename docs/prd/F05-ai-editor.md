# PRD: AI Editor — Split Screen (F05)
> **Version:** 1.1 | **Updated:** 2026-03-16 | **Agent:** `project-planner`
> **Priority:** P0 🌟 | **Sprint:** Wave 3 | **Size:** XL
> **Depends on:** F04 Block Renderer ✅, F01 AI Builder ✅ | **Blocks:** F14 Undo/Redo, F15 Auto-Save

---

> [!IMPORTANT]
> **Stories-First Rule:** PRD này được xây dựng từ các User Stories đã approve.
> Mọi FR phải có Story Ref. AC được copy từ story file. Không tự mở rộng scope.

---

## 0. Story Traceability

| Story ID | Title | File | Status |
|----------|-------|------|--------|
| US-F05-01 | AI Editor — Split Screen Chat + Preview | [F05-ai-editor-stories.md](../stories/F05-ai-editor-stories.md) | Ready |
| US-F05-02 | Page Manager | [F05-ai-editor-stories.md](../stories/F05-ai-editor-stories.md) | Ready |
| US-F05-03 | Inline Click-to-Edit Element | [F05-ai-editor-stories.md](../stories/F05-ai-editor-stories.md) | Draft |
| US-F05-04 | Add New Section via AI | [F05-ai-editor-stories.md](../stories/F05-ai-editor-stories.md) | Draft |
| US-F05-05 | Drag-and-Drop Block Reorder in Editor | [F05-ai-editor-stories.md](../stories/F05-ai-editor-stories.md) | Draft |

---

## 1. Problem Statement

After AI generates a website, users need to refine and customize it. Currently the editor is a basic single-panel view with limited AI integration. Users need a powerful but simple split-screen editor where they can chat with AI to make changes while seeing live preview — similar to Lovable/Bolt.new.

---

## 2. Target User

- SME owner vừa generate website (Persona A)
- Muốn chỉnh màu, text, images mà không cần code
- Comfortable chatting trong BM/EN/Manglish

---

## 3. Solution Overview

3-panel split screen editor: AI Chat (380px trái), Live Preview iframe (giữa), Settings panel (320px phải). User chat để AI apply changes realtime lên preview. Hover element để click-to-edit inline. Undo/Redo support cả AI và manual edits. Auto-save mỗi 3 giây.

---

## 4. Scope

### In Scope
- 3-panel layout: Chat + Preview + Settings (US-F05-01)
- AI chat → realtime preview update (US-F05-01)
- Undo/Redo (Ctrl+Z/Y) cho cả AI và manual changes (US-F05-01)
- Hover element → inline AI edit popup (US-F05-03)
- Page Manager: CRUD pages + soft delete (US-F05-02)
- Add new section via AI chat (US-F05-04)
- Auto-save debounce 3s (US-F05-01)
- Drag-drop block reordering in iframe (US-F05-05)

### Out of Scope
- Custom HTML/CSS injection
- Block Library sidebar (Wave 4+)

---

## 5. Success Metrics

| Metric | Target | Measured By |
|--------|--------|-------------|
| Chat edit → preview update | < 3 seconds | Custom timing |
| User satisfaction (editing exp) | > 7/10 | In-app survey |
| Undo/Redo usage | > 30% sessions | PostHog |

---

## 6. User Story Summary

```
AS A   site owner sau khi AI generate
I WANT chỉnh sửa website qua chat hoặc click trực tiếp
SO THAT tôi tinh chỉnh nội dung mà không cần biết code
```

> Source: [US-F05-01](../stories/F05-ai-editor-stories.md#us-f05-01)

---

## 7. Functional Requirements

| FR-ID | Requirement | Story Ref | Priority | Notes |
|-------|-------------|-----------|----------|-------|
| FR-01 | 3-panel layout: Chat (380px) + Preview (iframe) + Settings (320px) | US-F05-01 | P0 | Collapsible panels |
| FR-02 | Toolbar: Undo, Redo, Save, Preview, Publish | US-F05-01 | P0 | |
| FR-03 | AI chat → apply changes to preview realtime (SSE) | US-F05-01 | P0 | < 3s |
| FR-04 | Undo (Ctrl+Z) reverts most recent change — AI or manual | US-F05-01 | P0 | Max 50 states |
| FR-05 | Auto-save debounce 3s — prevent data loss on tab close | US-F05-01 | P0 | Payload PATCH |
| FR-06 | Badge: Draft / Published visible in header | US-F05-01 | P0 | |
| FR-07 | Page Manager: list pages với status, block count, last edited | US-F05-02 | P0 | |
| FR-08 | Add page: điền tên → slug auto-generated → redirect editor | US-F05-02 | P0 | |
| FR-09 | Delete page: soft delete + undo toast 5s | US-F05-02 | P0 | |
| FR-10 | Hover element 200ms → hiện "✨ Edit with AI" button | US-F05-03 | P0 | top-right position |
| FR-11 | Click ✨ → instruction popup → apply changes trong 300ms | US-F05-03 | P0 | |
| FR-12 | Add section via chat (Testimonials, FAQ, Gallery, etc.) | US-F05-04 | P0 | 8 section types |
| FR-13 | Drag handle on hover → drag to reorder blocks in preview | US-F05-05 | P0 | |
| FR-14 | Drag-drop action pushes to Undo/Redo stack and triggers auto-save | US-F05-05 | P0 | |

---

## 8. Business Rules

- **BR-01:** Mọi query scope theo tenant + siteId — không access cross-tenant
- **BR-02:** Soft delete page only — không hard delete
- **BR-03:** AI chat action được ghi vào chat history để user trace được
- **BR-04:** Inline edit chỉ modify element được click — không affect phần còn lại

---

## 9. User Flow

```
/editor/:siteId (authenticated)
  ↓
Load 3-panel layout + fetch site blocks
  ↓
User action:
  ├── Chat "Đổi màu chủ → xanh mint"
  │     → AI stream → preview update → chat shows "Done + Undo"
  ├── Hover element → Click ✨ → mini popup → type instruction → apply
  ├── Drag handle → block reorder → update Zustand state + auto save
  ├── Pages tab → add/delete page → soft delete + undo toast
  └── Ctrl+Z → revert last change (preview updates < 200ms)
```

---

## 10. Screen Layout

```
┌─ /editor/:siteId ──────────────────────────────────────────┐
│ ┌─ Toolbar ──────────────────────────────────────────────┐ │
│ │ [Pages ▼] [← Undo(3)] [Redo →] [💾] [👁] [🚀 Publish]│ │
│ │                                     Draft · Saved 2s   │ │
│ └────────────────────────────────────────────────────────┘ │
│ ┌──────────────┐ ┌──────────────────────────────────────┐  │
│ │  CHAT PANEL  │ │           LIVE PREVIEW (iframe)       │  │
│ │  (380px)     │ │                                       │  │
│ │  AI: How can │ │  [Nav Block]                          │  │
│ │  I help?     │ │  [Hero Block] ← hover → blue outline  │  │
│ │              │ │       ┌─────────────┐                 │  │
│ │  User: Change│ │       │ ✨ Edit with│                 │  │
│ │  hero color  │ │       │    AI       │                 │  │
│ │              │ │       └─────────────┘                 │  │
│ │  [Type...]   │ │  [Features] [About] [Contact]         │  │
│ └──────────────┘ └──────────────────────────────────────┘  │
│                                                              │
│ Mobile: Preview full width, Chat = bottom sheet             │
└──────────────────────────────────────────────────────────────┘
```

---

## 11. Acceptance Criteria

> AC được copy từ `F05-ai-editor-stories.md`. Không tự thêm AC không có trong story.

### AC-1: Layout 3 Panel
> 📌 Source: [US-F05-01](../stories/F05-ai-editor-stories.md) — AC-1

```gherkin
GIVEN user ở /editor/:siteId
WHEN  load trang
THEN  AI chat panel trái (380px, collapsible)
  AND live preview giữa (iframe, sandboxed)
  AND settings panel phải (320px, context-sensitive)
  AND toolbar: [Undo] [Redo] [Save] [Preview] [Publish]
  AND status bar: autosave ON, draft/published badge
```

### AC-2: AI Chat Edit
> 📌 Source: [US-F05-01](../stories/F05-ai-editor-stories.md) — AC-2

```gherkin
GIVEN user nhập lệnh chat (VD: "Đổi màu chủ thành xanh mint")
WHEN  gửi message
THEN  AI stream response
  AND changes apply lên preview realtime
  AND AI giải thích: "Đã đổi primary color thành #B2DFDB"
  AND có nút "Hoàn tác" trong chat message
```

### AC-3: Undo — Ctrl+Z
> 📌 Source: [US-F05-01](../stories/F05-ai-editor-stories.md) — AC-3

```gherkin
GIVEN user đã thực hiện thay đổi (AI hoặc manual)
WHEN  nhấn Ctrl+Z
THEN  revert change gần nhất (cả AI changes và manual edits)
  AND preview cập nhật trong < 200ms
```

### AC-4: Inline Click-to-Edit
> 📌 Source: [US-F05-03](../stories/F05-ai-editor-stories.md) — AC-1 & AC-2

```gherkin
GIVEN I hover over a text element in the preview pane
WHEN  cursor rests on element for 200ms
THEN  blue "✨ Edit with AI" button appears at top-right of element

GIVEN I click "✨ Edit with AI"
WHEN  popup opens
THEN  instruction field shows, I type + press Enter
```

### AC-5: Page Manager — Add & Delete
> 📌 Source: [US-F05-02](../stories/F05-ai-editor-stories.md) — AC-2 & AC-3

```gherkin
GIVEN click "Thêm trang mới" và điền tên "Khuyến mãi"
THEN  tạo page với slug = "khuyen-mai"
  AND redirect sang editor của page đó

GIVEN click Delete trên 1 page và confirm
THEN  soft delete (deletedAt set)
  AND toast "Đã xóa. Hoàn tác?" 5s
```

### AC-6: Mobile Responsive
> 📌 Source: [US-F05-01](../stories/F05-ai-editor-stories.md) — Additional Criteria

```gherkin
GIVEN screen width < 768px
WHEN  on /editor/:siteId
THEN  preview takes full width
  AND chat panel becomes bottom sheet (swipe up to open)
```

---

## 12. Non-Functional Requirements

| Category | Requirement | Notes |
|----------|-------------|-------|
| **Performance** | Chat edit → preview < 3s | SSE streaming |
| **Security** | Route requires auth, tenant-scoped | |
| **Device support** | Mobile 375px, Desktop 1280px+ | |
| **iframe** | Sandboxed — no cross-origin leaks | |

---

## 13. Technical Architecture

### 13.1 Components

| Component | File | Description |
|-----------|------|-------------|
| `EditorPage` | `app/(editor)/editor/[siteId]/page.tsx` | Layout orchestrator |
| `EditorChatPanel` | `components/editor/EditorChatPanel.tsx` | AI chat (380px left) |
| `EditorPreview` | `components/editor/EditorPreview.tsx` | Sandboxed iframe |
| `EditorToolbar` | `components/editor/EditorToolbar.tsx` | Top actions bar |
| `InlineEditPopup` | `components/editor/InlineEditPopup.tsx` | Hover → popup |
| `PageManager` | `components/editor/PageManager.tsx` | Pages CRUD |

### 13.2 API Endpoints

```
POST /api/ai/chat-edit        → structured changes (SSE)
PATCH /api/sites/:id/pages/:pageId → Save block changes
POST /api/pages               → Add new page
DELETE /api/pages/:id         → Soft delete page
```

### 13.3 iframe Communication

```
Parent → iframe: UPDATE_BLOCK, HIGHLIGHT_BLOCK, SET_THEME
iframe → Parent: BLOCK_CLICKED, BLOCK_HOVERED (with rect position)
```

---

## 14. Dependencies

| Dependency | Status | Action Needed |
|-----------|--------|---------------|
| F04 Block Renderer | ✅ Done | — |
| F01 AI Builder | ✅ Done | — |
| F14 Undo/Redo | ⬜ | Build concurrently |
| F15 Auto-Save | ⬜ | Build concurrently |

---

## 17. 9-Point Done Checklist

- [ ] Loading State — Skeleton preview, typing indicator chat
- [ ] Empty State — Welcome + suggestion prompts in chat
- [ ] Error State — Toast + retry cho AI failures
- [ ] Form Validation — N/A (chat input)
- [ ] Button States — Send disabled during streaming, Undo/Redo greyed khi empty
- [ ] Toast Feedback — Success/Error cho all actions
- [ ] Auth Redirect — 401 → /login
- [ ] Mobile 375px — Bottom sheet chat, full-width preview
- [ ] TypeScript Clean — `tsc --noEmit` pass

---

## 18. Definition of Ready

- [ ] User Stories approved và linked ở Section 0
- [ ] F04 Block Renderer done ✅
- [ ] F01 AI Builder done ✅
- [ ] iframe communication protocol agreed

---

## 19. Definition of Done

- [ ] All FR items implemented
- [ ] All AC pass
- [ ] 9-Point Checklist all pass
- [ ] Chat edit → preview < 3s measured
- [ ] Undo/Redo works cho cả AI + manual
- [ ] Mobile 375px tested
