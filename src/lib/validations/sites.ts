import { z } from 'zod'
import { MY_STATES } from '@/lib/shipping/constants'
import {
    BUSINESS_CATEGORY_OPTIONS,
    DAY_OF_WEEK_OPTIONS,
    isCompatibleSchemaSubtype,
    isValidBusinessPhone,
    OPENING_HOURS_TIME_REGEX,
    PRICE_RANGE_OPTIONS,
    SCHEMA_SUBTYPE_OPTIONS,
} from '@/lib/seo/local-business-constants'
import { sanitizeLocalBusinessText } from '@/components/editor/local-business/normalization'

const nullableString = z.string().nullable().optional()

/** Strip all HTML tags to prevent XSS */
function stripHtml(input: string): string {
    return input.replace(/<[^>]*>/g, '')
}

/** Zod transform: strip HTML from nullable string fields */
const sanitizedString = z.string()
    .transform(v => stripHtml(v).trim())
    .nullable().optional()

/** Validate optional business phone using the same rule as the Editor. */
const phoneString = z.string()
    .refine(isValidBusinessPhone, 'Invalid phone number format')
    .transform(v => stripHtml(v).trim())
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

const MY_STATE_VALUES = MY_STATES as unknown as [string, ...string[]]
const BUSINESS_CATEGORY_VALUES = BUSINESS_CATEGORY_OPTIONS.map(o => o.value) as [string, ...string[]]
const PRICE_RANGE_VALUES = PRICE_RANGE_OPTIONS.map(o => o.value) as [string, ...string[]]
const DAY_OF_WEEK_VALUES = DAY_OF_WEEK_OPTIONS.map(o => o.value) as [string, ...string[]]
const localBusinessSanitizedString = z.string()
    .transform(sanitizeLocalBusinessText)
    .nullable().optional()
const SCHEMA_SUBTYPE_VALUES = SCHEMA_SUBTYPE_OPTIONS.map(o => o.value) as [string, ...string[]]

/** F37 US-01: structured local business address + hours (AC-3 validation) */
const localBusinessPatchSchema = z.object({
    streetAddress: localBusinessSanitizedString,
    city: localBusinessSanitizedString,
    state: z.enum(MY_STATE_VALUES).nullable().optional(),
    postcode: z.string()
        .transform(sanitizeLocalBusinessText)
        .pipe(z.string().regex(/^\d{5}$/, 'MY postcode must be 5 digits').or(z.literal('')))
        .nullable().optional(),
    country: localBusinessSanitizedString,
    latitude: z.number().min(-90, 'Latitude must be between -90 and 90').max(90, 'Latitude must be between -90 and 90').nullable().optional(),
    longitude: z.number().min(-180, 'Longitude must be between -180 and 180').max(180, 'Longitude must be between -180 and 180').nullable().optional(),
    businessCategory: z.enum(BUSINESS_CATEGORY_VALUES).nullable().optional(),
    schemaSubtype: z.enum(SCHEMA_SUBTYPE_VALUES).nullable().optional(),
    priceRange: z.enum(PRICE_RANGE_VALUES).nullable().optional(),
    serviceAreaDescription: localBusinessSanitizedString,
    openingHours: z.array(z.object({
        dayOfWeek: z.enum(DAY_OF_WEEK_VALUES).nullable().optional(),
        opens: z.string().transform(sanitizeLocalBusinessText).pipe(z.string().regex(OPENING_HOURS_TIME_REGEX).or(z.literal(''))).optional(),
        closes: z.string().transform(sanitizeLocalBusinessText).pipe(z.string().regex(OPENING_HOURS_TIME_REGEX).or(z.literal(''))).optional(),
        isClosed: z.boolean().optional(),
    }).superRefine((row, ctx) => {
        if (row.isClosed) return
        if (!row.opens) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Opening time is required unless the day is marked closed',
                path: ['opens'],
            })
        }
        if (!row.closes) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Closing time is required unless the day is marked closed',
                path: ['closes'],
            })
        }
        if (!row.opens || !row.closes) return
        if (row.closes <= row.opens) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Closing time must be after opening time (overnight hours are not supported)',
                path: ['closes'],
            })
        }
    })).max(21).optional(), // 7 days × up to 3 shifts (split-shift)
})

function validateSchemaSubtypePair(
    value: { businessCategory?: string | null; schemaSubtype?: string | null },
    ctx: z.RefinementCtx,
    path: Array<string | number> = ['schemaSubtype'],
) {
    if (!value.schemaSubtype) return
    if (isCompatibleSchemaSubtype(value.businessCategory, value.schemaSubtype)) return
    ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Schema subtype is not compatible with the selected business category',
        path,
    })
}

export const localBusinessSchema = localBusinessPatchSchema.superRefine(validateSchemaSubtypePair)

export const saveSiteSchema = z.object({
    blocks: z.array(z.record(z.unknown())).optional(),
    headerBlock: z.record(z.unknown()).nullable().optional(),
    footerBlock: z.record(z.unknown()).nullable().optional(),
    globalBlocks: z.object({
        cartWidget: z.object({ blockType: z.literal('cartWidget') }).passthrough().nullable().optional(),
        whatsappButton: z.object({ blockType: z.literal('whatsapp-button') }).passthrough().nullable().optional(),
        socialWidget: z.object({ blockType: z.literal('socialWidget') }).passthrough().nullable().optional(),
    }).nullable().optional(),
    theme: z.record(z.unknown()).optional(),
    siteName: z.string().min(1).max(200).transform(v => stripHtml(v).trim()).optional(),
    locale: z.enum(['en', 'ms']).optional(),
    contactInfo: z.object({
        phone: phoneString,
        email: sanitizedString,
        address: sanitizedString,
    }).optional(),
    localBusiness: localBusinessPatchSchema.optional(),
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
        westRate: z.number().min(0).max(100_000).optional(),
        eastRate: z.number().min(0).max(100_000).optional(),
        freeAbove: z.number().min(1).max(10_000_000).nullable().optional(),
    }).optional(),
    isDraft: z.boolean().optional(),
    /** F-26: Per-block locale content map — persisted to pages.locale_content */
    localeContent: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
    /** F26-01: Clear pendingLocaleConfirm flag after user confirms/dismisses dialog */
    pendingLocaleConfirm: z.boolean().optional(),
}).superRefine((value, ctx) => {
    const localBusiness = value.localBusiness
    if (!localBusiness || localBusiness.schemaSubtype === undefined || localBusiness.businessCategory === undefined) return
    validateSchemaSubtypePair(localBusiness, ctx, ['localBusiness', 'schemaSubtype'])
}).refine(data => data.blocks !== undefined
    || data.theme !== undefined
    || data.locale !== undefined
    || data.shippingConfig !== undefined
    || data.headerBlock !== undefined
    || data.footerBlock !== undefined
    || data.globalBlocks !== undefined
    || data.siteName !== undefined
    || data.contactInfo !== undefined
    || data.localBusiness !== undefined
    || data.socialLinks !== undefined
    || data.branding !== undefined
    || data.seo !== undefined
    || data.isDraft !== undefined
    || data.localeContent !== undefined
    || data.pendingLocaleConfirm !== undefined, {
    message: 'At least one editable site field must be provided',
})
