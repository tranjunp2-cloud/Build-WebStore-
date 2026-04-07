# Phase 2: Image/Screenshot Extractor (GPT-4o Vision)

> Parent: [plan.md](plan.md) | Parallel Group: A (independent, parallel with Phase 1)

## Overview
| Field | Value |
|-------|-------|
| Priority | P1 |
| Status | pending |
| Effort | ~4h |
| Parallel with | Phase 1 |

## Key Insight

GPT-4o Vision can analyze screenshots with high accuracy — extract layout, colors, text, components. Single API call returns structured data matching ContentBrief.

## File Ownership (exclusive)
- `src/lib/ai/vision-extractor.ts` (NEW)
- `src/app/api/ai/extract-from-image/route.ts` (NEW)

## Implementation Steps

### 1. Create `src/lib/ai/vision-extractor.ts`

```typescript
export async function extractFromImage(
  imageBase64: string,
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp'
): Promise<ContentBrief>
```

- Send image to GPT-4o Vision with structured extraction prompt
- Prompt asks AI to identify: layout sections, text content, colors, components
- Map detected sections to block types
- Return ContentBrief

### 2. Vision extraction prompt

```
Analyze this website screenshot and extract:
1. Business name and industry
2. Each visible section (hero, features, testimonials, etc.)
3. ALL text content per section (headlines, descriptions, button labels)
4. Color palette (primary, secondary, background)
5. Layout style (centered, split, fullwidth)
6. Font style hint (modern, classic, playful)

Output JSON matching ContentBrief schema...
```

### 3. Create `POST /api/ai/extract-from-image`

- Accept multipart/form-data with image file
- Validate: max 10MB, image/* content type
- Auth + rate limit (same as URL extraction)
- Call `extractFromImage()`
- Return ContentBrief

### 4. Cost estimation
- GPT-4o Vision: ~$0.01-0.03 per image (depends on resolution)
- Recommend: resize to max 1024px before sending

## Success Criteria
- [ ] Screenshot uploaded → ContentBrief returned
- [ ] Text content extracted from image
- [ ] Colors detected
- [ ] Layout structure identified
- [ ] Works with PNG, JPEG, WebP

## Risk
- Vision quality varies with screenshot resolution → resize to consistent size
- Complex layouts may confuse AI → fallback to basic extraction
