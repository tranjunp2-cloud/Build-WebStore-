/**
 * System + user prompts for GPT-4o-mini URL extraction.
 * v2: Expanded schema with 17+ fields, section parsing, image hints.
 */

const EXTRACTION_SYSTEM_PROMPT = `You extract detailed business information and website content from scraped web pages.
Output JSON matching this exact schema:

{
  "businessName": "string — business/company name (strip suffixes like ' | Home')",
  "industry": "string — one of: business, ecommerce, restaurant, tech, health, education, realestate, fitness, creative, beauty, blog",
  "shortDescription": "string — 1-2 sentence business description",
  "products": "string — comma-separated products/services",

  "referenceContent": {
    "heroHeadline": "string — main hero/banner headline text (from the page)",
    "heroSubheadline": "string — subtitle or tagline under the hero headline",
    "heroCtaText": "string — primary call-to-action button text (e.g., 'Shop Now', 'Get Started')",
    "aboutText": "string — about us section text (1-3 sentences)",
    "featuresList": [{ "title": "Feature Name", "description": "Short description" }],
    "testimonials": [{ "quote": "Customer quote", "name": "Customer Name", "role": "optional role/title" }],
    "pricingPlans": [{ "name": "Plan Name", "price": "$X/mo", "features": ["feature1", "feature2"] }],
    "faqItems": [{ "question": "Question?", "answer": "Answer." }],
    "contactInfo": { "phone": "+60...", "email": "info@...", "address": "..." },
    "footerText": "string — copyright or footer tagline text",
    "collectionsList": ["Collection Name 1", "Collection Name 2"],
    "brandTagline": "string — company slogan or brand promise",
    "socialProofStats": [{ "number": "500+", "label": "Happy Customers" }],
    "blogPostTitles": ["Post Title 1", "Post Title 2"],
    "ctaTexts": ["Shop Now", "Learn More", "Get Started"],
    "navigationItems": ["Home", "Shop", "About", "Contact"],
    "sectionOrder": ["hero", "features", "about", "testimonials", "pricing", "faq", "contact"]
  },

  "suggestedTheme": {
    "primaryColor": "#hex — dominant brand color if detectable from theme-color meta or CSS",
    "secondaryColor": "#hex — accent color if detectable",
    "backgroundColor": "#hex — page background color if detectable",
    "siteType": "string — same enum as industry",
    "mood": "string — professional, warm, bold, playful, minimal, luxury, etc."
  },

  "suggestedBlocks": ["hero", "features", "testimonials", "pricing", "contact", "faq"],

  "detectedLanguage": "en|ms|vi",
  "confidence": "high|medium|low"
}

CRITICAL RULES:
1. Extract ALL sections found in the content — check MAIN CONTENT, SECTIONS, STRUCTURED DATA, and FOOTER
2. If [SECTIONS] data includes testimonials → MUST populate testimonials array with actual quotes
3. If [SECTIONS] data includes pricing → MUST populate pricingPlans array
4. If [SECTIONS] data includes FAQ → MUST populate faqItems array
5. If [STRUCTURED DATA] has FAQPage → use those FAQ items
6. sectionOrder MUST reflect the actual order of sections found on the page
7. heroHeadline should closely match the main headline from the page
8. For text content: keep the core meaning but adapt for a website builder context
9. If a section doesn't exist on the page, omit it (use null or empty array)
10. suggestedBlocks: list ONLY sections that ACTUALLY exist on the page
11. navigationItems: extract from Navigation field in META section
12. ctaTexts: collect ALL call-to-action button texts found
13. collectionsList: for e-commerce, extract product categories/collections
14. confidence: high = 6+ fields filled, medium = 3-5, low = 0-2
15. detectedLanguage: check Language field in META first, then analyze content`

export function buildExtractionPrompt(preprocessedText: string): {
    system: string
    user: string
} {
    return {
        system: EXTRACTION_SYSTEM_PROMPT,
        user: `Extract business information and full website content from this page. Capture ALL sections — hero, features, testimonials, pricing, FAQ, footer, collections, blog titles:\n\n${preprocessedText}`,
    }
}
