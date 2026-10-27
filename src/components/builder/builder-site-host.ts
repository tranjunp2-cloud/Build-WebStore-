// Preview-only site host for the builder's mini-browser URL bars (SlugPicker owns the real slug).
const PLATFORM_DOMAIN = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || 'primeweb.app'

function slugify(value: string): string {
    return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
}

export function getPreviewSiteHost(businessName: string, slug?: string): string {
    return `${slug || slugify(businessName) || 'your-site'}.${PLATFORM_DOMAIN}`
}
