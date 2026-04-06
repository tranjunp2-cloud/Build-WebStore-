# Phase 1: ContentBrief Type + URL Extractor Upgrade

> Parent: [plan.md](plan.md) | Parallel Group: A (independent)

## Overview
| Field | Value |
|-------|-------|
| Priority | P0 |
| Status | pending |
| Effort | ~4h |
| Parallel with | Phase 2 |

## Key Insight

Current URL extraction returns only 4 fields. Scraped content (headings, paragraphs, features, testimonials) is discarded. Need to:
1. Define `ContentBrief` type as unified IR for all input sources
2. Upgrade URL extractor to produce full ContentBrief with reference content

## File Ownership (exclusive)
- `src/lib/ai/content-brief.ts` (NEW)
- `src/lib/ai/url-scraper.ts` (modify)
- `src/lib/ai/url-extraction-prompt.ts` (modify)
- `src/app/api/ai/extract-from-url/route.ts` (modify)

## ContentBrief Type

```typescript
export type ContentBrief = {
  // Basic info (existing 4 fields)
  businessInfo: {
    businessName: string
    industry: string
    shortDescription: string
    products: string
  }

  // NEW: Reference content from source website/image
  referenceContent: {
    heroHeadline?: string
    heroSubheadline?: string
    heroCtaText?: string
    aboutText?: string
    featuresList?: { title: string; description: string }[]
    testimonials?: { quote: string; name: string; role?: string }[]
    pricingPlans?: { name: string; price: string; features: string[] }[]
    faqItems?: { question: string; answer: string }[]
    contactInfo?: { phone?: string; email?: string; address?: string }
    footerText?: string
  }

  // NEW: Visual style hints
  visualStyle: {
    primaryColor?: string
    secondaryColor?: string
    fontStyle?: 'modern' | 'classic' | 'playful' | 'minimal'
    layoutStyle?: 'centered' | 'split' | 'fullwidth'
    mood?: string // "professional", "warm", "bold"
  }

  // NEW: Block mapping suggestions
  suggestedBlocks?: string[] // e.g., ['hero', 'features', 'testimonials', 'pricing', 'contact']

  // Metadata
  source: 'url' | 'image' | 'video' | 'text'
  sourceUrl?: string
  language: 'en' | 'ms' | 'vi'
  confidence: 'high' | 'medium' | 'low'
}
```

## Implementation Steps

### 1. Create `src/lib/ai/content-brief.ts`
- Define ContentBrief type
- Helper: `contentBriefToExtraInstructions(brief)` — serialize reference content for GPT-4o prompt
- Helper: `contentBriefToBusinessInfo(brief)` — extract 4 fields for backward compat

### 2. Upgrade URL extraction prompt
Current prompt extracts only 4 fields. New prompt extracts:
- All 4 fields (unchanged)
- Hero text (headline, subheadline, CTA)
- About section text
- Features/services list (title + description for each)
- Testimonials (quote + name)
- Contact info (phone, email, address)
- Visual hints (primary color, mood)
- Suggested block order

### 3. Upgrade `extract-from-url/route.ts`
- Return full ContentBrief instead of just ExtractionResult
- Pass scraped headings/text as context to GPT-4o-mini for content mapping
- Include `referenceContent` in API response

### 4. Update url-scraper to extract more structure
- Extract contact info (phone, email patterns in text)
- Identify testimonial patterns (quote + name)
- Detect pricing sections
- Pass structured data to extraction prompt

## Success Criteria
- [ ] ContentBrief type defined and exported
- [ ] URL extraction returns full ContentBrief with referenceContent
- [ ] `contentBriefToExtraInstructions()` produces reference text for generator
- [ ] Backward compatible (existing 4-field flow still works)

## Todo
- [ ] Create `src/lib/ai/content-brief.ts` with ContentBrief type
- [ ] Add `contentBriefToExtraInstructions()` helper
- [ ] Add `contentBriefToBusinessInfo()` helper
- [ ] Add ContentBrief Zod schema to `src/lib/validations/ai.ts`
- [ ] Upgrade extraction prompt to extract referenceContent + visualStyle
- [ ] Upgrade `extract-from-url/route.ts` to return ContentBrief
- [ ] Test with real URL: verify referenceContent populated

## Risk Assessment
- GPT-4o-mini token limit: extraction prompt with full content may exceed. Mitigation: truncate to 8000 chars.
- Extraction quality: GPT-4o-mini may mismap content to wrong sections. Mitigation: validate with Zod defaults.

## Security Considerations
- Scraped content passes through existing content safety filter before AI processing
- No user-provided content stored in DB (stateless extraction)

## Next Steps
→ Phase 3: Enhanced Generator uses ContentBrief to generate high-fidelity blocks
