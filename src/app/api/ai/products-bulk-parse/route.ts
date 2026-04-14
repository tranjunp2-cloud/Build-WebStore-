import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { withAuth } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rateLimit'

function getOpenAI(): OpenAI | null {
    const key = process.env.OPENAI_API_KEY
    if (!key) return null
    return new OpenAI({ apiKey: key })
}

export const POST = withAuth(async (user, req) => {
    try {
        // Rate limit: 5 bulk AI tasks per hour (heavy resource usage)
        const rateLimit = await checkRateLimit(String(user.id), 5)
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { error: 'Rate limit exceeded. Try again later.' },
                { status: 429 }
            )
        }

        const { promptText, locale } = await req.json()
        if (!promptText) {
            return NextResponse.json({ error: 'promptText is required' }, { status: 400 })
        }

        const openai = getOpenAI()

        // Return dummy data if no key, ensuring tests/local dev won't crash
        if (!openai) {
            console.warn('[AI] No OPENAI_API_KEY — using fallback dummy data for bulk parse')
            return NextResponse.json({
                products: [
                    {
                        name: 'Áo thun Mẫu (Không API Key)', price: 150000, category: 'Fashion',
                        variants: [
                            { name: 'Đen - M', price: 150000, sku: 'AT-BLK-M', stock: 10 },
                            { name: 'Trắng - L', price: 150000, sku: 'AT-WHT-L', stock: 10 }
                        ]
                    },
                    { name: 'Dép tổ ong (Không API Key)', price: 20000, category: 'Footwear', variants: [] }
                ]
            })
        }

        const languageMap: Record<string, string> = {
            en: 'English',
            ms: 'Bahasa Melayu'
        }
        const targetLanguage = languageMap[locale as string] || 'English'

        const systemPrompt = `
You are an e-commerce product assistant. The user will provide a casual text listing multiple products to create.

CRITICAL INSTRUCTION: All text fields (name, description, seoTitle, seoDescription) MUST be written entirely in: ${targetLanguage.toUpperCase()}. 
You MUST TRANSLATE the user's input into ${targetLanguage.toUpperCase()} if they type in another language. For example, if the user types in Vietnamese "Muối tiêu" but target language is ENGLISH, you must output "Pepper Salt".

Parse the text and return a JSON object with a single "products" array.
Each product item MUST have:
- name: (string) The product name. MUST BE AT LEAST 3 CHARACTERS LONG (e.g. use "Áo Thun" instead of "Áo").
- price: (number) The price in full VND or MYR (e.g. "45k" = 45000, "RM 89" = 89). Default to 0 if not specified.
- compareAtPrice: (number) A sensible simulated original price (e.g. 20-30% higher than price) if realistic, or omit if not applicable.
- category: (string) Best-fit single category. Use one of: Fashion, F&B, Beauty, Home, Electronics, Footwear, Accessories, Sports, Books, Health, Toys, Automotive, Others
- description: (string) A comprehensive, engaging product description. Write at least 2 paragraphs separated by \\n\\n.
- weight: (number) Estimated logical shipping weight in kg. Minimum 0.1.
- length: (number) Estimated length in cm.
- width: (number) Estimated width in cm.
- height: (number) Estimated height in cm.
- seoTitle: (string) A catchy SEO-friendly title under 70 characters.
- seoDescription: (string) A compelling SEO meta description under 160 characters.
- slug: (string) URL-friendly lowercase slug (e.g. "ao-khoac-da").
- variants: (array) Generate flat 1D array of variant objects if any color/size/attribute is mentioned (2-tier Cartesian flattened). EVEN IF ONLY A SINGLE specific color or size is mentioned (e.g., "quần màu đỏ"), you MUST STILL generate exactly 1 variant for it (e.g., name: "Đỏ" or "Red").
  Each variant object MUST have:
    - name: (string) The full combination, e.g. "Đỏ - M", "Nâu - Size L", or just "Xanh" if 1-tier only
    - price: (number) same as base price unless specified per variant
    - sku: (string) auto-generate a 6-8 char unique uppercase SKU based on product abbreviation + option (e.g. "DT-XH-M")
    - stock: (number) default to 10 per variant
  If the product has NO specific options or attributes mentioned AT ALL, return variants as an empty array [].
- variantConfigs: (array) If variants exist, provide up to 2 tier configurations representing the dimensions.
  Each object MUST have:
    - name: (string) The dimension name in ${targetLanguage.toUpperCase()} (e.g., "Color", "Size", "Material", "Warna")
    - options: (array) An array of objects with a "value" string, e.g., [{"value": "S"}, {"value": "M"}]
  If no variants exist, return an empty array [].

Rules:
- Extract prices correctly: k/K = x1000, eg. 45k = 45000
- STRICT RULE for VARIANTS (MAXIMUM 2 TIERS): Our database ONLY supports a maximum of 2 variant tiers (e.g. Color and Size). 
  If the user mentions 3 or MORE attributes (e.g. Color, Size, Material, Type), YOU MUST ONLY USE THE FIRST 2 ATTRIBUTES and COMPLETELY DISCARD/IGNORE the rest. Do not merge them.
  Example: Tier 1 = Color (Xanh, Đỏ), Tier 2 = Size (S, M, L). Completely ignore attributes like "Vải len", "Loại thường".
  NEVER generate 3 tiers in variantConfigs. variantConfigs array length must be <= 2.
  Variant names MUST have at most ONE hyphen separating Tier 1 and Tier 2, e.g., "Xanh - S".
- If only 1 dimension of options (e.g. only colors), create 1 variant per option. NOTE: If the user says "quần màu đỏ" (ONLY 1 color option exists), you MUST output exactly 1 variant named "Đỏ" instead of empty array.
- The category name MUST be in English.
- Output ONLY valid JSON matching this exact schema, no other text
`

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: promptText },
            ],
            temperature: 0.2,
            max_tokens: 3000,
            response_format: { type: 'json_object' },
        })

        const content = completion.choices[0]?.message?.content
        if (!content) {
            throw new Error('Empty AI response')
        }

        const parsed = JSON.parse(content)
        return NextResponse.json(parsed)
    } catch (error) {
        console.error('[AI Bulk Parse Error]', error)
        
        let errorCode = 'parseError'
        const err = error as Error;
        if (err?.message) {
            if (err.message.includes('429') || err.message.includes('quota') || err.message.includes('insufficient_quota')) {
                errorCode = 'aiQuotaExceeded'
            } else if (err.message.includes('timeout')) {
                errorCode = 'aiTimeout'
            }
        }
        
        return NextResponse.json({ error: errorCode }, { status: 500 })
    }
})
