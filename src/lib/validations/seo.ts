import { z } from 'zod'

export const seoAnalyzeSchema = z.object({
    siteId: z.string().min(1)
})

export const seoFixSchema = z.object({
    siteId: z.string().min(1)
})
