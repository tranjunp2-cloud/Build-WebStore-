# PRD: AI Editor — Split Screen (F05)
> **Version:** 1.0 | **Created:** 2026-03-08 | **Agent:** `project-planner`  
> **Priority:** P0 🌟 | **Wave:** 3 | **Size:** XL  
> **Depends on:** F04 Block Renderer ✅, F01 AI Builder ✅ | **Blocks:** F14 Undo/Redo, F15 Auto-Save

---

## 1. Problem Statement

After AI generates a website, users need to refine and customize it. Currently the editor is a basic single-panel view with limited AI integration. Users need a powerful but simple split-screen editor where they can chat with AI to make changes while seeing live preview — similar to Lovable/Bolt.new.

## 2. Target User

- SME owner who just generated a website (Persona A)
- Wants to tweak colors, text, images without code
- Comfortable chatting in BM/EN/Manglish

## 3. Success Metrics

| Metric | Target |
|--------|--------|
| Chat edit → preview update | < 3 seconds |
| User satisfaction (editing experience) | > 7/10 |
| Average edits before publish | 5-15 |
| Undo/Redo usage | > 30% of sessions |

## 4. User Story

```
AS A site owner after AI generation
I WANT TO refine my website through chat or direct click
SO THAT I can customize everything without knowing code
```

## 5. Screen Layout

```
┌─ /editor/:siteId ──────────────────────────────────────────┐
│ ┌─ Toolbar ────────────────────────────────────────────────┐│
│ │ [☰ Pages ▼] [← Undo] [Redo →] [💾 Save] [👁 Preview] [🚀 Publish] ││
│ │                                        Draft · Saved 2s ago ││
│ └──────────────────────────────────────────────────────────┘│
│ ┌──────────────┐ ┌────────────────────────────────────────┐│
│ │  CHAT PANEL  │ │             LIVE PREVIEW               ││
│ │  (380px)     │ │             (iframe)                    ││
│ │              │ │                                        ││
│ │  AI: How can │ │  ┌──────────────────────────────────┐  ││
│ │  I help?     │ │  │  [Navigation Block]              │  ││
│ │              │ │  │  [Hero Block] ← hover = blue     │  ││
│ │  User: Change│ │  │     outline + ✨ button           │  ││
│ │  hero color  │ │  │  [Features Block]                │  ││
│ │  to mint     │ │  │  [About Block]                   │  ││
│ │              │ │  │  [Contact Block]                 │  ││
│ │  AI: Done!   │ │  │  [Footer Block]                  │  ││
│ │  Changed to  │ │  └──────────────────────────────────┘  ││
│ │  #A8E6CF ✓   │ │                                        ││
│ │  [Undo]      │ │                                        ││
│ │              │ │                                        ││
│ │  💡 Suggestions:                                        ││
│ │  • Add testimonials                                     ││
│ │  • Change font                                          ││
│ │              │ │                                        ││
│ │ [Type here.. ]│                                        ││
│ └──────────────┘ └────────────────────────────────────────┘│
│                                                              │
│ Mobile (< 768px): Chat = bottom sheet, Preview = full width  │
└──────────────────────────────────────────────────────────────┘
```

## 6. Acceptance Criteria

### AC-1: Split Screen Layout
```gherkin
GIVEN user navigates to /editor/:siteId
WHEN  page loads
THEN  chat panel (380px fixed) on left, collapsible
AND   live preview (iframe, sandboxed) takes remaining width
AND   toolbar top: Pages dropdown, Undo, Redo, Save, Preview, Publish
AND   status bar: "Draft · Saved Xs ago" or "Published"
```

### AC-2: Chat-to-Edit
```gherkin
GIVEN user types "Đổi tiêu đề hero thành Khám Phá Moda"
WHEN  message sent
THEN  AI responds within 3 seconds
AND   preview updates in real-time (no page refresh)
AND   AI explains: "Đã đổi tiêu đề hero"
AND   "Undo" button appears in that message
AND   3 follow-up suggestions shown below response
```

### AC-3: Inline AI Edit (Hover + Click)
```gherkin
GIVEN user hovers a block in preview iframe
WHEN  hover occurs
THEN  blue outline (2px solid #2563EB) around block
AND   floating [✨ AI Edit] button appears top-right

GIVEN user clicks [✨ AI Edit]
WHEN  popup opens
THEN  text input + quick actions (Viết lại, Đổi style, Xóa)
AND   popup positioned adjacent to block

GIVEN user types instruction and clicks Apply
THEN  AI modifies ONLY that block
AND   other blocks unaffected
AND   toast "Đã cập nhật [block name]"
```

### AC-4: Page Manager
```gherkin
GIVEN user clicks Pages dropdown in toolbar
WHEN  dropdown opens
THEN  list all pages: name, status (Draft/Published), block count
AND   option to "Add page" and "Delete page"
AND   clicking a page loads it in preview
```

### AC-5: Mobile Responsive
```gherkin
GIVEN screen width < 768px
WHEN  on /editor/:siteId
THEN  preview takes full width
AND   chat panel becomes bottom sheet (swipe up to open)
AND   toggle buttons: [💬 Chat] [👁 Preview]
```

### AC-6: Theme Controls
```gherkin
GIVEN user says "Đổi font chữ thành Poppins"
WHEN  AI processes
THEN  entire site font changes in preview
AND   theme config updated in state
AND   AI confirms change with before/after preview
```

## 7. Technical Requirements

### Components
| Component | File | Description |
|-----------|------|-------------|
| EditorPage | `app/(editor)/editor/[siteId]/page.tsx` | Layout orchestrator |
| EditorChatPanel | `components/editor/EditorChatPanel.tsx` | AI chat (380px left) |
| EditorPreview | `components/editor/EditorPreview.tsx` | Sandboxed iframe |
| EditorToolbar | `components/editor/EditorToolbar.tsx` | Top actions bar |
| InlineEditPopup | `components/editor/InlineEditPopup.tsx` | Hover → popup over block |
| PageSelector | `components/editor/PageSelector.tsx` | Pages dropdown |

### State (Zustand — `editorStore`)
```typescript
type EditorStore = {
  siteId: string
  currentPageId: string
  blocks: BlockConfig[]
  theme: ThemeConfig
  messages: Message[]
  isDirty: boolean
  lastSaved: Date | null
  undoStack: UndoAction[] // max 50
  redoStack: UndoAction[]
}
```

### iframe Communication
- Parent → iframe: `UPDATE_BLOCK`, `HIGHLIGHT_BLOCK`, `SET_THEME`
- iframe → Parent: `BLOCK_CLICKED`, `BLOCK_HOVERED` (with rect position)

### API
- `POST /api/ai/chat-edit` — Send message, get structured changes
- `PATCH /api/sites/:id/pages/:pageId` — Save block changes

## 8. 9-Point Done Checklist

- [ ] Loading State — Skeleton for preview, typing indicator for chat
- [ ] Empty State — Welcome message + suggestion prompts
- [ ] Error State — Toast + retry for AI failures
- [ ] Form Validation — N/A (chat input)
- [ ] Button States — Send disabled during streaming, Undo/Redo greyed when empty
- [ ] Toast Feedback — Success/Error for all actions
- [ ] Auth Redirect — 401 → /login
- [ ] Mobile 375px — Bottom sheet chat, full-width preview
- [ ] TypeScript Clean — tsc --noEmit pass
