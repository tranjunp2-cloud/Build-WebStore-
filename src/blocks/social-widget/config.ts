import { z } from 'zod'
import { BaseBlockSchema } from '../types'

const SocialPlatformSchema = z.enum(['facebook', 'whatsapp', 'instagram', 'linkedin', 'youtube'])

export type SocialPlatform = z.infer<typeof SocialPlatformSchema>
export type SocialLinkItem = {
    platform: SocialPlatform
    url: string
    enabled?: boolean
}

export type SocialWidgetConfig = {
    blockType: 'socialWidget'
    variant?: 'floating' | 'inline'
    headline?: string
    links: SocialLinkItem[]
}

export const DEFAULT_SOCIAL_WIDGET_LINKS: SocialLinkItem[] = [
    { platform: 'facebook', url: 'https://facebook.com/your-page', enabled: true },
    { platform: 'whatsapp', url: 'https://wa.me/60123456789', enabled: true },
    { platform: 'instagram', url: 'https://instagram.com/yourbrand', enabled: true },
    { platform: 'linkedin', url: 'https://linkedin.com/company/yourbrand', enabled: false },
    { platform: 'youtube', url: 'https://youtube.com/@yourbrand', enabled: false },
]

export function getDefaultSocialWidgetLinks(): SocialLinkItem[] {
    return DEFAULT_SOCIAL_WIDGET_LINKS.map(link => ({ ...link }))
}

export function normalizeSocialWidgetConfig<T extends Record<string, unknown>>(block: T): T & { links: SocialLinkItem[] } {
    const rawLinks = Array.isArray(block.links) ? block.links : []

    if (rawLinks.length === 0) {
        return {
            ...block,
            links: getDefaultSocialWidgetLinks(),
        }
    }

    return {
        ...block,
        links: rawLinks.map(link => {
            const p = SocialPlatformSchema.safeParse(link?.platform)
            return {
                platform: p.success ? p.data : 'facebook',
                url: typeof link?.url === 'string' ? link.url : '',
                enabled: link?.enabled !== false,
            }
        }),
    }
}

export const SocialWidgetConfigSchema = BaseBlockSchema.extend({
    blockType: z.literal('socialWidget'),
    variant: z.enum(['floating', 'inline']).default('floating'),
    headline: z.string().optional(),
    links: z.array(
        z.object({
            platform: SocialPlatformSchema,
            url: z.string().default(''),
            enabled: z.boolean().default(true),
        }),
    ).default(DEFAULT_SOCIAL_WIDGET_LINKS),
})

export const socialWidgetMeta = {
    type: 'socialWidget' as const,
    name: 'Social Media',
    description: 'Floating or inline social contact buttons',
    icon: '💬',
    variants: ['floating', 'inline'],
    defaultVariant: 'floating',
    editableFields: ['headline', 'links'],
    quickActions: ['Add social link', 'Update platform URLs'],
}
