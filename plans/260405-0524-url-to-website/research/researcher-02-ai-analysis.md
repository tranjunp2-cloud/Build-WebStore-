# Research: AI Analysis of Scraped Website Content

## 1. Prompt Engineering Strategy

### Recommended: Two-Phase Extraction Prompt

Use a single GPT-4o call with a structured system prompt that maps scraped content directly to the existing `BusinessInfoInput` + `theme` + `blocks` schema.

**System prompt structure:**

```
You are an AI that analyzes scraped website content and extracts structured business data.
Input: raw text content from a website (already stripped of HTML tags).
Output: JSON matching the exact schema below.
```

**Key extraction targets (mapped to existing codebase types):**

| Target | Maps to | Source signals |
|--------|---------|---------------|
| Business name | `businessInfo.businessName` | `<title>`, `<h1>`, logo alt text, og:site_name |
| Industry | `businessInfo.industry` | Keywords in headings, meta description, nav labels |
| Description | `businessInfo.shortDescription` | meta description, og:description, first paragraph |
| Products/services | `businessInfo.products` | Repeated section headings, feature lists, menu items |
| Primary color | `theme.primaryColor` | Most frequent non-white/black color in inline styles |
| Secondary color | `theme.secondaryColor` | Second most frequent accent color |
| Font preference | `theme.fontHeading` | Google Fonts link, font-family CSS declarations |
| Site type | `siteType` | Nav structure, block pattern (menu = restaurant, cart = ecommerce) |
| Language | `language` | `<html lang>`, meta charset context, content language detection |

**Content-to-block mapping rules in prompt:**

```
- First large heading + subtext + button → hero block
- "About"/"About Us" section → about block
- Repeated card patterns (3-6 items with icon+title+desc) → features block
- Quote + name + role pattern → testimonials block
- "Contact"/"Get in Touch" + form fields → contact block
- Price + plan name + feature list → pricing block
- Question + answer pairs → faq block
```

### Language Detection

Embed in system prompt: "Detect language from content. Set `language` to `ms` if Bahasa Melayu, `vi` if Vietnamese, `en` otherwise. Use `<html lang>` attribute as primary signal, fall back to content analysis."

## 2. Token Optimization

### Pre-processing Pipeline (BEFORE sending to GPT-4o)

```typescript
function preprocessForAI(rawHtml: string): string {
  // 1. Strip <script>, <style>, <svg>, <noscript> tags entirely
  // 2. Strip HTML comments
  // 3. Extract key meta tags: title, description, og:*, theme-color
  // 4. Extract <html lang="..."> attribute
  // 5. Extract Google Fonts URL from <link> tags
  // 6. Extract inline color values from first <style> block (CSS custom properties)
  // 7. Strip all remaining HTML tags, keep text content
  // 8. Collapse whitespace (multiple spaces/newlines → single space)
  // 9. Truncate to 6000 chars (body) + 500 chars (meta header)
}
```

**Token budget breakdown:**

| Component | Chars | ~Tokens | Notes |
|-----------|-------|---------|-------|
| System prompt | 1500 | 400 | Reusable, cached by OpenAI |
| Meta header (title, desc, og, fonts, colors) | 500 | 130 | High-signal, always include |
| Body text (truncated) | 6000 | 1600 | Main content |
| JSON schema definition | 800 | 200 | Output format spec |
| **Total input** | **8800** | **~2330** | |
| Output (BusinessInfo JSON) | 2000 | ~500 | Structured extraction |
| **Total per call** | | **~2830** | |

**Cost estimation:**

| Model | Input cost | Output cost | Total/call |
|-------|-----------|-------------|------------|
| GPT-4o | $0.0058 | $0.005 | ~$0.011 |
| GPT-4o-mini | $0.00035 | $0.0006 | ~$0.001 |

**Recommendation:** Use **GPT-4o-mini** for extraction. The task is structured data extraction, not creative generation. Quality is sufficient and cost is 10x lower. Reserve GPT-4o for the subsequent site generation call (already implemented).

### Structured Output (JSON mode)

Use `response_format: { type: "json_object" }` (already used in `openai-generator.ts`). This is sufficient -- full JSON Schema mode (`json_schema`) adds complexity without meaningful benefit here since we validate with Zod after parsing.

## 3. Two-Step vs One-Step Approach

### Recommendation: Two-Step (Option A)

```
Scrape → GPT-4o-mini extracts BusinessInfo → Feed to existing generate-site → Full site
```

**Comparison:**

| Criteria | Option A (Two-Step) | Option B (One-Step) |
|----------|-------------------|-------------------|
| Cost | $0.001 + $0.04 = $0.041 | $0.06-0.08 (bigger prompt) |
| Reusability | Extraction reusable for other flows | Tightly coupled |
| Error isolation | Can retry each step independently | All-or-nothing |
| Existing code reuse | 100% reuse of `generateSiteWithAI()` | Must rewrite prompt + sanitizer |
| User review | User can edit extracted info before generation | No review step |
| Quality | GPT-4o for generation (proven) | Bigger context = slightly lower quality |
| Latency | ~3s + ~8s = 11s total | ~12s (one call but larger) |
| Token efficiency | Optimized per step | Wasteful (scrape text in generation prompt) |

**Why Option A wins:**

1. **Zero changes to core AI pipeline.** `generateSiteWithAI()`, `sanitizeBlocksForPayload()`, `buildGeneratedPages()` all stay untouched.
2. **User gets a review step.** After extraction, show pre-filled business info form. User corrects mistakes before generation.
3. **Extraction can use GPT-4o-mini** ($0.001) while generation stays on GPT-4o ($0.04). One-step forces GPT-4o for everything.
4. **Better error messages.** If extraction fails ("this doesn't look like a business website"), user gets clear feedback before wasting a generation credit.

### Implementation Architecture

```
[URL Input] → [Scraper Service] → [AI Extraction (GPT-4o-mini)]
                                          ↓
                                   BusinessInfoInput {
                                     businessName, industry,
                                     products, shortDescription
                                   } + theme hints + language
                                          ↓
                              [Pre-filled Builder Form]
                              (user reviews & edits)
                                          ↓
                              [Existing generate-site API]
                              (unchanged, GPT-4o)
```

## 4. Error Handling & Fallbacks

### Scenario Matrix

| Scenario | Detection | Response |
|----------|-----------|----------|
| Minimal content (<200 chars after strip) | Check text length post-preprocessing | Return partial extraction + flag `confidence: "low"` |
| Not a business site (social media, wiki, etc.) | GPT-4o-mini returns `siteType: "unknown"` | Show warning: "This doesn't appear to be a business website. You can still edit the extracted info." |
| Non-English/Malay content | Language detection returns unsupported | Extract what's possible, default language to `en` |
| Scrape blocked (403/captcha) | HTTP status check | "We couldn't access this website. Please enter your business info manually." |
| AI extraction returns garbage | Zod validation fails on response | Fall back to empty form with just the URL as context |
| Site has only images (no text) | Body text <50 chars | "This website is mostly images. Please describe your business manually." |

### Confidence Score

Add a `confidence` field to extraction response:

```typescript
type ExtractionResult = {
  businessInfo: Partial<BusinessInfoInput>
  theme: Partial<ThemeHints>
  language: 'en' | 'ms' | 'vi'
  confidence: 'high' | 'medium' | 'low'
  warnings: string[]
}
```

- **high**: All 4 BusinessInfo fields extracted, >500 chars source text
- **medium**: 2-3 fields extracted, or short source text
- **low**: Only 1 field or very sparse content

## 5. OpenAI Structured Outputs

### Recommended Approach

Use `response_format: { type: "json_object" }` with explicit schema in the system prompt (same pattern as existing `openai-generator.ts`). Post-validate with Zod.

```typescript
const extractionSchema = z.object({
  businessName: z.string().default(''),
  industry: z.string().default(''),
  shortDescription: z.string().default(''),
  products: z.string().default(''),
  suggestedColors: z.object({
    primary: z.string().optional(),
    secondary: z.string().optional(),
  }).optional(),
  detectedLanguage: z.enum(['en', 'ms', 'vi']).default('en'),
  siteType: z.enum(['business', 'ecommerce', 'restaurant', 'portfolio', 'blog']).default('business'),
  confidence: z.enum(['high', 'medium', 'low']).default('medium'),
})
```

**Why not `json_schema` mode:** It requires defining the full schema in OpenAI's format (redundant with Zod), adds ~200 tokens to request, and `json_object` mode already guarantees valid JSON. The schema-in-prompt + Zod-validation pattern is battle-tested in this codebase.

## 6. Summary & Recommendations

| Decision | Recommendation |
|----------|---------------|
| Approach | Two-step: Extract → Review → Generate |
| Extraction model | GPT-4o-mini ($0.001/call) |
| Generation model | GPT-4o ($0.04/call, unchanged) |
| Total cost per URL-to-site | ~$0.041 |
| Pre-processing | Strip HTML → meta header + truncated body text (6500 chars) |
| Output format | `json_object` mode + Zod validation |
| New API endpoint | `POST /api/ai/extract-business-info` |
| New AI task in config.ts | `'url-extraction'` → GPT-4o-mini |
| Error strategy | Confidence scoring + graceful fallback to manual form |
| Codebase impact | Zero changes to existing generate-site pipeline |
