import { z } from 'zod'

export const saveSiteSchema = z.object({
    blocks: z.array(z.record(z.unknown())).optional(),
    theme: z.record(z.unknown()).optional(),
}).refine(data => data.blocks !== undefined || data.theme !== undefined, {
    message: 'At least blocks or theme must be provided',
})
