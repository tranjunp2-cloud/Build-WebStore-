import { z } from 'zod'
import { BaseBlockSchema } from '../types'
import type { BlockMeta } from '../types'

export const BlogListConfigSchema = BaseBlockSchema.extend({
    showCategoryFilter: z.boolean().default(false),
    variant: z.enum(['cards', 'list']).default('cards'),
    headline: z.string().optional(),
    subheadline: z.string().optional(),
    limit: z.number().int().min(1).max(20).default(3),
    readArticleLabel: z.string().optional(),
    uncategorizedLabel: z.string().optional(),
    emptyStateLabel: z.string().optional(),
})

export type BlogListConfig = z.infer<typeof BlogListConfigSchema>

export const blogListMeta: BlockMeta = {
    type: 'blog-list',
    name: 'Blog List',
    description: 'Display recent blog posts or news articles.',
    icon: '📰',
    variants: ['cards', 'list'],
    defaultVariant: 'cards',
    editableFields: [
        'showCategoryFilter',
        'headline',
        'subheadline',
        'limit',
        'readArticleLabel',
        'uncategorizedLabel',
        'emptyStateLabel',
    ],
    quickActions: ['change-limit'],
    category: 'content' as const,
}

/** Canonical configSchema export for block-schema-registry.ts introspection */
export const configSchema = BlogListConfigSchema
