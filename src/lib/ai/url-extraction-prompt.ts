/**
 * System + user prompts for GPT-4o-mini URL extraction.
 * Extracts full ContentBrief (not just 4 fields) from scraped website content.
 */

const EXTRACTION_SYSTEM_PROMPT = `You extract detailed business information and website content from scraped web pages.
Output JSON matching this exact schema:

{
  "businessName": "string — business/company name (strip suffixes like ' | Home')",
  "industry": "string — one of: business, ecommerce, restaurant, tech, health, education, realestate, fitness, creative, beauty, blog",
  "shortDescription": "string — 1-2 sentence business description",
  "products": "string — comma-separated products/services",

  "referenceContent": {
    "heroHeadline": "string — main hero/banner headline text (verbatim from site)",
    "heroSubheadline": "string — subtitle or tagline under the hero headline",
    "heroCtaText": "string — primary call-to-action button text (e.g., 'Shop Now', 'Get Started')",
    "aboutText": "string — about us section text (1-3 sentences)",
    "featuresList": [{ "title": "Feature Name", "description": "Short description" }],
    "testimonials": [{ "quote": "Customer quote", "name": "Customer Name", "role": "optional role/title" }],
    "pricingPlans": [{ "name": "Plan Name", "price": "$X/mo", "features": ["feature1", "feature2"] }],
    "faqItems": [{ "question": "Question?", "answer": "Answer." }],
    "contactInfo": { "phone": "+60...", "email": "info@...", "address": "..." },
    "footerText": "string — copyright or footer tagline text"
  },

  "suggestedTheme": {
    "primaryColor": "#hex — dominant brand color if detectable",
    "secondaryColor": "#hex — accent color if detectable",
    "siteType": "string — same enum as industry",
    "mood": "string — professional, warm, bold, playful, minimal, luxury, etc."
  },

  "suggestedBlocks": ["hero", "features", "testimonials", "pricing", "contact", "faq"],

  "detectedLanguage": "en|ms|vi",
  "confidence": "high|medium|low"
}

CRITICAL RULES:
- Extract REAL text content from the website — do NOT invent, summarize, or paraphrase
- heroHeadline MUST be the EXACT headline text from the page (not your interpretation)
- featuresList items MUST use the ACTUAL feature names/descriptions from the page
- testimonials MUST be EXACT quotes from the page (not fabricated)
- If a section doesn't exist on the page, omit it (use null or empty array)
- For referenceContent: prefer VERBATIM text over summarized text
- For suggestedBlocks: list only sections that ACTUALLY exist on the page
- confidence: high = 4+ fields filled with real content, medium = 2-3, low = 0-1
- detectedLanguage: check <html lang> first, then analyze content language`

export function buildExtractionPrompt(preprocessedText: string): {
    system: string
    user: string
} {
    return {
        system: EXTRACTION_SYSTEM_PROMPT,
        user: `Extract business information and website content from this page. Use VERBATIM text — do not rewrite or paraphrase:\n\n${preprocessedText}`,
    }
}
