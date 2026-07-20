import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { withAuth } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rateLimit'
import { selectModel } from '@/lib/ai/config'
import { logAiUsage } from '@/lib/ai/log-usage'
import { detectLocaleFromText } from '@/lib/detect-locale'
import { z } from 'zod'

export const maxDuration = 60

const INITIAL_PARSE_TIMEOUT_MS = 45_000
const REPAIR_TIMEOUT_MS = 12_000
const RESPONSE_RESERVE_MS = 3_000

const BulkParseRequestSchema = z.object({
    promptText: z.string().trim().min(1).max(6_000),
    locale: z.enum(['en', 'ms']).optional().default('en'),
})

type ParsedVariant = {
    name?: string
    price?: number
    compareAtPrice?: number
    sku?: string
    stock?: number
}

type ParsedVariantConfig = {
    name?: string
    options?: { value?: string }[]
}

type ParsedProduct = {
    name?: string
    description?: string
    seoTitle?: string
    seoDescription?: string
    slug?: string
    category?: string
    price?: number
    compareAtPrice?: number
    sku?: string
    stock?: number
    weight?: number
    length?: number
    width?: number
    height?: number
    variants?: ParsedVariant[]
    variantConfigs?: ParsedVariantConfig[]
}

type BulkParseResult = {
    products?: ParsedProduct[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOnlyOptionalStrings(record: Record<string, unknown>, fields: string[]): boolean {
    return fields.every(field => record[field] === undefined || typeof record[field] === 'string')
}

function isValidBulkParseResult(value: unknown): value is BulkParseResult {
    if (!isRecord(value) || !Array.isArray(value.products)) return false
    return value.products.every(product => {
        if (!isRecord(product) || typeof product.name !== 'string' || !product.name.trim()) return false
        if (!hasOnlyOptionalStrings(product, ['description', 'seoTitle', 'seoDescription', 'slug', 'sku', 'category'])) return false
        if (product.variants !== undefined && (!Array.isArray(product.variants) || !product.variants.every(
            variant => isRecord(variant) && typeof variant.name === 'string' && variant.name.trim() &&
                hasOnlyOptionalStrings(variant, ['sku'])
        ))) return false
        return product.variantConfigs === undefined || (
            Array.isArray(product.variantConfigs) && product.variantConfigs.every(config =>
                isRecord(config) && (config.options === undefined || (Array.isArray(config.options) && config.options.every(isRecord)))
            )
        )
    })
}

function collectMerchantFacingFields(parsed: BulkParseResult): string[] {
    if (!Array.isArray(parsed.products)) return []

    return parsed.products.flatMap(product => {
        // AI JSON is untrusted even with response_format. Ignore malformed rows so a
        // language-repair best effort never turns a usable parse response into a 500.
        if (!isRecord(product)) return []
        const variants = Array.isArray(product.variants) ? product.variants.filter(isRecord) : []
        const variantConfigs = Array.isArray(product.variantConfigs) ? product.variantConfigs.filter(isRecord) : []
        return [
            product.name,
            product.description,
            product.seoTitle,
            product.seoDescription,
            ...variants.map(variant => variant.name),
            ...variantConfigs.flatMap(config => {
                const options = Array.isArray(config.options) ? config.options.filter(isRecord) : []
                return [config.name, ...options.map(option => option.value)]
            }),
        ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    })
}

function detectMerchantFacingLocale(parsed: BulkParseResult): string | null {
    const merchantFacingText = collectMerchantFacingFields(parsed).join(' ').trim()
    if (!merchantFacingText) return null
    return detectLocaleFromText(merchantFacingText)
}

function needsMerchantLanguageRepair(parsed: BulkParseResult, locale: unknown): boolean {
    if (locale !== 'en' && locale !== 'ms') return false
    if (collectMerchantFacingFields(parsed).length === 0) return false
    const detectedLocale = detectMerchantFacingLocale(parsed)

    // Malay and English share ASCII. For an English store, detection cannot prove that
    // short/ambiguous output (for example "Hat Merah") is actually English, so run the
    // bounded repair pass. The repair prompt preserves already-correct English text.
    if (locale === 'en') return true

    // ASCII Malay and English cannot be reliably separated by franc. Repair every
    // English-detected Malay draft; the repair prompt explicitly preserves text that
    // is already natural Malay, preventing a mixed-language result from slipping through.
    return Boolean(detectedLocale && detectedLocale !== locale)
}

function mergeRepairedMerchantFacingText(original: BulkParseResult, repaired: unknown): BulkParseResult {
    if (!isRecord(repaired) || !Array.isArray(repaired.products) || !Array.isArray(original.products)) {
        return original
    }
    if (repaired.products.length !== original.products.length || !repaired.products.every(isRecord)) {
        return original
    }
    const repairedProducts = repaired.products as Record<string, unknown>[]

    return {
        ...original,
        products: original.products.map((product, productIndex) => {
            const repairedProduct = repairedProducts[productIndex]
            const mergedProduct: ParsedProduct = { ...product }

            for (const field of ['name', 'description', 'seoTitle', 'seoDescription', 'slug'] as const) {
                if (typeof repairedProduct[field] === 'string') mergedProduct[field] = repairedProduct[field]
            }

            if (Array.isArray(product.variants)) {
                if (!Array.isArray(repairedProduct.variants) || repairedProduct.variants.length !== product.variants.length || !repairedProduct.variants.every(isRecord)) {
                    return product
                }
                const repairedVariants = repairedProduct.variants as Record<string, unknown>[]
                mergedProduct.variants = product.variants.map((variant, variantIndex) => ({
                    ...variant,
                    ...(typeof repairedVariants[variantIndex].name === 'string'
                        ? { name: repairedVariants[variantIndex].name as string }
                        : {}),
                }))
            }

            if (Array.isArray(product.variantConfigs)) {
                if (!Array.isArray(repairedProduct.variantConfigs) || repairedProduct.variantConfigs.length !== product.variantConfigs.length || !repairedProduct.variantConfigs.every(isRecord)) {
                    return product
                }
                mergedProduct.variantConfigs = product.variantConfigs.map((config, configIndex) => {
                    const repairedConfig = (repairedProduct.variantConfigs as Record<string, unknown>[])[configIndex]
                    if (!Array.isArray(config.options) || !Array.isArray(repairedConfig.options) || repairedConfig.options.length !== config.options.length || !repairedConfig.options.every(isRecord)) {
                        return config
                    }
                    const repairedOptions = repairedConfig.options as Record<string, unknown>[]
                    return {
                        ...config,
                        ...(typeof repairedConfig.name === 'string' ? { name: repairedConfig.name } : {}),
                        options: config.options.map((option, optionIndex) => ({
                            ...option,
                            ...(typeof repairedOptions[optionIndex].value === 'string'
                                ? { value: repairedOptions[optionIndex].value as string }
                                : {}),
                        })),
                    }
                })
            }

            return mergedProduct
        }),
    }
}

async function repairMerchantLanguage(
    openai: OpenAI,
    model: string,
    targetLanguage: string,
    parsed: BulkParseResult,
    userId: string | number | null | undefined,
    timeoutMs: number,
): Promise<BulkParseResult> {
    const systemPrompt = [
        'You are fixing language consistency in an e-commerce products JSON payload.',
        `Rewrite merchant-facing text so it is entirely in ${targetLanguage.toUpperCase()}.`,
        'Merchant-facing fields: name, description, seoTitle, seoDescription, variants[].name, variantConfigs[].name, and variantConfigs[].options[].value.',
        'Also rewrite each product slug so it matches the corrected product name in lowercase ASCII kebab-case.',
        'Rules:',
        '- Return ONLY valid JSON with exactly the same top-level/object/array structure and keys.',
        '- Preserve product count, product order, variant count, variant order, option count, and all numeric values.',
        '- Preserve category values in English, preserve SKUs, stock, compareAtPrice, dimensions, and prices.',
        '- Do NOT add, remove, merge, or split products, variants, or options.',
        '- Keep variant names to maximum 2 tiers with a single " - " separator when already present.',
        '- If a field already matches the target language, keep it natural and consistent; only fix mixed-language or wrong-language text.',
    ].join('\n')

    const repairStart = Date.now()
    const completion = await openai.chat.completions.create({
        model,
        temperature: 0,
        max_tokens: 3000,
        response_format: { type: 'json_object' },
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: JSON.stringify(parsed) },
        ],
    }, { timeout: timeoutMs, maxRetries: 0 })

    logAiUsage({
        endpoint: 'bulk-parse',
        model: completion.model,
        tokensIn: completion.usage?.prompt_tokens ?? 0,
        tokensOut: completion.usage?.completion_tokens ?? 0,
        durationMs: Date.now() - repairStart,
        success: true,
        userId,
    })

    const content = completion.choices[0]?.message?.content
    if (!content) return parsed

    try {
        return mergeRepairedMerchantFacingText(parsed, JSON.parse(content))
    } catch (error) {
        console.warn('[AI bulk-parse] language repair returned invalid JSON', error)
        return parsed
    }
}

function getOpenAI(): OpenAI | null {
    const key = process.env.OPENAI_API_KEY
    if (!key) return null
    return new OpenAI({ apiKey: key })
}

export const POST = withAuth(async (user, req) => {
    try {
        // Rate limit: 10 bulk AI tasks per hour (heavy resource usage)
        // Namespaced key — bare user.id would share a single bucket with every other
        // AI route (edit-block, product-description, etc.), making this limit meaningless
        // (see PR #1608 review). Matches this codebase's `{feature}:${user.id}` convention.
        const rateLimit = await checkRateLimit(`ai-bulk-parse:${user.id}`, 10)
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { error: 'rateLimitExceeded', resetAt: rateLimit.resetAt },
                { status: 429 }
            )
        }

        const request = BulkParseRequestSchema.safeParse(await req.json().catch(() => null))
        if (!request.success) {
            return NextResponse.json({ error: 'invalidRequest' }, { status: 400 })
        }
        const { promptText, locale } = request.data

        const openai = getOpenAI()

        // Return dummy data if no key, ensuring tests/local dev won't crash
        if (!openai) {
            console.warn('[AI] No OPENAI_API_KEY — using locale-aware fallback data for bulk parse')
            const fallbackProducts = locale === 'ms'
                ? [
                    {
                        name: 'Baju Contoh (Tiada Kunci API)', price: 45, category: 'Fashion', sku: 'BJ-CTH',
                        variants: [
                            { name: 'Hitam - M', price: 45, sku: 'BJ-BLK-M', stock: 0 },
                            { name: 'Putih - L', price: 45, sku: 'BJ-WHT-L', stock: 0 }
                        ]
                    },
                    { name: 'Selipar Contoh (Tiada Kunci API)', price: 15, category: 'Footwear', sku: 'SP-CTH', variants: [] }
                ]
                : [
                    {
                        name: 'Sample T-Shirt (No API Key)', price: 45, category: 'Fashion', sku: 'TS-SAMPLE',
                        variants: [
                            { name: 'Black - M', price: 45, sku: 'TS-BLK-M', stock: 0 },
                            { name: 'White - L', price: 45, sku: 'TS-WHT-L', stock: 0 }
                        ]
                    },
                    { name: 'Sample Slippers (No API Key)', price: 15, category: 'Footwear', sku: 'SS-SAMPLE', variants: [] }
                ]
            return NextResponse.json({ products: fallbackProducts })
        }

        const languageMap: Record<string, string> = {
            en: 'English',
            ms: 'Bahasa Melayu'
        }
        const targetLanguage = languageMap[locale as string] || 'English'

        const systemPrompt = `
You are an e-commerce product assistant. The user will provide a casual text listing multiple products to create.

CRITICAL INSTRUCTION: ALL merchant-facing text fields — including name, description, seoTitle, seoDescription, variants[].name, variantConfigs[].name, and variantConfigs[].options[].value — MUST be written entirely in: ${targetLanguage.toUpperCase()}.
This applies to colors, sizes, materials, and every other option value.
You MUST TRANSLATE the user's input into ${targetLanguage.toUpperCase()} if they type in another language.
Examples:
- If the user types Vietnamese "Muối tiêu" and target language is ENGLISH, you must output "Pepper Salt".
- If the user types Vietnamese "quần màu đỏ" and target language is ENGLISH, the variant name MUST be "Red", NOT "Đỏ".
- If the user types Vietnamese "quần màu đỏ" and target language is BAHASA MELAYU, the variant name MUST be "Merah" and the dimension name MUST be "Warna".

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
- variants: (array) Generate flat 1D array of variant objects if any color/size/attribute is mentioned (2-tier Cartesian flattened). EVEN IF ONLY A SINGLE specific color or size is mentioned (e.g., Vietnamese input "quần màu đỏ"), you MUST STILL generate exactly 1 variant for it in ${targetLanguage.toUpperCase()} (e.g., "Red" in English or "Merah" in Bahasa Melayu).
  Each variant object MUST have:
    - name: (string) The full combination in ${targetLanguage.toUpperCase()}, e.g. "Red - M", "Brown - Size L", or just "Blue" if 1-tier only
    - price: (number) same as base price unless specified per variant
    - compareAtPrice: (number) same as the product-level compareAtPrice unless specified per variant, or omit if the product-level compareAtPrice was omitted
    - sku: (string) auto-generate a 6-8 char unique uppercase SKU based on product abbreviation + option (e.g. "DT-XH-M")
    - stock: (number) default to 0 per variant (out of stock until the merchant confirms real stock)
  If the product has NO specific options or attributes mentioned AT ALL, return variants as an empty array [].
- variantConfigs: (array) If variants exist, provide up to 2 tier configurations representing the dimensions.
  Each object MUST have:
    - name: (string) The dimension name in ${targetLanguage.toUpperCase()} (e.g., "Color", "Size", "Material", "Warna")
    - options: (array) An array of objects with a "value" string in ${targetLanguage.toUpperCase()}, e.g., [{"value": "White"}, {"value": "Grey"}] for English or [{"value": "Putih"}, {"value": "Kelabu"}] for Bahasa Melayu
  If no variants exist, return an empty array [].

Rules:
- All prices are RM (Malaysian Ringgit). Extract correctly: k/K = x1000, e.g. "45k" = 45000. Ignore any other currency symbol the user types (Rp, VND, $, etc.) — always treat the number as RM.
- STRICT RULE for VARIANTS (MAXIMUM 2 TIERS): Our database ONLY supports a maximum of 2 variant tiers (e.g. Color and Size). 
  If the user mentions 3 or MORE attributes (e.g. Color, Size, Material, Type), YOU MUST ONLY USE THE FIRST 2 ATTRIBUTES and COMPLETELY DISCARD/IGNORE the rest. Do not merge them.
  Example: Tier 1 = Color (Red, Blue), Tier 2 = Size (S, M, L). Completely ignore attributes like Material or Type.
  NEVER generate 3 tiers in variantConfigs. variantConfigs array length must be <= 2.
  Variant names MUST have at most ONE hyphen separating Tier 1 and Tier 2, e.g., "Red - S".
- If only 1 dimension of options (e.g. only colors), create 1 variant per option. NOTE: If the user says Vietnamese "quần màu đỏ" (ONLY 1 color option exists), you MUST output exactly 1 variant in ${targetLanguage.toUpperCase()} — e.g. "Red" for English or "Merah" for Bahasa Melayu — instead of an empty array.
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
            }, { timeout: INITIAL_PARSE_TIMEOUT_MS, maxRetries: 0 })
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

        const parsedResult = JSON.parse(content)
        if (!isValidBulkParseResult(parsedResult)) {
            throw new Error('Invalid AI response structure')
        }
        let parsed = parsedResult

        const detectedMerchantLocale = detectMerchantFacingLocale(parsed)
        if (needsMerchantLanguageRepair(parsed, locale)) {
            const remainingMs = maxDuration * 1_000 - (Date.now() - callStart) - RESPONSE_RESERVE_MS
            const repairTimeoutMs = Math.min(REPAIR_TIMEOUT_MS, remainingMs)
            if (repairTimeoutMs < 3_000) {
                console.warn('[AI bulk-parse] skipping language repair because the request budget is nearly exhausted', {
                    locale,
                    detectedMerchantLocale,
                    remainingMs,
                })
            } else {
                console.warn('[AI bulk-parse] detected merchant-facing language mismatch after parse; running language repair pass', {
                    locale,
                    detectedMerchantLocale,
                    productCount: parsed.products?.length ?? 0,
                    repairTimeoutMs,
                })
                const repairStart = Date.now()
                try {
                    parsed = await repairMerchantLanguage(openai, modelName, targetLanguage, parsed, user?.id, repairTimeoutMs)
                } catch (error) {
                console.warn('[AI bulk-parse] language repair failed; returning original parse result', error)
                    logAiUsage({
                        endpoint: 'bulk-parse',
                        model: modelName,
                        tokensIn: 0,
                        tokensOut: 0,
                        durationMs: Date.now() - repairStart,
                        success: false,
                        userId: user?.id ?? null,
                        errorCode: error instanceof Error ? error.name : 'unknown',
                    })
                }
            }
        }

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
