import OpenAI from 'openai'
import { SYSTEM_PROMPTS } from './config'
import { startCapture, finishCapture } from './capture-generation'

function getOpenAI(): OpenAI | null {
    const key = process.env.OPENAI_API_KEY
    if (!key) return null
    return new OpenAI({ apiKey: key })
}

export type SEOMetaOutput = {
    title: string
    description: string
}

export async function generateAutoSEOMeta(
    type: 'page' | 'product',
    itemName: string,
    siteName: string,
    context?: string,
    keywords?: string[],
    signal?: AbortSignal,
): Promise<SEOMetaOutput> {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    const promptSummary = `${type}:${itemName} | site:${siteName}`
    const cap = await startCapture({ endpoint: 'generate-meta', prompt: promptSummary, category: type })

    const openai = getOpenAI()
    
    // Fallback if no API key is provided
    if (!openai) {
        const fallback: SEOMetaOutput = type === 'product'
            ? {
                title: `${itemName} | ${siteName} | Buy Online Malaysia`,
                description: `Shop ${itemName} at ${siteName}. High quality and best prices in Malaysia. Buy online today!`,
            }
            : {
                title: `${itemName} | ${siteName} Online Malaysia`,
                description: `Welcome to ${siteName}'s ${itemName} page. Discover our services and offerings in Malaysia.`,
            }
        await finishCapture(cap, { status: 'success', outputSnapshot: { path: 'no-key-fallback', ...fallback } })
        return fallback
    }

    const systemPrompt = SYSTEM_PROMPTS['seo-generation']
    
    const keywordLine = keywords?.length
        ? `\nTarget Keywords: ${keywords.join(', ')}\n- Naturally incorporate 1-2 target keywords if provided\n- Keyword density must not exceed 2%\n- Do NOT force keywords unnaturally`
        : ''

    let userPrompt = ''
    if (type === 'product') {
        userPrompt = `Generate SEO meta tags for a product named "${itemName}" sold by "${siteName}".
Context/Description: ${context || 'No description provided.'}${keywordLine}
Rules:
- Meta Title: Max 60 characters, include product name + "${siteName}" + "Buy Online Malaysia" if possible.
- Meta Description: 150-160 characters, compelling, highlight benefits, end with a call-to-action to buy.`
    } else {
        userPrompt = `Generate SEO meta tags for a web page named "${itemName}" for the business "${siteName}".
Context/Content: ${context || 'No content provided.'}${keywordLine}
Rules:
- Meta Title: Max 60 characters, include page name + "${siteName}" + "Malaysia".
- Meta Description: 150-160 characters, professional and engaging, explain what the page is about.`
    }

    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            temperature: 0.7,
            max_tokens: 300,
            response_format: { type: 'json_object' },
        }, { timeout: 15000, signal }) // 15 second timeout so it fails fast for the queue

        const content = completion.choices[0]?.message?.content
        if (!content) throw new Error('Empty AI response')

        const parsed = JSON.parse(content)

        const output: SEOMetaOutput = {
            title: (parsed.metaTitle || parsed.title || `${itemName} | ${siteName}`).substring(0, 60),
            description: (parsed.metaDescription || parsed.description || '').substring(0, 160),
        }
        await finishCapture(cap, { status: 'success', outputSnapshot: { path: 'openai', ...output } })
        return output
    } catch (error: unknown) {
        if (signal?.aborted) {
            await finishCapture(cap, { status: 'failed', error: 'aborted' })
            throw new DOMException('Aborted', 'AbortError')
        }

        const message = error instanceof Error ? error.message : 'Unknown error'
        console.error('[AI] SEO Meta Generation failed:', message)

        // Fallback to template if API quota exceeded or unavailable
        if (message.includes('429') || message.includes('quota') || message.includes('rate')) {
            console.warn('[AI] Using template fallback due to API quota limit')
            const rateFallback: SEOMetaOutput = type === 'product'
                ? {
                    title: `${itemName} | ${siteName} | Buy Online Malaysia`.substring(0, 60),
                    description: `Shop ${itemName} at ${siteName}. High quality and best prices in Malaysia. Buy online today!`.substring(0, 160),
                }
                : {
                    title: `${itemName} | ${siteName} Online Malaysia`.substring(0, 60),
                    description: `Welcome to ${siteName}'s ${itemName} page. Discover our services and offerings in Malaysia.`.substring(0, 160),
                }
            await finishCapture(cap, { status: 'success', outputSnapshot: { path: 'rate-limit-fallback', ...rateFallback } })
            return rateFallback
        }

        await finishCapture(cap, { status: 'failed', error: message })
        throw new Error(`OpenAI meta generation failed: ${message}`)
    }
}
