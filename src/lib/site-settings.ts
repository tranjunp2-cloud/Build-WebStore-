export type SiteContactInfo = {
    phone?: string | null
    email?: string | null
    address?: string | null
}

export type SiteSocialLinks = {
    facebook?: string | null
    instagram?: string | null
    twitter?: string | null
    linkedin?: string | null
    youtube?: string | null
    tiktok?: string | null
    whatsapp?: string | null
}

export type SiteBranding = {
    logo?: string | null
    favicon?: string | null
}

const SOCIAL_PLATFORM_ORDER = ['facebook', 'whatsapp', 'instagram', 'linkedin', 'youtube', 'twitter', 'tiktok'] as const

function stripHtml(value: string | undefined | null): string {
    if (!value) return ''
    return value.replace(/<[^>]*>/g, '').trim()
}

export function mergeContactInfoWithSite<T extends { email?: string; phone?: string; address?: string }>(
    block: T,
    siteContactInfo?: SiteContactInfo | null,
) {
    return {
        ...block,
        email: stripHtml(block.email || siteContactInfo?.email),
        phone: stripHtml(block.phone || siteContactInfo?.phone),
        address: stripHtml(block.address || siteContactInfo?.address),
    }
}

export function getSiteSocialWidgetLinks(siteSocialLinks?: SiteSocialLinks | null) {
    return SOCIAL_PLATFORM_ORDER
        .map((platform) => ({
            platform,
            url: siteSocialLinks?.[platform] || '',
            enabled: Boolean(siteSocialLinks?.[platform]),
        }))
        .filter((item) => item.enabled)
}

export function mergeSocialWidgetLinksWithSite<T extends { links?: Array<{ platform: string; url: string; enabled?: boolean }> }>(
    block: T,
    siteSocialLinks?: SiteSocialLinks | null,
) {
    if (Array.isArray(block.links) && block.links.some((item) => item?.url || item?.enabled !== false)) {
        return block
    }

    return {
        ...block,
        links: getSiteSocialWidgetLinks(siteSocialLinks),
    }
}

export function mergeFooterSocialsWithSite<T extends { socials?: Array<{ platform: string; url: string }>; logoText?: string }>(
    block: T,
    site?: { socialLinks?: SiteSocialLinks | null; name?: string | null; branding?: SiteBranding | null } | null,
) {
    const socials = Array.isArray(block.socials) && block.socials.length > 0
        ? block.socials
        : getSiteSocialWidgetLinks(site?.socialLinks).map(({ platform, url }) => ({ platform, url }))

    return {
        ...block,
        logoText: block.logoText || site?.name || '',
        logo: (block as Record<string, unknown>).logo || (site?.branding?.logo ? { url: site.branding.logo, alt: site?.name || 'Logo' } : undefined),
        socials,
    }
}

export function mergeNavigationBrandingWithSite<T extends { logoText?: string; logo?: { url?: string; alt?: string } }>(
    block: T,
    site?: { name?: string | null; branding?: SiteBranding | null } | null,
) {
    return {
        ...block,
        logoText: block.logoText || site?.name || '',
        logo: block.logo?.url ? block.logo : (site?.branding?.logo ? { url: site.branding.logo, alt: site?.name || 'Logo' } : block.logo),
    }
}
