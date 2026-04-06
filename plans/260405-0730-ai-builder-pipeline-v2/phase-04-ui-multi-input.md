# Phase 4: UI — Multi-Input Tabs (URL/Image/Text)

> Parent: [plan.md](plan.md) | Parallel Group: B (depends on Phase 1+2, parallel with Phase 3)

## Overview
| Field | Value |
|-------|-------|
| Priority | P1 |
| Status | pending |
| Effort | ~6h |
| Depends on | Phase 1, Phase 2 |
| Parallel with | Phase 3 |

## Key Insight

Current UI has 2 tabs (Manual / URL). Need to add Image tab. Video tab deferred to v3.

## File Ownership (exclusive)
- `src/components/builder/BusinessInfoForm.tsx` (modify)
- `src/store/builderStore.ts` (modify)
- `src/lib/validations/ai.ts` (modify)
- `src/i18n/locales/en.json` (modify)
- `src/i18n/locales/ms.json` (modify)

## UI Layout

```
┌──────────────────────────────────────────────────┐
│  [✏️ Describe] [🔗 From URL] [📷 From Image]     │
│  ─────────────────────────────────────────────── │
│                                                   │
│  (Tab content based on selection)                 │
│                                                   │
│  Manual: existing 4-field form                    │
│  URL: URL input + Extract button                  │
│  Image: Drop zone + upload + Extract button       │
│                                                   │
└──────────────────────────────────────────────────┘
```

## Implementation Steps

### 1. Update `inputMode` type
```typescript
type InputMode = 'manual' | 'url' | 'image'
```

### 2. Add Image upload component
- Drag-and-drop zone (shadcn pattern)
- Accept: PNG, JPEG, WebP (max 10MB)
- Show preview thumbnail after selection
- "Extract" button calls `POST /api/ai/extract-from-image`

### 3. Wire ContentBrief through the flow
- After extraction (URL or Image) → receive ContentBrief from API
- Store ContentBrief in component state
- When generating: pass ContentBrief to generate-site endpoint
- Generate-site uses `referenceContent` for high-fidelity output

### 4. Update BusinessInfo type
```typescript
export type BusinessInfo = {
  // existing fields...
  businessUrl?: string
  source?: 'form' | 'url' | 'image'
  contentBrief?: ContentBrief // NEW: passed to generate-site
}
```

### 5. Add i18n keys for Image tab
```json
{
  "tabImage": "From Image",
  "imageLabel": "Website Screenshot",
  "imagePlaceholder": "Drop image here or click to upload",
  "imageHint": "Upload a screenshot of the website you want to recreate",
  "imageExtracting": "Analyzing image..."
}
```

## Success Criteria
- [ ] 3 tabs work: Manual, URL, Image
- [ ] Image upload + extract produces ContentBrief
- [ ] ContentBrief passed to generation → high-fidelity output
- [ ] Mobile responsive (image upload works on mobile)
- [ ] i18n complete (EN + MS)

## Conflict Prevention
- Only modifies UI/state files (no AI core files)
- Phase 3 owns generator files, Phase 4 owns UI files
- Interface: ContentBrief type defined in Phase 1, consumed by both
