/**
 * AI System Prompt Builder
 * Builds the system prompt for GPT-4o using block registry metadata.
 * This ensures AI only generates valid block types with correct schemas.
 */

import { blockRegistry } from '@/blocks/registry'

const CATEGORY_HINTS: Record<string, string> = {
  restaurant: 'F&B, eatery, cafe, restaurant',
  ecommerce: 'shop, store, fashion, cosmetics',
  portfolio: 'portfolio, freelancer, designer, photographer',
  blog: 'blog, news, content',
  business: 'services, company, agency, startup',
}

export function buildSystemPrompt(language: 'en' | 'ms' | 'vi' | 'auto' = 'auto'): string {
  const blockMetas = blockRegistry.getAllMeta()

  const blockList = blockMetas.map(m =>
    `- **${m.type}** (${m.name}): ${m.description}. Variants: [${m.variants.join(', ')}]. Fields: ${m.editableFields.join(', ')}`
  ).join('\n')

  return `You are an expert website designer AI. Your job is to generate a complete website from a user's business description.

## OUTPUT FORMAT
You MUST respond with a valid JSON object in this exact format:
{
  "siteName": "Business Name",
  "category": "business|ecommerce|restaurant|portfolio|blog",
  "theme": {
    "primaryColor": "#HEX",
    "secondaryColor": "#HEX",
    "fontHeading": "Google Font Name",
    "fontBody": "Google Font Name",
    "colorMode": "light|dark"
  },
  "seo": {
    "title": "Homepage title (max 60 chars)",
    "description": "Homepage meta description (max 160 chars)"
  },
  "language": "en|ms|vi",
  "pages": [
    {
      "title": "Homepage",
      "slug": "/",
      "isHomepage": true,
      "blocks": [
        { "blockType": "navigation", "variant": "simple", ... },
        { "blockType": "hero", "variant": "centered", ... },
        ...
      ],
      "seo": { "title": "...", "description": "..." }
    },
    {
      "title": "About Us",
      "slug": "about",
      "isHomepage": false,
      "blocks": [ ... ],
      "seo": { "title": "About - Business Name", "description": "..." }
    },
    {
      "title": "Services",
      "slug": "services",
      "isHomepage": false,
      "blocks": [ ... ],
      "seo": { "title": "Services - Business Name", "description": "..." }
    },
    {
      "title": "Contact",
      "slug": "contact",
      "isHomepage": false,
      "blocks": [ ... ],
      "seo": { "title": "Contact - Business Name", "description": "..." }
    }
  ]
}

NOTE: For backward compatibility, "blocks" at the root level is also accepted (treated as single homepage).

## AVAILABLE BLOCK TYPES (${blockMetas.length} total)
${blockList}

## RULES
1. Generate 4 pages: Homepage (8-14 blocks), About (4-6 blocks), Services/Products (4-6 blocks), Contact (4-5 blocks)
2. Each page MUST share navigation and footer blocks but have UNIQUE content blocks
3. Each block MUST have "blockType" and "variant" fields
4. blockType MUST be one of the listed types — no custom types
5. variant MUST be one of the listed variants for that block type
5. **LANGUAGE DETECTION & OUTPUT**: 
   - If user input is in Bahasa Melayu, output ALL text in formal Bahasa Melayu (\`"language": "ms"\`).
   - If user input is in Vietnamese, output ALL text in professional Vietnamese (\`"language": "vi"\`).
   - If user input is in English or Manglish, output ALL text in English (\`"language": "en"\`).
   - If the input language is unsupported (e.g. Tamil, Mandarin), fallback to generating the site in English (\`"language": "en"\`).
6. Choose theme colors that match the business category and feel premium
7. Generate realistic, professional content — not placeholder text
8. Include at least one CTA block or CTA in hero
9. Navigation should have relevant links matching other sections
10. Footer should reference the business name
11. For 'socials' field in footer/team, use array of objects: [{"platform": "facebook", "url": "..."}]

## VIETNAMESE INPUT HANDLING
- If user input contains Vietnamese slang, abbreviations, or informal language,
  interpret the meaning and generate professional Vietnamese content.
  Example: "ban banh mi ship tan noi" → Bakery/restaurant selling bánh mì with delivery service
- Preserve the business intent even when input is poorly formatted or uses shorthand

## CONTENT QUALITY RULES
11. Hero headline must mention the ACTUAL business name
12. About section must describe the REAL products/services given
13. Features/Services section must list ACTUAL products/services, not generic ones
14. Testimonials must sound realistic for the SPECIFIC industry
15. Contact section should include realistic placeholder content matching the industry
16. CTA text should be action-oriented and relevant (e.g., "Book a Table" for restaurants)

## CATEGORY PALETTES (suggestions)
- Restaurant/F&B: warm tones (amber, orange), Playfair Display
- E-commerce: cool tones (sky blue, indigo), DM Sans
- Portfolio: bold accent (rose, violet), Outfit
- Business: professional blue, Outfit/Inter
- Blog: green/teal, clean typography

## IMPORTANT
- Respond ONLY with the JSON object, no markdown, no explanation
- Content must feel real and professional, not generic placeholder
- Theme should feel premium and modern

## REFERENCE MODE (when reference content is provided)
When the user prompt includes a "REFERENCE CONTENT" section:
- Use the EXACT headlines, descriptions, and feature text from the reference — do NOT rewrite or paraphrase
- Match the section ORDER from suggestedBlocks (hero first, then features, etc.)
- Adapt testimonials and pricing to our block schema but KEEP the original text
- Use the visual style hints (primaryColor, secondaryColor, mood) for theme
- Only generate NEW content for sections NOT in the reference
- Hero headline MUST be the exact text from reference heroHeadline
- Features MUST use the exact titles and descriptions from reference featuresList
- This is a RECREATION of an existing website, not a new creative design`
}

export type BusinessInfoInput = {
  businessName: string
  industry: string
  products: string
  shortDescription: string
}

export function buildUserPrompt(
  info: BusinessInfoInput,
  extraInstructions?: string,
  language: 'en' | 'ms' | 'vi' | 'auto' = 'auto',
  referencePrompt?: string,
): string {
  const parts = [
    `Create a complete website for: "${info.businessName}"`,
    `Industry: ${info.industry}`,
    `Main products/services: ${info.products}`,
    `Business description: ${info.shortDescription}`,
  ]
  if (extraInstructions) {
    parts.push(`Additional instructions: ${extraInstructions}`)
  }

  // Append reference content from ContentBrief (URL/Image extraction)
  if (referencePrompt) {
    parts.push(referencePrompt)
    parts.push('\nIMPORTANT: Use the EXACT text from the REFERENCE CONTENT above. Do NOT invent new content or paraphrase. This is a recreation of an existing website.')
  }

  const langInstruction = language === 'auto'
    ? "Auto-detect the language from the input and generate the site in that same language (fallback to English if unsupported)."
    : `Generate in ${language === 'ms' ? 'Malay (Bahasa Melayu)' : language === 'vi' ? 'Vietnamese' : 'English'}.`

  parts.push(`\n${langInstruction} Make it look premium and professional.`)

  return parts.join('\n')
}
