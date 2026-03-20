import OpenAI from 'openai'
import { SYSTEM_PROMPTS } from './config'

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
    context?: string
): Promise<SEOMetaOutput> {
    const openai = getOpenAI()
    
    // Fallback if no API key is provided
    if (!openai) {
        if (type === 'product') {
            return {
                title: `${itemName} | ${siteName} | Buy Online Malaysia`,
                description: `Shop ${itemName} at ${siteName}. High quality and best prices in Malaysia. Buy online today!`,
            }
        }
        return {
            title: `${itemName} | ${siteName} Online Malaysia`,
            description: `Welcome to ${siteName}'s ${itemName} page. Discover our services and offerings in Malaysia.`,
        }
    }

    const systemPrompt = SYSTEM_PROMPTS['seo-generation']
    
    let userPrompt = ''
    if (type === 'product') {
        userPrompt = `Generate SEO meta tags for a product named "${itemName}" sold by "${siteName}".
Context/Description: ${context || 'No description provided.'}
Rules:
- Meta Title: Max 60 characters, include product name + "${siteName}" + "Buy Online Malaysia" if possible.
- Meta Description: 150-160 characters, compelling, highlight benefits, end with a call-to-action to buy.`
    } else {
        userPrompt = `Generate SEO meta tags for a web page named "${itemName}" for the business "${siteName}".
Context/Content: ${context || 'No content provided.'}
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
        }, { timeout: 15000 }) // 15 second timeout so it fails fast for the queue

        const content = completion.choices[0]?.message?.content
        if (!content) throw new Error('Empty AI response')

        const parsed = JSON.parse(content)
        
        return {
            title: (parsed.metaTitle || parsed.title || `${itemName} | ${siteName}`).substring(0, 60),
            description: (parsed.metaDescription || parsed.description || '').substring(0, 160),
        }
    } catch (error: any) {
        console.error('[AI] SEO Meta Generation failed:', error.message)
        throw new Error(`OpenAI meta generation failed: ${error.message}`)
    }
}
