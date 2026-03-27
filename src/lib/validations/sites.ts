import { z } from 'zod'

const nullableString = z.string().nullable().optional()

export const saveSiteSchema = z.object({
    blocks: z.array(z.record(z.unknown())).optional(),
    headerBlock: z.record(z.unknown()).nullable().optional(),
    footerBlock: z.record(z.unknown()).nullable().optional(),
    theme: z.record(z.unknown()).optional(),
    siteName: z.string().min(1).optional(),
    locale: z.enum(['en', 'ms']).optional(),
    contactInfo: z.object({
        phone: nullableString,
        email: nullableString,
        address: nullableString,
    }).optional(),
    socialLinks: z.object({
        facebook: nullableString,
        instagram: nullableString,
        twitter: nullableString,
        linkedin: nullableString,
        youtube: nullableString,
        tiktok: nullableString,
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
    || data.seo !== undefined, {
    message: 'At least one editable site field must be provided',
})
