import { z } from 'zod'

// --- Blog Post Schemas ---

export const createBlogSchema = z.object({
    title: z.string().min(1, 'Title is required').max(200),
    content: z.any().optional(),
    status: z.enum(['draft', 'published']).default('draft'),
    category: z.string().optional(),
    thumbnail: z.string().optional(),
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
    category: z.string().nullable().optional(),
    thumbnail: z.string().nullable().optional(),
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
