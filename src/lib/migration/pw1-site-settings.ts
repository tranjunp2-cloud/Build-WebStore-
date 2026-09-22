import { z } from 'zod'
import type { Payload } from 'payload'

const AssetUrl = z.string().url().refine(value => /^https?:\/\//i.test(value))
/** Website settings are source data, not AI design choices. */
export const SiteSettingsSchema = z.object({
    branding: z.object({ logo: AssetUrl.optional().catch(undefined), favicon: AssetUrl.optional().catch(undefined) }).strict(),
    contactInfo: z.object({ phone: z.string().optional(), email: z.string().optional(), address: z.string().optional() }).strict(),
    socialLinks: z.object({ facebook: z.string().optional(), instagram: z.string().optional(), twitter: z.string().optional(), linkedin: z.string().optional(), youtube: z.string().optional(), tiktok: z.string().optional() }).strict(),
    seo: z.object({ metaTitle: z.string().optional(), metaDescription: z.string().optional(), ogImage: AssetUrl.optional().catch(undefined) }).strict(),
}).strict()

export async function preparePw1SiteSettings(settings: z.infer<typeof SiteSettingsSchema>, tenantId: number | string, payload: Payload) {
    const assets: Record<string, unknown>[] = []
    const urls = new Map<string, Record<string, unknown>>()
    for (const url of [settings.branding.logo, settings.branding.favicon, settings.seo.ogImage]) {
        if (url && !urls.has(url)) { const asset = { image: url }; urls.set(url, asset); assets.push(asset) }
    }
    const { importPw1BlockMedia } = await import('./pw1-media')
    if (assets.length) {
        try {
            await importPw1BlockMedia([assets], tenantId, payload)
        } catch (error) {
            console.warn(`[preparePw1SiteSettings] Non-fatal asset import error: ${error instanceof Error ? error.message : String(error)}`)
        }
    }
    const publicUrls = new Map<string, string>()
    for (const [url, asset] of urls) {
        if (typeof asset.image === 'number') {
            const media = await payload.findByID({ collection: 'media', id: asset.image, depth: 0 }).catch(() => null)
            if (media?.url) publicUrls.set(url, media.url)
        }
    }
    return {
        branding: { logo: settings.branding.logo ? (publicUrls.get(settings.branding.logo) ?? '') : '', favicon: settings.branding.favicon ? (publicUrls.get(settings.branding.favicon) ?? '') : '' },
        contactInfo: { phone: '', email: '', address: '', ...settings.contactInfo },
        socialLinks: { facebook: '', instagram: '', twitter: '', linkedin: '', youtube: '', tiktok: '', ...settings.socialLinks },
        seo: { metaTitle: settings.seo.metaTitle ?? '', metaDescription: settings.seo.metaDescription ?? '', ogImage: settings.seo.ogImage && typeof urls.get(settings.seo.ogImage)?.image === 'number' ? (urls.get(settings.seo.ogImage)!.image as number) : null },
    }
}
