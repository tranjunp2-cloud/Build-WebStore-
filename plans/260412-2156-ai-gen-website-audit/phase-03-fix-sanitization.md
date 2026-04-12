# Phase 03: Fix Sanitization to Preserve Variety

## Context
- Parent: [plan.md](plan.md)
- Depends on: Phase 01 (audit data), Phase 02 (better AI output)
- File: `src/lib/ai/openai-generator.ts` (lines 232-561)
- Priority: P1
- Status: pending

## Overview
Sanitizer at lines 255-261 silently replaces ALL invalid variants with `meta.defaultVariant || meta.variants[0]`. This kills variety even when AI tries creative choices.

## Key Insights
- No logging — we never know how much variety is killed
- Case sensitivity — AI might return "Grid-3" instead of "grid-3"
- All invalid variants collapse to SAME default per block type
- Gallery images (line 523) and logo-cloud (line 530) always emptied

## Implementation Steps

### 3.1 Replace Hard Fallback with Smart Matching (lines 255-261)

```typescript
if (!meta.variants.includes(s.variant)) {
    // Try case-insensitive match first
    const lowerVariant = s.variant.toLowerCase().replace(/[_\s]/g, '-')
    const matched = meta.variants.find(v => v.toLowerCase() === lowerVariant)

    if (matched) {
        s.variant = matched  // Preserve AI intent
    } else {
        // Log replacement for audit
        console.warn(`[AI Sanitizer] "${s.blockType}": "${s.variant}" -> random (not in [${meta.variants.join(', ')}])`)
        // Random valid variant instead of always defaulting
        s.variant = meta.variants[Math.floor(Math.random() * meta.variants.length)]
    }
}
```

### 3.2 Add Fuzzy Variant Matching Helper

Handle common AI hallucination patterns:
```typescript
const VARIANT_ALIASES: Record<string, string> = {
    'three-column': 'grid-3',
    'two-column': 'grid-2',
    'four-column': 'grid-4',
    'side-by-side': 'split',
    'slider': 'carousel',
    'full-width': 'fullscreen',
    'compact': 'minimal',
}
```

### 3.3 Fix Gallery Image Stripping (line 523)

Current: `s.images = []` — always empties.
Fix: Strip only `image` sub-field if string URL, keep alt text and caption.

### 3.4 Optional: Sanitization Stats Counter

```typescript
const sanitizationStats = new Map<string, { replaced: number, total: number }>()
export function getSanitizationStats() { return Object.fromEntries(sanitizationStats) }
```

## Related Files
- `src/lib/ai/openai-generator.ts` (main target)
- `src/blocks/registry.ts` (variant source of truth)

## Todo
- [ ] Replace hard fallback with case-insensitive match + random fallback
- [ ] Add VARIANT_ALIASES map
- [ ] Add console.warn logging for replacements
- [ ] Fix gallery image stripping to preserve alt/caption
- [ ] Fix logo-cloud stripping similarly
- [ ] Optional: Add sanitization stats counter

## Success Criteria
- [ ] Case-insensitive variants preserved (e.g., "Grid-3" -> "grid-3")
- [ ] Invalid variants now get random valid variant instead of always default
- [ ] Every replacement logged with blockType + original + replacement
- [ ] Gallery blocks retain structure (even without images)

## Risk Assessment
- Low risk: fuzzy matching is additive, doesn't remove existing validation
- Random fallback might produce variants that look bad with certain content — acceptable tradeoff vs always-same-default
- Gallery fix is safe: just keeps metadata, images still need Media IDs from upload flow
