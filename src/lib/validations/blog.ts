import { z } from 'zod'

// --- Blog Post Schemas ---

export const createBlogSchema = z.object({
    title: z.string().min(1, 'Title is required').max(200),
    content: z.any().optional(),
    status: z.enum(['draft', 'published']).default('draft'),
    category: z.union([z.string(), z.number()]).transform(v => v ? String(v) : null).nullable().optional(),
    thumbnail: z.union([z.string(), z.number()]).transform(v => v ? String(v) : null).nullable().optional(),
    seo: z
        .object({
            metaTitle: z.string().max(70).optional(),
            metaDescription: z.string().max(160).optional(),
        })
        .optional(),
})

export const updateBlogSchema = z.object({
    title: z.string().min(1).max(200).optional(),
    slug: z.string().min(1).max(200).optional(),
    content: z.any().optional(),
    status: z.enum(['draft', 'published']).optional(),
    category: z.union([z.string(), z.number()]).transform(v => v ? String(v) : null).nullable().optional(),
    thumbnail: z.union([z.string(), z.number()]).transform(v => v ? String(v) : null).nullable().optional(),
    seo: z
        .object({
            metaTitle: z.string().max(70).optional(),
            metaDescription: z.string().max(160).optional(),
        })
        .optional(),
})

// --- Blog Category Schemas ---

export const createCategorySchema = z.object({
    name: z.string().min(1, 'Category name is required').max(100),
})

export const updateCategorySchema = z.object({
    name: z.string().min(1).max(100).optional(),
})

// Type exports
export type CreateBlogInput = z.infer<typeof createBlogSchema>
export type UpdateBlogInput = z.infer<typeof updateBlogSchema>
export type CreateCategoryInput = z.infer<typeof createCategorySchema>
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>
