# Architecture: Template Gallery — AI Editor Integration (F07)
> **Version:** 1.0 | **Created:** 2026-03-18 | **Agent:** `frontend-specialist`
> **PRD:** [`docs/prd/F07-template-gallery.md`](../prd/F07-template-gallery.md)

---

## 1. Overview

Tài liệu này mô tả kiến trúc kỹ thuật để tích hợp Template Gallery vào bên trong AI Editor (F05) như một module. Bao gồm: cấu trúc component, luồng dữ liệu, API endpoints, cơ chế Smart Content Mapping, và Undo state management.

---

## 2. System Context

```
/editor/:siteId
      │
      ├── EditorToolbar
      │     └── [Templates 🎨 Button]
      │             │
      │             ▼
      │       TemplateGalleryModal
      │             │
      │     ┌───────┴───────┐
      │     │               │
      │  Browse        AI Search (Gemini-style chat)
      │  Categories    TemplateAISearchBar
      │     │               │
      │     └───────┬───────┘
      │             │ Select Template
      │             ▼
      │       TemplatePreviewModal (View-only iframe)
      │             │ Apply
      │             ▼
      │       ContentMapper.run(oldBlocks, newTemplate)
      │             │
      │             ▼
      │       EditorStore.applyTemplate(newBlocks)
      │             │ pushUndoSnapshot()
      │             ▼
      │       iframe SYNC_BLOCKS → re-render
      │             │ Undo or Save
      └─────────────┘
```

---

## 3. Component Tree

```
EditorPage
├── EditorToolbar
│   └── TemplatesButton           ← Entry point (FR-28)
│
└── TemplateGalleryModule
    ├── TemplateGalleryModal       ← Overlay modal chứa Gallery
    │   ├── TemplateCategoryTabs  ← Filter: F&B, Sports, Beauty...
    │   ├── TemplateCardGrid      ← Hiển thị thumbnails
    │   └── TemplateAISearchBar   ← Chat input (Gemini-style)
    │
    ├── TemplatePreviewModal       ← View-only fullscreen iframe
    │   ├── PreviewIframe          ← Render template với sample data
    │   └── ApplyTemplateButton    ← CTA chính
    │
    └── TemplateApplyController   ← Điều phối Apply + Undo
        ├── ContentMapper          ← Smart mapping nội dung
        └── TemplateUndoManager    ← Lưu 1 snapshot pre-apply
```

### Component Responsibility

| Component | File | Responsibility |
|-----------|------|----------------|
| `TemplatesButton` | `components/editor/TemplatesButton.tsx` | Nút mở Gallery trong Toolbar |
| `TemplateGalleryModal` | `components/editor/templates/TemplateGalleryModal.tsx` | Modal container chứa browse + search |
| `TemplateCategoryTabs` | `components/editor/templates/TemplateCategoryTabs.tsx` | Tabs lọc ngành nghề |
| `TemplateCardGrid` | `components/editor/templates/TemplateCardGrid.tsx` | Grid hiển thị card thumbnails |
| `TemplateAISearchBar` | `components/editor/templates/TemplateAISearchBar.tsx` | 1-line chat input để AI tìm template |
| `TemplatePreviewModal` | `components/editor/templates/TemplatePreviewModal.tsx` | Full-screen preview (view-only) |
| `ContentMapper` | `lib/editor/contentMapper.ts` | Map nội dung user sang template mới |
| `TemplateUndoManager` | `lib/editor/templateUndoManager.ts` | Lưu/Phục hồi 1 snapshot pre-apply |

---

## 4. Data Flow

### Apply Template Flow

```
User clicks "Apply Template"
      │
      ▼
TemplateUndoManager.saveSnapshot(currentBlocks)  ← Lưu 1 snapshot
      │
      ▼
ContentMapper.run(currentBlocks, templateBlocks)
  ├── Match blocks by blockType (Hero↔Hero, ProductList↔ProductList...)
  ├── Copy user text/image vào block mới
  └── Fallback: block template nếu không có block tương ứng
      │
      ▼
EditorStore.setBlocks(mappedBlocks)
      │
      ▼
iframe.postMessage("SYNC_BLOCKS", mappedBlocks)
      │
      ▼
Editor re-renders với template mới, Undo button hiện ra
```

### Undo Flow

```
User clicks Undo
      │
      ▼
TemplateUndoManager.restoreSnapshot()
      │
      ▼
EditorStore.setBlocks(previousBlocks)
      │
      ▼
iframe.postMessage("SYNC_BLOCKS", previousBlocks)
      │
      ▼
Undo button ẩn đi (snapshot cleared)
```

### Save → Clear Undo

```
User clicks Save
      │
      ▼
Modal cảnh báo: "Không thể hoàn tác sau khi lưu"
      │ Confirm
      ▼
PATCH /api/sites/:siteId  ← Lưu blocks hiện tại
      │
      ▼
TemplateUndoManager.clearSnapshot()  ← Xoá điểm Undo
```

---

## 5. State Management

| State | Location | Type | Description |
|-------|----------|------|-------------|
| `templateModalOpen` | Zustand EditorStore | `boolean` | Đóng/mở Gallery modal |
| `previewTemplateId` | Zustand EditorStore | `string \| null` | Template đang preview |
| `undoSnapshot` | `TemplateUndoManager` (singleton) | `Block[] \| null` | Snapshot blocks trước khi apply |
| `hasUndoAvailable` | Zustand EditorStore | `boolean` | Hiện/ẩn nút Undo |
| `templateList` | React Query cache | `Template[]` | Danh sách templates từ API |

---

## 6. API Design

### GET Templates (Browse)
```
GET /api/templates?category={category}

Response:
{
  success: true,
  data: [
    {
      id: string,
      name: string,
      category: "fb" | "sports" | "beauty" | "tech" | "news" | "portfolio",
      thumbnailUrl: string,
      previewUrl: string,   // URL cho iframe preview
      blocks: Block[]       // Template block schema
    }
  ]
}
```

### POST AI Template Search
```
POST /api/ai/template-search

Request:
{
  query: string             // "tìm mẫu cho nhà hàng sang trọng"
}

Response:
{
  success: true,
  data: Template[]          // Danh sách templates phù hợp
}
```

---

## 7. Database / Collection Changes

| Collection | Change | Fields |
|-----------|--------|--------|
| `templates` (Payload CMS) | EXISTING / EXPAND | Thêm field `category`, `thumbnailUrl`, `previewUrl`, `blocks[]` |
| `sites` | NO CHANGE | Smart mapping chỉ update `blocks[]` trong site khi Apply |

### Template Quality Standard
- **Loại**: Tối thiểu 10 templates đa ngành nghề
- **Weight**: Medium/Optimized — mỗi template không quá 20 blocks
- **Image**: Dùng placeholder optimized hoặc WebP ≤ 200KB mỗi ảnh
- **Font**: Tối đa 2 font families để không ảnh hưởng LCP

---

## 8. ContentMapper Logic

```typescript
// lib/editor/contentMapper.ts

function mapContent(userBlocks: Block[], templateBlocks: Block[]): Block[] {
  return templateBlocks.map(templateBlock => {
    // Tìm block cùng type từ user content
    const matchedUserBlock = userBlocks.find(
      b => b.blockType === templateBlock.blockType
    );
    if (!matchedUserBlock) return templateBlock; // fallback to template default

    return {
      ...templateBlock,          // Layout/style từ template mới
      content: matchedUserBlock.content, // Nội dung từ user
    };
  });
}
```

---

## 9. Error Handling Matrix

| Error | HTTP Code | User Message | Recovery |
|-------|-----------|-------------|----------|
| Template API fail | 503 | "Không tải được danh sách template" | Retry button |
| AI Search fail | 500 | "AI Search tạm thời không khả dụng, hãy dùng bộ lọc thủ công" | Hiện browse mode |
| Apply timeout | — | Toast: "Đang áp dụng, vui lòng chờ..." | Auto-retry 1x |
| Undo fail (no snapshot) | — | Undo button bị disabled | — |

---

## 10. Security Considerations

- [x] Auth required → JWT (Editor route đã yêu cầu auth)
- [x] Tenant-scoped access → Template AI apply chỉ update site thuộc tenantId hiện tại
- [x] Input validation → Zod schema cho AI search query (max 200 chars)

---

## 11. Performance Considerations

- **Template thumbnails**: Lazy-loaded, dùng `next/image` với `priority={false}`
- **Preview iframe**: Load theo demand (chỉ khi user click Preview)
- **AI Search**: Debounce 500ms trên input trước khi gọi API
- **ContentMapper**: Chạy synchronous phía client, không cần server round-trip
- **Transition animation**: CSS-only fade/slide, không JS-heavy library

---

## 12. Testing Strategy

| Type | What to Test | Tool |
|------|-------------|------|
| Unit | `ContentMapper.run()` — mapping logic đúng với nhiều block types | Jest |
| Unit | `TemplateUndoManager` — save, restore, clear snapshot | Jest |
| Integration | `POST /api/ai/template-search` trả đúng kết quả | Jest + Payload test |
| E2E | Luồng đầy đủ: Mở Gallery → Search → Preview → Apply → Undo → Save | Playwright |

---

## 13. Migration / Rollback Plan

- **Migration**: Seed ≥ 10 templates vào Payload CMS `templates` collection trước khi deploy.
- **Feature flag**: Có thể ẩn `TemplatesButton` bằng env `NEXT_PUBLIC_ENABLE_TEMPLATE_GALLERY=false` nếu cần rollback.
- **Rollback**: Tắt feature flag, không ảnh hưởng dữ liệu site hiện có.
