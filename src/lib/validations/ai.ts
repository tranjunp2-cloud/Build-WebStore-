import { z } from 'zod'

export const generateSiteSchema = z.object({
    businessInfo: z.object({
        businessName: z.string().min(1),
        industry: z.string().min(1),
        products: z.string().min(1),
        shortDescription: z.string().min(1),
    }),
    extraInstructions: z.string().optional(),
    language: z.enum(['en', 'ms', 'vi', 'auto']).optional(),
})

export const editBlockSchema = z.object({
    instruction: z.string().min(1),
    block: z.record(z.unknown()).nullable().optional(),
    blockIndex: z.number().nullable().optional(),
    allBlocks: z.array(z.record(z.unknown())).optional(),
    theme: z.record(z.unknown()).optional(),
    siteName: z.string().optional(),
})

export const rewriteTextSchema = z.object({
    text: z.string().min(1),
    instruction: z.string().min(1),
    context: z.string().optional(),
    language: z.string().optional(),
})

export const applyTemplateSchema = z.object({
    templateId: z.union([z.string().min(1), z.number()]).transform(String),
    siteId: z.union([z.string(), z.number()]).optional().transform((v) => v != null ? String(v) : undefined),
})
