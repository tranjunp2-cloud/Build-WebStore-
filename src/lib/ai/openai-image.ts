import OpenAI from 'openai'
import type { BusinessInfoInput } from './system-prompt'

/**
 * Generates an ultra-wide hero banner image using DALL-E 3 based on business info,
 * then downloads and uploads it to Payload CMS Media.
 */
export async function generateAndUploadHeroImage(
    businessInfo: BusinessInfoInput,
    tenantId: string,
    payload: any,
    assertCanWrite?: () => void,
): Promise<any | null> {
    const key = process.env.OPENAI_API_KEY
    if (!key) return null

    try {
        const openai = new OpenAI({ apiKey: key })
        
        const prompt = `A professional, high-quality, cinematic, ultra-wide website hero background image for a ${businessInfo.industry} business named "${businessInfo.businessName}". Main products/services are: ${businessInfo.products}. The image must be suitable for a website header: abstract enough to place text over it, visually stunning, photorealistic, and strictly WITHOUT any text, logos, or typography in the image itself.`
        
        console.log('[DALL-E] Requesting hero image generation...')
        const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: prompt,
            n: 1,
            size: "1792x1024",
            quality: "standard"
        })

        const imageUrl = response.data?.[0]?.url
        if (!imageUrl) throw new Error('No image URL returned')
        console.log('[DALL-E] Image generated successfully. Downloading...')

        // Download image to buffer
        const imgRes = await fetch(imageUrl)
        const arrayBuffer = await imgRes.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        console.log(`[DALL-E] Uploading to Payload CMS for tenant ${tenantId}...`)
        
        // Upload to payload CMS Media collection
        // Payload's `create` with `file` requires the file object
        assertCanWrite?.()
        const mediaDoc = await payload.create({
            collection: 'media',
            data: {
                alt: `${businessInfo.businessName} hero banner`,
                tenant: tenantId,
            },
            file: {
                data: buffer,
                mimetype: imgRes.headers.get('content-type') || 'image/png',
                name: `hero-${Date.now()}.png`,
                size: buffer.length,
            }
        })

        console.log(`[DALL-E] Successfully saved media document ID: ${mediaDoc.id}`)
        return mediaDoc

    } catch (e: any) {
        assertCanWrite?.()
        console.error('[DALL-E] Generation failed, falling back to stock/placeholder:', e.message)
        
        // Fallback: Fetch a generic professional business stock image from Unsplash
        try {
            console.log('[DALL-E] Fetching Unsplash fallback stock image...')
            const fallbackUrl = 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1792&h=1024&fit=crop&q=80'
            const imgRes = await fetch(fallbackUrl)
            if (!imgRes.ok) throw new Error('Unsplash fetch failed')
            
            const arrayBuffer = await imgRes.arrayBuffer()
            const buffer = Buffer.from(arrayBuffer)

            assertCanWrite?.()
            const mediaDoc = await payload.create({
                collection: 'media',
                data: {
                    alt: `${businessInfo.businessName} stock background`,
                    tenant: tenantId,
                },
                file: {
                    data: buffer,
                    mimetype: 'image/jpeg',
                    name: `fallback-hero-${Date.now()}.jpg`,
                    size: buffer.length,
                }
            })
            return mediaDoc
            
        } catch (fallbackErr: any) {
            console.error('[DALL-E] Fallback also failed:', fallbackErr.message)
            return null
        }
    }
}
