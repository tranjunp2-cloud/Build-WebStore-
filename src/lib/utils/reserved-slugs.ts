/**
 * Reserved subdomain slugs that cannot be used by tenants.
 * Includes system routes, common infrastructure names, and brand protection.
 */
export const RESERVED_SLUGS = new Set([
    // System routes
    'admin', 'api', 'app', 'dashboard', 'login', 'register', 'signup',
    'auth', 'oauth', 'sso', 'verify-otp', 'forgot-password', 'reset-password',

    // Infrastructure
    'www', 'mail', 'ftp', 'static', 'assets', 'cdn', 'media',
    'health', 'status', 'monitoring',

    // Features
    'help', 'support', 'docs', 'blog', 'store', 'shop',
    'billing', 'payment', 'checkout', 'cart',
    'settings', 'account', 'profile',
    'builder', 'editor', 'onboarding', 'templates',

    // Environment
    'dev', 'staging', 'test', 'demo', 'preview', 'sandbox',

    // Brand protection
    'primeweb', 'ecommercehub', 'ech', 'prime',
])

/**
 * Check if a slug is reserved.
 */
export function isReservedSlug(slug: string): boolean {
    return RESERVED_SLUGS.has(slug.toLowerCase())
}

/**
 * Slug format validation rules (DNS label spec).
 * Returns error message or null if valid.
 */
export function validateSlugFormat(slug: string): string | null {
    if (!slug) return 'Slug is required'
    if (slug.length < 3) return 'Slug must be at least 3 characters'
    if (slug.length > 63) return 'Slug must be at most 63 characters'
    if (!/^[a-z0-9-]+$/.test(slug)) return 'Slug can only contain lowercase letters, numbers, and hyphens'
    if (slug.startsWith('-') || slug.endsWith('-')) return 'Slug cannot start or end with a hyphen'
    if (/^\d+$/.test(slug)) return 'Slug cannot be pure numbers'
    return null
}
