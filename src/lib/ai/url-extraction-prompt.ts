/**
 * System + user prompts for GPT-4o-mini URL extraction.
 * Extracts structured BusinessInfo from scraped website content.
 */

const EXTRACTION_SYSTEM_PROMPT = `You extract structured business information from website content.
Output JSON matching this exact schema:
{
  "businessName": "string — business/company name",
  "industry": "string — one of: business, ecommerce, restaurant, tech, health, education, realestate, fitness, creative, beauty, blog",
  "shortDescription": "string — 1-2 sentence business description",
  "products": "string — comma-separated products/services offered",
  "suggestedTheme": {
    "primaryColor": "#hex — dominant brand color if detectable from meta theme-color or content hints",
    "secondaryColor": "#hex — accent color if detectable",
    "siteType": "string — same enum as industry"
  },
  "detectedLanguage": "en|ms|vi — based on content language",
  "confidence": "high|medium|low"
}

Rules:
- If a field is not detectable, use empty string (never null)
- Detect language from the Language field in META section first, then analyze content
- For industry, pick the closest match from the enum list
- For colors, only include if clearly present in meta theme-color or described in content
- confidence: high = 4/4 main fields filled, medium = 2-3 filled, low = 0-1 filled
- businessName: prefer og:site_name or title tag, strip suffixes like " | Home" or " - Official"
- shortDescription: prefer meta description, otherwise summarize first paragraph
- products: extract from headings, feature lists, menu items, service descriptions
- Keep all output concise and factual — do not invent or hallucinate content`

export function buildExtractionPrompt(preprocessedText: string): {
    system: string
    user: string
} {
    return {
        system: EXTRACTION_SYSTEM_PROMPT,
        user: `Analyze this website content and extract business information:\n\n${preprocessedText}`,
    }
}
