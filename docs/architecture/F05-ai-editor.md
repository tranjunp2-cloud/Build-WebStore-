# Architecture: AI Editor — Split Screen (F05)

> **Version:** 1.0 | **PRD:** [F05-ai-editor.md](../prd/F05-ai-editor.md)  
> **Tech:** Next.js 15 + Payload CMS 3 + OpenAI + Vercel AI SDK

---

## 1. System Overview

```
┌──────────────────────────────────────────────────────────────┐
│                       /editor/:siteId                        │
│ ┌───────────────┬──────────────────────┬───────────────────┐ │
│ │ AI Chat Panel │    Live Preview      │ Settings Panel    │ │
│ │   / Blocks    │    (iframe SSR)      │ (Contextual/320px)│ │
│ │   (380px)     │                      │                   │ │
│ │  useChat()    │  /sites/:slug/       │ - Global Settings │
│ │  Drag & Drop  │  (sandboxed iframe)  │ - Block Settings  │ │
│ │  Components   │  WYSIWYG Overlay     │ - Navigation Tree │ │
│ └───────────────┴──────────────────────┴───────────────────┘ │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ Toolbar: [Pages/Visibility] [Undo] [Redo] [Publish]      │ │
│ └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

## 2. Component Tree

```
EditorPage (Server Component)
├── EditorToolbar
│   ├── UndoRedoButtons
│   ├── PageVisibilityToggle
│   └── PublishButton (Maintenance Mode Toggle)
├── EditorLayout (Client Component)
│   ├── LeftSidebar (Tabs: Chat | Blocks)
│   │   ├── ChatPanel (useChat from Vercel SDK)
│   │   └── BlockLibrary (Draggable components)
│   ├── PreviewPanel (flex: 1)
│   │   ├── PreviewIframe (sandboxed with postMessage sync)
│   │   └── WYSIWYGOverlay (Rich-text Floating Toolbar)
│   └── SettingsPanel (320px, context-sensitive)
│       ├── GlobalSettings (Name, Contact, SEO, Social, Favicon)
│       ├── HeaderNavigationTree (Drag & Drop Submenu)
│       ├── BlockSettings (Colors, config)
│       └── ComponentSpecificSettings (e.g., Links, IDs)
└── EditorProviders
    ├── EditorStoreProvider (Zustand: Blocks + Global Data)
    ├── HistoryProvider (undo/redo stack max 50)
    └── AutoSaveProvider (3s debounce interval)
```

## 3. State Management (Zustand)

```typescript
interface GlobalSiteData {
  storeName: string;
  tagline: string;
  logoUrl: string;       // Automates favicon generation
  contact: { phone: string; email: string; address: string };
  socialLinks: Record<string, string>; // Facebook, IG, etc.
  seo: { metaTitle: string; metaDescription: string; ogImage: string };
  isMaintenanceMode: boolean; // Site unpublish
}

interface EditorStore {
  siteId: string;
  pageId: string;
  isVisible: boolean;       // Page hide/show toggle
  blocks: Block[];          // Current site/page blocks
  globalData: GlobalSiteData; // Bindings for Header/Footer/Widgets
  selectedBlockId: string | null;
  isDirty: boolean;         // Has unsaved changes
  
  // History (undo/redo)
  history: { blocks: Block[], globalData: GlobalSiteData }[]; // Save holistic state
  historyIndex: number;
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;
  
  // Actions
  updateBlock: (id: string, data: Partial<Block>) => void;
  updateGlobalData: (data: Partial<GlobalSiteData>) => void;
  addBlock: (block: Block, position?: number) => void; // Via Chat or Drag/Drop
  removeBlock: (id: string) => void;
  reorderBlocks: (from: number, to: number) => void;
}
```

## 4. iframe Communication Protocol (postMessage)

Because the Preview is rendered in an SSR sandboxed `iframe`, the parent Editor and iframe must sync states avoiding direct DOM injection:

**Parent → Iframe:**
- `SYNC_BLOCKS`: Push updated `blocks` state from Zustand to re-render iframe.
- `SYNC_GLOBAL_DATA`: Push `globalData` so Header/Footer re-read variables.
- `SET_THEME`: Change root CSS variables for dynamic AI styling.

**Iframe → Parent:**
- `BLOCK_SELECTED`: User clicked a block (sends `blockId` to open Settings Panel).
- `TEXT_EDITED`: User finished WYSIWYG typing (sends payload to update Zustand).
- `BLOCK_DROPPED`: User dropped a Block component from LeftSidebar into the iframe canvas.
- `IMAGE_REPLACE_REQUEST`: User clicked "Replace Image". Parent opens file dialog.

## 5. API Routes

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/ai/edit-block` | AI processes chat → stream blocks updates |
| POST | `/api/ai/generate-favicon`| Triggers background job to create `.ico` from Logo |
| POST | `/api/upload` | Handle image drops (validates >2MB → configures Crop/Compress) |
| GET | `/api/sites/[siteId]` | Load site data & Global settings |
| PATCH | `/api/sites/[siteId]` | Save site changes (auto-save debounce 3s) |
| POST | `/api/sites/[siteId]/publish` | Toggle live status / Maintenance Mode |

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
