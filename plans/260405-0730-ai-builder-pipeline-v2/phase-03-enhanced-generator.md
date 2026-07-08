# Phase 3: Enhanced Generator — ContentBrief → High-Fidelity Blocks

> Parent: [plan.md](plan.md) | Parallel Group: B (depends on Phase 1+2)

## Overview
| Field | Value |
|-------|-------|
| Priority | P0 — Core quality improvement |
| Status | pending |
| Effort | ~4h |
| Depends on | Phase 1 only |

## Key Insight

Current generator creates NEW content from 4 fields. Enhanced generator uses ContentBrief's `referenceContent` as source material — GPT-4o **adapts** existing content into blocks instead of inventing new content. This is the key change that moves fidelity from ~35% to ~70%.

## File Ownership (exclusive)
- `src/lib/ai/system-prompt.ts` (modify)
- `src/lib/ai/openai-generator.ts` (modify)
- `src/app/api/ai/generate-site/route.ts` (modify)

## Architecture

```
ContentBrief
    ├── businessInfo → buildUserPrompt() (existing)
    ├── referenceContent → NEW: buildReferencePrompt()
    │   "Use THIS content for each section:
    │    Hero headline: 'Premium Fashion Store'
    │    Features: [{ title: 'Free Shipping', desc: '...' }, ...]
    │    Testimonials: [{ quote: '...', name: 'Ali' }, ...]"
    ├── visualStyle → theme hints in prompt
    └── suggestedBlocks → block order constraint
         ↓
    GPT-4o: "Generate blocks using the EXACT content provided.
             Do NOT invent new content. Adapt and structure it."
         ↓
    Blocks with REAL content from source website
```

## Implementation Steps

### 1. Add `buildReferencePrompt()` to `system-prompt.ts`

```typescript
export function buildReferencePrompt(brief: ContentBrief): string {
  const sections: string[] = []

  if (brief.referenceContent.heroHeadline) {
    sections.push(`HERO SECTION:
  Headline: "${brief.referenceContent.heroHeadline}"
  Subheadline: "${brief.referenceContent.heroSubheadline || ''}"
  CTA Button: "${brief.referenceContent.heroCtaText || 'Get Started'}"`)
  }

  if (brief.referenceContent.featuresList?.length) {
    sections.push(`FEATURES/SERVICES:
${brief.referenceContent.featuresList.map(f => `  - ${f.title}: ${f.description}`).join('\n')}`)
  }

  // ... similar for testimonials, pricing, FAQ, contact

  if (brief.visualStyle.primaryColor) {
    sections.push(`VISUAL STYLE:
  Primary Color: ${brief.visualStyle.primaryColor}
  Mood: ${brief.visualStyle.mood || 'professional'}`)
  }

  return sections.length > 0
    ? `\n## REFERENCE CONTENT (from source website — USE THIS CONTENT, do not invent new)
${sections.join('\n\n')}`
    : ''
}
```

### 2. Update `buildUserPrompt()` to accept ContentBrief

```typescript
export function buildUserPrompt(
  info: BusinessInfoInput,
  extraInstructions?: string,
  language?: string,
  referenceContent?: string, // NEW: from buildReferencePrompt()
): string {
  // ... existing logic ...
  if (referenceContent) {
    parts.push(referenceContent)
    parts.push('\nIMPORTANT: Use the EXACT text from reference content above. Do not invent or paraphrase.')
  }
}
```

### 3. Update `generateSiteWithAI()` to accept ContentBrief

```typescript
export async function generateSiteWithAI(
  businessInfo: BusinessInfoInput,
  extraInstructions?: string,
  language?: string,
  contentBrief?: ContentBrief, // NEW
)
```

### 4. Wire ContentBrief in `generate-site/route.ts`

- Check if `businessInfo.businessUrl` or `businessInfo.source === 'url'`
- If ContentBrief passed (via request body or extracted during flow)
- Build reference prompt and pass to generator

### 5. Update system prompt rules

Add to system prompt:
```
## REFERENCE MODE
When reference content is provided:
- Use the EXACT headlines, descriptions, and feature text from the reference
- Match the section ORDER from the reference (hero first, then features, etc.)
- Adapt testimonials and pricing to our block schema but keep original text
- Use the visual style hints for theme colors
- Only generate NEW content for sections not in the reference
```

## Success Criteria
- [ ] URL-generated website uses REAL content from source (not invented)
- [ ] Hero headline matches source website's headline
- [ ] Features list contains actual features from source
- [ ] Theme colors match suggested colors
- [ ] Fidelity: ~70% match with source website
- [ ] Backward compatible: text-only input still works (no ContentBrief)

## Todo
- [ ] Add `buildReferencePrompt(brief)` to system-prompt.ts
- [ ] Update `buildUserPrompt()` to accept referenceContent param
- [ ] Update `generateSiteWithAI()` to accept ContentBrief
- [ ] Wire ContentBrief from request body → generator in generate-site/route.ts
- [ ] Update BusinessInfoForm to pass contentBrief when generating from URL
- [ ] Update builderStore to store contentBrief
- [ ] Add REFERENCE MODE rules to system prompt
- [ ] Test: URL extraction → generation uses real content from source

## Risk Assessment
- Token limit: ContentBrief reference text + system prompt may exceed GPT-4o context. Mitigation: truncate referenceContent to 4000 chars, prioritize hero + features.
- Content quality: GPT-4o may still rephrase reference content. Mitigation: strong prompt instruction "EXACT text, do not paraphrase."

## Security Considerations
- Reference content already safety-checked in Phase 1 extraction
- No new attack vectors (same OpenAI API calls)

## Next Steps
→ Test with real URLs and measure fidelity improvement
→ Phase 2+4 (deferred): Image input + multi-input UI
