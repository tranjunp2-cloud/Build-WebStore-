import { NextResponse } from 'next/server'
import OpenAI from 'openai'

function getOpenAI(): OpenAI | null {
    const key = process.env.OPENAI_API_KEY
    if (!key) return null
    return new OpenAI({ apiKey: key })
}

export async function POST(req: Request) {
    try {
        const { promptText } = await req.json()
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

        const systemPrompt = `
You are an e-commerce product assistant for the Malaysia/Vietnamese market. The user will provide a casual text listing multiple products to create.

Parse the text and return a JSON object with a single "products" array.
Each product item MUST have:
- name: (string) The product name in Vietnamese or Malay as provided
- price: (number) The price in full VND or MYR (e.g. "45k" = 45000, "RM 89" = 89). Default to 0 if not specified.
- category: (string) Best-fit single category. Use one of: Fashion, F&B, Beauty, Home, Electronics, Footwear, Accessories, Sports, Books, Health, Toys, Automotive, Others
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
    } catch (error: unknown) {
        console.error('[AI Bulk Parse Error]', error)
        const message = error instanceof Error ? error.message : 'Internal Server Error'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
