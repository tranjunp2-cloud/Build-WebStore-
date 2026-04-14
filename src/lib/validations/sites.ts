import { z } from 'zod'

const nullableString = z.string().nullable().optional()

/** Strip all HTML tags to prevent XSS */
function stripHtml(input: string): string {
    return input.replace(/<[^>]*>/g, '')
}

/** Zod transform: strip HTML from nullable string fields */
const sanitizedString = z.string()
    .transform(v => stripHtml(v).trim())
    .nullable().optional()

/** BUG-F05-045: Validate phone format — allows +, digits, spaces, hyphens, parens, dots */
const phoneString = z.string()
    .transform(v => stripHtml(v).trim())
    .pipe(
        z.string().regex(/^\+?[\d\s\-().]*$/, 'Invalid phone number format')
            .or(z.literal(''))
    )
    .nullable().optional()

/** Validate URL format — only allow https:// or http:// */
const socialUrlString = z.string()
    .transform(v => stripHtml(v).trim())
    .pipe(
        z.string().url('Invalid URL format')
            .refine(v => {
                try { const u = new URL(v); return u.protocol === 'https:' || u.protocol === 'http:' }
                catch { return false }
            }, 'Only http:// and https:// URLs are allowed')
            .or(z.literal(''))
    )
    .nullable().optional()

export const saveSiteSchema = z.object({
    blocks: z.array(z.record(z.unknown())).optional(),
    headerBlock: z.record(z.unknown()).nullable().optional(),
    footerBlock: z.record(z.unknown()).nullable().optional(),
    theme: z.record(z.unknown()).optional(),
    siteName: z.string().min(1).max(200).transform(v => stripHtml(v).trim()).optional(),
    locale: z.enum(['en', 'ms']).optional(),
    contactInfo: z.object({
        phone: phoneString,
        email: sanitizedString,
        address: sanitizedString,
    }).optional(),
    socialLinks: z.object({
        facebook: socialUrlString,
        instagram: socialUrlString,
        twitter: socialUrlString,
        linkedin: socialUrlString,
        youtube: socialUrlString,
        tiktok: socialUrlString,
    }).optional(),
    branding: z.object({
        logo: nullableString,
        favicon: nullableString,
    }).optional(),
    seo: z.object({
        metaTitle: nullableString,
        metaDescription: nullableString,
        ogImage: z.union([z.string(), z.number()]).nullable().optional(),
    }).optional(),
    shippingConfig: z.object({
        westRate: z.number().optional(),
        eastRate: z.number().optional(),
        freeAbove: z.number().nullable().optional(),
    }).optional(),
    isDraft: z.boolean().optional(),
}).refine(data => data.blocks !== undefined
    || data.theme !== undefined
    || data.locale !== undefined
    || data.shippingConfig !== undefined
    || data.headerBlock !== undefined
    || data.footerBlock !== undefined
    || data.siteName !== undefined
    || data.contactInfo !== undefined
    || data.socialLinks !== undefined
    || data.branding !== undefined
    || data.seo !== undefined
    || data.isDraft !== undefined, {
    message: 'At least one editable site field must be provided',
})
