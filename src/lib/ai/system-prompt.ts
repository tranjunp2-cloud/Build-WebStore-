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
    "title": "Page title (max 60 chars)",
    "description": "Meta description (max 160 chars)"
  },
  "language": "en|ms|vi",
  "blocks": [
    { "blockType": "navigation", "variant": "simple", ... },
    { "blockType": "hero", "variant": "centered", ... },
    ...
  ]
}

## AVAILABLE BLOCK TYPES (${blockMetas.length} total)
${blockList}

## RULES
1. Generate 8-14 blocks per site (minimum: navigation, hero, about/features, contact, footer)
2. Each block MUST have "blockType" and "variant" fields
3. blockType MUST be one of the listed types — no custom types
4. variant MUST be one of the listed variants for that block type
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
- Theme should feel premium and modern`
}

export type BusinessInfoInput = {
  businessName: string
  industry: string
  products: string
  shortDescription?: string
  targetAudience?: string
  style?: string
}

export function buildUserPrompt(
  info: BusinessInfoInput,
  extraInstructions?: string,
  language: 'en' | 'ms' | 'vi' | 'auto' = 'auto',
): string {
  const parts = [
    `Create a complete website for: "${info.businessName}"`,
    `Industry: ${info.industry}`,
    `Main products/services: ${info.products}`,
  ]

  if (info.shortDescription) {
    parts.push(`Short description: ${info.shortDescription}`)
  }
  if (info.targetAudience) {
    parts.push(`Target audience: ${info.targetAudience}`)
  }
  if (info.style) {
    parts.push(`Design style: ${info.style}`)
  }
  if (extraInstructions) {
    parts.push(`Additional instructions: ${extraInstructions}`)
  }

  const langInstruction = language === 'auto' 
    ? "Auto-detect the language from the input and generate the site in that same language (fallback to English if unsupported)."
    : `Generate in ${language === 'ms' ? 'Malay (Bahasa Melayu)' : language === 'vi' ? 'Vietnamese' : 'English'}.`

  parts.push(`\n${langInstruction} Make it look premium and professional.`)

  return parts.join('\n')
}

