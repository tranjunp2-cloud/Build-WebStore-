# Research: AI Builder Pipeline v2 — Multi-Source Generation Architecture

## 1. Pipeline Architecture Patterns

### Industry Standard: Unified IR (Intermediate Representation)

The dominant pattern across v0.dev, Bolt.new, Lovable, and Websim is **source-specific extractors feeding a common schema, then a single generator**:

```
[URL] → URL Extractor → ┐
[Image] → Vision Analyzer → ├─→ Unified ContentBrief → AI Generator → Block JSON
[Video] → Frame Extractor → ┤
[Text] → Text Parser ───→ ┘
```

**Why this wins over source-specific generators:**
- Single system prompt to maintain (not 4 separate ones)
- Consistent output quality regardless of input source
- Easier to combine inputs (e.g., URL + extra text instructions)
- The generator only needs to know about `ContentBrief`, not about scraping/vision/OCR

### Proposed ContentBrief Schema (IR)

```typescript
type ContentBrief = {
  // Identity
  businessName: string
  industry: string
  tagline: string
  description: string
  products: string[]

  // Visual Reference (from image/video/URL)
  visualReference?: {
    layout: 'single-page' | 'multi-section' | 'grid-heavy' | 'text-heavy'
    sections: SectionHint[]         // detected sections with content
    colorPalette: string[]          // extracted hex colors
    typography?: { heading: string; body: string }
    mood: string                    // "corporate", "playful", "luxury", etc.
  }

  // Content Mapping (from URL scrape)
  contentMapping?: {
    hero: { headline: string; subline: string; cta: string }
    features: { title: string; description: string }[]
    about: string
    testimonials: { quote: string; author: string }[]
    contact: { address?: string; phone?: string; email?: string }
  }

  // User Intent
  extraInstructions?: string
  language: 'en' | 'ms' | 'vi'
  fidelityMode: 'clone' | 'inspired' | 'creative'
}
```

### ECH Prime Current State vs. Proposed

| Aspect | Current | Proposed |
|--------|---------|----------|
| Input sources | Text-only (businessInfo) + URL extract (separate) | Unified: URL, image, video, text |
| URL extraction | Extracts businessInfo fields only, discards structure | Extracts full ContentBrief with layout hints + content mapping |
| Generator input | `businessName + industry + products + description` | Full ContentBrief with visual + content references |
| Output fidelity | ~35% match to source | Target 70-80% with content mapping |

---

## 2. Content-Aware Generation

### The Core Problem

Current system extracts `businessName, industry, products, shortDescription` from URL — then generates a **generic** website for that industry. Source content is discarded. This is why output looks ~35% similar.

### Solution: Structured Content Mapping

Pass scraped content as **explicit section references** in the prompt:

```
REFERENCE CONTENT (from source website):
- Hero section: "Transform Your Business with AI" / "We help 500+ companies..."
- Features: ["Real-time Analytics", "Custom Dashboards", "API Integration"]
- Testimonials: ["Best tool we've used" — John, CEO at Acme]
- About: "Founded in 2020, we serve the Southeast Asian market..."

INSTRUCTION: Generate a website that uses THIS EXACT content, adapted to our block schema.
Do NOT invent new content. Rephrase only if needed for length constraints.
```

### Fidelity Modes

| Mode | Behavior | Use Case |
|------|----------|----------|
| `clone` | Use exact content from source, match layout order | "Make my website on ECH Prime" |
| `inspired` | Use source content as reference, allow AI improvements | "Build something like this but better" |
| `creative` | Use only business info, AI generates freely | Current default behavior |

---

## 3. Image-to-Website (Vision Analysis)

### How GPT-4o Vision / Claude Vision Works for This

Send screenshot to vision model with a structured extraction prompt:

```
Analyze this website screenshot. Return JSON:
{
  "sections": [
    { "type": "hero|features|about|...", "y_position": 0-100,
      "content": { "headline": "...", "description": "..." },
      "style": { "background": "dark|light|gradient|image", "layout": "centered|split|grid" }
    }
  ],
  "colorPalette": ["#hex1", "#hex2", ...],
  "typography": { "heading": "serif|sans-serif|display", "body": "serif|sans-serif" },
  "mood": "corporate|playful|luxury|minimal|bold"
}
```

### Key Techniques

1. **Layout detection**: Vision models reliably identify grid vs. single-column, split layouts, full-width sections
2. **Color extraction**: Ask for dominant 3-5 colors — models are ~90% accurate on hex values from screenshots
3. **Component identification**: Models correctly identify navbar, hero, card grids, testimonial carousels, footers in >85% of cases
4. **Text extraction (OCR)**: GPT-4o extracts visible text at ~95% accuracy, including headlines, button labels, descriptions
5. **Spacing/sizing**: Models can estimate relative proportions but NOT exact pixel values — use for "mood" not measurements

### Implementation for ECH Prime

```typescript
// New extractor: src/lib/ai/image-extractor.ts
async function extractFromImage(imageUrl: string): Promise<ContentBrief> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: imageUrl } },
        { type: 'text', text: IMAGE_EXTRACTION_PROMPT }
      ]
    }],
    response_format: { type: 'json_object' },
    max_tokens: 4000,
  })
  return parseToContentBrief(response)
}
```

---

## 4. Video-to-Website

### Approach: Frame Extraction + Multi-Frame Analysis

Videos of websites (scrolling demos, product tours) contain multiple "views" of the same site.

**Pipeline:**
1. Extract frames at 1fps using ffmpeg (or browser-side canvas capture)
2. Deduplicate similar frames (perceptual hash / SSIM threshold > 0.95)
3. Select 3-5 "key frames" that represent distinct sections
4. Send all key frames to vision model in a single multi-image prompt
5. Model synthesizes a complete site structure from all frames

### Key Frame Selection Strategy

```
Frame score = content_uniqueness * 0.4 + text_density * 0.3 + visual_clarity * 0.3
```

- **Content uniqueness**: How different is this frame from previously selected frames
- **Text density**: Frames with more visible text are more valuable
- **Visual clarity**: Sharp, non-transitional frames (no scroll blur)

### Practical Limits

- Cost: 5 frames x GPT-4o vision ~ $0.15-0.25 per video analysis
- Best for: screen recordings, product demos, Loom-style walkthroughs
- Poor for: animated marketing videos, non-website content
- Maximum useful frames: 8 (beyond this, diminishing returns)

### MVP Recommendation

For v1, skip server-side video processing. Instead:
- Accept video URL, extract thumbnail frame only (YouTube/Vimeo API)
- Or: let user upload a screenshot instead (simpler, cheaper, more reliable)
- Phase 2: add ffmpeg frame extraction for uploaded MP4/WebM

---

## 5. Prompt Engineering for High-Fidelity Output

### Why Current Output is ~35% Similar

The current system prompt says "generate a website for X industry" — it gives the AI **creative freedom** instead of **reference material**. The AI hallucinates generic content.

### High-Fidelity Prompt Structure

```
## ROLE
You are a website cloner. Your job is to RECREATE the source website
using our block system, preserving content and visual feel.

## SOURCE CONTENT (use this — do NOT invent new content)
${contentBrief.contentMapping}

## VISUAL REFERENCE
- Layout: ${contentBrief.visualReference.layout}
- Sections (top to bottom): ${contentBrief.visualReference.sections}
- Colors: ${contentBrief.visualReference.colorPalette}
- Mood: ${contentBrief.visualReference.mood}

## BLOCK SYSTEM (your output format)
${blockSchemas}

## FIDELITY RULES
1. Use EXACT headlines/text from SOURCE CONTENT when available
2. Match section ORDER from visual reference
3. Use extracted colors for theme.primaryColor and theme.secondaryColor
4. Choose block variants that best match the source layout
5. If source has 6 features, generate 6 features — not 3, not 8
6. Testimonial quotes must be verbatim from source
7. Only generate content freely for sections NOT found in source
```

### Key Differences from Current Prompt

| Current | High-Fidelity |
|---------|--------------|
| "Generate realistic content" | "Use EXACT content from source" |
| AI picks section order | Section order from visual reference |
| AI picks colors by industry | Colors extracted from source |
| AI decides block count | Block count matches source sections |
| No content mapping | Explicit field-to-block mapping |

### Token Budget Consideration

- Current: ~2K tokens (system + user prompt)
- With ContentBrief: ~4-6K tokens (adds content mapping + visual reference)
- Still well within GPT-4o's context (128K) and output (8K) limits
- Cost increase: ~$0.02 per generation (negligible)

---

## 6. Recommended Implementation Order

1. **ContentBrief schema** — define the IR type (`src/lib/ai/types.ts`)
2. **Upgrade URL extractor** — return full ContentBrief with content mapping (not just businessInfo)
3. **New system prompt v2** — support fidelity modes, accept content references
4. **Image extractor** — GPT-4o vision → ContentBrief
5. **Builder UI** — add image upload + input mode selector
6. **Video support** — thumbnail extraction only for MVP

---

## 7. Cost Estimate Per Generation

| Input Source | API Calls | Est. Cost |
|-------------|-----------|-----------|
| Text only (current) | 1x GPT-4o + 1x DALL-E | ~$0.08 |
| URL → ContentBrief | 1x GPT-4o-mini (extract) + 1x GPT-4o (generate) + 1x DALL-E | ~$0.10 |
| Image → ContentBrief | 1x GPT-4o-vision (extract) + 1x GPT-4o (generate) + 1x DALL-E | ~$0.15 |
| Video → ContentBrief | 5x GPT-4o-vision frames + 1x GPT-4o (generate) + 1x DALL-E | ~$0.30 |
