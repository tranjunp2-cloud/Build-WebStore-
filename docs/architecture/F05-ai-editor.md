# Architecture: AI Editor — Split Screen (F05)

> **Version:** 1.0 | **PRD:** [F05-ai-editor.md](../prd/F05-ai-editor.md)  
> **Tech:** Next.js 15 + Payload CMS 3 + OpenAI + Vercel AI SDK

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────┐
│                    /editor/:siteId                       │
│ ┌──────────────┬──────────────────────┬────────────────┐ │
│ │ AI Chat Panel│    Live Preview      │ Settings Panel │ │
│ │   (380px)    │    (iframe SSR)      │   (320px)      │ │
│ │              │                      │                │ │
│ │  useChat()   │  /sites/:slug/       │  Block config  │ │
│ │  Vercel SDK  │  (sandboxed iframe)  │  Theme/colors  │ │
│ │              │                      │                │ │
│ └──────────────┴──────────────────────┴────────────────┘ │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Toolbar: [Undo] [Redo] [Save] [Preview] [Publish]   │ │
│ └──────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## 2. Component Tree

```
EditorPage (Server Component)
├── EditorToolbar
│   ├── UndoRedoButtons
│   ├── SaveIndicator (auto-save status)
│   ├── PreviewToggle (desktop/mobile)
│   └── PublishButton
├── EditorLayout (Client Component)
│   ├── ChatPanel (380px, collapsible)
│   │   ├── ChatMessages (useChat from Vercel AI SDK)
│   │   ├── ChatInput
│   │   └── QuickActions
│   ├── PreviewPanel (flex: 1)
│   │   ├── PreviewIframe (sandboxed)
│   │   └── InlineEditOverlay
│   └── SettingsPanel (320px, context-sensitive)
│       ├── BlockSettings
│       ├── ThemeSettings
│       └── SEOSettings
└── EditorProviders
    ├── EditorStoreProvider (Zustand)
    ├── HistoryProvider (undo/redo stack)
    └── AutoSaveProvider (30s interval)
```

## 3. State Management (Zustand)

```typescript
interface EditorStore {
  siteId: string
  blocks: Block[]           // Current site blocks
  selectedBlockId: string | null
  isDirty: boolean          // Has unsaved changes
  
  // History (undo/redo)
  history: Block[][]        // Max 50 states
  historyIndex: number
  undo: () => void
  redo: () => void
  pushHistory: (blocks: Block[]) => void
  
  // Actions
  updateBlock: (id: string, data: Partial<Block>) => void
  addBlock: (block: Block, position?: number) => void
  removeBlock: (id: string) => void
  reorderBlocks: (from: number, to: number) => void
}
```

## 4. API Routes

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/ai/edit-block` | AI processes chat instruction → returns updated blocks |
| POST | `/api/ai/rewrite-text` | Inline edit: rewrite specific text element |
| GET | `/api/sites/[siteId]` | Load site data for editor |
| PATCH | `/api/sites/[siteId]` | Save site changes (auto-save) |
| POST | `/api/sites/[siteId]/publish` | Publish site live |

## 5. Data Flow

```
User types chat → useChat() → /api/ai/edit-block
                                    ↓
                              OpenAI streamText()
                                    ↓
                              Parse AI response → Block changes
                                    ↓
                              Update Zustand store → pushHistory()
                                    ↓
                              Preview iframe refreshes (postMessage)
                                    ↓
                              Auto-save triggers (30s interval)
                                    ↓
                              PATCH /api/sites/[siteId]
```

## 6. Error Matrix

| Error | User Sees | Recovery |
|-------|-----------|----------|
| AI timeout (>30s) | "AI đang xử lý lâu hơn bình thường..." | Auto-retry 1x |
| AI API failure | Toast: "Không thể xử lý. Thử lại" | Retry button |
| Auto-save failure | Orange dot on save indicator | Retry in 10s |
| Preview iframe crash | "Preview error" overlay | Reload iframe button |
| Session expired | Redirect to /login | — |
