import { z } from 'zod'

export const saveSiteSchema = z.object({
    blocks: z.array(z.record(z.unknown())).optional(),
    theme: z.record(z.unknown()).optional(),
    locale: z.enum(['en', 'ms']).optional(),
    shippingConfig: z.object({
        westRate: z.number().optional(),
        eastRate: z.number().optional(),
        freeAbove: z.number().nullable().optional(),
    }).optional(),
}).refine(data => data.blocks !== undefined || data.theme !== undefined || data.locale !== undefined || data.shippingConfig !== undefined, {
    message: 'At least one field (blocks, theme, locale, or shippingConfig) must be provided',
})
