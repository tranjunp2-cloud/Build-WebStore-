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
        const rateLimit = checkRateLimit(String(user.id), 5)
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
- name: (string) The product name in Vietnamese or Malay as provided
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
- variants: (array) Generate flat 1D array of variant objects if color/size/options are mentioned (2-tier Cartesian flattened).
  Each variant object MUST have:
    - name: (string) The full combination, e.g. "Đỏ - M", "Nâu - Size L", or just "Xanh" if 1-tier only
    - price: (number) same as base price unless specified per variant
    - sku: (string) auto-generate a 6-8 char unique uppercase SKU based on product abbreviation + option (e.g. "DT-XH-M")
    - stock: (number) default to 10 per variant
  If the product has NO specific color/size/variant options mentioned, return variants as an empty array [].

Rules:
- Extract prices correctly: k/K = x1000, eg. 45k = 45000
- Detect 2-tier variants: if BOTH color AND size are mentioned, create the full Cartesian product (e.g. Đỏ+Xanh × M+L = 4 variants)
- If only 1 dimension of options (e.g. only colors), create 1 variant per option
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
    } catch (error: any) {
        console.error('[AI Bulk Parse Error]', error)
        
        // Cải thiện UX (QA & FE friendly error message)
        let message = 'Hệ thống AI tạm thời không tĩnh được, vui lòng thử lại sau.'
        if (error?.message) {
            if (error.message.includes('429') || error.message.includes('quota') || error.message.includes('insufficient_quota')) {
                message = 'Hệ thống AI đang quá tải hoặc hết hạn ngạch (Quota Exceeded), vui lòng thử lại sau hoặc báo admin.'
            } else if (error.message.includes('timeout')) {
                message = 'Hệ thống AI phản hồi quá chậm (Timeout), vui lòng nhập ít văn bản hơn hoặc thử lại sau.'
            }
        }
        
        return NextResponse.json({ error: message }, { status: 500 })
    }
})
