import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { withAuth } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rateLimit'
import { selectModel } from '@/lib/ai/config'
import { logAiUsage } from '@/lib/ai/log-usage'

function getOpenAI(): OpenAI | null {
    const key = process.env.OPENAI_API_KEY
    if (!key) return null
    return new OpenAI({ apiKey: key })
}

export const POST = withAuth(async (user, req) => {
    try {
        // Rate limit: 10 bulk AI tasks per hour (heavy resource usage)
        const rateLimit = await checkRateLimit(String(user.id), 10)
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { error: 'rateLimitExceeded', resetAt: rateLimit.resetAt },
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
                        name: 'Áo thun Mẫu (Không API Key)', price: 45, category: 'Fashion', sku: 'AT-MAU',
                        variants: [
                            { name: 'Đen - M', price: 45, sku: 'AT-BLK-M', stock: 0 },
                            { name: 'Trắng - L', price: 45, sku: 'AT-WHT-L', stock: 0 }
                        ]
                    },
                    { name: 'Dép tổ ong (Không API Key)', price: 15, category: 'Footwear', sku: 'DTO-MAU', variants: [] }
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
- price: (number) The price in RM (Malaysian Ringgit) — this store ONLY sells in MYR, never VND or any other currency. Parse "RM89" or a plain "89" as 89; "RM1.5k" or "1.5k" as 1500 (k/K = x1000 shorthand). Default to 0 if not specified.
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
- sku: (string) auto-generate a 6-8 char unique uppercase SKU based on the product name abbreviation (e.g. "Leather Jacket" -> "LEA-JKT"). Always required, even for products with no variants.
- variants: (array) Generate flat 1D array of variant objects if any color/size/attribute is mentioned (2-tier Cartesian flattened). EVEN IF ONLY A SINGLE specific color or size is mentioned (e.g., "quần màu đỏ"), you MUST STILL generate exactly 1 variant for it (e.g., name: "Đỏ" or "Red").
  Each variant object MUST have:
    - name: (string) The full combination, e.g. "Đỏ - M", "Nâu - Size L", or just "Xanh" if 1-tier only
    - price: (number) same as base price unless specified per variant
    - compareAtPrice: (number) same as the product-level compareAtPrice unless specified per variant, or omit if the product-level compareAtPrice was omitted
    - sku: (string) auto-generate a 6-8 char unique uppercase SKU based on product abbreviation + option (e.g. "DT-XH-M")
    - stock: (number) default to 0 per variant (out of stock until the merchant confirms real stock)
  If the product has NO specific options or attributes mentioned AT ALL, return variants as an empty array [].
- variantConfigs: (array) If variants exist, provide up to 2 tier configurations representing the dimensions.
  Each object MUST have:
    - name: (string) The dimension name in ${targetLanguage.toUpperCase()} (e.g., "Color", "Size", "Material", "Warna")
    - options: (array) An array of objects with a "value" string, e.g., [{"value": "S"}, {"value": "M"}]
  If no variants exist, return an empty array [].

Rules:
- All prices are RM (Malaysian Ringgit). Extract correctly: k/K = x1000, e.g. "45k" = 45000. Ignore any other currency symbol the user types (Rp, VND, $, etc.) — always treat the number as RM.
- STRICT RULE for VARIANTS (MAXIMUM 2 TIERS): Our database ONLY supports a maximum of 2 variant tiers (e.g. Color and Size). 
  If the user mentions 3 or MORE attributes (e.g. Color, Size, Material, Type), YOU MUST ONLY USE THE FIRST 2 ATTRIBUTES and COMPLETELY DISCARD/IGNORE the rest. Do not merge them.
  Example: Tier 1 = Color (Xanh, Đỏ), Tier 2 = Size (S, M, L). Completely ignore attributes like "Vải len", "Loại thường".
  NEVER generate 3 tiers in variantConfigs. variantConfigs array length must be <= 2.
  Variant names MUST have at most ONE hyphen separating Tier 1 and Tier 2, e.g., "Xanh - S".
- If only 1 dimension of options (e.g. only colors), create 1 variant per option. NOTE: If the user says "quần màu đỏ" (ONLY 1 color option exists), you MUST output exactly 1 variant named "Đỏ" instead of empty array.
- The category name MUST be in English.
- Output ONLY valid JSON matching this exact schema, no other text
`

        const callStart = Date.now()
        const modelName = selectModel('bulk-parse')
        let completion: Awaited<ReturnType<typeof openai.chat.completions.create>>
        try {
            completion = await openai.chat.completions.create({
                model: modelName,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: promptText },
                ],
                temperature: 0.2,
                max_tokens: 3000,
                response_format: { type: 'json_object' },
            })
        } catch (err) {
            logAiUsage({
                endpoint: 'bulk-parse',
                model: modelName,
                tokensIn: 0,
                tokensOut: 0,
                durationMs: Date.now() - callStart,
                success: false,
                userId: user?.id ?? null,
                errorCode: err instanceof Error ? err.name : 'unknown',
            })
            throw err
        }

        logAiUsage({
            endpoint: 'bulk-parse',
            model: completion.model,
            tokensIn: completion.usage?.prompt_tokens ?? 0,
            tokensOut: completion.usage?.completion_tokens ?? 0,
            durationMs: Date.now() - callStart,
            success: true,
            userId: user?.id ?? null,
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
