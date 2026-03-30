import { describe, it, expect } from 'vitest'
import {
    createBlogSchema,
    updateBlogSchema,
    createCategorySchema,
    updateCategorySchema,
} from '@/lib/validations/blog'

// ─── TC-F17: Blog Management Validation ───────────────────────────────

describe('createBlogSchema [TC-F17]', () => {
    it('accepts valid blog post with title only', () => {
        const result = createBlogSchema.safeParse({ title: 'My First Post' })
        expect(result.success).toBe(true)
    })

    it('defaults status to draft when not provided', () => {
        const result = createBlogSchema.safeParse({ title: 'Draft Post' })
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.status).toBe('draft')
        }
    })

    it('accepts published status', () => {
        const result = createBlogSchema.safeParse({
            title: 'Published Post',
            status: 'published',
        })
        expect(result.success).toBe(true)
    })

    it('rejects empty title', () => {
        const result = createBlogSchema.safeParse({ title: '' })
        expect(result.success).toBe(false)
    })

    it('rejects title exceeding 200 characters', () => {
        const result = createBlogSchema.safeParse({ title: 'x'.repeat(201) })
        expect(result.success).toBe(false)
    })

    it('accepts title at exactly 200 characters', () => {
        const result = createBlogSchema.safeParse({ title: 'x'.repeat(200) })
        expect(result.success).toBe(true)
    })

    it('rejects invalid status enum', () => {
        const result = createBlogSchema.safeParse({ title: 'Post', status: 'archived' })
        expect(result.success).toBe(false)
    })

    it('accepts seo with metaTitle and metaDescription', () => {
        const result = createBlogSchema.safeParse({
            title: 'SEO Post',
            seo: {
                metaTitle: 'My SEO Title',
                metaDescription: 'A description for search engines',
            },
        })
        expect(result.success).toBe(true)
    })

    it('rejects seo.metaTitle exceeding 70 characters', () => {
        const result = createBlogSchema.safeParse({
            title: 'Post',
            seo: { metaTitle: 'x'.repeat(71) },
        })
        expect(result.success).toBe(false)
    })

    it('rejects seo.metaDescription exceeding 160 characters', () => {
        const result = createBlogSchema.safeParse({
            title: 'Post',
            seo: { metaDescription: 'x'.repeat(161) },
        })
        expect(result.success).toBe(false)
    })

    it('transforms category string to string', () => {
        const result = createBlogSchema.safeParse({
            title: 'Post',
            category: 'cat-1',
        })
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.category).toBe('cat-1')
        }
    })

    it('transforms category number to string', () => {
        const result = createBlogSchema.safeParse({
            title: 'Post',
            category: 42,
        })
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.category).toBe('42')
        }
    })

    it('accepts null category', () => {
        const result = createBlogSchema.safeParse({
            title: 'Post',
            category: null,
        })
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.category).toBeNull()
        }
    })
})

describe('updateBlogSchema [TC-F17]', () => {
    it('accepts empty object (all fields optional)', () => {
        const result = updateBlogSchema.safeParse({})
        expect(result.success).toBe(true)
    })

    it('accepts partial update with title only', () => {
        const result = updateBlogSchema.safeParse({ title: 'Updated Title' })
        expect(result.success).toBe(true)
    })

    it('accepts slug field', () => {
        const result = updateBlogSchema.safeParse({ slug: 'my-post-slug' })
        expect(result.success).toBe(true)
    })

    it('rejects title exceeding 200 characters', () => {
        const result = updateBlogSchema.safeParse({ title: 'x'.repeat(201) })
        expect(result.success).toBe(false)
    })

    it('rejects slug exceeding 200 characters', () => {
        const result = updateBlogSchema.safeParse({ slug: 'x'.repeat(201) })
        expect(result.success).toBe(false)
    })
})

describe('createCategorySchema [TC-F17]', () => {
    it('accepts valid category name', () => {
        const result = createCategorySchema.safeParse({ name: 'Technology' })
        expect(result.success).toBe(true)
    })

    it('rejects empty name', () => {
        const result = createCategorySchema.safeParse({ name: '' })
        expect(result.success).toBe(false)
    })

    it('rejects name exceeding 100 characters', () => {
        const result = createCategorySchema.safeParse({ name: 'x'.repeat(101) })
        expect(result.success).toBe(false)
    })

    it('accepts name at exactly 100 characters', () => {
        const result = createCategorySchema.safeParse({ name: 'x'.repeat(100) })
        expect(result.success).toBe(true)
    })
})

describe('updateCategorySchema [TC-F17]', () => {
    it('accepts empty object (name optional)', () => {
        const result = updateCategorySchema.safeParse({})
        expect(result.success).toBe(true)
    })

    it('accepts valid name update', () => {
        const result = updateCategorySchema.safeParse({ name: 'Updated Category' })
        expect(result.success).toBe(true)
    })

    it('rejects name exceeding 100 characters', () => {
        const result = updateCategorySchema.safeParse({ name: 'x'.repeat(101) })
        expect(result.success).toBe(false)
    })
})
